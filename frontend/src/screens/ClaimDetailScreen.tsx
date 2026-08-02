import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronRight,
  FileCode2,
  Pencil,
  X,
} from "lucide-react";

import {
  useClaim,
  useReviewClaim,
  useUpdateCodes,
} from "../api/queries";
import { AuditTrail } from "../components/AuditTrail";
import { ClaimStepper } from "../components/ClaimStepper";
import { CodeChip } from "../components/CodeChip";
import { ConfidenceBar } from "../components/ConfidenceBar";
import { MaskedName } from "../components/MaskedName";
import { SeverityDot } from "../components/SeverityDot";
import { StatusBadge, type BadgeTone } from "../components/StatusBadge";
import { ageFrom, classNames, formatDate, formatMoney } from "../lib/format";
import type {
  ClaimDetailView,
  CodedProcedure,
  EligibilityResult,
  ReviewStatus,
  Severity,
} from "../types";

const STATUS_TONE: Record<ReviewStatus, BadgeTone> = {
  pending: "amber",
  approved: "green",
  rejected: "red",
};

export function ClaimDetailScreen() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data, isLoading, isError, error } = useClaim(id);

  if (isLoading) return <DetailLoading />;
  if (isError || !data) {
    return (
      <div className="p-6">
        <div className="border border-gray-200 bg-white p-6 text-sm text-severity-error">
          Failed to load claim {id}: {error?.message ?? "not found"}
        </div>
      </div>
    );
  }

  return <ClaimDetail detail={data} onBack={() => navigate("/ops/queue")} />;
}

function ClaimDetail({
  detail,
  onBack,
}: {
  detail: ClaimDetailView;
  onBack: () => void;
}) {
  const { claim } = detail;
  const [editing, setEditing] = useState(false);
  const [ediOpen, setEdiOpen] = useState(false);

  const approve = useReviewClaim("approve");
  const reject = useReviewClaim("reject");

  const pending = detail.review_status === "pending";
  const busy = approve.isPending || reject.isPending;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Header */}
      <header className="flex h-12 shrink-0 items-center gap-3 border-b border-gray-200 bg-white px-6">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1 text-xs text-gray-500 transition-colors hover:text-ink"
        >
          <ArrowLeft size={13} /> Queue
        </button>
        <span className="text-gray-300">/</span>
        <span className="font-mono text-sm font-medium text-ink">
          {claim.claim_id}
        </span>
        <StatusBadge
          label={detail.review_status}
          tone={STATUS_TONE[detail.review_status]}
        />
        <div className="ml-auto flex items-center gap-4 text-xs text-gray-500">
          <MaskedName
            firstName={claim.patient.first_name}
            lastName={claim.patient.last_name}
          />
          <span>{claim.patient.payer_name}</span>
          <span>DOS {formatDate(claim.encounter.service_date)}</span>
          <span className="font-mono tabular-nums text-ink">
            {formatMoney(
              claim.procedures.reduce((s, p) => s + Number(p.charge), 0),
            )}
          </span>
        </div>
      </header>

      {/* Clearinghouse lifecycle stepper */}
      <div className="flex shrink-0 items-center border-b border-gray-200 bg-white px-6 py-2">
        <ClaimStepper
          status={detail.lifecycle_status}
          rejection={detail.clearinghouse_rejection}
        />
      </div>

      {/* Three columns */}
      <div className="grid min-h-0 flex-1 grid-cols-[minmax(280px,1fr)_minmax(360px,1.3fr)_minmax(280px,1fr)] divide-x divide-gray-200 overflow-hidden">
        <EncounterColumn detail={detail} />
        <CodedClaimColumn
          detail={detail}
          editing={editing}
          onDoneEditing={() => setEditing(false)}
        />
        <FindingsColumn detail={detail} />
      </div>

      {/* Bottom drawer: raw 837P */}
      <section className="shrink-0 border-t border-gray-200 bg-white">
        <button
          type="button"
          onClick={() => setEdiOpen((o) => !o)}
          className="flex h-9 w-full items-center gap-2 px-6 text-xs font-medium text-gray-600 transition-colors hover:text-ink"
        >
          {ediOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
          <FileCode2 size={13} />
          Raw 837P output
          <span className="font-mono text-gray-400">
            {detail.edi_837p.split("\n").length} segments
          </span>
        </button>
        {ediOpen && <EdiViewer edi={detail.edi_837p} />}
      </section>

      {/* Sticky action bar */}
      <footer className="flex h-14 shrink-0 items-center gap-2 border-t border-gray-200 bg-white px-6">
        <button
          type="button"
          className="btn-primary"
          disabled={!pending || busy || editing}
          onClick={() => approve.mutate(claim.claim_id)}
        >
          <Check size={14} /> Approve
        </button>
        <button
          type="button"
          className="btn-secondary"
          disabled={!pending || busy}
          onClick={() => setEditing((e) => !e)}
        >
          <Pencil size={13} /> {editing ? "Cancel Edit" : "Edit Codes"}
        </button>
        <button
          type="button"
          className="btn-danger"
          disabled={!pending || busy || editing}
          onClick={() => reject.mutate(claim.claim_id)}
        >
          <X size={14} /> Reject
        </button>
        {!pending && (
          <span className="text-xs text-gray-500">
            This claim has been {detail.review_status}. Actions are locked.
          </span>
        )}
        {(approve.isError || reject.isError) && (
          <span className="text-xs text-severity-error">
            Action failed — changes rolled back.
          </span>
        )}
      </footer>
    </div>
  );
}

