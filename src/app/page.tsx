import Link from "next/link";
import type { Metadata } from "next";
import { Container } from "@/components/landing/container";
import Image from "next/image";
import { Instrument_Serif } from "next/font/google";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = {
  title: "Scrunity — Client Collaboration & Workspace",
  description: "Seamless client workspace for modern agencies and freelancers.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "Scrunity — Client Collaboration & Workspace",
    description: "Seamless client workspace for modern agencies and freelancers.",
    url: "/",
  },
};

const newsreader = Instrument_Serif({ subsets: ["latin"], weight: ["400"] });

export default function Page() {

  return (
      <div className="dark min-h-screen w-full bg-neutral-950">
      <Container className="relative min-h-screen px-4 sm:px-6 pt-12 sm:pt-20 pb-16">
        <header className="flex flex-col">
          <div className="flex items-end gap-2">
            <Image
            src="/logo/scrunity-logo-light.png"
            alt="Scrunity — AI research and mind map tool"
            width={100}
            height={100}
            className="w-16 h-16 sm:w-25 sm:h-25"
            priority
          />
          <Badge>Under Construction</Badge>
          </div>
          <h1 className={`${newsreader.className} text-3xl sm:text-5xl md:text-6xl mt-4 text-neutral-100`}>
            Improve your client&apos;s <br /> experience
          </h1>
          <p
            className="mt-4 text-md sm:text-lg text-neutral-500"
          >
            Contracts, Deliverables, E-Signatures, Payment Tracking, <br /> Timelines
            and more. Join the waitlist to get early access.
          </p>
        </header>
        <Link href="/sign-in" className="mt-4 inline-block">
          <Button>Get Started</Button>
        </Link>
        <div className="mt-8 sm:mt-12">
        <footer className="mt-12 sm:absolute sm:bottom-4 flex items-center justify-between w-full">
          <p className="text-neutral-400 text-sm">
            Scrunity © 2026
          </p>
          <div>
            <Link href="/privacy" className="text-neutral-400 text-sm">
              Privacy Policy
            </Link>
            <Link href="/terms" className="text-neutral-400 text-sm ml-4">
              Terms of Service
            </Link>
          </div>
        </footer>
        </div>
      </Container>
    </div>
  );
}
