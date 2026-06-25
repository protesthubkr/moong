create extension if not exists pgcrypto;

create table if not exists public.social_sources (
  id uuid primary key default gen_random_uuid(),
  platform text not null check (platform in ('x', 'facebook')),
  source_key text not null,
  platform_user_id text not null,
  username text not null,
  display_name text not null,
  source_url text not null,
  profile_image_url text,
  description text,
  follower_count integer,
  following_count integer,
  listed_count integer,
  post_count integer,
  is_following boolean not null default true,
  is_protected boolean not null default false,
  enabled boolean not null default true,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  last_synced_at timestamptz,
  last_scanned_at timestamptz,
  last_scanned_post_id text,
  last_scanned_post_at timestamptz,
  last_error text,
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (platform, source_key),
  unique (platform, platform_user_id),
  unique (platform, username)
);

create index if not exists social_sources_ingest_idx
  on public.social_sources (
    platform,
    enabled,
    is_following,
    is_protected,
    last_scanned_at asc nulls first
  );

create table if not exists public.social_posts (
  id uuid primary key default gen_random_uuid(),
  platform text not null check (platform in ('x', 'facebook')),
  source_id uuid references public.social_sources(id) on delete set null,
  source_key text not null,
  platform_post_id text not null,
  author_platform_user_id text,
  author_username text not null,
  author_name text not null,
  source_url text not null,
  text_snapshot text not null default '',
  posted_at timestamptz,
  post_type text not null default 'original'
    check (post_type in ('original', 'reply', 'quote', 'repost')),
  conversation_id text,
  reply_to_platform_post_id text,
  quoted_platform_post_id text,
  reposted_platform_post_id text,
  parent_context jsonb,
  quote_context jsonb,
  attachments jsonb not null default '[]'::jsonb,
  links jsonb not null default '[]'::jsonb,
  raw_payload jsonb not null default '{}'::jsonb,
  visibility_status text not null default 'tracking'
    check (visibility_status in ('tracking', 'promoted', 'archived', 'skipped')),
  skip_reason text,
  promoted_at timestamptz,
  metrics_frozen_at timestamptz,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  last_metric_checked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (platform, platform_post_id)
);

create index if not exists social_posts_feed_idx
  on public.social_posts (promoted_at asc, posted_at asc)
  where visibility_status = 'promoted' and promoted_at is not null;

create index if not exists social_posts_metric_refresh_idx
  on public.social_posts (
    platform,
    visibility_status,
    posted_at desc nulls last,
    last_metric_checked_at asc nulls first
  )
  where visibility_status = 'tracking' and metrics_frozen_at is null;

create index if not exists social_posts_source_idx
  on public.social_posts (source_id, posted_at desc nulls last);

create table if not exists public.social_post_metrics (
  post_id uuid primary key references public.social_posts(id) on delete cascade,
  like_count integer not null default 0 check (like_count >= 0),
  repost_count integer not null default 0 check (repost_count >= 0),
  reply_count integer not null default 0 check (reply_count >= 0),
  quote_count integer not null default 0 check (quote_count >= 0),
  impression_count integer check (impression_count is null or impression_count >= 0),
  score numeric not null default 0,
  raw_metrics jsonb not null default '{}'::jsonb,
  captured_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists social_post_metrics_score_idx
  on public.social_post_metrics (score desc, like_count desc);

create table if not exists public.social_post_character_decisions (
  post_id uuid primary key references public.social_posts(id) on delete cascade,
  classifier_version text not null,
  model_name text not null default '',
  primary_character text not null
    check (
      primary_character in (
        'emotional_essay',
        'personal_miscellany',
        'militant_declaration',
        'gratitude_reflection',
        'policy_explainer',
        'field_note',
        'campaign_mobilization',
        'satirical_short_comment',
        'argument_reply',
        'quote_commentary',
        'notice_or_resource',
        'memorial_note',
        'media_dependent',
        'mixed_other'
      )
    ),
  secondary_characters text[] not null default '{}'::text[]
    check (
      secondary_characters <@ array[
        'emotional_essay',
        'personal_miscellany',
        'militant_declaration',
        'gratitude_reflection',
        'policy_explainer',
        'field_note',
        'campaign_mobilization',
        'satirical_short_comment',
        'argument_reply',
        'quote_commentary',
        'notice_or_resource',
        'memorial_note',
        'media_dependent',
        'mixed_other'
      ]::text[]
    ),
  tone text not null
    check (
      tone in (
        'cold',
        'critical_logical',
        'emotional',
        'matter_of_fact',
        'solemn',
        'urgent',
        'warm',
        'wry'
      )
    ),
  context_dependency text not null
    check (
      context_dependency in (
        'needs_media',
        'needs_parent',
        'needs_quote',
        'standalone'
      )
    ),
  publicness text not null
    check (
      publicness in (
        'campaign',
        'personal_public',
        'private_like',
        'public_issue'
      )
    ),
  confidence numeric not null default 0
    check (confidence >= 0 and confidence <= 1),
  reason text not null default '',
  raw_output jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists social_post_character_decisions_character_idx
  on public.social_post_character_decisions (
    classifier_version,
    primary_character,
    confidence desc
  );

create index if not exists social_post_character_decisions_updated_idx
  on public.social_post_character_decisions (updated_at desc);

create table if not exists public.social_scan_runs (
  id uuid primary key default gen_random_uuid(),
  platform text not null check (platform in ('x', 'facebook')),
  run_type text not null
    check (run_type in ('source_refresh', 'post_ingest', 'character_gate')),
  status text not null default 'running'
    check (status in ('running', 'succeeded', 'failed')),
  dry_run boolean not null default false,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  source_count integer not null default 0 check (source_count >= 0),
  posts_seen integer not null default 0 check (posts_seen >= 0),
  posts_written integer not null default 0 check (posts_written >= 0),
  posts_promoted integer not null default 0 check (posts_promoted >= 0),
  metrics_refreshed integer not null default 0 check (metrics_refreshed >= 0),
  error_message text,
  options jsonb not null default '{}'::jsonb
);

create index if not exists social_scan_runs_started_idx
  on public.social_scan_runs (started_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_updated_at_social_sources on public.social_sources;
create trigger set_updated_at_social_sources
before update on public.social_sources
for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at_social_posts on public.social_posts;
create trigger set_updated_at_social_posts
before update on public.social_posts
for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at_social_post_metrics
  on public.social_post_metrics;
create trigger set_updated_at_social_post_metrics
before update on public.social_post_metrics
for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at_social_post_character_decisions
  on public.social_post_character_decisions;
create trigger set_updated_at_social_post_character_decisions
before update on public.social_post_character_decisions
for each row execute function public.set_updated_at();

alter table public.social_sources enable row level security;
alter table public.social_posts enable row level security;
alter table public.social_post_metrics enable row level security;
alter table public.social_post_character_decisions enable row level security;
alter table public.social_scan_runs enable row level security;

alter table public.social_sources force row level security;
alter table public.social_posts force row level security;
alter table public.social_post_metrics force row level security;
alter table public.social_post_character_decisions force row level security;
alter table public.social_scan_runs force row level security;

revoke all on public.social_sources from public, anon, authenticated;
revoke all on public.social_posts from public, anon, authenticated;
revoke all on public.social_post_metrics from public, anon, authenticated;
revoke all on public.social_post_character_decisions
  from public, anon, authenticated;
revoke all on public.social_scan_runs from public, anon, authenticated;
