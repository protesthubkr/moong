create or replace function public.moong_is_recommended_sincerity_candidate(
  p_primary_character text,
  p_secondary_characters text[]
)
returns boolean
language sql
immutable
as $$
  select case
    when p_primary_character = 'militant_declaration'
      and 'argument_reply' = any(coalesce(p_secondary_characters, '{}'::text[]))
      then false
    when p_primary_character = 'militant_declaration'
      and 'quote_commentary' = any(coalesce(p_secondary_characters, '{}'::text[]))
      then false
    when p_primary_character = 'campaign_mobilization'
      and 'militant_declaration' = any(coalesce(p_secondary_characters, '{}'::text[]))
      then false
    when p_primary_character = 'policy_explainer'
      and 'notice_or_resource' = any(coalesce(p_secondary_characters, '{}'::text[]))
      and not exists (
        select 1
        from unnest(coalesce(p_secondary_characters, '{}'::text[])) as secondary(character)
        where secondary.character in (
          'emotional_essay',
          'field_note',
          'gratitude_reflection',
          'memorial_note'
        )
      )
      then false
    when p_primary_character in (
      'emotional_essay',
      'field_note',
      'gratitude_reflection',
      'memorial_note',
      'policy_explainer'
    )
      then true
    when p_primary_character in (
      'campaign_mobilization',
      'militant_declaration'
    )
      and exists (
        select 1
        from unnest(coalesce(p_secondary_characters, '{}'::text[])) as secondary(character)
        where secondary.character in (
          'argument_reply',
          'campaign_mobilization',
          'emotional_essay',
          'field_note',
          'gratitude_reflection',
          'notice_or_resource',
          'policy_explainer'
        )
      )
      then true
    else false
  end;
$$;

create or replace function public.get_public_moong_ranked_post_ids(
  p_source_keys text[],
  p_classifier_version text,
  p_limit integer default 200
)
returns table (
  post_id uuid,
  ranking_score numeric,
  sincerity_score numeric,
  engagement_score numeric,
  like_count integer
)
language sql
stable
as $$
  with candidates as (
    select
      posts.id as post_id,
      posts.platform_post_id,
      posts.posted_at,
      posts.promoted_at,
      metrics.score::numeric as engagement_score,
      metrics.like_count,
      decisions.primary_character,
      decisions.secondary_characters,
      case
        when public.moong_is_recommended_sincerity_candidate(
          decisions.primary_character,
          decisions.secondary_characters
        )
          then 1::numeric
        else 0::numeric
      end as observed_sincerity
    from public.social_posts as posts
    join public.social_post_metrics as metrics
      on metrics.post_id = posts.id
    join public.social_post_character_decisions as decisions
      on decisions.post_id = posts.id
    join public.social_sources as sources
      on sources.platform = posts.platform
     and sources.source_key = posts.source_key
    where posts.visibility_status = 'promoted'
      and posts.source_key = any(coalesce(p_source_keys, '{}'::text[]))
      and decisions.classifier_version = p_classifier_version
      and coalesce(sources.is_protected, false) = false
  ),
  category_observations as (
    select
      candidates.post_id,
      categories.category,
      candidates.observed_sincerity
    from candidates
    cross join lateral (
      select btrim(candidates.primary_character)::text as category
      where btrim(coalesce(candidates.primary_character, '')) <> ''
      union
      select btrim(secondary.character)::text as category
      from unnest(coalesce(candidates.secondary_characters, '{}'::text[]))
        as secondary(character)
      where btrim(secondary.character) <> ''
        and secondary.character <> candidates.primary_character
    ) as categories
  ),
  category_averages as (
    select
      category,
      avg(observed_sincerity)::numeric as sincerity_average
    from category_observations
    group by category
  ),
  global_average as (
    select coalesce(avg(observed_sincerity), 0.5)::numeric as sincerity_average
    from candidates
  ),
  post_sincerity as (
    select
      candidates.post_id,
      candidates.platform_post_id,
      candidates.posted_at,
      candidates.promoted_at,
      candidates.engagement_score,
      candidates.like_count,
      candidates.observed_sincerity,
      coalesce(
        weighted_categories.weighted_sincerity,
        (select sincerity_average from global_average),
        0.5
      )::numeric as sincerity_score
    from candidates
    left join lateral (
      select
        sum(
          coalesce(
            category_averages.sincerity_average,
            (select sincerity_average from global_average),
            0.5
          ) * post_categories.weight
        ) / nullif(sum(post_categories.weight), 0) as weighted_sincerity
      from (
        select
          btrim(candidates.primary_character)::text as category,
          2::numeric as weight
        where btrim(coalesce(candidates.primary_character, '')) <> ''
        union all
        select distinct
          btrim(secondary.character)::text as category,
          1::numeric as weight
        from unnest(coalesce(candidates.secondary_characters, '{}'::text[]))
          as secondary(character)
        where btrim(secondary.character) <> ''
          and secondary.character <> candidates.primary_character
      ) as post_categories
      left join category_averages
        on category_averages.category = post_categories.category
    ) as weighted_categories on true
  ),
  ranked_visible as (
    select
      post_id,
      sincerity_score as ranking_score,
      sincerity_score,
      engagement_score,
      like_count,
      posted_at,
      promoted_at,
      platform_post_id
    from post_sincerity
    where observed_sincerity = 1
  ),
  top_ranked as (
    select *
    from ranked_visible
    order by
      ranking_score desc,
      engagement_score desc,
      like_count desc,
      posted_at desc nulls last,
      promoted_at desc nulls last,
      platform_post_id desc
    limit greatest(coalesce(p_limit, 200), 0)
  )
  select
    post_id,
    ranking_score,
    sincerity_score,
    engagement_score,
    like_count
  from top_ranked;
$$;

revoke all on function public.get_public_moong_ranked_post_ids(text[], text, integer)
  from public, anon, authenticated;
grant execute on function public.get_public_moong_ranked_post_ids(text[], text, integer)
  to service_role;
