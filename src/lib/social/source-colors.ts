import type { PublicMoongPost, SocialPostContext } from "./types";

export type SocialSourceColorStyle = {
  "--party-accent": string;
  "--party-avatar-border": string;
  "--party-card-border": string;
  "--party-card-hover": string;
  "--party-card-rim": string;
  "--party-focus": string;
  "--party-glow": string;
  "--party-ink": string;
  "--party-link-bg": string;
  "--party-parent-bg": string;
  "--party-shadow": string;
  "--party-soft": string;
};

export type SocialSourcePartyInfo = {
  accentColor: string;
  key: string;
  label: string;
  logoSrc: string | null;
};

type SocialColorPalette = SocialSourceColorStyle & {
  key: string;
};

const NEUTRAL_PALETTE: SocialColorPalette = {
  key: "neutral",
  "--party-accent": "#6e716b",
  "--party-avatar-border": "rgba(104, 108, 101, 0.48)",
  "--party-card-border": "rgba(104, 108, 101, 0.16)",
  "--party-card-hover": "rgba(104, 108, 101, 0.34)",
  "--party-card-rim": "rgba(104, 108, 101, 0.22)",
  "--party-focus": "rgba(104, 108, 101, 0.62)",
  "--party-glow": "rgba(104, 108, 101, 0.52)",
  "--party-ink": "#41443f",
  "--party-link-bg": "rgba(247, 247, 244, 0.82)",
  "--party-parent-bg": "#f0f1ed",
  "--party-shadow": "rgba(104, 108, 101, 0.13)",
  "--party-soft": "#f1f1ee",
};

