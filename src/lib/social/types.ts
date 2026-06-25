export type SocialPlatform = "x" | "facebook";

export type ScoreWeights = {
  like: number;
  quote: number;
  reply: number;
  repost: number;
};

export type SocialSource = {
  display_name: string;
  enabled: boolean;
  id: string;
  is_following: boolean;
  is_protected: boolean;
  last_scanned_post_at: string | null;
  last_scanned_post_id: string | null;
  platform: SocialPlatform;
  platform_user_id: string;
  profile_image_url: string | null;
  source_key: string;
  source_url: string;
  username: string;
};

export type SocialPostMetrics = {
  impression_count?: number;
  like_count: number;
  quote_count: number;
  reply_count: number;
  repost_count: number;
  score: number;
};

export type SocialPostAttachment = {
  altText?: string | null;
  height?: number | null;
  mediaKey?: string;
  previewImageUrl?: string | null;
  type: "photo" | "video" | "animated_gif" | "unknown";
  url?: string | null;
  width?: number | null;
};

export type SocialPostLink = {
  description?: string | null;
  displayUrl?: string | null;
  expandedUrl: string;
  images?: Array<{ height?: number; url: string; width?: number }>;
  shortUrl?: string | null;
  title?: string | null;
};

export type SocialPostContext = {
  authorName?: string | null;
  authorUsername?: string | null;
  platformPostId: string;
  sourceUrl?: string | null;
  text?: string | null;
};

export type PublicMoongPost = {
  attachments: SocialPostAttachment[];
  authorName: string;
  authorProfileImageUrl: string | null;
  authorUsername: string;
  id: string;
  links: SocialPostLink[];
  parentContext: SocialPostContext | null;
  platform: SocialPlatform;
  platformPostId: string;
  postType: string;
  postedAt: string | null;
  promotedAt: string | null;
  quotedPlatformPostId: string | null;
  quoteContext: SocialPostContext | null;
  sourceUrl: string;
  text: string;
};

export type PublicMoongFeedItem =
  | {
      id: string;
      kind: "post";
      post: PublicMoongPost;
      promotedAt: string | null;
    }
  | {
      id: string;
      kind: "quote_group";
      original: SocialPostContext | null;
      posts: PublicMoongPost[];
      promotedAt: string | null;
      quotedPlatformPostId: string;
    };

export type OpsSocialSource = {
  display_name: string;
  enabled: boolean;
  follower_count: number | null;
  is_following: boolean;
  is_protected: boolean;
  last_error: string | null;
  last_scanned_at: string | null;
  platform: SocialPlatform;
  source_key: string;
  username: string;
};

export type OpsRankingPost = PublicMoongPost & {
  metrics: SocialPostMetrics;
};

export type XPublicMetrics = {
  bookmark_count?: number;
  impression_count?: number;
  like_count?: number;
  quote_count?: number;
  reply_count?: number;
  retweet_count?: number;
};

export type XUser = {
  created_at?: string;
  description?: string;
  id: string;
  location?: string;
  name: string;
  profile_image_url?: string;
  protected?: boolean;
  public_metrics?: {
    followers_count?: number;
    following_count?: number;
    listed_count?: number;
    tweet_count?: number;
  };
  username: string;
  verified?: boolean;
  verified_type?: string;
};

export type XMedia = {
  alt_text?: string;
  height?: number;
  media_key: string;
  preview_image_url?: string;
  type?: "photo" | "video" | "animated_gif";
  url?: string;
  width?: number;
};

export type XPost = {
  attachments?: {
    media_keys?: string[];
  };
  author_id?: string;
  conversation_id?: string;
  created_at?: string;
  edit_history_tweet_ids?: string[];
  entities?: {
    urls?: Array<{
      description?: string;
      display_url?: string;
      expanded_url?: string;
      images?: Array<{ height?: number; url: string; width?: number }>;
      title?: string;
      unwound_url?: string;
      url?: string;
    }>;
  };
  hydration_includes?: XIncludes;
  id: string;
  note_tweet?: {
    text?: string;
  };
  public_metrics?: XPublicMetrics;
  referenced_tweets?: Array<{
    id: string;
    type: "quoted" | "replied_to" | "retweeted";
  }>;
  text?: string;
};

export type XIncludes = {
  media?: XMedia[];
  tweets?: XPost[];
  users?: XUser[];
};

export type XTimelineResponse = {
  data?: XPost[];
  errors?: unknown[];
  includes?: XIncludes;
  meta?: {
    next_token?: string;
    result_count?: number;
  };
};

export type XFollowingResponse = {
  data?: XUser[];
  meta?: {
    next_token?: string;
    result_count?: number;
  };
};

export type XUserResponse = {
  data?: XUser;
};
