import type { SocialPostCharacter } from "./character-gate";

export const SOCIAL_SINCERITY_RULE_VERSION =
  "recommended_sincerity_rule_v1";

const ALWAYS_PASS_PRIMARY_CHARACTERS = new Set<SocialPostCharacter>([
  "emotional_essay",
  "field_note",
  "gratitude_reflection",
  "memorial_note",
  "policy_explainer",
]);

const CONDITIONAL_PRIMARY_CHARACTERS = new Set<SocialPostCharacter>([
  "campaign_mobilization",
  "militant_declaration",
]);

const SINCERITY_BOOSTING_SECONDARY_CHARACTERS = new Set<SocialPostCharacter>([
  "argument_reply",
  "campaign_mobilization",
  "emotional_essay",
  "field_note",
  "gratitude_reflection",
  "notice_or_resource",
  "policy_explainer",
]);

export type SocialSincerityRuleDecision = {
  passes: boolean;
  reason:
    | "always_pass_primary"
    | "conditional_primary_with_boosting_secondary"
    | "excluded_by_rule";
  ruleVersion: typeof SOCIAL_SINCERITY_RULE_VERSION;
};

export function getRecommendedSincerityRuleDecision({
  primaryCharacter,
  secondaryCharacters,
}: {
  primaryCharacter: string;
  secondaryCharacters: string[];
}): SocialSincerityRuleDecision {
  if (isSocialPostCharacter(primaryCharacter)) {
    if (ALWAYS_PASS_PRIMARY_CHARACTERS.has(primaryCharacter)) {
      return {
        passes: true,
        reason: "always_pass_primary",
        ruleVersion: SOCIAL_SINCERITY_RULE_VERSION,
      };
    }

    if (
      CONDITIONAL_PRIMARY_CHARACTERS.has(primaryCharacter) &&
      secondaryCharacters.some(
        (character) =>
          isSocialPostCharacter(character) &&
          SINCERITY_BOOSTING_SECONDARY_CHARACTERS.has(character),
      )
    ) {
      return {
        passes: true,
        reason: "conditional_primary_with_boosting_secondary",
        ruleVersion: SOCIAL_SINCERITY_RULE_VERSION,
      };
    }
  }

  return {
    passes: false,
    reason: "excluded_by_rule",
    ruleVersion: SOCIAL_SINCERITY_RULE_VERSION,
  };
}

export function isRecommendedSincerityCandidate(input: {
  primaryCharacter: string;
  secondaryCharacters: string[];
}) {
  return getRecommendedSincerityRuleDecision(input).passes;
}

function isSocialPostCharacter(value: string): value is SocialPostCharacter {
  return (
    value === "argument_reply" ||
    value === "campaign_mobilization" ||
    value === "emotional_essay" ||
    value === "field_note" ||
    value === "gratitude_reflection" ||
    value === "media_dependent" ||
    value === "memorial_note" ||
    value === "militant_declaration" ||
    value === "mixed_other" ||
    value === "notice_or_resource" ||
    value === "personal_miscellany" ||
    value === "policy_explainer" ||
    value === "quote_commentary" ||
    value === "satirical_short_comment"
  );
}
