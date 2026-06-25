create table if not exists public.social_post_character_decisions (
  post_id uuid primary key references public.social_posts(id) on delete cascade,
  classifier_version text not null,
  model_name text not null default '',
  primary_character text not null,
  secondary_characters text[] not null default '{}'::text[],
  tone text not null,
  context_dependency text not null,
  publicness text not null,
  confidence numeric not null default 0,
  reason text not null default '',
  raw_output jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.social_post_character_decisions
  add column if not exists model_name text not null default '';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'social_post_character_decisions_primary_character_check'
      and conrelid = 'public.social_post_character_decisions'::regclass
  ) then
    alter table public.social_post_character_decisions
      add constraint social_post_character_decisions_primary_character_check
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
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'social_post_character_decisions_secondary_characters_check'
      and conrelid = 'public.social_post_character_decisions'::regclass
  ) then
    alter table public.social_post_character_decisions
      add constraint social_post_character_decisions_secondary_characters_check
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
      );
  end if;

  if exists (
    select 1
    from pg_constraint
    where conname = 'social_post_character_decisions_tone_check'
      and conrelid = 'public.social_post_character_decisions'::regclass
  ) then
    alter table public.social_post_character_decisions
      drop constraint social_post_character_decisions_tone_check;
  end if;

  alter table public.social_post_character_decisions
    add constraint social_post_character_decisions_tone_check
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
    );

  if not exists (
    select 1
    from pg_constraint
    where conname = 'social_post_character_decisions_context_dependency_check'
      and conrelid = 'public.social_post_character_decisions'::regclass
  ) then
    alter table public.social_post_character_decisions
      add constraint social_post_character_decisions_context_dependency_check
      check (
        context_dependency in (
          'needs_media',
          'needs_parent',
          'needs_quote',
          'standalone'
        )
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'social_post_character_decisions_publicness_check'
      and conrelid = 'public.social_post_character_decisions'::regclass
  ) then
    alter table public.social_post_character_decisions
      add constraint social_post_character_decisions_publicness_check
      check (
        publicness in (
          'campaign',
          'personal_public',
          'private_like',
          'public_issue'
        )
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'social_post_character_decisions_confidence_check'
      and conrelid = 'public.social_post_character_decisions'::regclass
  ) then
    alter table public.social_post_character_decisions
      add constraint social_post_character_decisions_confidence_check
      check (confidence >= 0 and confidence <= 1);
  end if;
end $$;

create index if not exists social_post_character_decisions_character_idx
  on public.social_post_character_decisions (
    classifier_version,
    primary_character,
    confidence desc
  );

create index if not exists social_post_character_decisions_updated_idx
  on public.social_post_character_decisions (updated_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_updated_at_social_post_character_decisions
  on public.social_post_character_decisions;
create trigger set_updated_at_social_post_character_decisions
before update on public.social_post_character_decisions
for each row execute function public.set_updated_at();

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'social_scan_runs_run_type_check'
      and conrelid = 'public.social_scan_runs'::regclass
  ) then
    alter table public.social_scan_runs
      drop constraint social_scan_runs_run_type_check;
  end if;

  alter table public.social_scan_runs
    add constraint social_scan_runs_run_type_check
    check (run_type in ('source_refresh', 'post_ingest', 'character_gate'));
end $$;

alter table public.social_post_character_decisions enable row level security;
alter table public.social_post_character_decisions force row level security;

revoke all on public.social_post_character_decisions
  from public, anon, authenticated;
