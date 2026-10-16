import type { Metadata } from "next"
import { Mailbox } from "@/components/mailbox/mailbox"

export const metadata: Metadata = {
  title: "Mailbox | Scrunity",
  description: "Sent campaign emails and the replies to them.",
}

export default function MailboxPage() {
  return <Mailbox />
}
