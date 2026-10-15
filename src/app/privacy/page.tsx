import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy | Scrunity",
  description: "Read Scrunity's privacy policy to understand how we collect, use, and protect your personal, analytics, e-signature, and financial information.",
  alternates: {
    canonical: "/privacy",
  },
  openGraph: {
    title: "Privacy Policy | Scrunity",
    description: "Read Scrunity's privacy policy to understand how we collect, use, and protect your personal, analytics, e-signature, and financial information.",
    url: "/privacy",
  },
};

export default function PrivacyPage() {
  return (
    <div className="flex min-h-svh flex-col bg-background text-foreground font-sans selection:bg-border-strong">
      <header className="px-6 py-4 border-b border-border flex items-center justify-between">
        <Link href="/" className="text-sm font-medium text-fg-muted hover:text-fg-strong transition-colors">
          &larr; Back to Scrunity
        </Link>
        <span className="text-xs text-fg-muted font-mono">beta.scrunity.com</span>
      </header>
      <main className="flex-1 w-full max-w-4xl mx-auto px-6 py-16 md:py-24">
        <div className="space-y-12">
          <div className="space-y-4">
            <h1 className="text-title text-fg-strong">
              Privacy Policy
            </h1>
            <p className="text-body text-fg-muted">
              Last updated: {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
            </p>
          </div>

          <div className="space-y-8 text-fg-default text-body">
            <section className="space-y-3">
              <h2 className="text-section text-fg-strong">1. Information We Collect</h2>
              <p>
                We collect personal, business, and usage information necessary to provide project management, contract e-signing, payment tracking, and platform analytics:
              </p>
              <ul className="list-disc pl-6 space-y-1.5 text-fg-muted">
                <li><strong className="text-fg-strong">Account Credentials:</strong> Full name, email address, profile photo, and organization metadata collected via Google OAuth.</li>
                <li><strong className="text-fg-strong">Project & Legal Data:</strong> Uploaded contracts (SOW, NDA, NOC, MSA, Addendums), Statements of Work, proposals, deliverables, and discussion messages.</li>
                <li><strong className="text-fg-strong">Audit & E-Signatures:</strong> IP addresses, timestamps, user-agent signatures, drawn/typed signature data, and SHA-256 document hashes for legal verification.</li>
                <li><strong className="text-fg-strong">Payment & Financial Metadata:</strong> Subscription plan statuses, payment milestone amounts, reference notes (UTR / Transaction IDs), and payment verification logs.</li>
                <li><strong className="text-fg-strong">Usage Analytics & Telemetry:</strong> Device type, browser type, page views, click interactions, and feature usage patterns via privacy-conscious analytics providers (e.g. PostHog).</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-section text-fg-strong">2. Payment Processing & Merchant of Record</h2>
              <p>
                Subscription payments for Scrunity SaaS plans are securely facilitated by our Merchant of Record partner, <strong className="text-fg-strong">Dodo Payments</strong>.
              </p>
              <p className="text-fg-muted">
                When you subscribe to a paid plan on Scrunity, Dodo Payments collects and processes payment credentials (including Credit/Debit Card numbers, UPI IDs, or Netbanking details). Scrunity does not directly store full credit card numbers or sensitive banking credentials on our servers.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-section text-fg-strong">3. Analytics & Product Telemetry</h2>
              <p className="text-fg-muted">
                We use privacy-conscious product analytics tools (such as PostHog) to understand how users interact with Scrunity, diagnose performance bottlenecks, and improve product workflows. This data is collected solely to optimize user experience and is never sold to third-party ad networks.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-section text-fg-strong">4. How We Use Your Information</h2>
              <p className="text-fg-muted">
                We utilize collected information solely to facilitate project collaboration, generate legal contract audit logs, send automated notifications, perform product analytics, and maintain platform security.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-section text-fg-strong">5. Data Storage & Security</h2>
              <p className="text-fg-muted">
                We enforce industry-standard security measures including HTTPS/TLS encryption in transit, AES-256 encrypted storage, SHA-256 document cryptographic hashing, and restricted database access to protect your documents and financial records against unauthorized access.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-section text-fg-strong">6. Third-Party Service Providers</h2>
              <p className="text-fg-muted">
                We share data with trusted infrastructure providers (Neon Postgres for database, Vercel Blob for document storage, Resend for transactional email, PostHog for telemetry, and Dodo Payments for subscription billing) under strict data protection protocols.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-section text-fg-strong">7. Contact & Support</h2>
              <p className="text-fg-muted">
                For questions or data deletion requests regarding this Privacy Policy, please reach out to us at <a href="mailto:support@scrunity.com" className="text-fg-strong underline underline-offset-4">support@scrunity.com</a>.
              </p>
            </section>
          </div>
        </div>
      </main>
      <footer className="px-6 py-6 border-t border-border text-center text-xs text-fg-muted">
        &copy; {new Date().getFullYear()} Scrunity. All rights reserved.
      </footer>
    </div>
  );
}
