import Link from "next/link";
import type { PublicMoongFeedItem } from "@/lib/social/types";
import { FeedLoadWindow } from "../feed-load-window";
import { MessageStepScroll } from "../message-step-scroll";
import { MoongPartyFilter } from "../moong-party-filter";
import { ScrollToBottom } from "../scroll-to-bottom";
import { MoongFeedItem } from "./feed-item";
import { getPartyFilterOptions } from "./party-options";

const PUBLIC_FEED_BATCH_SIZE = 20;

export function MoongFeedPage({ items }: { items: PublicMoongFeedItem[] }) {
  const partyOptions = getPartyFilterOptions(items);
  const hasItems = items.length > 0;

  return (
    <main className="moong-page">
      <ScrollToBottom enabled={hasItems} />
      <MessageStepScroll enabled={hasItems} />
      <MoongPartyFilter options={partyOptions} />
      <header className="moong-topbar">
        <Link aria-label="뭉" className="moong-brand" href="/">
          {/* eslint-disable-next-line @next/next/no-img-element -- tiny local logo, stable dimensions */}
          <img alt="" className="moong-brand-mark" src="/moong-logo.png" />
        </Link>
      </header>

      <section aria-label="뭉 피드" className="moong-feed-shell">
        {hasItems ? <MoongFeedList items={items} /> : <MoongEmptyFeed />}
      </section>
    </main>
  );
}

function MoongFeedList({ items }: { items: PublicMoongFeedItem[] }) {
  return (
    <FeedLoadWindow batchSize={PUBLIC_FEED_BATCH_SIZE}>
      {items.map((item) => (
        <li
          className="moong-feed-item"
          data-feed-item-id={item.id}
          key={item.id}
        >
          <MoongFeedItem item={item} />
        </li>
      ))}
    </FeedLoadWindow>
  );
}

function MoongEmptyFeed() {
  return (
    <div className="moong-empty">
      <p>아직 올라온 글이 없습니다.</p>
    </div>
  );
}
