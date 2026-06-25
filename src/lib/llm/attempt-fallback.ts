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
    (process.env[key]?.trim() ?? "")
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
  const value = process.env.OPENAI_MOONG_LLM_RETRY_ATTEMPTS;
  const parsed = value ? Number.parseInt(value, 10) : 2;
  const retries = Number.isFinite(parsed) ? parsed : 2;

  return Math.min(Math.max(retries, 0), 5) + 1;
}

function getRetryDelayMs(attempt: number) {
  const value = process.env.OPENAI_MOONG_LLM_RETRY_BASE_DELAY_MS;
  const parsed = value ? Number.parseInt(value, 10) : 1500;
  const baseMs = Number.isFinite(parsed) ? parsed : 1500;
  const cappedBaseMs = Math.min(Math.max(baseMs, 250), 10000);

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
