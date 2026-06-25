export const SOCIAL_POST_CHARACTER_CLASSIFIER_VERSION =
  "social_character_gate_v1_llm";

export const SOCIAL_POST_CHARACTER_VALUES = [
  "emotional_essay",
  "personal_miscellany",
  "militant_declaration",
  "gratitude_reflection",
  "policy_explainer",
  "field_note",
  "campaign_mobilization",
  "satirical_short_comment",
  "argument_reply",
  "quote_commentary",
  "notice_or_resource",
  "memorial_note",
  "media_dependent",
  "mixed_other",
] as const;

export const SOCIAL_POST_TONE_VALUES = [
  "warm",
  "cold",
  "critical_logical",
  "emotional",
  "urgent",
  "wry",
  "solemn",
  "matter_of_fact",
] as const;

export const SOCIAL_POST_CONTEXT_DEPENDENCY_VALUES = [
  "needs_media",
  "needs_parent",
  "needs_quote",
  "standalone",
] as const;

export const SOCIAL_POST_PUBLICNESS_VALUES = [
  "campaign",
  "personal_public",
  "private_like",
  "public_issue",
] as const;

export type SocialPostCharacter =
  (typeof SOCIAL_POST_CHARACTER_VALUES)[number];

export type SocialPostTone = (typeof SOCIAL_POST_TONE_VALUES)[number];

export type SocialPostContextDependency =
  (typeof SOCIAL_POST_CONTEXT_DEPENDENCY_VALUES)[number];

export type SocialPostPublicness =
  (typeof SOCIAL_POST_PUBLICNESS_VALUES)[number];

export type SocialPostCharacterDecision = {
  classifierVersion: string;
  confidence: number;
  contextDependency: SocialPostContextDependency;
  modelName: string;
  primaryCharacter: SocialPostCharacter;
  publicness: SocialPostPublicness;
  rawOutput: Record<string, unknown>;
  reason: string;
  secondaryCharacters: SocialPostCharacter[];
  tone: SocialPostTone;
};

export type SocialPostCharacterInput = {
  attachments?: unknown;
  authorName?: string;
  authorUsername?: string;
  links?: unknown;
  parentContext?: unknown;
  platformPostId?: string;
  postType: string;
  quoteContext?: unknown;
  sourceUrl?: string;
  text: string;
};

export type SocialPostCharacterLlmOutput = {
  confidence: number;
  context_dependency: SocialPostContextDependency;
  evidence: string[];
  primary_character: SocialPostCharacter;
  publicness: SocialPostPublicness;
  reason: string;
  secondary_characters: SocialPostCharacter[];
  tone: SocialPostTone;
};

export const SOCIAL_POST_CHARACTER_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "primary_character",
    "secondary_characters",
    "tone",
    "context_dependency",
    "publicness",
    "confidence",
    "reason",
    "evidence",
  ],
  properties: {
    primary_character: {
      type: "string",
      enum: SOCIAL_POST_CHARACTER_VALUES,
    },
    secondary_characters: {
      type: "array",
      items: {
        type: "string",
        enum: SOCIAL_POST_CHARACTER_VALUES,
      },
    },
    tone: {
      type: "string",
      enum: SOCIAL_POST_TONE_VALUES,
    },
    context_dependency: {
      type: "string",
      enum: SOCIAL_POST_CONTEXT_DEPENDENCY_VALUES,
    },
    publicness: {
      type: "string",
      enum: SOCIAL_POST_PUBLICNESS_VALUES,
    },
    confidence: {
      type: "number",
      minimum: 0,
      maximum: 1,
    },
    reason: { type: "string" },
    evidence: {
      type: "array",
      items: { type: "string" },
    },
  },
} as const;

