import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service | Scrunity",
  description: "Read Scrunity's terms of service governing subscription plans, payment milestones, e-signatures, acceptable use, and platform usage.",
  alternates: {
    canonical: "/terms",
  },
  openGraph: {
    title: "Terms of Service | Scrunity",
    description: "Read Scrunity's terms of service governing subscription plans, payment milestones, e-signatures, acceptable use, and platform usage.",
    url: "/terms",
  },
};

export default function TermsPage() {
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
              Terms of Service
            </h1>
            <p className="text-body text-fg-muted">
              Last updated: {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
            </p>
          </div>

          <div className="space-y-8 text-fg-default text-body">
            {/* 1. Acceptance */}
            <section className="space-y-3">
              <h2 className="text-section text-fg-strong">1. Acceptance & Description of Service</h2>
              <p className="text-fg-muted">
                Scrunity ("the Service", hosted at <strong className="text-fg-strong">beta.scrunity.com</strong>) is a client collaboration, e-signature, and revenue protection platform for agencies, freelancers, and clients. By creating an account, accessing, or using the Service, you agree to be bound by these Terms of Service. If you do not agree, please do not access or use the Service.
              </p>
            </section>

            {/* 2. Merchant of Record */}
            <section className="space-y-3">
              <h2 className="text-section text-fg-strong">2. Merchant of Record & Billing Terms</h2>
              <p>
                All online SaaS subscription plan billing (Free, Freelancer, Agency tiers) for Scrunity are powered, billed, and fulfilled by our Merchant of Record partner, <strong className="text-fg-strong">Dodo Payments</strong>.
              </p>
              <ul className="list-disc pl-6 space-y-1.5 text-fg-muted">
                <li>Dodo Payments handles payment authorization, invoice generation, global sales tax/GST compliance, and currency settlement for Scrunity SaaS subscriptions.</li>
                <li>Subscriptions automatically renew monthly unless cancelled prior to the renewal date via Organization Settings.</li>
                <li>Prices are displayed in USD or INR as specified during checkout.</li>
              </ul>
            </section>

            {/* 3. Refund & Cancellation */}
            <section className="space-y-3">
              <h2 className="text-section text-fg-strong">3. Refund & Cancellation Policy</h2>
              <p className="text-fg-default">
                We strive to ensure complete satisfaction with Scrunity:
              </p>
              <ul className="list-disc pl-6 space-y-1.5 text-fg-muted">
                <li><strong className="text-fg-strong">14-Day Money-Back Guarantee:</strong> If you are unsatisfied with a paid subscription plan within 14 days of your initial upgrade, contact <a href="mailto:support@scrunity.com" className="text-fg-strong underline underline-offset-4">support@scrunity.com</a> for a full refund.</li>
                <li><strong className="text-fg-strong">Subscription Cancellation:</strong> You can cancel your subscription at any time. Your access will remain active through the end of your current paid billing period.</li>
                <li><strong className="text-fg-strong">Project Milestone Payments:</strong> Client-to-agency project milestone tracking is governed by the specific project contract and deliverable acceptance terms agreed upon directly between the Agency and Client.</li>
              </ul>
            </section>

            {/* 4. Electronic Signatures */}
            <section className="space-y-3">
              <h2 className="text-section text-fg-strong">4. Electronic Signatures & Contracts</h2>
              <p className="text-fg-muted">
                Scrunity facilitates electronic signature execution for Statements of Work (SOW), NDAs, MSAs, NOCs, and project addendums uploaded by agencies or clients. By executing a signature on Scrunity, you affirm that your electronic signature is <strong className="text-fg-strong">intended to be legally binding and enforceable to the extent permitted by applicable law</strong>. You are solely responsible for ensuring that electronic execution satisfies statutory legal requirements in your jurisdiction.
              </p>
            </section>

            {/* 5. Acceptable Use Policy */}
            <section className="space-y-3">
              <h2 className="text-section text-fg-strong">5. Acceptable Use Policy</h2>
              <p className="text-fg-muted">
                You agree not to misuse the Service. Specifically, you agree not to:
              </p>
              <ul className="list-disc pl-6 space-y-1.5 text-fg-muted">
                <li>Upload fraudulent, unlawful, defamatory, or infringing content.</li>
                <li>Engage in unauthorized access, probing, scanning, or security testing of our systems.</li>
                <li>Reverse engineer, decompile, or attempt to derive source code from the Service.</li>
                <li>Use automated scripts or bots to spam, scrape, or overload platform infrastructure.</li>
              </ul>
            </section>

            {/* 6. Intellectual Property & Ownership */}
            <section className="space-y-3">
              <h2 className="text-section text-fg-strong">6. Intellectual Property & Ownership</h2>
              <ul className="list-disc pl-6 space-y-1.5 text-fg-muted">
                <li><strong className="text-fg-strong">Your Content:</strong> You retain full ownership and intellectual property rights to all contracts, proposals, files, deliverables, and communications uploaded to Scrunity. You grant us a limited license solely to host and process your content to provide the Service.</li>
                <li><strong className="text-fg-strong">Platform IP:</strong> Scrunity retains all right, title, and interest in and to the platform software, source code, UI designs, brand assets, and logos.</li>
              </ul>
            </section>

            {/* 7. Account Suspension & Termination */}
            <section className="space-y-3">
              <h2 className="text-section text-fg-strong">7. Account Suspension & Termination</h2>
              <p className="text-fg-muted">
                We reserve the right to temporarily suspend or permanently terminate your account or access to the Service at our sole discretion, with or without notice, in the event of a material breach of these Terms, non-payment, suspected fraudulent activity, or legal/security requirements.
              </p>
            </section>

            {/* 8. Warranty Disclaimer */}
            <section className="space-y-3">
              <h2 className="text-section text-fg-strong">8. Warranty Disclaimer</h2>
              <p className="text-fg-muted">
                THE SERVICE IS PROVIDED ON AN "AS IS" AND "AS AVAILABLE" BASIS WITHOUT WARRANTIES OF ANY KIND, WHETHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, OR NON-INFRINGEMENT. SCRUNITY DOES NOT WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED, ERROR-FREE, OR COMPLETELY SECURE.
              </p>
            </section>

            {/* 9. Limitation of Liability */}
            <section className="space-y-3">
              <h2 className="text-section text-fg-strong">9. Limitation of Liability</h2>
              <p className="text-fg-muted">
                TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, IN NO EVENT SHALL SCRUNITY, ITS AFFILIATES, OR SUPPLIERS BE LIABLE FOR ANY INDIRECT, INCIDENTAL, CONSEQUENTIAL, SPECIAL, OR PUNITIVE DAMAGES, OR LOSS OF PROFITS OR REVENUE. SCRUNITY'S AGGREGATE LIABILITY ARISING OUT OF OR RELATING TO THESE TERMS OR THE SERVICE SHALL NOT EXCEED THE TOTAL FEES PAID BY YOU TO SCRUNITY IN THE TWELVE (12) MONTHS PRECEDING THE CLAIM (OR $100 USD IF NO PAYMENTS WERE MADE).
              </p>
            </section>

            {/* 10. Governing Law & Dispute Resolution */}
            <section className="space-y-3">
              <h2 className="text-section text-fg-strong">10. Governing Law & Dispute Resolution</h2>
              <p className="text-fg-muted">
                These Terms shall be governed by and construed in accordance with the laws of India, without regard to its conflict of law principles. Any dispute or claim arising out of or in connection with these Terms or the Service shall be subject to the exclusive jurisdiction of the courts located in India.
              </p>
            </section>

            {/* 11. Modifications to Terms */}
            <section className="space-y-3">
              <h2 className="text-section text-fg-strong">11. Modifications to Terms</h2>
              <p className="text-fg-muted">
                We reserve the right to update or modify these Terms of Service at any time. When we make material changes, we will update the "Last updated" date at the top of this page. Your continued use of the Service after any changes constitutes acceptance of the updated Terms.
              </p>
            </section>

            {/* 12. Contact */}
            <section className="space-y-3">
              <h2 className="text-section text-fg-strong">12. Contact Information</h2>
              <p className="text-fg-muted">
                For questions regarding these Terms, legal notices, or billing support, please contact us at <a href="mailto:support@scrunity.com" className="text-fg-strong underline underline-offset-4">support@scrunity.com</a>.
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
