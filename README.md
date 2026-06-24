# 뭉

`뭉`은 `@wordybirdbird`가 팔로우하는 X 계정의 공개 글을 수집하고, 좋아요 기준을 넘은 글을 승격 시각 순서대로 보여주는 독립 앱입니다.

## 방향

- v1은 X 전용입니다.
- DB는 `social_*` 공통 모델을 사용해 `platform = 'x' | 'facebook'` 확장을 염두에 둡니다.
- 공개 피드에는 점수와 좋아요 수를 표시하지 않습니다.
- 점수와 좋아요 수는 `/ops`의 내부 랭킹에서만 봅니다.
- 답글은 원글 context를 품은 형태로 보여줍니다.
- quote tweet은 작성자 텍스트를 중심으로 보여주고, quoted reference는 raw/context에 저장합니다.
- retweet wrapper는 피드에서 제외합니다.

## Local Setup

1. `.env.example`을 `.env.local`로 복사합니다.
2. Supabase, X, 운영 secret을 채웁니다.
3. 새 Supabase 프로젝트에 `supabase/schema.sql`을 적용합니다.
4. 의존성을 설치하고 개발 서버를 실행합니다.

```powershell
npm install
npm run dev
```

## Env

핵심 env:

- `X_BEARER_TOKEN`
- `MOONG_X_FOLLOWING_USERNAME=wordybirdbird`
- `MOONG_SOCIAL_POST_START_DATE=2026-06-01`
- `MOONG_LIKE_THRESHOLD=150`
- `MOONG_METRIC_REFRESH_WINDOW_HOURS=168`
- `MOONG_SCORE_LIKE_WEIGHT=1`
- `MOONG_SCORE_REPOST_WEIGHT=2`
- `MOONG_SCORE_REPLY_WEIGHT=1`
- `MOONG_SCORE_QUOTE_WEIGHT=2`

`MOONG_LIKE_THRESHOLD`는 공개 승격 기준입니다. 점수 공식은 내부 랭킹에만 쓰입니다.

```text
score = like_count * MOONG_SCORE_LIKE_WEIGHT
      + repost_count * MOONG_SCORE_REPOST_WEIGHT
      + reply_count * MOONG_SCORE_REPLY_WEIGHT
      + quote_count * MOONG_SCORE_QUOTE_WEIGHT
```

## Cron

`vercel.json` 기준 schedule은 UTC입니다.

| Route | UTC | KST |
| --- | --- | --- |
| `/api/ingest/social-posts` | `0 * * * *` | 매시간 |
| `/api/ingest/social-sources` | `0 4,11 * * *` | 13:00, 20:00 |

Cron GET은 `Authorization: Bearer $CRON_SECRET`이 필요합니다.

Manual POST는 `Authorization: Bearer $OPS_RUN_SECRET`이 필요합니다.

## Manual Runs

Following 갱신 dry-run:

```powershell
$headers = @{ Authorization = "Bearer $env:OPS_RUN_SECRET" }
Invoke-RestMethod -Method Post "http://localhost:3000/api/ingest/social-sources" `
  -Headers $headers `
  -ContentType "application/json" `
  -Body (@{ dryRun = $true } | ConvertTo-Json)
```

Post 수집 dry-run:

```powershell
Invoke-RestMethod -Method Post "http://localhost:3000/api/ingest/social-posts" `
  -Headers $headers `
  -ContentType "application/json" `
  -Body (@{ dryRun = $true; sourceLimit = 3; startDate = "2026-06-01" } | ConvertTo-Json)
```

## Checks

```powershell
npm run typecheck
npm run lint
npm run build
```