export function buildSocialPostCharacterPrompt(input: SocialPostCharacterInput) {
  return [
    "너는 Moong의 X 게시글 성격 gate다.",
    "",
    "목표:",
    "- 좋아요 기준을 넘었거나 넘을 수 있는 공개 X 게시글을 데이터상 보이는 큰 덩어리로 나눈다.",
    "- 여기서 성격은 주제나 첨부 형식이 아니라 글의 사회적 기능과 말하기 방식이다.",
    "- 예: 감성적인 에세이, 신변잡기적인 이야기, 투쟁적인 선언, 정책 설명, 현장 기록, 풍자적 촌평.",
    "- 어조도 별도 축으로 판단한다. 예: 따뜻한 어조, 차가운 어조, 비판적/논리적 어조, 감성적 어조.",
    "",
    "primary_character 기준:",
    "- emotional_essay: 삶, 기억, 감정, 서사, 가치 언어로 독자를 설득하는 에세이형 글.",
    "- personal_miscellany: 식사, 가족, 친구, 일상 해프닝, 가벼운 신변잡기.",
    "- militant_declaration: 규탄, 촉구, 요구, 반대, 투쟁, 책임 추궁이 중심인 선언.",
    "- gratitude_reflection: 감사, 사과, 선거 결과 소회, 지지자에게 보내는 회고.",
    "- policy_explainer: 정책, 공약, 제도, 법안, 예산, 구조를 설명하거나 설득하는 글.",
    "- field_note: 방문, 집회, 기자회견, 간담회, 유세, 현장 활동을 기록하는 글.",
    "- campaign_mobilization: 투표, 후원, 추천, 유세 참여, 선거 행동을 직접 독려하는 글.",
    "- satirical_short_comment: 풍자, 드립, 냉소, 짧은 촌평이 중심인 글.",
    "- argument_reply: 답글 맥락에서 반박, 논쟁, 설명, 대화가 중심인 글.",
    "- quote_commentary: 인용한 글에 대한 짧은 반응, 해설, 평가가 중심인 글.",
    "- notice_or_resource: 링크, 영상, 자료, 공지, 다시보기, 행사 정보를 전달하는 것이 중심인 글.",
    "- memorial_note: 추모, 애도, 기억, 참배가 중심인 글.",
    "- media_dependent: 사진/영상이 없으면 글의 핵심 의미가 성립하지 않는 글.",
    "- mixed_other: 위 범주로 안정적으로 묶기 어려운 혼합형.",
    "",
    "tone 기준:",
    "- warm: 감사, 격려, 위로, 연대감처럼 따뜻하게 말을 건다.",
    "- cold: 감정보다 거리두기, 건조한 사실 전달, 차분한 정리가 두드러진다.",
    "- critical_logical: 비판하되 논리, 근거, 구조, 반박의 형태가 강하다.",
    "- emotional: 슬픔, 분노, 벅참, 고통, 희망 등 정서 호소가 강하다.",
    "- urgent: 지금 행동해야 한다는 압박, 경고, 긴급성이 강하다.",
    "- wry: 풍자, 농담, 비꼼, 어이없음, 가벼운 조소가 강하다.",
    "- solemn: 추모, 애도, 엄숙함이 강하다.",
    "- matter_of_fact: 특별한 정서 색이 약하고 중립적인 안내/보고에 가깝다.",
    "",
    "판단 규칙:",
    "- post_type은 참고만 한다. quote 글도 정책 설명이나 투쟁 선언일 수 있고, reply 글도 감성 에세이일 수 있다.",
    "- 링크가 있다는 이유만으로 notice_or_resource로 두지 않는다. 글의 중심 기능이 자료/공지 전달일 때만 그렇게 둔다.",
    "- 이미지가 있다는 이유만으로 media_dependent로 두지 않는다. 본문만으로 의미가 약할 때만 그렇게 둔다.",
    "- primary_character는 하나만 고르고, 함께 강하게 보이는 덩어리는 secondary_characters에 0~4개 넣는다.",
    "- reason은 사람이 ops에서 빠르게 검토할 수 있게 한국어 한 문장으로 쓴다.",
    "- evidence는 원문 또는 맥락에서 판단에 직접 쓴 짧은 구절만 넣는다.",
    "",
    "게시글 메타:",
    JSON.stringify(
      {
        author_name: input.authorName ?? null,
        author_username: input.authorUsername ?? null,
        platform_post_id: input.platformPostId ?? null,
        post_type: input.postType,
        source_url: input.sourceUrl ?? null,
      },
      null,
      2,
    ),
    "",
    "본문:",
    truncateForPrompt(input.text, 4000),
    "",
    "부모 답글 맥락:",
    JSON.stringify(input.parentContext ?? null, null, 2),
    "",
    "인용 원문 맥락:",
    JSON.stringify(input.quoteContext ?? null, null, 2),
    "",
    "첨부/링크 요약:",
    JSON.stringify(
      {
        attachments: summarizeAttachments(input.attachments),
        links: summarizeLinks(input.links),
      },
      null,
      2,
    ),
  ].join("\n");
}

