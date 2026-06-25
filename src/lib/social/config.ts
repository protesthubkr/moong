import {
  readIntegerEnv,
  readNumberEnv,
  readRequiredStringEnv,
  readStringEnv,
} from "@/lib/env";
import type { ScoreWeights } from "./types";

export type MoongConfig = {
  likeThreshold: number;
  maxFollowingAccounts: number;
  metricRefreshLimit: number;
  metricRefreshWindowHours: number;
  scoreWeights: ScoreWeights;
  sourceLimit: number;
  startIso: string;
  timelineBootstrapMaxPages: number;
  timelinePageSize: number;
  xFollowingUsername: string;
};

export function getMoongConfig(): MoongConfig {
  return {
    likeThreshold: readIntegerEnv("MOONG_LIKE_THRESHOLD", {
      defaultValue: 150,
      min: 1,
    }),
    maxFollowingAccounts: readIntegerEnv("MOONG_X_MAX_FOLLOWING_ACCOUNTS", {
      defaultValue: 10000,
      min: 1,
    }),
    metricRefreshLimit: readIntegerEnv("MOONG_X_METRIC_REFRESH_LIMIT", {
      defaultValue: 100,
      max: 500,
      min: 1,
    }),
    metricRefreshWindowHours: readIntegerEnv(
      "MOONG_METRIC_REFRESH_WINDOW_HOURS",
      {
        defaultValue: 168,
        max: 744,
        min: 1,
      },
    ),
    scoreWeights: {
      like: readNumberEnv("MOONG_SCORE_LIKE_WEIGHT", {
        defaultValue: 1,
        min: 0,
      }),
      quote: readNumberEnv("MOONG_SCORE_QUOTE_WEIGHT", {
        defaultValue: 2,
        min: 0,
      }),
      reply: readNumberEnv("MOONG_SCORE_REPLY_WEIGHT", {
        defaultValue: 1,
        min: 0,
      }),
      repost: readNumberEnv("MOONG_SCORE_REPOST_WEIGHT", {
        defaultValue: 2,
        min: 0,
      }),
    },
    sourceLimit: readIntegerEnv("MOONG_X_SOURCE_LIMIT", {
      defaultValue: 60,
      max: 500,
      min: 1,
    }),
    startIso: getStartIso(),
    timelineBootstrapMaxPages: readIntegerEnv(
      "MOONG_X_TIMELINE_BOOTSTRAP_MAX_PAGES",
      {
        defaultValue: 2,
        max: 30,
        min: 1,
      },
    ),
    timelinePageSize: readIntegerEnv("MOONG_X_TIMELINE_PAGE_SIZE", {
      defaultValue: 100,
      max: 100,
      min: 5,
    }),
    xFollowingUsername: readStringEnv(
      "MOONG_X_FOLLOWING_USERNAME",
      "wordybirdbird",
    ).replace(/^@/, ""),
  };
}

export function getRequiredXBearerToken() {
  return readRequiredStringEnv(
    "X_BEARER_TOKEN",
    "X_BEARER_TOKEN is not configured.",
  );
}

function getStartIso() {
  const value = readStringEnv("MOONG_SOCIAL_POST_START_DATE", "2026-05-01");

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Date(`${value}T00:00:00+09:00`).toISOString();
  }

  const timestamp = Date.parse(value);

  if (Number.isFinite(timestamp)) {
    return new Date(timestamp).toISOString();
  }

  return new Date("2026-05-01T00:00:00+09:00").toISOString();
}
