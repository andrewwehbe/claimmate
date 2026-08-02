import { SeverityDot } from "../components/SeverityDot";

/**
 * Trust & compliance page (rendered inside MarketingLayout). Honest tense
 * throughout: what this demo does today vs. what production adds.
 */
export function TrustScreen() {
  return (
    <div className="mx-auto w-full max-w-[1360px] px-5 pb-20 pt-16 sm:pt-24 lg:px-10">
      <h1 className="max-w-3xl text-[36px] font-semibold leading-[1.1] tracking-tight sm:text-[48px]">
        Trust & compliance
      </h1>
      <p className="mt-5 max-w-2xl text-[17px] leading-7 text-gray-600 sm:text-[19px] sm:leading-8">
        Plain language about how ClaimMate handles protected health
        information and how we keep ourselves accountable. Where this page
        describes the demo, it says so; where it describes production
        commitments, it says that too.
      </p>

      <div className="mt-14 grid gap-x-16 gap-y-12 lg:grid-cols-2">
        <Section title="HIPAA posture">
          <p>
            In production, ClaimMate operates as a business associate to its
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
      </div>

      <div className="mt-16 flex max-w-3xl items-start gap-3 rounded-xl border border-gray-200 bg-gray-50 p-5 text-sm leading-6 text-gray-600">
        <SeverityDot severity="INFO" showLabel={false} className="mt-1.5" />
        <span>
          This entire site is a demonstration environment. All data is
          synthetic, all identities are seeded, and the payer portal is a
          simulator that plays the payer's role. Nothing on this page is legal
          advice or a certification claim.
        </span>
      </div>
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
    <section>
      <h2 className="text-[22px] font-semibold tracking-tight">{title}</h2>
      <div className="mt-3 max-w-xl text-[15px] leading-7 text-gray-600">
        {children}
      </div>
    </section>
  );
}