export function sanitizeSocialPostCharacterOutput({
  modelName,
  output,
}: {
  modelName: string;
  output: Partial<SocialPostCharacterLlmOutput>;
}): SocialPostCharacterDecision {
  const primaryCharacter = normalizeEnum(
    output.primary_character,
    SOCIAL_POST_CHARACTER_VALUES,
    "mixed_other",
  );
  const secondaryCharacters = normalizeEnumArray(
    output.secondary_characters,
    SOCIAL_POST_CHARACTER_VALUES,
  ).filter((character) => character !== primaryCharacter);
  const tone = normalizeEnum(
    output.tone,
    SOCIAL_POST_TONE_VALUES,
    "matter_of_fact",
  );
  const contextDependency = normalizeEnum(
    output.context_dependency,
    SOCIAL_POST_CONTEXT_DEPENDENCY_VALUES,
    "standalone",
  );
  const publicness = normalizeEnum(
    output.publicness,
    SOCIAL_POST_PUBLICNESS_VALUES,
    "public_issue",
  );
  const evidence = Array.isArray(output.evidence)
    ? output.evidence.filter((item): item is string => typeof item === "string")
    : [];

  return {
    classifierVersion: SOCIAL_POST_CHARACTER_CLASSIFIER_VERSION,
    confidence: clampNumber(output.confidence, 0, 1),
    contextDependency,
    modelName,
    primaryCharacter,
    publicness,
    rawOutput: {
      ...output,
      evidence,
      model_name: modelName,
      prompt_version: SOCIAL_POST_CHARACTER_CLASSIFIER_VERSION,
    },
    reason:
      typeof output.reason === "string" && output.reason.trim()
        ? output.reason.trim()
        : "LLM gate가 큰 성격 덩어리를 판정했습니다.",
    secondaryCharacters: Array.from(new Set(secondaryCharacters)).slice(0, 4),
    tone,
  };
}

function normalizeEnum<T extends string>(
  value: unknown,
  values: readonly T[],
  fallback: T,
) {
  return typeof value === "string" && values.includes(value as T)
    ? (value as T)
    : fallback;
}

function normalizeEnumArray<T extends string>(value: unknown, values: readonly T[]) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(
    (item): item is T => typeof item === "string" && values.includes(item as T),
  );
}

function clampNumber(value: unknown, min: number, max: number) {
  const numberValue = typeof value === "number" ? value : Number(value);

  if (!Number.isFinite(numberValue)) {
    return min;
  }

  return Math.min(Math.max(numberValue, min), max);
}

function summarizeAttachments(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.slice(0, 8).map((attachment) => {
    if (!attachment || typeof attachment !== "object") {
      return attachment;
    }

    return {
      altText: readObjectString(attachment, "altText"),
      height: readObjectNumber(attachment, "height"),
      type: readObjectString(attachment, "type"),
      width: readObjectNumber(attachment, "width"),
    };
  });
}

function summarizeLinks(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.slice(0, 8).map((link) => {
    if (!link || typeof link !== "object") {
      return link;
    }

    return {
      description: readObjectString(link, "description"),
      displayUrl: readObjectString(link, "displayUrl"),
      expandedUrl: readObjectString(link, "expandedUrl"),
      title: readObjectString(link, "title"),
    };
  });
}

function readObjectString(value: object, key: string) {
  return key in value && typeof value[key as keyof typeof value] === "string"
    ? (value[key as keyof typeof value] as string)
    : null;
}

function readObjectNumber(value: object, key: string) {
  return key in value && typeof value[key as keyof typeof value] === "number"
    ? (value[key as keyof typeof value] as number)
    : null;
}

function truncateForPrompt(value: string, maxChars: number) {
  if (value.length <= maxChars) {
    return value;
  }

  return `${value.slice(0, maxChars)}...`;
}
