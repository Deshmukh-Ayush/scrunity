import { getTenantContext } from "@/lib/tenant-context"
import { getHomeFeed } from "@/lib/data/home"
import { asJson } from "@/lib/data/serialize"
import type { HomeFeed } from "@/lib/data/home"
import { HomeClient } from "./home-client"

const EMPTY_FEED: HomeFeed = { needsYou: [], activity: [], hasChats: false }

/** Server-fetches the Home feed (needs you, today's activity, whether chats exist). */
export async function Home({ firstName }: { firstName: string | null }) {
  const { organizationId } = await getTenantContext()
  const feed = organizationId ? await getHomeFeed(organizationId) : EMPTY_FEED

  return <HomeClient firstName={firstName} feed={asJson<HomeFeed>(feed)} />
}
