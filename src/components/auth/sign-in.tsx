"use client"

import { Button } from "@/components/ui/button"
import { GoogleLogo } from "@/components/ui/google-logo"
import { signIn } from "@/lib/auth-client"
import React, { useState } from "react"
import { Loader2 } from "@/components/ui/icons"
import Link from "next/link"
import Image from "next/image"
import { MagicLinkForm } from "./magic-link-form"

/** Messages for the `?error=` the magic-link verify endpoint and the proxy redirect with. */
function signInErrorMessage(error: string | undefined): string | null {
  if (!error) return null
  if (error === "session_unavailable") return "We couldn't check your session. Please sign in again."
  return "That sign-in link is invalid, expired or already used. Request a new one."
}

export const SignInComp = ({ error, next }: { error?: string; next?: string }) => {
  const [isLoading, setIsLoading] = useState(false)
  const errorMessage = signInErrorMessage(error)

  const handleGoogleSignIn = async () => {
    setIsLoading(true)
    try {
      await signIn.social({
        provider: "google",
        callbackURL: next ?? "/dashboard",
        errorCallbackURL: "/error",
        newUserCallbackURL: next ?? "/onboarding",
      })
    } catch (error) {
      console.error("Sign in failed:", error)
      setIsLoading(false)
    }
  }
  return (
    <div className="flex min-h-svh items-center justify-center">
      <div className="flex w-full max-w-xs flex-col justify-center space-y-6 px-2 py-4">
        {/* Header */}
        <div className="flex flex-col space-y-1 text-center">
          <div className="mb-2 flex justify-center">
            <Image
              src="/logo/scrunity_logo_svg.svg"
              alt="Scrunity Logo"
              width={100}
              height={100}
              className="h-14 w-14 invert dark:invert-0"
            />
          </div>
          <h1 className="text-lg font-semibold tracking-tight text-balance">
            Login or Create your account
          </h1>
        </div>

        <div className="grid gap-2">
          <Button
            variant="outline"
            type="button"
            disabled={isLoading}
            onClick={handleGoogleSignIn}
            className="group relative overflow-hidden text-sm transition-transform hover:shadow active:scale-[0.96]"
          >
            {isLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <GoogleLogo className="mr-2" />
            )}
            <span className="font-medium">Continue with Google</span>
          </Button>
        </div>

        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <span className="h-px flex-1 bg-border" />
          or
          <span className="h-px flex-1 bg-border" />
        </div>

        <MagicLinkForm next={next} />

        {errorMessage && (
          <p role="alert" className="text-center text-xs text-muted-foreground">
            {errorMessage}
          </p>
        )}

        <div>
          <p className="px-2 text-center text-xs text-balance text-muted-foreground">
            By clicking continue, you agree to our{" "}
            <Link
              href="/terms"
              className="underline underline-offset-4 transition-colors hover:text-primary"
            >
              Terms of Service
            </Link>{" "}
            and{" "}
            <Link
              href="/privacy"
              className="underline underline-offset-4 transition-colors hover:text-primary"
            >
              Privacy Policy
            </Link>
            .
          </p>
        </div>
      </div>
    </div>
  )
}
