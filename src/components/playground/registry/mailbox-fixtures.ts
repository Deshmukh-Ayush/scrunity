import type { MailboxThread } from "@/lib/mailbox-thread-types"

/**
 * Fake mailbox data for the testing route only. Never shown in the product
 * and never written anywhere. Times are fixed so screenshots are stable.
 */

const at = (iso: string) => new Date(iso).toISOString()
const ME = "founder@acme-outbound.com"

function thread(
  partial: Partial<MailboxThread> &
    Pick<MailboxThread, "id" | "subject" | "contact" | "messages">
): MailboxThread {
  const last = partial.messages[partial.messages.length - 1]
  return {
    draftId: `draft-${partial.id}`,
    threadId: null,
    company: { id: null, name: null, domain: null },
    campaign: { id: "fixture-campaign", name: "Mid-market logistics" },
    sentAt: partial.messages[0].timestamp,
    lastActivityAt: last.timestamp,
    latestSnippet: last.body,
    latestSender: last.isOutbound ? "You" : partial.contact.name,
    classifiedIntent: null,
    hasReply: partial.messages.some((m) => !m.isOutbound),
    isUnread: false,
    isBounced: false,
    bounceReason: null,
    ...partial,
  }
}

const sent = (
  id: string,
  to: string,
  toName: string,
  timestamp: string,
  body: string
) => ({
  id,
  from: ME,
  fromName: "You",
  to,
  toName,
  timestamp: at(timestamp),
  body,
  isOutbound: true,
})

const reply = (
  id: string,
  from: string,
  fromName: string,
  timestamp: string,
  body: string,
  classifiedIntent?: string
) => ({
  id,
  from,
  fromName,
  to: ME,
  toName: "You",
  timestamp: at(timestamp),
  body,
  isOutbound: false,
  classifiedIntent: classifiedIntent ?? null,
})

const OUTREACH =
  "Hi Dana,\n\nNoticed Northwind moved its dispatch team to Austin. We help freight teams book 3x more demos without hiring.\n\nWorth a 15-minute look? https://cal.example.com/acme-15\n\nAyush"

export const FIXTURE_THREADS: MailboxThread[] = [
  thread({
    id: "t-interested",
    subject: "Freight demos without hiring",
    contact: {
      id: "c1",
      name: "Dana Whitfield",
      email: "dana@northwind.example",
      title: "VP Operations",
      linkedinUrl: null,
    },
    company: {
      id: "co1",
      name: "Northwind Analytics",
      domain: "northwind.example",
    },
    classifiedIntent: "interested",
    isUnread: true,
    messages: [
      sent(
        "m1",
        "dana@northwind.example",
        "Dana Whitfield",
        "2026-10-15T14:05:00Z",
        OUTREACH
      ),
      reply(
        "m2",
        "dana@northwind.example",
        "Dana Whitfield",
        "2026-10-16T09:12:00Z",
        "Sounds good, let&#39;s talk Tuesday. Can you send times?\n\nOn Thu, Oct 15, 2026 at 2:05 PM Ayush <founder@acme-outbound.com> wrote:\n> Hi Dana,\n> Noticed Northwind moved its dispatch team to Austin.\n> Worth a 15-minute look?",
        "interested"
      ),
    ],
  }),
  thread({
    id: "t-question",
    subject: "Quick question on pricing",
    contact: {
      id: "c2",
      name: "Priya Raman",
      email: "priya@lattice.example",
      title: "Head of Growth",
      linkedinUrl: null,
    },
    company: { id: "co2", name: "Lattice Freight", domain: "lattice.example" },
    classifiedIntent: "question",
    isUnread: true,
    messages: [
      sent(
        "m3",
        "priya@lattice.example",
        "Priya Raman",
        "2026-10-14T10:00:00Z",
        "Hi Priya, a short note about outbound for Lattice."
      ),
      reply(
        "m4",
        "priya@lattice.example",
        "Priya Raman",
        "2026-10-15T16:40:00Z",
        "How does pricing work for a team of 12?",
        "question"
      ),
    ],
  }),
  thread({
    id: "t-bounced",
    subject: "Outbound for Acme Robotics",
    contact: {
      id: "c3",
      name: "Marco Ruiz",
      email: "marco@acme-robotics.example",
      title: "COO",
      linkedinUrl: null,
    },
    company: {
      id: "co3",
      name: "Acme Robotics",
      domain: "acme-robotics.example",
    },
    isBounced: true,
    isUnread: true,
    bounceReason:
      "Address not found Your message wasn&#39;t delivered to marco@acme-robotics.example because the address couldn&#39;t be found.",
    messages: [
      sent(
        "m5",
        "marco@acme-robotics.example",
        "Marco Ruiz",
        "2026-10-13T09:00:00Z",
        "Hi Marco, a quick idea for Acme's warehouse team."
      ),
      {
        id: "m6",
        from: "mailer-daemon@googlemail.com",
        fromName: "Mail Delivery Subsystem",
        to: ME,
        toName: "You",
        timestamp: at("2026-10-13T09:01:00Z"),
        body: "Address not found Your message wasn&#39;t delivered to marco@acme-robotics.example because the address couldn&#39;t be found.",
        isOutbound: false,
      },
    ],
  }),
  thread({
    id: "t-not-interested",
    subject: "Outbound for Bluefin",
    contact: {
      id: "c4",
      name: "Sam Okafor",
      email: "sam@bluefin.example",
      title: "CEO",
      linkedinUrl: null,
    },
    company: { id: "co4", name: "Bluefin Health", domain: "bluefin.example" },
    classifiedIntent: "not_interested",
    messages: [
      sent(
        "m7",
        "sam@bluefin.example",
        "Sam Okafor",
        "2026-10-09T09:00:00Z",
        "Hi Sam, a short note about outbound."
      ),
      reply(
        "m8",
        "sam@bluefin.example",
        "Sam Okafor",
        "2026-10-10T11:00:00Z",
        "Not a fit for us right now, thanks.",
        "not_interested"
      ),
    ],
  }),
  thread({
    id: "t-hostile",
    subject: "Re: <b>Partnership</b> &amp; next steps",
    contact: {
      id: "c5",
      name: "Unknown Sender With A Very Long Name That Keeps Going",
      email: "noreply@example.com",
      title: "",
      linkedinUrl: null,
    },
    company: {
      id: "co5",
      name: "International Enterprise Logistics & Advanced Technology Solutions Corporation",
      domain: null,
    },
    classifiedIntent: "auto_reply",
    messages: [
      sent(
        "m9",
        "noreply@example.com",
        "Unknown Sender",
        "2026-10-08T09:00:00Z",
        "Hi there, a short note."
      ),
      reply(
        "m10",
        "noreply@example.com",
        "Unknown Sender",
        "2026-10-08T09:30:00Z",
        'Thanks &lt;script&gt;alert("x")&lt;/script&gt; <img src=x onerror="alert(1)"> <a href="javascript:alert(2)">click</a>\nVisit https://example.com/out-of-office.',
        "auto_reply"
      ),
    ],
  }),
  thread({
    id: "t-sent",
    subject: "Booking more freight demos",
    contact: {
      id: "c6",
      name: "Ray Rike",
      email: "ray@benchmarkit.example",
      title: "Founder",
      linkedinUrl: null,
    },
    company: { id: "co6", name: "Benchmarkit", domain: null },
    messages: [
      sent(
        "m11",
        "ray@benchmarkit.example",
        "Ray Rike",
        "2026-10-07T09:00:00Z",
        "Hi Ray, congrats on the launch of your 2026 report."
      ),
    ],
  }),
]