const PALETTES: Record<string, SocialColorPalette> = {
  neutral: NEUTRAL_PALETTE,
  jinbo: {
    key: "jinbo",
    "--party-accent": "#d6001c",
    "--party-avatar-border": "rgba(214, 0, 28, 0.58)",
    "--party-card-border": "rgba(214, 0, 28, 0.2)",
    "--party-card-hover": "rgba(214, 0, 28, 0.44)",
    "--party-card-rim": "rgba(214, 0, 28, 0.34)",
    "--party-focus": "rgba(214, 0, 28, 0.62)",
    "--party-glow": "rgba(214, 0, 28, 0.68)",
    "--party-ink": "#7a0918",
    "--party-link-bg": "rgba(255, 241, 243, 0.84)",
    "--party-parent-bg": "#fff0f2",
    "--party-shadow": "rgba(214, 0, 28, 0.14)",
    "--party-soft": "#fff0f2",
  },
  justice: {
    key: "justice",
    "--party-accent": "#d9bc00",
    "--party-avatar-border": "rgba(232, 210, 0, 0.74)",
    "--party-card-border": "rgba(217, 188, 0, 0.24)",
    "--party-card-hover": "rgba(217, 188, 0, 0.5)",
    "--party-card-rim": "rgba(217, 188, 0, 0.38)",
    "--party-focus": "rgba(217, 188, 0, 0.7)",
    "--party-glow": "rgba(248, 236, 0, 0.78)",
    "--party-ink": "#5d4f00",
    "--party-link-bg": "rgba(255, 251, 214, 0.86)",
    "--party-parent-bg": "#fff9cf",
    "--party-shadow": "rgba(217, 188, 0, 0.15)",
    "--party-soft": "#fff9cf",
  },
  minjoo: {
    key: "minjoo",
    "--party-accent": "#152484",
    "--party-avatar-border": "rgba(21, 36, 132, 0.56)",
    "--party-card-border": "rgba(21, 36, 132, 0.18)",
    "--party-card-hover": "rgba(21, 36, 132, 0.42)",
    "--party-card-rim": "rgba(21, 36, 132, 0.28)",
    "--party-focus": "rgba(21, 36, 132, 0.58)",
    "--party-glow": "rgba(21, 36, 132, 0.62)",
    "--party-ink": "#14205f",
    "--party-link-bg": "rgba(236, 240, 255, 0.84)",
    "--party-parent-bg": "#edf1ff",
    "--party-shadow": "rgba(21, 36, 132, 0.13)",
    "--party-soft": "#edf1ff",
  },
  reform: {
    key: "reform",
    "--party-accent": "#ed6c00",
    "--party-avatar-border": "rgba(237, 108, 0, 0.56)",
    "--party-card-border": "rgba(237, 108, 0, 0.19)",
    "--party-card-hover": "rgba(237, 108, 0, 0.42)",
    "--party-card-rim": "rgba(237, 108, 0, 0.3)",
    "--party-focus": "rgba(237, 108, 0, 0.58)",
    "--party-glow": "rgba(237, 108, 0, 0.64)",
    "--party-ink": "#743400",
    "--party-link-bg": "rgba(255, 242, 231, 0.86)",
    "--party-parent-bg": "#fff2e7",
    "--party-shadow": "rgba(237, 108, 0, 0.13)",
    "--party-soft": "#fff2e7",
  },
  chokuk: {
    key: "chokuk",
    "--party-accent": "#003890",
    "--party-avatar-border": "rgba(0, 56, 144, 0.56)",
    "--party-card-border": "rgba(0, 56, 144, 0.18)",
    "--party-card-hover": "rgba(0, 56, 144, 0.42)",
    "--party-card-rim": "rgba(0, 56, 144, 0.28)",
    "--party-focus": "rgba(0, 56, 144, 0.58)",
    "--party-glow": "rgba(0, 112, 184, 0.62)",
    "--party-ink": "#08255d",
    "--party-link-bg": "rgba(232, 241, 255, 0.84)",
    "--party-parent-bg": "#e8f1ff",
    "--party-shadow": "rgba(0, 56, 144, 0.13)",
    "--party-soft": "#e8f1ff",
  },
  green: {
    key: "green",
    "--party-accent": "#5bb52f",
    "--party-avatar-border": "rgba(91, 181, 47, 0.58)",
    "--party-card-border": "rgba(91, 181, 47, 0.2)",
    "--party-card-hover": "rgba(91, 181, 47, 0.44)",
    "--party-card-rim": "rgba(91, 181, 47, 0.32)",
    "--party-focus": "rgba(91, 181, 47, 0.6)",
    "--party-glow": "rgba(91, 181, 47, 0.66)",
    "--party-ink": "#2c6817",
    "--party-link-bg": "rgba(241, 250, 236, 0.86)",
    "--party-parent-bg": "#f1faec",
    "--party-shadow": "rgba(91, 181, 47, 0.13)",
    "--party-soft": "#f1faec",
  },
  laborparty: {
    key: "laborparty",
    "--party-accent": "#f00000",
    "--party-avatar-border": "rgba(240, 0, 0, 0.58)",
    "--party-card-border": "rgba(240, 0, 0, 0.19)",
    "--party-card-hover": "rgba(240, 0, 0, 0.42)",
    "--party-card-rim": "rgba(240, 0, 0, 0.3)",
    "--party-focus": "rgba(240, 0, 0, 0.58)",
    "--party-glow": "rgba(240, 0, 0, 0.64)",
    "--party-ink": "#7c0000",
    "--party-link-bg": "rgba(255, 240, 240, 0.84)",
    "--party-parent-bg": "#fff0f0",
    "--party-shadow": "rgba(240, 0, 0, 0.13)",
    "--party-soft": "#fff0f0",
  },
  climateall: {
    key: "climateall",
    "--party-accent": "#10c0a0",
    "--party-avatar-border": "rgba(16, 192, 160, 0.6)",
    "--party-card-border": "rgba(16, 192, 160, 0.2)",
    "--party-card-hover": "rgba(16, 192, 160, 0.44)",
    "--party-card-rim": "rgba(16, 192, 160, 0.32)",
    "--party-focus": "rgba(16, 192, 160, 0.6)",
    "--party-glow": "rgba(16, 192, 160, 0.66)",
    "--party-ink": "#006b5a",
    "--party-link-bg": "rgba(230, 252, 248, 0.86)",
    "--party-parent-bg": "#e6fcf8",
    "--party-shadow": "rgba(16, 192, 160, 0.13)",
    "--party-soft": "#e6fcf8",
  },
  feminist: {
    key: "feminist",
    "--party-accent": "#7b4aa0",
    "--party-avatar-border": "rgba(123, 74, 160, 0.56)",
    "--party-card-border": "rgba(123, 74, 160, 0.18)",
    "--party-card-hover": "rgba(123, 74, 160, 0.4)",
    "--party-card-rim": "rgba(123, 74, 160, 0.28)",
    "--party-focus": "rgba(123, 74, 160, 0.58)",
    "--party-glow": "rgba(123, 74, 160, 0.62)",
    "--party-ink": "#4f2c69",
    "--party-link-bg": "rgba(246, 239, 252, 0.84)",
    "--party-parent-bg": "#f6effc",
    "--party-shadow": "rgba(123, 74, 160, 0.13)",
    "--party-soft": "#f6effc",
  },
};

const DEFAULT_SOURCE_COLOR_KEYS: Record<string, string> = {
  fighthatebydata: "justice",
  fightbydate: "justice",
  insook_kwon: "minjoo",
  jaeyeon80: "jinbo",
  janghyeyeong: "justice",
  jhkjinbo: "jinbo",
  junggu_: "justice",
  lovelylawyerjj: "minjoo",
  nasaram2017: "justice",
  sanghyun_green: "green",
  sonsol_jinbo: "jinbo",
  yoeman6310: "minjoo",
};

