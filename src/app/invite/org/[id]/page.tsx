import type { Metadata } from "next"
import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import { AcceptInvitation } from "@/components/invite/accept-invitation"

export const metadata: Metadata = {
  title: "Join workspace | Scrunity",
  robots: { index: false, follow: false },
}

/** Target of the team invitation email link (`/invite/org/<invitationId>`). */
export default async function InvitationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await auth.api.getSession({ headers: await headers() })

  return (
    <div className="flex min-h-svh items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-4 text-center">
        <h1 className="text-lg font-semibold">Workspace invitation</h1>
        <AcceptInvitation inviteId={id} signedInEmail={session?.user.email ?? null} />
      </div>
    </div>
  )
}
