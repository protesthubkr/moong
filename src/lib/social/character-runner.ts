import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { getRequiredSupabaseAdminClient } from "@/lib/supabase-admin";
import {
  SOCIAL_POST_CHARACTER_CLASSIFIER_VERSION,
  type SocialPostCharacter,
  type SocialPostCharacterDecision,
} from "./character-gate";
import {
  getSocialPostCharacterGateConcurrency,
  getSocialPostCharacterGateLimit,
} from "./character-config";
import { runSocialPostCharacterGateWithLlm } from "./character-openai";
import { createScanRun, finishScanRun } from "./repository";

export type CharacterGateOptions = {
  concurrency?: number;
  dryRun?: boolean;
  force?: boolean;
  limit?: number;
  sourceKey?: string;
  statuses?: string[];
};

export type CharacterGateSample = {
  authorUsername: string;
  confidence: number;
  modelName: string;
  platformPostId: string;
  primaryCharacter: SocialPostCharacter;
  reason: string;
  secondaryCharacters: SocialPostCharacter[];
  sourceUrl: string;
  text: string;
};

export type CharacterGateResult = {
  byCharacter: Partial<Record<SocialPostCharacter, number>>;
  candidatesSeen: number;
  classifierVersion: string;
  concurrency: number;
  decisionsEvaluated: number;
  decisionsWritten: number;
  dryRun: boolean;
  force: boolean;
  rowsFetched: number;
  samples: CharacterGateSample[];
  skippedCurrentVersion: number;
  statuses: VisibilityStatus[];
  truncatedByFetchWindow: boolean;
};

type VisibilityStatus = "archived" | "promoted" | "tracking";

type CharacterCandidateRow = {
  attachments: unknown;
  author_name: string;
  author_username: string;
  id: string;
  links: unknown;
  parent_context: unknown;
  platform_post_id: string;
  post_type: string;
  quote_context: unknown;
  source_key: string;
  source_url: string;
  social_post_character_decisions?:
    | CharacterDecisionVersionRow
    | CharacterDecisionVersionRow[]
    | null;
  social_sources?: JoinedSocialSourceRow | JoinedSocialSourceRow[] | null;
  text_snapshot: string;
  visibility_status: string;
};

type CharacterDecisionVersionRow = {
  classifier_version?: string | null;
};

type JoinedSocialSourceRow = {
  enabled?: boolean | null;
  is_following?: boolean | null;
  is_protected?: boolean | null;
};

const DEFAULT_CHARACTER_GATE_STATUSES: VisibilityStatus[] = [
  "promoted",
  "tracking",
  "archived",
];

const MAX_CHARACTER_GATE_CONCURRENCY = 8;
const MAX_CHARACTER_GATE_LIMIT = 500;
const CHARACTER_CANDIDATE_SELECT = [
  "id",
  "platform_post_id",
  "source_key",
  "author_username",
  "author_name",
  "source_url",
  "text_snapshot",
  "post_type",
  "parent_context",
  "quote_context",
  "attachments",
  "links",
  "visibility_status",
  "social_sources!inner(enabled,is_following,is_protected)",
  "social_post_character_decisions(classifier_version)",
].join(",");

export async function runSocialPostCharacterGate(
  options: CharacterGateOptions = {},
): Promise<CharacterGateResult> {
  const dryRun = options.dryRun ?? false;
  const force = options.force ?? false;
  const limit = clampInteger(
    options.limit ?? getSocialPostCharacterGateLimit(),
    1,
    MAX_CHARACTER_GATE_LIMIT,
  );
  const concurrency = clampInteger(
    options.concurrency ?? getSocialPostCharacterGateConcurrency(),
    1,
    MAX_CHARACTER_GATE_CONCURRENCY,
  );
  const statuses = normalizeStatuses(options.statuses);
  const supabase = getRequiredSupabaseAdminClient();
  const result: CharacterGateResult = {
    byCharacter: {},
    candidatesSeen: 0,
    classifierVersion: SOCIAL_POST_CHARACTER_CLASSIFIER_VERSION,
    concurrency,
    decisionsEvaluated: 0,
    decisionsWritten: 0,
    dryRun,
    force,
    rowsFetched: 0,
    samples: [],
    skippedCurrentVersion: 0,
    statuses,
    truncatedByFetchWindow: false,
  };
  const scanRunId = await createScanRun({
    dryRun,
    options: {
      ...options,
      classifierVersion: SOCIAL_POST_CHARACTER_CLASSIFIER_VERSION,
      concurrency,
      statuses,
    },
    platform: "x",
    runType: "character_gate",
    supabase,
  });

  try {
    const candidateResult = await getSocialPostCharacterCandidates({
      force,
      limit,
      sourceKey: options.sourceKey,
      statuses,
      supabase,
    });
    result.rowsFetched = candidateResult.rowsFetched;
    result.skippedCurrentVersion = candidateResult.skippedCurrentVersion;
    result.truncatedByFetchWindow = candidateResult.truncatedByFetchWindow;
    result.candidatesSeen = candidateResult.candidates.length;

    await runWithConcurrency(candidateResult.candidates, concurrency, async (candidate) => {
      const decision = await classifyCandidate(candidate);

      result.decisionsEvaluated += 1;
      result.byCharacter[decision.primaryCharacter] =
        (result.byCharacter[decision.primaryCharacter] ?? 0) + 1;

      if (result.samples.length < 20) {
        result.samples.push({
          authorUsername: candidate.author_username,
          confidence: decision.confidence,
          modelName: decision.modelName,
          platformPostId: candidate.platform_post_id,
          primaryCharacter: decision.primaryCharacter,
          reason: decision.reason,
          secondaryCharacters: decision.secondaryCharacters,
          sourceUrl: candidate.source_url,
          text: candidate.text_snapshot,
        });
      }

      if (!dryRun) {
        await upsertSocialPostCharacterDecision({
          decision,
          postId: candidate.id,
          supabase,
        });
        result.decisionsWritten += 1;
      }
    });

    await finishScanRun({
      counters: {
        postsSeen: result.decisionsEvaluated,
        postsWritten: result.decisionsWritten,
      },
      scanRunId,
      status: "succeeded",
      supabase,
    });

    return result;
  } catch (error) {
    await finishScanRun({
      counters: {
        errorMessage: error instanceof Error ? error.message : String(error),
        postsSeen: result.decisionsEvaluated,
        postsWritten: result.decisionsWritten,
      },
      scanRunId,
      status: "failed",
      supabase,
    });

    throw error;
  }
}