// ------------------------------------------------------- left: encounter

function EncounterColumn({ detail }: { detail: ClaimDetailView }) {
  const enc = detail.claim.encounter;
  return (
    <div className="min-h-0 overflow-y-auto bg-gray-50/60 p-4">
      <ColumnTitle>Clinical Encounter</ColumnTitle>
      <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
        <span className="font-mono">{enc.encounter_id}</span>
        <span>{enc.provider_name}</span>
        <span className="inline-flex items-center gap-1">
          NPI <CodeChip code={enc.provider_npi} />
        </span>
        <span>POS {enc.place_of_service}</span>
      </div>

      {enc.extraction_warnings.length > 0 && (
        <div className="mb-3 border-l-2 border-severity-warning bg-white p-2.5">
          {enc.extraction_warnings.map((w) => (
            <div key={w} className="flex items-start gap-1.5 text-xs text-gray-600">
              <SeverityDot severity="WARNING" showLabel={false} className="mt-1" />
              {w}
            </div>
          ))}
        </div>
      )}

      <EligibilityBlock eligibility={detail.eligibility} />

      <SoapSection
        label="Chief Complaint"
        confidence={enc.field_confidence["chief_complaint"]}
      >
        {enc.chief_complaint}
      </SoapSection>
      <SoapSection label="HPI" confidence={enc.field_confidence["hpi"]}>
        {enc.hpi || <span className="text-gray-400">Not documented</span>}
      </SoapSection>
      <SoapSection
        label="Assessment (diagnoses)"
        confidence={enc.field_confidence["diagnoses"]}
      >
        <ul className="list-inside list-disc space-y-1">
          {enc.diagnoses.map((d) => (
            <li key={d}>{d}</li>
          ))}
        </ul>
      </SoapSection>
      <SoapSection
        label="Plan (procedures)"
        confidence={enc.field_confidence["procedures"]}
      >
        {enc.procedures.length > 0 ? (
          <ul className="list-inside list-disc space-y-1">
            {enc.procedures.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        ) : (
          <span className="text-gray-400">Plan section missing from note</span>
        )}
      </SoapSection>
    </div>
  );
}

const ELIGIBILITY_LABELS: Record<EligibilityResult["status"], string> = {
  active: "Active coverage",
  inactive: "Coverage inactive",
  terminated: "Coverage terminated",
  not_found: "Subscriber not found",
};

function EligibilityBlock({ eligibility }: { eligibility: EligibilityResult }) {
  const ok = eligibility.status === "active";
  return (
    <section className="mb-3 border border-gray-200 bg-white">
      <div className="flex h-8 items-center gap-1.5 border-b border-gray-100 px-2.5 text-xs font-medium text-gray-700">
        Eligibility (270/271)
        <span className="ml-auto flex items-center gap-1.5">
          <SeverityDot severity={ok ? "PASS" : "ERROR"} showLabel={false} />
          <span
            className={classNames(
              "text-xs font-medium",
              ok ? "text-severity-pass" : "text-severity-error",
            )}
          >
            {ELIGIBILITY_LABELS[eligibility.status]}
          </span>
        </span>
      </div>
      <dl className="space-y-1 px-2.5 py-2 text-xs">
        <div className="flex justify-between gap-2">
          <dt className="text-gray-500">Plan</dt>
          <dd className="text-gray-700">{eligibility.plan_name}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-gray-500">Copay</dt>
          <dd className="font-mono tabular-nums text-gray-700">
            {formatMoney(eligibility.copay)}
          </dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-gray-500">Deductible remaining</dt>
          <dd className="font-mono tabular-nums text-gray-700">
            {formatMoney(eligibility.deductible_remaining)}
          </dd>
        </div>
        {eligibility.termination_date && (
          <div className="flex justify-between gap-2">
            <dt className="text-gray-500">Terminated</dt>
            <dd className="font-mono text-severity-error">
              {formatDate(eligibility.termination_date)}
            </dd>
          </div>
        )}
        <div className="flex justify-between gap-2">
          <dt className="text-gray-500">Checked</dt>
          <dd className="text-gray-400">{ageFrom(eligibility.checked_at)} ago</dd>
        </div>
      </dl>
    </section>
  );
}

function SoapSection({
  label,
  confidence,
  children,
}: {
  label: string;
  confidence?: number;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(true);
  return (
    <section className="mb-2 border border-gray-200 bg-white">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex h-8 w-full items-center gap-1.5 px-2.5 text-xs font-medium text-gray-700"
      >
        {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        {label}
        {confidence !== undefined && (
          <ConfidenceBar value={confidence} className="ml-auto" barWidth={32} />
        )}
      </button>
      {open && (
        <div className="border-t border-gray-100 px-2.5 py-2 text-sm text-gray-700">
          {children}
        </div>
      )}
    </section>
  );
}

// ------------------------------------------------------ center: coding

function CodedClaimColumn({
  detail,
  editing,
  onDoneEditing,
}: {
  detail: ClaimDetailView;
  editing: boolean;
  onDoneEditing: () => void;
}) {
  const { claim } = detail;
  return (
    <div className="min-h-0 overflow-y-auto p-4">
      <ColumnTitle>
        Coded Claim
        <ConfidenceBar value={claim.overall_confidence} className="ml-auto" />
      </ColumnTitle>

      {claim.prior_auth_number && (
        <div className="mb-3 text-xs text-gray-500">
          Prior auth <CodeChip code={claim.prior_auth_number} />
        </div>
      )}

      {editing ? (
        <CodeEditor detail={detail} onDone={onDoneEditing} />
      ) : (
        <>
          <SectionLabel>Diagnoses (ICD-10-CM)</SectionLabel>
          <div className="mb-4 border border-gray-200 bg-white">
            {claim.diagnoses.map((d, i) => (
              <div
                key={d.code}
                className="flex items-center gap-2 border-b border-gray-100 px-2.5 py-2 last:border-b-0"
              >
                <span className="w-4 font-mono text-xs text-gray-400">{i + 1}</span>
                <CodeChip code={d.code} title={d.description} />
                <span className="min-w-0 flex-1 truncate text-sm text-gray-700">
                  {d.description}
                </span>
                <ConfidenceBar value={d.confidence} barWidth={32} />
              </div>
            ))}
          </div>

          <SectionLabel>Procedures (CPT / HCPCS)</SectionLabel>
          <div className="border border-gray-200 bg-white">
            {claim.procedures.map((p) => (
              <div
                key={p.code}
                className="border-b border-gray-100 px-2.5 py-2 last:border-b-0"
              >
                <div className="flex items-center gap-2">
                  <CodeChip code={p.code} title={p.description} />
                  {p.modifiers.map((m) => (
                    <CodeChip key={m} code={m} title={`Modifier ${m}`} />
                  ))}
                  <span className="text-xs text-gray-400">
                    x{p.units} • dx {p.diagnosis_pointers.join(",")}
                  </span>
                  <span className="ml-auto font-mono text-xs tabular-nums text-ink">
                    {formatMoney(p.charge)}
                  </span>
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate text-sm text-gray-600">
                    {p.description}
                  </span>
                  <ConfidenceBar value={p.confidence} barWidth={32} />
                </div>
              </div>
            ))}
            <div className="flex items-center justify-between bg-gray-50 px-2.5 py-2 text-xs font-medium text-gray-600">
              Total charge
              <span className="font-mono text-sm tabular-nums text-ink">
                {formatMoney(
                  claim.procedures.reduce((s, p) => s + Number(p.charge), 0),
                )}
              </span>
            </div>
          </div>

          {claim.validation_flags.length > 0 && (
            <>
              <SectionLabel className="mt-4">Validation flags</SectionLabel>
              <div className="flex flex-wrap gap-1.5">
                {claim.validation_flags.map((f) => (
                  <CodeChip key={f} code={f} />
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

interface EditableProcedure {
  code: string;
  description: string;
  modifiers: string;
  units: string;
  charge: string;
  diagnosis_pointers: number[];
  confidence: number;
}

function CodeEditor({
  detail,
  onDone,
}: {
  detail: ClaimDetailView;
  onDone: () => void;
}) {
  const { claim } = detail;
  const update = useUpdateCodes(claim.claim_id);
  const [dx, setDx] = useState(
    claim.diagnoses.map((d) => ({ ...d })),
  );
  const [procs, setProcs] = useState<EditableProcedure[]>(
    claim.procedures.map((p) => ({
      code: p.code,
      description: p.description,
      modifiers: p.modifiers.join(", "),
      units: String(p.units),
      charge: p.charge,
      diagnosis_pointers: p.diagnosis_pointers,
      confidence: p.confidence,
    })),
  );

  const save = () => {
    const procedures: CodedProcedure[] = procs.map((p) => ({
      code: p.code.trim().toUpperCase(),
      description: p.description,
      modifiers: p.modifiers
        .split(",")
        .map((m) => m.trim().toUpperCase())
        .filter(Boolean),
      units: Math.max(1, Number(p.units) || 1),
      charge: (Number(p.charge) || 0).toFixed(2),
      diagnosis_pointers: p.diagnosis_pointers,
      confidence: p.confidence,
    }));
    update.mutate(
      { diagnoses: dx, procedures },
      { onSuccess: onDone },
    );
  };

  return (
    <div>
      <SectionLabel>Edit diagnoses</SectionLabel>
      <div className="mb-4 space-y-2">
        {dx.map((d, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              className="input w-24 font-mono text-xs uppercase"
              value={d.code}
              aria-label={`Diagnosis code ${i + 1}`}
              onChange={(e) =>
                setDx((rows) =>
                  rows.map((r, j) =>
                    j === i ? { ...r, code: e.target.value } : r,
                  ),
                )
              }
            />
            <input
              className="input min-w-0 flex-1"
              value={d.description}
              aria-label={`Diagnosis description ${i + 1}`}
              onChange={(e) =>
                setDx((rows) =>
                  rows.map((r, j) =>
                    j === i ? { ...r, description: e.target.value } : r,
                  ),
                )
              }
            />
          </div>
        ))}
      </div>

      <SectionLabel>Edit procedures</SectionLabel>
      <div className="space-y-2">
        {procs.map((p, i) => (
          <div
            key={i}
            className="space-y-2 border border-gray-200 bg-white p-2.5"
          >
            <div className="flex items-center gap-2">
              <input
                className="input w-24 font-mono text-xs uppercase"
                value={p.code}
                aria-label={`Procedure code ${i + 1}`}
                onChange={(e) =>
                  setProcs((rows) =>
                    rows.map((r, j) =>
                      j === i ? { ...r, code: e.target.value } : r,
                    ),
                  )
                }
              />
              <input
                className="input w-28 font-mono text-xs uppercase"
                placeholder="modifiers"
                value={p.modifiers}
                aria-label={`Modifiers for procedure ${i + 1}`}
                onChange={(e) =>
                  setProcs((rows) =>
                    rows.map((r, j) =>
                      j === i ? { ...r, modifiers: e.target.value } : r,
                    ),
                  )
                }
              />
              <input
                className="input w-14 font-mono text-xs"
                value={p.units}
                aria-label={`Units for procedure ${i + 1}`}
                onChange={(e) =>
                  setProcs((rows) =>
                    rows.map((r, j) =>
                      j === i ? { ...r, units: e.target.value } : r,
                    ),
                  )
                }
              />
              <input
                className="input w-24 text-right font-mono text-xs"
                value={p.charge}
                aria-label={`Charge for procedure ${i + 1}`}
                onChange={(e) =>
                  setProcs((rows) =>
                    rows.map((r, j) =>
                      j === i ? { ...r, charge: e.target.value } : r,
                    ),
                  )
                }
              />
            </div>
            <div className="text-xs text-gray-500">{p.description}</div>
          </div>
        ))}
      </div>

      <div className="mt-4 flex items-center gap-2">
        <button
          type="button"
          className="btn-primary"
          disabled={update.isPending}
          onClick={save}
        >
          {update.isPending ? "Saving…" : "Save Codes"}
        </button>
        <button type="button" className="btn-secondary" onClick={onDone}>
          Cancel
        </button>
        {update.isError && (
          <span className="text-xs text-severity-error">
            Save failed: {update.error?.message}
          </span>
        )}
      </div>
    </div>
  );
}

// ------------------------------------------------------ right: findings

const SEVERITY_ORDER: Severity[] = ["ERROR", "WARNING", "INFO"];

function FindingsColumn({ detail }: { detail: ClaimDetailView }) {
  const groups = useMemo(() => {
    const by = new Map<Severity, typeof detail.findings>();
    for (const s of SEVERITY_ORDER) by.set(s, []);
    for (const f of detail.findings) by.get(f.severity)?.push(f);
    return by;
  }, [detail.findings]);

  const borderFor: Record<Severity, string> = {
    ERROR: "border-l-severity-error",
    WARNING: "border-l-severity-warning",
    INFO: "border-l-severity-info",
  };

  return (
    <div className="min-h-0 overflow-y-auto bg-gray-50/60 p-4">
      <ColumnTitle>Scrub Findings</ColumnTitle>
      {detail.findings.length === 0 ? (
        <div className="flex items-center gap-2 border border-gray-200 bg-white p-3 text-sm text-gray-600">
          <SeverityDot severity="PASS" showLabel={false} />
          All scrub rules passed.
        </div>
      ) : (
        SEVERITY_ORDER.map((sev) => {
          const items = groups.get(sev) ?? [];
          if (items.length === 0) return null;
          return (
            <div key={sev} className="mb-4">
              <div className="mb-1.5 flex items-center gap-1.5">
                <SeverityDot severity={sev} />
                <span className="font-mono text-xs text-gray-400">
                  {items.length}
                </span>
              </div>
              <div className="space-y-1.5">
                {items.map((f) => (
                  <div
                    key={f.rule_id + (f.procedure_code ?? "")}
                    className={classNames(
                      "border border-l-2 border-gray-200 bg-white p-2.5",
                      borderFor[sev],
                    )}
                  >
                    <div className="mb-1 flex items-center gap-2">
                      <span className="font-mono text-xs font-medium text-ink">
                        {f.rule_id}
                      </span>
                      {f.procedure_code && <CodeChip code={f.procedure_code} />}
                    </div>
                    <p className="text-sm leading-5 text-gray-600">{f.message}</p>
                    {f.field && (
                      <div className="mt-1 font-mono text-xs text-gray-400">
                        {f.field}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })
      )}

      <ColumnTitle className="mt-6">Routing</ColumnTitle>
      <ul className="space-y-1 text-sm text-gray-600">
        {detail.routing.reasons.map((r) => (
          <li key={r} className="flex items-start gap-1.5">
            <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-gray-400" />
            {r}
          </li>
        ))}
      </ul>

      <ColumnTitle className="mt-6">Recent activity</ColumnTitle>
      <AuditTrail entityId={detail.claim.claim_id} />
    </div>
  );
}

// --------------------------------------------------------- EDI viewer

/** Mono 837P with segment IDs bolded, element separators dimmed. */
function EdiViewer({ edi }: { edi: string }) {
  return (
    <pre className="max-h-64 overflow-auto border-t border-gray-200 bg-gray-50 px-6 py-3 font-mono text-xs leading-5 text-gray-600">
      {edi.split("\n").map((line, i) => {
        const starIdx = line.indexOf("*");
        const segId = starIdx === -1 ? line : line.slice(0, starIdx);
        const rest = starIdx === -1 ? "" : line.slice(starIdx);
        return (
          <div key={i}>
            <span className="font-semibold text-ink">{segId}</span>
            {rest.split("*").map((el, j) =>
              j === 0 ? null : (
                <span key={j}>
                  <span className="text-gray-300">*</span>
                  <span>{el}</span>
                </span>
              ),
            )}
          </div>
        );
      })}
    </pre>
  );
}

// ----------------------------------------------------------- shared bits

function ColumnTitle({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <h2
      className={classNames(
        "mb-3 flex items-center text-xs font-semibold uppercase tracking-wide text-gray-500",
        className,
      )}
    >
      {children}
    </h2>
  );
}

function SectionLabel({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={classNames("mb-1.5 text-xs font-medium text-gray-500", className)}>
      {children}
    </div>
  );
}

function DetailLoading() {
  return (
    <div className="grid min-h-0 flex-1 grid-cols-3 gap-px bg-gray-200 p-0">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="space-y-3 bg-white p-4">
          <div className="h-3 w-32 bg-gray-100" />
          <div className="h-20 bg-gray-100" />
          <div className="h-20 bg-gray-100" />
        </div>
      ))}
    </div>
  );
}
