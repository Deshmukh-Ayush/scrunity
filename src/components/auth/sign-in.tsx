"use client"

import { Button } from "@/components/ui/button"
import { signIn } from "@/lib/auth-client"
import React, { useState } from "react"
import { Loader2 } from "lucide-react"
import Link from "next/link"
import Image from "next/image"
import { MagicLinkForm } from "./magic-link-form"

/** Messages for the `?error=` the magic-link verify endpoint and the proxy redirect with. */
function signInErrorMessage(error: string | undefined): string | null {
  if (!error) return null
  if (error === "session_unavailable") return "We couldn't check your session. Please sign in again."
  return "That sign-in link is invalid, expired or already used. Request a new one."
}

export const SignInComp = ({ error }: { error?: string }) => {
  const [isLoading, setIsLoading] = useState(false)
  const errorMessage = signInErrorMessage(error)

  const handleGoogleSignIn = async () => {
    setIsLoading(true)
    try {
      await signIn.social({
        provider: "google",
        callbackURL: "/dashboard",
        errorCallbackURL: "/error",
        newUserCallbackURL: "/onboarding",
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
            className="group relative h-9 overflow-hidden text-sm shadow-sm transition-transform hover:shadow active:scale-[0.96]"
          >
            {isLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
            )}
            <span className="font-medium">Continue with Google</span>
          </Button>
        </div>

        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <span className="h-px flex-1 bg-border" />
          or
          <span className="h-px flex-1 bg-border" />
        </div>

        <MagicLinkForm />

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
