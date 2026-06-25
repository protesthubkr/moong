import type { PublicMoongFeedItem } from "@/lib/social/types";
import type { MoongPartyFilterOption } from "../moong-party-filter";

const PARTY_FILTER_ORDER = [
  "justice",
  "jinbo",
  "green",
  "minjoo",
  "reform",
  "chokuk",
  "laborparty",
  "climateall",
  "feminist",
  "neutral",
];

export function getPartyFilterOptions(
  items: PublicMoongFeedItem[],
): MoongPartyFilterOption[] {
  const optionsByKey = new Map<string, MoongPartyFilterOption>();

  for (const item of items) {
    for (const post of getFeedItemPosts(item)) {
      const key = post.partyKey || "neutral";

      if (optionsByKey.has(key)) {
        continue;
      }

      optionsByKey.set(key, {
        accentColor: post.partyAccentColor,
        key,
        label: post.partyLabel || "무정당",
        logoSrc: post.partyLogoSrc,
      });
    }
  }

  return Array.from(optionsByKey.values()).sort(comparePartyFilterOptions);
}

function getFeedItemPosts(item: PublicMoongFeedItem) {
  if (item.kind === "post") {
    return [item.post];
  }

  return item.posts;
}

function comparePartyFilterOptions(
  first: MoongPartyFilterOption,
  second: MoongPartyFilterOption,
) {
  const firstRank = getPartyFilterRank(first.key);
  const secondRank = getPartyFilterRank(second.key);

  if (firstRank !== secondRank) {
    return firstRank - secondRank;
  }

  return first.label.localeCompare(second.label, "ko-KR");
}

function getPartyFilterRank(key: string) {
  const index = PARTY_FILTER_ORDER.indexOf(key);

  return index >= 0 ? index : PARTY_FILTER_ORDER.length;
}
