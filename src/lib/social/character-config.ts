import { readIntegerEnv, readStringEnv } from "@/lib/env";

export const SOCIAL_POST_CHARACTER_REASONING_ENV_KEY =
  "OPENAI_MOONG_CHARACTER_GATE_REASONING_EFFORT";

export function getSocialPostCharacterGateModel() {
  return readStringEnv(
    "OPENAI_MOONG_CHARACTER_GATE_MODEL",
    readStringEnv("OPENAI_SOCIAL_CHARACTER_GATE_MODEL", "gpt-5-mini"),
  );
}

export function getSocialPostCharacterGateFallbackModels() {
  return [
    "OPENAI_MOONG_CHARACTER_GATE_FALLBACK_MODELS",
    "OPENAI_SOCIAL_CHARACTER_GATE_FALLBACK_MODELS",
  ];
}

export function getSocialPostCharacterGateLimit() {
  return readIntegerEnv("MOONG_SOCIAL_CHARACTER_GATE_LIMIT", {
    defaultValue: 100,
    max: 500,
    min: 1,
  });
}

export function getSocialPostCharacterGateConcurrency() {
  return readIntegerEnv("MOONG_SOCIAL_CHARACTER_GATE_CONCURRENCY", {
    defaultValue: 4,
    max: 8,
    min: 1,
  });
}

export function getSocialPostCharacterGateMaxOutputTokens() {
  return readIntegerEnv("OPENAI_MOONG_CHARACTER_GATE_MAX_OUTPUT_TOKENS", {
    defaultValue: 1200,
    max: 4000,
    min: 400,
  });
}

export function getSocialPostCharacterGateDefaultReasoningEffort() {
  return "low";
}
