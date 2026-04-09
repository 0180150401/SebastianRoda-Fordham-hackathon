import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy | 6 degree's",
  description:
    "How NOEM collects, uses, and protects personal information when you use 6 degree's (AI GEO consultant).",
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="scroll-mt-8">
      <h2 className="mt-10 text-lg font-semibold tracking-tight text-foreground first:mt-0">{title}</h2>
      <div className="mt-3 space-y-3 text-sm leading-relaxed text-muted-foreground">{children}</div>
    </section>
  );
}

export default function PolicyPage() {
  return (
    <main className="mx-auto min-h-screen max-w-2xl px-6 py-16">
      <Link href="/" className="text-sm text-muted-foreground hover:text-foreground hover:underline">
        ← Back
      </Link>

      <h1 className="mt-8 text-3xl font-semibold tracking-tight text-foreground">Privacy Policy</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        <span className="text-foreground/90">Effective date:</span> April 9, 2026
      </p>

      <div className="mt-6">
        <p className="text-sm leading-relaxed text-muted-foreground">
          This Privacy Policy describes how{" "}
          <strong className="font-medium text-foreground">NOEM</strong> (“we,” “us,” or “our”) collects, uses,
          discloses, and protects information when you use the <strong className="font-medium text-foreground">6 degree&apos;s</strong>{" "}
          website and related services (the <strong className="font-medium text-foreground">“Service”</strong>), including our AI-assisted
          brand and visibility (“GEO”) tools. By using the Service, you agree to this Policy. If you do not agree, please do not use the
          Service.
        </p>

        <Section title="1. Who we are">
          <p>
            The Service is operated by NOEM. For privacy inquiries, contact:{" "}
            <a className="font-medium text-foreground underline underline-offset-2" href="mailto:hello@noemtech.com">
              hello@noemtech.com
            </a>
            .
          </p>
        </Section>

        <Section title="2. Information we collect">
          <p className="font-medium text-foreground">2.1 You provide directly</p>
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <strong className="text-foreground/90">Account data:</strong> such as name, email address, and credentials when you register
              or sign in (including via third-party identity providers like Google).
            </li>
            <li>
              <strong className="text-foreground/90">Billing data:</strong> when you subscribe or pay, we and our payment processor receive
              information needed to complete transactions (e.g., customer identifiers, plan, payment status). We do not store full payment card
              numbers on our servers.
            </li>
            <li>
              <strong className="text-foreground/90">Communications:</strong> content you send us (e.g., support requests, waitlist sign-ups).
            </li>
            <li>
              <strong className="text-foreground/90">Inputs to the Service:</strong> text, URLs, prompts, brand names, or other content you
              submit so we can run analyses, generate outputs, or improve your experience.
            </li>
          </ul>

          <p className="pt-2 font-medium text-foreground">2.2 Collected automatically</p>
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <strong className="text-foreground/90">Device and technical data:</strong> IP address, browser type, general location derived
              from IP, timestamps, and similar diagnostics.
            </li>
            <li>
              <strong className="text-foreground/90">Cookies and similar technologies:</strong> we use cookies and related storage to operate
              authentication sessions, remember preferences, and protect the Service. See Section 6.
            </li>
          </ul>
        </Section>

        <Section title="3. How we use information">
          <ul className="list-disc space-y-2 pl-5">
            <li>Provide, maintain, secure, and improve the Service.</li>
            <li>Authenticate users, manage accounts, and enforce subscription or demo limits.</li>
            <li>Process payments and subscriptions; communicate about billing and the Service.</li>
            <li>Run analyses you request (including using AI and search tools to process your inputs and produce results).</li>
            <li>Send operational emails (e.g., account, security, product updates) where permitted.</li>
            <li>Detect, prevent, and address fraud, abuse, and technical issues.</li>
            <li>Comply with law and respond to lawful requests.</li>
          </ul>
          <p className="pt-2">
            Where the GDPR or similar law applies, we rely on appropriate legal bases such as performance of a contract, legitimate interests
            (e.g., securing the Service), consent where required, and legal obligation.
          </p>
        </Section>

        <Section title="4. How we share information">
          <p>We do not sell your personal information. We share information only as described below.</p>
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <strong className="text-foreground/90">Service providers (“subprocessors”):</strong> vendors that help us host the Service,
              authenticate users, store data, send email, process payments, or run AI and search features. They may process information on our
              instructions and are bound by contractual obligations.
            </li>
            <li>
              <strong className="text-foreground/90">Categories of providers we use today include:</strong> database and authentication
              (Supabase), payment processing (Stripe), transactional email (Resend), and AI / web research providers (e.g., OpenAI, Tavily,
              Exa) when you use features that call those services.
            </li>
            <li>
              <strong className="text-foreground/90">OAuth providers:</strong> if you choose “Sign in with Google” (or similar), that
              provider receives information according to its own policies and your settings.
            </li>
            <li>
              <strong className="text-foreground/90">Legal and safety:</strong> when required by law, legal process, or to protect rights,
              safety, and integrity of users, NOEM, or the public.
            </li>
            <li>
              <strong className="text-foreground/90">Business transfers:</strong> in connection with a merger, acquisition, or sale of assets,
              subject to appropriate safeguards.
            </li>
          </ul>
        </Section>

        <Section title="5. International transfers">
          <p>
            We are based in the United States and may process information in the U.S. and other countries where we or our providers operate.
            Where required, we use appropriate safeguards (such as standard contractual clauses) for transfers from the EEA, UK, or Switzerland.
          </p>
        </Section>

        <Section title="6. Cookies and authentication">
          <p>
            We use cookies and similar technologies that are essential for login sessions and security. Session-related cookies may be
            necessary for signed-in use of the Service. You can control cookies through your browser; disabling certain cookies may limit
            sign-in or features.
          </p>
        </Section>

        <Section title="7. Retention">
          <p>
            We retain information for as long as needed to provide the Service, comply with law, resolve disputes, and enforce agreements.
            Retention periods vary by data type (e.g., account records vs. logs). When data is no longer needed, we delete or de-identify it
            where feasible.
          </p>
        </Section>

        <Section title="8. Security">
          <p>
            We implement technical and organizational measures designed to protect information. No method of transmission or storage is 100%
            secure; we cannot guarantee absolute security.
          </p>
        </Section>

        <Section title="9. Your choices and rights">
          <p>
            Depending on where you live, you may have rights to access, correct, delete, or export personal information; object to or restrict
            certain processing; withdraw consent where processing is consent-based; and lodge a complaint with a supervisory authority.
          </p>
          <p>
            To exercise rights, contact{" "}
            <a className="font-medium text-foreground underline underline-offset-2" href="mailto:hello@noemtech.com">
              hello@noemtech.com
            </a>
            . We may verify your request as permitted by law.
          </p>
          <p className="font-medium text-foreground">California residents (summary)</p>
          <p>
            California law may grant you additional rights (e.g., to know, delete, and opt out of certain “sales” or “sharing” as defined by
            law). We do not sell personal information for money. You may designate an authorized agent where applicable. We will not discriminate
            for exercising your rights.
          </p>
        </Section>

        <Section title="10. Children">
          <p>
            The Service is not directed to children under 13 (or the minimum age in your jurisdiction). We do not knowingly collect personal
            information from children. If you believe we have, contact us and we will take appropriate steps.
          </p>
        </Section>

        <Section title="11. Third-party services">
          <p>
            The Service may link to third-party sites or services. This Policy does not apply to them. Review their privacy policies before
            providing information.
          </p>
        </Section>

        <Section title="12. Changes to this Policy">
          <p>
            We may update this Policy from time to time. We will post the updated version on this page and update the effective date. If
            changes are material, we may provide additional notice (e.g., email or in-product notice). Continued use after the effective date
            may constitute acceptance of the revised Policy.
          </p>
        </Section>

        <Section title="13. Contact">
          <p>
            Questions about this Privacy Policy:{" "}
            <a className="font-medium text-foreground underline underline-offset-2" href="mailto:hello@noemtech.com">
              hello@noemtech.com
            </a>
          </p>
        </Section>

        <p className="mt-10 border-t border-border pt-6 text-xs leading-relaxed text-muted-foreground">
          This policy is provided for transparency and does not create contractual rights beyond those in your agreement with us. For legal
          advice, consult an attorney.
        </p>
      </div>
    </main>
  );
}
