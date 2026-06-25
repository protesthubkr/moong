import { readIntegerEnv, readStringEnv } from "@/lib/env";

type LlmAttemptFailure = {
  errorMessage: string;
  model: string;
  retryable: boolean;
};

export class LlmAttemptFallbackError extends Error {
  constructor(
    readonly operation: string,
    readonly failures: LlmAttemptFailure[],
  ) {
    super(
      `${operation}_llm_failed_after_${failures.length}_attempts:${failures.at(-1)?.errorMessage ?? "unknown"}`,
    );
  }
}

export async function runLlmWithFallback<T>({
  models,
  operation,
  run,
}: {
  models: string[];
  operation: string;
  run: (model: string) => Promise<T>;
}) {
  const failures: LlmAttemptFailure[] = [];
  const modelList = normalizeModelList(models);

  for (const model of modelList) {
    const attempts = getAttemptsForModel();

    for (let attempt = 0; attempt < attempts; attempt += 1) {
      try {
        return {
          failures,
          model,
          value: await run(model),
        };
      } catch (error) {
        const retryable = isRetryableLlmAttemptError(error);
        failures.push({
          errorMessage: getLlmAttemptErrorMessage(error),
          model,
          retryable,
        });

        if (!shouldRetryCurrentModel({ attempt, attempts, error })) {
          break;
        }

        await sleep(getRetryDelayMs(attempt));
      }
    }
  }

  throw new LlmAttemptFallbackError(operation, failures);
}

export function getLlmModelFallbackList({
  fallbackEnvKeys,
  primaryModel,
}: {
  fallbackEnvKeys: string[];
  primaryModel: string;
}) {
  const fallbackModels = fallbackEnvKeys.flatMap((key) =>
    readStringEnv(key)
      .split(",")
      .map((item) => item.trim()),
  );

  return normalizeModelList([primaryModel, ...fallbackModels]);
}

function normalizeModelList(models: string[]) {
  return Array.from(
    new Set(models.map((model) => model.trim()).filter(Boolean)),
  );
}

function shouldRetryCurrentModel({
  attempt,
  attempts,
  error,
}: {
  attempt: number;
  attempts: number;
  error: unknown;
}) {
  return attempt + 1 < attempts && isRetryableLlmAttemptError(error);
}

function getAttemptsForModel() {
  return (
    readIntegerEnv("OPENAI_MOONG_LLM_RETRY_ATTEMPTS", {
      defaultValue: 2,
      max: 5,
      min: 0,
    }) + 1
  );
}

function getRetryDelayMs(attempt: number) {
  const cappedBaseMs = readIntegerEnv("OPENAI_MOONG_LLM_RETRY_BASE_DELAY_MS", {
    defaultValue: 1500,
    max: 10000,
    min: 250,
  });

  return cappedBaseMs * 2 ** attempt + Math.floor(Math.random() * 500);
}

function isRetryableLlmAttemptError(error: unknown) {
  const status = getErrorStatus(error);

  if (status !== null) {
    return status === 408 || status === 409 || status === 429 || status >= 500;
  }

  return /(?:fetch failed|ECONNRESET|ETIMEDOUT|ECONNREFUSED|ENOTFOUND|EAI_AGAIN|empty(?:_openai)?_output|returned no output|no output text|Unexpected end of JSON input|JSON)/i.test(
    getLlmAttemptErrorMessage(error),
  );
}

function getErrorStatus(error: unknown) {
  const message = getLlmAttemptErrorMessage(error);
  const match = message.match(/(?:failed|request_failed):(\d{3})/);

  return match ? Number.parseInt(match[1], 10) : null;
}

function getLlmAttemptErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
