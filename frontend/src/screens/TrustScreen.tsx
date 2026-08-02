import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

import { SeverityDot } from "../components/SeverityDot";

/**
 * Public trust & security page. Honest tense throughout: what this demo
 * does today vs. what production adds.
 */
export function TrustScreen() {
  return (
    <div className="min-h-screen bg-white text-ink">
      <header className="border-b border-gray-200">
        <div className="mx-auto flex h-12 max-w-3xl items-center justify-between px-6">
          <Link to="/" className="flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-sm bg-ink font-mono text-xs font-semibold text-white">
              R
            </span>
            <span className="text-sm font-semibold tracking-tight">RemitPath</span>
          </Link>
          <Link
            to="/"
            className="flex items-center gap-1 text-xs text-gray-500 transition-colors hover:text-ink"
          >
            <ArrowLeft size={13} /> Back to site
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-xl font-semibold tracking-tight">Trust & security</h1>
        <p className="mt-2 max-w-xl text-sm leading-5 text-gray-600">
          Plain language about how RemitPath handles protected health
          information and how we keep ourselves accountable. Where this page
          describes the demo, it says so; where it describes production
          commitments, it says that too.
        </p>

        <Section title="HIPAA posture">
          <p>
            In production, RemitPath operates as a business associate to its
            client practices. We sign a Business Associate Agreement (BAA) with
            every client before any PHI moves, and we hold BAAs with every
            subprocessor in the data path (hosting, clearinghouse, and EDI
            connectivity vendors). This demo contains no PHI at all — every
            patient, claim, and dollar amount is synthetic.
          </p>
        </Section>

        <Section title="PHI handling">
          <p>
            Patient names in every screen of this demo are masked by default
            ("J. D—") with an explicit click-to-reveal, and Social Security
            numbers are never rendered anywhere. Production carries the same
            defaults further: PHI never appears in application logs, URLs, or
            error reports; reveal actions are recorded; and access is scoped to
            the practice a user belongs to.
          </p>
        </Section>

        <Section title="Audit logging">
          <p>
            Every state-changing action in this demo — approving a claim,
            editing codes, filing or deciding an appeal, posting a payment —
            writes an append-only audit record with the acting identity,
            timestamp, and a before/after summary. There is no edit or delete
            path for audit rows. You can see this working today in the
            Operations portal's Audit Log page. Production adds tamper-evident
            storage and retention controls on the same model.
          </p>
        </Section>

        <Section title="Human-in-the-loop thresholds">
          <p>
            Automation only auto-submits what it is sure of. A claim is routed
            to a certified coder for review when any of these hold: extraction
            or coding confidence below 0.90, claim value above $5,000, or any
            ERROR-severity scrub finding (including eligibility failures and
            clearinghouse rejections). The demo uses the same routing logic
            with a lower high-value bar ($1,000) so the queue has interesting
            examples at small claim sizes.
          </p>
        </Section>

        <Section title="SOC 2 Type II roadmap">
          <p>
            Production infrastructure is being built against SOC 2 criteria
            (security, availability, confidentiality) from the start: least
            privilege access, encrypted data in transit and at rest, change
            management, and vendor review. A Type II audit is on the roadmap
            once the platform has the required months of operating history; we
            will publish the report to customers under NDA when complete. This
            is a roadmap statement, not a current certification.
          </p>
        </Section>

        <div className="mt-10 flex items-start gap-2 border-l-2 border-severity-info bg-gray-50 p-4 text-xs leading-5 text-gray-600">
          <SeverityDot severity="INFO" showLabel={false} className="mt-1.5" />
          <span>
            This entire site is a demonstration environment. All data is
            synthetic, all identities are seeded, and the payer portal is a
            simulator that plays the payer's role. Nothing on this page is
            legal advice or a certification claim.
          </span>
        </div>
      </main>

      <footer className="border-t border-gray-200">
        <div className="mx-auto max-w-3xl px-6 py-6 text-xs text-gray-400">
          RemitPath, Inc. — a fictional company for this demo.
        </div>
      </footer>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-8 border-t border-gray-100 pt-6">
      <h2 className="text-md font-semibold tracking-tight">{title}</h2>
      <div className="mt-2 max-w-2xl text-sm leading-6 text-gray-600">
        {children}
      </div>
    </section>
  );
}
