export type SplitAuthorName = {
  bottom: string;
  top: string;
};

const HTML_ENTITY_PATTERN = /&(#x?[0-9a-f]+|[a-z]+);/gi;
const X_STATUS_URL_PATTERN =
  /https?:\/\/(?:www\.)?(?:x\.com|twitter\.com)\/[A-Za-z0-9_]+\/status\/\d+(?:[/?#][^\s]*)?/gi;
const TCO_URL_PATTERN =
  /https?:\/\/t\.co\/[A-Za-z0-9]+(?:[ \t]*-[ \t]*@YouTube)?/gi;
const YOUTUBE_HANDLE_TRAILER_PATTERN = /(?:^|[ \t])-?[ \t]*@YouTube\b/gi;

const NAMED_HTML_ENTITIES: Record<string, string> = {
  amp: "&",
  apos: "'",
  gt: ">",
  lt: "<",
  nbsp: " ",
  quot: "\"",
};

const KOREA_POST_TIME_FORMATTER = new Intl.DateTimeFormat("ko-KR", {
  day: "2-digit",
  hour: "2-digit",
  hourCycle: "h23",
  minute: "2-digit",
  month: "2-digit",
  timeZone: "Asia/Seoul",
});

export function getTweetPreviewText(value: string) {
  return sanitizeTweetText(value)
    .replace(/\r\n/g, "\n")
    .split(/\n+/)
    .map((paragraph) => paragraph.replace(/[ \t]{2,}/g, " ").trim())
    .filter(Boolean)
    .join("\n");
}

export function sanitizeTweetText(value: string) {
  return decodeHtmlEntities(value)
    .replace(TCO_URL_PATTERN, "")
    .replace(YOUTUBE_HANDLE_TRAILER_PATTERN, " ")
    .replace(X_STATUS_URL_PATTERN, "")
    .replace(/[ \t]+\n/g, "\n")
    .trim();
}

export function formatPostTime(value: string | null) {
  if (!value) {
    return "";
  }

  return KOREA_POST_TIME_FORMATTER.format(new Date(value));
}

export function getAvatarLabel(name: string) {
  return Array.from(name.replace(/\s+/g, ""))[0]?.toUpperCase() ?? "뭉";
}

export function splitAuthorName(value: string): SplitAuthorName {
  const parts = value.trim().split(/\s+/).filter(Boolean);

  if (parts.length <= 1) {
    return {
      bottom: value.trim(),
      top: "",
    };
  }

  return {
    bottom: parts.slice(1).join(" "),
    top: parts[0],
  };
}

function decodeHtmlEntities(value: string) {
  return value.replace(HTML_ENTITY_PATTERN, (entity, token: string) => {
    const normalized = token.toLowerCase();

    if (normalized.startsWith("#x")) {
      return decodeHtmlCodePoint(entity, normalized.slice(2), 16);
    }

    if (normalized.startsWith("#")) {
      return decodeHtmlCodePoint(entity, normalized.slice(1), 10);
    }

    return NAMED_HTML_ENTITIES[normalized] ?? entity;
  });
}

function decodeHtmlCodePoint(entity: string, value: string, radix: 10 | 16) {
  const codePoint = Number.parseInt(value, radix);

  return isValidCodePoint(codePoint) ? String.fromCodePoint(codePoint) : entity;
}

function isValidCodePoint(value: number) {
  return Number.isInteger(value) && value >= 0 && value <= 0x10ffff;
}
