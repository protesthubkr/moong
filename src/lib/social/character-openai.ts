import "server-only";

import {
  getLlmModelFallbackList,
  runLlmWithFallback,
} from "@/lib/llm/attempt-fallback";
import {
  parseResponsesJsonObject,
  readResponsesOutputText,
} from "@/lib/llm/responses-output";
import { getReasoningRequestOptions } from "@/lib/llm/structured-event-config";
import {
  getSocialPostCharacterGateDefaultReasoningEffort,
  getSocialPostCharacterGateFallbackModels,
  getSocialPostCharacterGateMaxOutputTokens,
  getSocialPostCharacterGateModel,
  SOCIAL_POST_CHARACTER_REASONING_ENV_KEY,
} from "./character-config";
import {
  buildSocialPostCharacterPrompt,
  sanitizeSocialPostCharacterOutput,
  SOCIAL_POST_CHARACTER_SCHEMA,
  type SocialPostCharacterLlmOutput,
  type SocialPostCharacterDecision,
  type SocialPostCharacterInput,
} from "./character-gate";

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";

export async function runSocialPostCharacterGateWithLlm(
  input: SocialPostCharacterInput,
): Promise<SocialPostCharacterDecision> {
  const primaryModel = getSocialPostCharacterGateModel();
  const prompt = buildSocialPostCharacterPrompt(input);
  const result = await runLlmWithFallback({
    models: getLlmModelFallbackList({
      fallbackEnvKeys: getSocialPostCharacterGateFallbackModels(),
      primaryModel,
    }),
    operation: "social_post_character_gate",
    run: async (model) =>
      sanitizeSocialPostCharacterOutput({
        modelName: model,
        output: await requestSocialPostCharacterOutput({
          model,
          prompt,
        }),
      }),
  });

  return result.value;
}

async function requestSocialPostCharacterOutput({
  model,
  prompt,
}: {
  model: string;
  prompt: string;
}) {
  const apiKey = process.env.OPENAI_API_KEY?.trim();

  if (!apiKey) {
    throw new Error("missing_openai_api_key");
  }

  const response = await fetch(OPENAI_RESPONSES_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      input: [
        {
          content: [
            {
              text: prompt,
              type: "input_text",
            },
          ],
          role: "user",
        },
      ],
      max_output_tokens: getSocialPostCharacterGateMaxOutputTokens(),
      model,
      text: {
        format: {
          name: "social_post_character_gate",
          schema: SOCIAL_POST_CHARACTER_SCHEMA,
          strict: true,
          type: "json_schema",
        },
      },
      ...getReasoningRequestOptions(model, {
        defaultEffort: getSocialPostCharacterGateDefaultReasoningEffort(),
        effortEnvKey: SOCIAL_POST_CHARACTER_REASONING_ENV_KEY,
      }),
    }),
  });
  const payload = await readJsonSafely(response);

  if (!response.ok) {
    throw new Error(`openai_request_failed:${response.status}`);
  }

  const outputText = readResponsesOutputText(payload);

  if (!outputText) {
    throw new Error("empty_openai_output");
  }

  return parseResponsesJsonObject<Partial<SocialPostCharacterLlmOutput>>(
    outputText,
  );
}

async function readJsonSafely(response: Response) {
  const text = await response.text();

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}
