import type { GuardDraft } from "@/lib/contact-import/bounce-guard"
import type { Draft } from "./types"

/** A campaign-page draft in the shape the shared delivery count (lib/contact-import/bounce-guard.ts) reads. */
export const toDeliveryDraft = (d: Draft): GuardDraft => ({
  id: d.id,
  contactId: d.contact.id,
  status: d.status,
  sentAt: d.sentAt ?? null,
  hasBounced: Boolean(d.hasBounced),
})
