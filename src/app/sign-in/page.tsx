import type { Metadata } from "next"
import { SignInComp } from "@/components/auth/sign-in"
import { safeSignInNext } from "@/lib/sign-in-next"
import React from "react"

export const metadata: Metadata = {
  title: "Sign In",
  description: "Sign in to your Scrunity account to manage your client workspace, contracts, and deliverables.",
  alternates: {
    canonical: "/sign-in",
  },
  openGraph: {
    title: "Sign In | Scrunity",
    description: "Sign in to your Scrunity account to manage your client workspace, contracts, and deliverables.",
    url: "/sign-in",
  },
  twitter: {
    card: "summary_large_image",
    title: "Sign In | Scrunity",
    description: "Sign in to your Scrunity account to manage your client workspace, contracts, and deliverables.",
  },
}

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string | string[]; next?: string | string[] }>
}) {
  const { error, next } = await searchParams
  return (
    <div>
      <SignInComp
        error={typeof error === "string" ? error : undefined}
        next={safeSignInNext(typeof next === "string" ? next : null) ?? undefined}
      />
    </div>
  )
}