const PARTY_META: Record<
  string,
  {
    label: string;
    logoSrc: string | null;
  }
> = {
  chokuk: {
    label: "조국혁신당",
    logoSrc: null,
  },
  climateall: {
    label: "기후민생당",
    logoSrc: null,
  },
  feminist: {
    label: "여성/페미니즘",
    logoSrc: null,
  },
  green: {
    label: "녹색당",
    logoSrc: "/green-logo.webp",
  },
  jinbo: {
    label: "진보당",
    logoSrc: "/jinbo-logo.svg",
  },
  justice: {
    label: "정의당",
    logoSrc: "/justice-logo.webp",
  },
  laborparty: {
    label: "노동당",
    logoSrc: null,
  },
  minjoo: {
    label: "민주당",
    logoSrc: null,
  },
  neutral: {
    label: "무정당",
    logoSrc: null,
  },
  reform: {
    label: "개혁신당",
    logoSrc: null,
  },
};

export function getPostColorStyle(post: PublicMoongPost): SocialSourceColorStyle {
  return getPalette(
    post.partyKey ||
      getSocialSourceColorKey({
        displayName: post.authorName,
        sourceKey: post.sourceKey,
        sourceUrl: post.sourceUrl,
        username: post.authorUsername,
      }),
  );
}

export function getPostPartyInfo(post: PublicMoongPost): SocialSourcePartyInfo {
  return getPartyInfo(
    post.partyKey ||
      getSocialSourceColorKey({
        displayName: post.authorName,
        sourceKey: post.sourceKey,
        sourceUrl: post.sourceUrl,
        username: post.authorUsername,
      }),
  );
}

export function getSocialSourcePartyInfo({
  displayName,
  sourceKey,
  sourceUrl,
  username,
}: {
  displayName?: string | null;
  sourceKey?: string | null;
  sourceUrl?: string | null;
  username?: string | null;
}): SocialSourcePartyInfo {
  return getPartyInfo(
    getSocialSourceColorKey({ displayName, sourceKey, sourceUrl, username }),
  );
}

export function getPartyInfo(key: string): SocialSourcePartyInfo {
  const palette = getPalette(key);
  const meta = PARTY_META[palette.key] ?? PARTY_META.neutral;

  return {
    accentColor: palette["--party-accent"],
    key: palette.key,
    label: meta.label,
    logoSrc: meta.logoSrc,
  };
}

export function getSocialSourceColorKey({
  displayName,
  sourceKey,
  sourceUrl,
  username,
}: {
  displayName?: string | null;
  sourceKey?: string | null;
  sourceUrl?: string | null;
  username?: string | null;
}) {
  return (
    getConfiguredColorKey(sourceKey, username, sourceUrl) ??
    inferColorKey({ displayName, sourceKey, sourceUrl, username }) ??
    "neutral"
  );
}

export function getSocialSourceColorStyle({
  displayName,
  sourceKey,
  sourceUrl,
  username,
}: {
  displayName?: string | null;
  sourceKey?: string | null;
  sourceUrl?: string | null;
  username?: string | null;
}): SocialSourceColorStyle {
  return getPalette(
    getSocialSourceColorKey({ displayName, sourceKey, sourceUrl, username }),
  );
}

export function getContextColorStyle(context: SocialPostContext | null) {
  if (!context) {
    return getSocialSourceColorStyle({});
  }

  return getSocialSourceColorStyle({
    displayName: context.authorName ?? undefined,
    sourceUrl: context.sourceUrl ?? undefined,
    username: context.authorUsername ?? undefined,
  });
}

function getConfiguredColorKey(
  sourceKey?: string | null,
  username?: string | null,
  sourceUrl?: string | null,
) {
  const overrides = getSourceColorKeyOverrides();
  const candidates = [
    sourceKey,
    username,
    getUsernameFromSourceUrl(sourceUrl),
  ].map(normalizeKey);

  for (const candidate of candidates) {
    if (!candidate) {
      continue;
    }

    const override = overrides.get(candidate);

    if (override) {
      return override;
    }

    const defaultKey = DEFAULT_SOURCE_COLOR_KEYS[candidate];

    if (defaultKey) {
      return defaultKey;
    }
  }

  return null;
}

