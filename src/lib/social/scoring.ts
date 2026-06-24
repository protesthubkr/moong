import type { ScoreWeights, SocialPostMetrics, XPublicMetrics } from "./types";

export function mapXMetrics(
  metrics: XPublicMetrics | undefined,
  weights: ScoreWeights,
): SocialPostMetrics {
  const likeCount = metrics?.like_count ?? 0;
  const repostCount = metrics?.retweet_count ?? 0;
  const replyCount = metrics?.reply_count ?? 0;
  const quoteCount = metrics?.quote_count ?? 0;

  return {
    impression_count: metrics?.impression_count,
    like_count: likeCount,
    quote_count: quoteCount,
    reply_count: replyCount,
    repost_count: repostCount,
    score:
      likeCount * weights.like +
      repostCount * weights.repost +
      replyCount * weights.reply +
      quoteCount * weights.quote,
  };
}