async function getSocialPostCharacterCandidates({
  force,
  limit,
  sourceKey,
  statuses,
  supabase,
}: {
  force: boolean;
  limit: number;
  sourceKey?: string;
  statuses: VisibilityStatus[];
  supabase: SupabaseClient;
}) {
  const fetchLimit = Math.min(Math.max(limit * 10, limit), 5000);
  let query = supabase
    .from("social_posts")
    .select(CHARACTER_CANDIDATE_SELECT)
    .eq("platform", "x")
    .in("visibility_status", statuses)
    .eq("social_sources.enabled", true)
    .eq("social_sources.is_following", true)
    .eq("social_sources.is_protected", false)
    .order("posted_at", { ascending: false, nullsFirst: false })
    .limit(fetchLimit);

  if (sourceKey) {
    query = query.eq("source_key", sourceKey.replace(/^@/, "").toLowerCase());
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  const rows = (data ?? []) as unknown as CharacterCandidateRow[];
  const filtered = rows.filter(
    (row) => force || !hasCurrentCharacterDecision(row),
  );
  const candidates = filtered.slice(0, limit);

  return {
    candidates,
    rowsFetched: rows.length,
    skippedCurrentVersion: rows.length - filtered.length,
    truncatedByFetchWindow: rows.length === fetchLimit,
  };
}

async function classifyCandidate(candidate: CharacterCandidateRow) {
  return runSocialPostCharacterGateWithLlm({
    attachments: candidate.attachments,
    authorName: candidate.author_name,
    authorUsername: candidate.author_username,
    links: candidate.links,
    parentContext: candidate.parent_context,
    platformPostId: candidate.platform_post_id,
    postType: candidate.post_type,
    quoteContext: candidate.quote_context,
    sourceUrl: candidate.source_url,
    text: candidate.text_snapshot,
  });
}

async function runWithConcurrency<T>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<void>,
) {
  let failure: unknown = null;
  let nextIndex = 0;

  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    async () => {
      while (!failure && nextIndex < items.length) {
        const item = items[nextIndex];
        nextIndex += 1;

        try {
          await worker(item);
        } catch (error) {
          failure ??= error;
        }
      }
    },
  );

  await Promise.all(workers);

  if (failure) {
    throw failure;
  }
}

async function upsertSocialPostCharacterDecision({
  decision,
  postId,
  supabase,
}: {
  decision: SocialPostCharacterDecision;
  postId: string;
  supabase: SupabaseClient;
}) {
  const { error } = await supabase
    .from("social_post_character_decisions")
    .upsert(
      {
        classifier_version: decision.classifierVersion,
        confidence: decision.confidence,
        context_dependency: decision.contextDependency,
        model_name: decision.modelName,
        post_id: postId,
        primary_character: decision.primaryCharacter,
        publicness: decision.publicness,
        raw_output: decision.rawOutput,
        reason: decision.reason,
        secondary_characters: decision.secondaryCharacters,
        tone: decision.tone,
      },
      { onConflict: "post_id" },
    );

  if (error) {
    throw new Error(error.message);
  }
}

function hasCurrentCharacterDecision(row: CharacterCandidateRow) {
  const decisions = Array.isArray(row.social_post_character_decisions)
    ? row.social_post_character_decisions
    : row.social_post_character_decisions
      ? [row.social_post_character_decisions]
      : [];

  return decisions.some(
    (decision) =>
      decision.classifier_version === SOCIAL_POST_CHARACTER_CLASSIFIER_VERSION,
  );
}

function normalizeStatuses(values: string[] | undefined) {
  const allowed = new Set<VisibilityStatus>(DEFAULT_CHARACTER_GATE_STATUSES);
  const normalized = (values ?? [])
    .map((status) => status.trim().toLowerCase())
    .filter((status): status is VisibilityStatus =>
      allowed.has(status as VisibilityStatus),
    );

  return normalized.length > 0
    ? Array.from(new Set(normalized))
    : DEFAULT_CHARACTER_GATE_STATUSES;
}

function clampInteger(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) {
    return min;
  }

  return Math.min(Math.max(Math.trunc(value), min), max);
}
