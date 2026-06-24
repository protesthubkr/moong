import Link from "next/link";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { getMoongConfig } from "@/lib/social/config";
import { getOpsData } from "@/lib/social/repository";

export const dynamic = "force-dynamic";

export default async function OpsPage() {
  const config = getMoongConfig();
  const ops = await getOpsData({ supabase: getSupabaseAdminClient() });

  return (
    <main className="ops-page">
      <header className="ops-header">
        <Link className="ops-brand" href="/">
          {/* eslint-disable-next-line @next/next/no-img-element -- tiny local logo */}
          <img alt="" src="/moong-logo.png" />
          <span>Ops</span>
        </Link>
        <dl className="ops-config">
          <div>
            <dt>threshold</dt>
            <dd>{config.likeThreshold.toLocaleString("ko-KR")}</dd>
          </div>
          <div>
            <dt>refresh</dt>
            <dd>{config.metricRefreshWindowHours}h</dd>
          </div>
        </dl>
      </header>

      <section className="ops-stats" aria-label="운영 현황">
        <Stat label="sources" value={ops.counts.sources} />
        <Stat label="promoted" value={ops.counts.promoted} />
        <Stat label="tracking" value={ops.counts.tracking} />
        <Stat label="archived" value={ops.counts.archived} />
      </section>

      <section className="ops-section">
        <div className="ops-section-heading">
          <h1>Ranking</h1>
        </div>
        <div className="ops-ranking">
          {ops.ranking.map((post, index) => (
            <article className="ops-ranking-row" key={post.id}>
              <span className="ops-rank">{index + 1}</span>
              <div className="ops-ranking-body">
                <a href={post.sourceUrl} rel="noopener noreferrer" target="_blank">
                  @{post.authorUsername}
                </a>
                <p>{post.text}</p>
              </div>
              <dl className="ops-metrics">
                <div>
                  <dt>score</dt>
                  <dd>{Math.round(post.metrics.score).toLocaleString("ko-KR")}</dd>
                </div>
                <div>
                  <dt>like</dt>
                  <dd>{post.metrics.like_count.toLocaleString("ko-KR")}</dd>
                </div>
                <div>
                  <dt>repost</dt>
                  <dd>{post.metrics.repost_count.toLocaleString("ko-KR")}</dd>
                </div>
                <div>
                  <dt>reply</dt>
                  <dd>{post.metrics.reply_count.toLocaleString("ko-KR")}</dd>
                </div>
                <div>
                  <dt>quote</dt>
                  <dd>{post.metrics.quote_count.toLocaleString("ko-KR")}</dd>
                </div>
              </dl>
            </article>
          ))}
          {ops.ranking.length === 0 ? (
            <p className="ops-empty">No promoted posts yet.</p>
          ) : null}
        </div>
      </section>

      <section className="ops-grid">
        <div className="ops-section">
          <div className="ops-section-heading">
            <h2>Sources</h2>
          </div>
          <div className="ops-table-wrap">
            <table className="ops-table">
              <thead>
                <tr>
                  <th>source</th>
                  <th>status</th>
                  <th>followers</th>
                  <th>last scan</th>
                </tr>
              </thead>
              <tbody>
                {ops.sources.map((source) => (
                  <tr key={`${source.platform}:${source.source_key}`}>
                    <td>
                      <span className="ops-source-name">{source.display_name}</span>
                      <span className="ops-source-handle">@{source.username}</span>
                    </td>
                    <td>{formatSourceStatus(source)}</td>
                    <td>{source.follower_count?.toLocaleString("ko-KR") ?? "-"}</td>
                    <td>{formatDateTime(source.last_scanned_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="ops-section">
          <div className="ops-section-heading">
            <h2>Runs</h2>
          </div>
          <div className="ops-runs">
            {ops.runs.map((run) => (
              <article className="ops-run" key={run.id}>
                <div>
                  <strong>{run.run_type}</strong>
                  <span>{run.status}</span>
                </div>
                <p>
                  {formatDateTime(run.started_at)} · sources {run.source_count} ·
                  posts {run.posts_seen}/{run.posts_written} · promoted{" "}
                  {run.posts_promoted}
                </p>
                {run.error_message ? <p>{run.error_message}</p> : null}
              </article>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="ops-stat">
      <dt>{label}</dt>
      <dd>{value.toLocaleString("ko-KR")}</dd>
    </div>
  );
}

function formatDateTime(value: string | null) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("ko-KR", {
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
    minute: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Seoul",
  }).format(new Date(value));
}

function formatSourceStatus(source: {
  enabled: boolean;
  is_following: boolean;
  is_protected: boolean;
}) {
  if (!source.enabled) {
    return "disabled";
  }

  if (!source.is_following) {
    return "unfollowed";
  }

  if (source.is_protected) {
    return "protected";
  }

  return "enabled";
}