function inferColorKey({
  displayName,
  sourceKey,
  sourceUrl,
  username,
}: {
  displayName?: string | null;
  sourceKey?: string | null;
  sourceUrl?: string | null;
  username?: string | null;
}) {
  const name = displayName?.toLowerCase() ?? "";
  const keys = [sourceKey, username, getUsernameFromSourceUrl(sourceUrl)]
    .map(normalizeKey)
    .filter((key): key is string => Boolean(key));
  const keyText = keys.join(" ");

  if (name.includes("진보당") || keyText.includes("jinbo")) {
    return "jinbo";
  }

  if (name.includes("정의당") || keyText.includes("justice")) {
    return "justice";
  }

  if (
    name.includes("더불어민주당") ||
    name.includes("민주당") ||
    keyText.includes("minjoo")
  ) {
    return "minjoo";
  }

  if (name.includes("개혁신당") || keyText.includes("reform")) {
    return "reform";
  }

  if (name.includes("조국혁신당") || keyText.includes("chokuk")) {
    return "chokuk";
  }

  if (name.includes("녹색당") || keyText.includes("green")) {
    return "green";
  }

  if (name.includes("노동당") || keyText.includes("laborparty")) {
    return "laborparty";
  }

  if (
    name.includes("여성") ||
    name.includes("페미") ||
    keyText.includes("kwau") ||
    keyText.includes("equalact") ||
    keyText.includes("rainbowact")
  ) {
    return "feminist";
  }

  if (name.includes("기후") || keyText.includes("climate")) {
    return "climateall";
  }

  return null;
}

function getPalette(key: string): SocialColorPalette {
  const normalizedKey = normalizeKey(key) ?? "neutral";
  const override = getPaletteOverrides().get(normalizedKey);

  if (override) {
    return {
      ...NEUTRAL_PALETTE,
      ...PALETTES[normalizedKey],
      ...override,
      key: normalizedKey,
    };
  }

  return PALETTES[normalizedKey] ?? NEUTRAL_PALETTE;
}

function getUsernameFromSourceUrl(value?: string | null) {
  if (!value) {
    return null;
  }

  try {
    const url = new URL(value);
    const host = url.hostname.replace(/^www\./, "").toLowerCase();

    if (host !== "x.com" && host !== "twitter.com") {
      return null;
    }

    return url.pathname.split("/").filter(Boolean)[0] ?? null;
  } catch {
    return null;
  }
}

function normalizeKey(value?: string | null) {
  const normalized = value?.replace(/^@/, "").trim().toLowerCase();

  return normalized || null;
}

let sourceColorKeyOverrides: Map<string, string> | null = null;

function getSourceColorKeyOverrides() {
  if (sourceColorKeyOverrides) {
    return sourceColorKeyOverrides;
  }

  sourceColorKeyOverrides = new Map();
  const parsed = parseJsonRecord(process.env.MOONG_SOURCE_COLOR_KEYS);

  for (const [sourceKey, colorKey] of Object.entries(parsed)) {
    if (typeof colorKey !== "string") {
      continue;
    }

    const normalizedSourceKey = normalizeKey(sourceKey);
    const normalizedColorKey = normalizeKey(colorKey);

    if (normalizedSourceKey && normalizedColorKey) {
      sourceColorKeyOverrides.set(normalizedSourceKey, normalizedColorKey);
    }
  }

  return sourceColorKeyOverrides;
}

let paletteOverrides: Map<string, Partial<SocialSourceColorStyle>> | null = null;

function getPaletteOverrides() {
  if (paletteOverrides) {
    return paletteOverrides;
  }

  paletteOverrides = new Map();
  const parsed = parseJsonRecord(process.env.MOONG_COLOR_PALETTES);

  for (const [paletteKey, value] of Object.entries(parsed)) {
    if (!isRecord(value)) {
      continue;
    }

    const normalizedPaletteKey = normalizeKey(paletteKey);

    if (!normalizedPaletteKey) {
      continue;
    }

    const override: Partial<SocialSourceColorStyle> = {};

    for (const token of SOCIAL_COLOR_TOKENS) {
      const tokenValue = value[token];

      if (typeof tokenValue === "string" && tokenValue.trim()) {
        override[token] = tokenValue.trim();
      }
    }

    paletteOverrides.set(normalizedPaletteKey, override);
  }

  return paletteOverrides;
}

const SOCIAL_COLOR_TOKENS = [
  "--party-accent",
  "--party-avatar-border",
  "--party-card-border",
  "--party-card-hover",
  "--party-card-rim",
  "--party-focus",
  "--party-glow",
  "--party-ink",
  "--party-link-bg",
  "--party-parent-bg",
  "--party-shadow",
  "--party-soft",
] as const;

function parseJsonRecord(value?: string) {
  if (!value?.trim()) {
    return {};
  }

  try {
    const parsed = JSON.parse(value) as unknown;

    return isRecord(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
