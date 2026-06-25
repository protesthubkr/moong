import { readStringEnv } from "@/lib/env";
import { SOCIAL_POST_CHARACTER_CLASSIFIER_VERSION } from "./character-gate";
import { getRecommendedSincerityRuleDecision } from "./sincerity-rule";

export const DEFAULT_PUBLIC_FEED_SOURCE_KEYS = [
  "hongjenam",
  "nasaram2017",
  "fighthatebydata",
  "jaeyeon80",
  "junggu_",
  "sanghyun_green",
  "janghyeyeong",
  "sonsol_jinbo",
];

export type PublicFeedCharacterDecisionRow = {
  classifier_version?: string | null;
  primary_character?: string | null;
  secondary_characters?: string[] | null;
};

export function getPublicFeedSourceKeys() {
  const raw = readStringEnv(
    "MOONG_PUBLIC_SOURCE_KEYS",
    DEFAULT_PUBLIC_FEED_SOURCE_KEYS.join(","),
  );

  return Array.from(
    new Set(
      raw
        .split(",")
        .map((key) => key.trim().replace(/^@/, "").toLowerCase())
        .filter(Boolean),
    ),
  );
}

export function shouldExposeByPublicFeedCharacterPolicy(
  decision: PublicFeedCharacterDecisionRow | null,
) {
  if (
    !decision ||
    decision.classifier_version !== SOCIAL_POST_CHARACTER_CLASSIFIER_VERSION
  ) {
    return false;
  }

  return getRecommendedSincerityRuleDecision({
    primaryCharacter: decision.primary_character ?? "",
    secondaryCharacters: Array.isArray(decision.secondary_characters)
      ? decision.secondary_characters
      : [],
  }).passes;
}
