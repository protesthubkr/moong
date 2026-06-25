import { MoongFeedPage } from "@/app/feed/feed-page";
import { getPublicMoongFeed } from "@/lib/social/repository";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

export default async function Home() {
  const items = await loadFeed();

  return <MoongFeedPage items={items} />;
}

async function loadFeed() {
  try {
    return await getPublicMoongFeed({
      limit: 160,
      supabase: getSupabaseAdminClient(),
    });
  } catch (error) {
    console.warn("[moong-feed] failed to load", error);

    return [];
  }
}
