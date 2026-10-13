import { getTenantContext } from "@/lib/tenant-context"
import { getMailboxThreads } from "@/lib/data/mailbox"
import { asJson } from "@/lib/data/serialize"
import type { MailboxThread } from "@/lib/mailbox-thread-types"
import { MailboxClient } from "./mailbox-client"
import type { ConnectedMailboxInfo } from "./types"

/** Server-fetches the unfiltered thread list and mailbox record for /dashboard/mailbox. */
export async function Mailbox() {
  const { organizationId } = await getTenantContext()
  const { mailbox, threads } = organizationId
    ? await getMailboxThreads(organizationId)
    : { mailbox: null, threads: [] }

  return (
    <MailboxClient
      initialThreads={asJson<MailboxThread[]>(threads)}
      initialMailbox={asJson<ConnectedMailboxInfo | null>(mailbox)}
    />
  )
}
