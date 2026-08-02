import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";

import { useSignupPractice } from "../../api/queries";
import { CodeChip } from "../../components/CodeChip";
import { StatusBadge } from "../../components/StatusBadge";
import { classNames } from "../../lib/format";
import { saveIdentity } from "../../lib/identity";
import { isValidNpi } from "../../lib/npi";
import type { IntegrationMethod, PlanType, PracticeSignupBody } from "../../types";

const SPECIALTIES = [
  "Family Medicine", "Internal Medicine", "Pediatrics", "Cardiology",
  "Orthopedics", "Dermatology", "OB/GYN", "Behavioral Health",
  "Gastroenterology", "Urgent Care", "Other",
];

const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA",
  "KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT",
  "VA","WA","WV","WI","WY","DC",
];

const EHR_SYSTEMS = [
  { id: "Epic", note: "Hospital-affiliated and large groups" },
  { id: "athenahealth", note: "Cloud PM + EHR" },
  { id: "eClinicalWorks", note: "Ambulatory EHR" },
  { id: "Kareo / Tebra", note: "Independent practice suite" },
  { id: "DrChrono", note: "Mobile-first EHR" },
  { id: "AdvancedMD", note: "PM + billing platform" },
  { id: "Other", note: "Anything with an export" },
];

const METHODS: {
  id: IntegrationMethod;
  label: string;
  note: string;
  fields: { key: string; label: string; placeholder: string }[];
}[] = [
  {
    id: "vendor_api",
    label: "PM/EHR vendor API",
    note: "Your vendor's partner API (e.g. athenahealth, Tebra). We connect as a registered app.",
    fields: [
      {
        key: "vendor_app_id",
        label: "Vendor app / client ID",
        placeholder: "remitpath-partner-app",
      },
      {
        key: "api_scope_note",
        label: "API scope note",
        placeholder: "encounters + billing read scopes",
      },
    ],
  },
  {
    id: "fhir_api",
    label: "FHIR API",
    note: "OAuth-secured FHIR R4 endpoint from your EHR vendor.",
    fields: [
      { key: "fhir_base_url", label: "FHIR base URL", placeholder: "https://fhir.ehr.example/r4" },
      { key: "client_id", label: "Client ID", placeholder: "remitpath-demo" },
    ],
  },
  {
    id: "sftp_flat_file",
    label: "SFTP flat-file export",
    note: "Scheduled CSV/X12 drops from your PM system to our SFTP.",
    fields: [
      { key: "sftp_host", label: "SFTP host", placeholder: "sftp.remitpath.example" },
      { key: "folder", label: "Drop folder", placeholder: "/exports/daily" },
      { key: "schedule", label: "Schedule", placeholder: "Daily at 02:00 CT" },
    ],
  },
];

const PLANS: { id: PlanType; label: string; price: string; note: string }[] = [
  {
    id: "performance",
    label: "Performance",
    price: "4.9% of collections",
    note: "Full-service RCM. We only make money when you collect.",
  },
  {
    id: "hybrid",
    label: "Hybrid",
    price: "$299/mo + $1.10/claim",
    note: "Predictable SaaS base with per-claim processing.",
  },
  {
    id: "denial_recovery_share",
    label: "Denial recovery share",
    price: "25% of recovered denials",
    note: "Keep your current billing flow; we only work your denials.",
  },
];

const STEPS = ["Practice", "EHR / PM", "Integration", "Plan", "Review"];

interface WizardState {
  legal_name: string;
  specialty: string;
  providers_count: string;
  state: string;
  group_npi: string;
  contact_name: string;
  contact_email: string;
  ehr_system: string;
  integration_method: IntegrationMethod;
  connection: Record<string, string>;
  plan: PlanType;
}

const INITIAL: WizardState = {
  legal_name: "",
  specialty: "",
  providers_count: "",
  state: "",
  group_npi: "",
  contact_name: "",
  contact_email: "",
  ehr_system: "",
  integration_method: "fhir_api",
  connection: {},
  plan: "performance",
};

export function SignupWizard() {
  const navigate = useNavigate();
  const signup = useSignupPractice();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<WizardState>(INITIAL);
  const [touchedNpi, setTouchedNpi] = useState(false);

  const set = (patch: Partial<WizardState>) =>
    setForm((f) => ({ ...f, ...patch }));

  const npiValid = isValidNpi(form.group_npi);
  const stepValid = (s: number): boolean => {
    switch (s) {
      case 0:
        return (
          form.legal_name.trim().length > 0 &&
          form.specialty !== "" &&
          Number(form.providers_count) >= 1 &&
          form.state !== "" &&
          npiValid &&
          form.contact_name.trim().length > 0 &&
          /.+@.+\..+/.test(form.contact_email)
        );
      case 1:
        return form.ehr_system !== "";
      case 2:
        return true; // connection fields are mock-optional
      case 3:
        return form.plan !== undefined;
      default:
        return true;
    }
  };

  const submit = () => {
    const body: PracticeSignupBody = {
      legal_name: form.legal_name.trim(),
      specialty: form.specialty,
      providers_count: Number(form.providers_count),
      state: form.state,
      group_npi: form.group_npi,
      contact_name: form.contact_name.trim(),
      contact_email: form.contact_email.trim(),
      ehr_system: form.ehr_system,
      integration_method: form.integration_method,
      connection: form.connection,
      plan: form.plan,
    };
    signup.mutate(body, {
      onSuccess: (account) => {
        // Auto sign-in to the practice portal as the new practice.
        saveIdentity("practice", {
          id: `practice-${account.practice_id}`,
          name: account.legal_name,
          role: `${account.specialty} · ${account.state}`,
          practice_id: account.practice_id,
        });
        navigate("/practice");
      },
    });
  };

  const method = METHODS.find((m) => m.id === form.integration_method)!;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="flex h-12 items-center justify-between border-b border-gray-200 bg-white px-6">
        <Link to="/" className="flex items-center gap-2">
          <span className="flex h-5 w-5 items-center justify-center rounded-sm bg-ink font-mono text-xs font-semibold text-white">
            R
          </span>
          <span className="text-sm font-semibold tracking-tight">RemitPath</span>
        </Link>
        <StatusBadge label="Demo access — no real data" tone="amber" />
      </header>

      <div className="mx-auto max-w-2xl px-6 py-10">
        <h1 className="text-lg font-semibold tracking-tight">
          Practice onboarding
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Five short steps. Nothing here leaves your browser — this demo
          persists to an in-memory mock store.
        </p>

        {/* Step indicator */}
        <ol className="mt-6 flex items-center gap-1">
          {STEPS.map((label, i) => (
            <li key={label} className="flex flex-1 flex-col gap-1.5">
              <span
                className={classNames(
                  "h-0.5 w-full",
                  i <= step ? "bg-primary" : "bg-gray-200",
                )}
              />
              <span
                className={classNames(
                  "text-xs",
                  i === step ? "font-medium text-ink" : "text-gray-400",
                )}
              >
                {i + 1}. {label}
              </span>
            </li>
          ))}
        </ol>

        <div className="mt-6 border border-gray-200 bg-white p-6">
          {step === 0 && (
            <div className="space-y-4">
              <Field label="Practice legal name">
                <input
                  className="input w-full"
                  value={form.legal_name}
                  placeholder="Sunrise Family Medicine, S.C."
                  onChange={(e) => set({ legal_name: e.target.value })}
                />
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Specialty">
                  <select
                    className="input w-full"
                    value={form.specialty}
                    onChange={(e) => set({ specialty: e.target.value })}
                  >
                    <option value="">Select…</option>
                    {SPECIALTIES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Providers">
                  <input
                    className="input w-full font-mono"
                    inputMode="numeric"
                    value={form.providers_count}
                    placeholder="6"
                    onChange={(e) =>
                      set({ providers_count: e.target.value.replace(/\D/g, "") })
                    }
                  />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Field label="State">
                  <select
                    className="input w-full"
                    value={form.state}
                    onChange={(e) => set({ state: e.target.value })}
                  >
                    <option value="">Select…</option>
                    {US_STATES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field
                  label="Group NPI (Type 2)"
                  error={
                    touchedNpi && !npiValid && form.group_npi.length > 0
                      ? "Not a valid NPI (Luhn check over 80840 + first 9 digits failed)"
                      : undefined
                  }
                  hint={npiValid ? "Valid NPI" : undefined}
                >
                  <input
                    className={classNames(
                      "input w-full font-mono",
                      touchedNpi && !npiValid && form.group_npi.length > 0
                        ? "border-severity-error"
                        : npiValid && "border-severity-pass",
                    )}
                    inputMode="numeric"
                    maxLength={10}
                    value={form.group_npi}
                    placeholder="1234567893"
                    onBlur={() => setTouchedNpi(true)}
                    onChange={(e) =>
                      set({ group_npi: e.target.value.replace(/\D/g, "") })
                    }
                  />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Billing contact name">
                  <input
                    className="input w-full"
                    value={form.contact_name}
                    placeholder="Dana Whitfield"
                    onChange={(e) => set({ contact_name: e.target.value })}
                  />
                </Field>
                <Field label="Contact email">
                  <input
                    className="input w-full"
                    type="email"
                    value={form.contact_email}
                    placeholder="billing@practice.example"
                    onChange={(e) => set({ contact_email: e.target.value })}
                  />
                </Field>
              </div>
            </div>
          )}

          {step === 1 && (
            <RadioCards
              options={EHR_SYSTEMS.map((e) => ({
                id: e.id,
                title: e.id,
                note: e.note,
              }))}
              value={form.ehr_system}
              onChange={(ehr_system) => set({ ehr_system })}
            />
          )}

          {step === 2 && (
            <div className="space-y-5">
              <RadioCards
                options={METHODS.map((m) => ({
                  id: m.id,
                  title: m.label,
                  note: m.note,
                }))}
                value={form.integration_method}
                onChange={(id) =>
                  set({
                    integration_method: id as IntegrationMethod,
                    connection: {},
                  })
                }
              />
              <div className="border-t border-gray-100 pt-4">
                <div className="mb-3 text-xs font-medium uppercase tracking-wide text-gray-500">
                  Connection details (mock — optional)
                </div>
                <div className="grid grid-cols-2 gap-4">
                  {method.fields.map((f) => (
                    <Field key={f.key} label={f.label}>
                      <input
                        className="input w-full font-mono text-xs"
                        value={form.connection[f.key] ?? ""}
                        placeholder={f.placeholder}
                        onChange={(e) =>
                          set({
                            connection: {
                              ...form.connection,
                              [f.key]: e.target.value,
                            },
                          })
                        }
                      />
                    </Field>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-5">
              <RadioCards
                options={PLANS.map((p) => ({
                  id: p.id,
                  title: p.label,
                  note: p.note,
                  right: p.price,
                }))}
                value={form.plan}
                onChange={(id) => set({ plan: id as PlanType })}
              />
              <div className="border-l-2 border-severity-info bg-gray-50 p-3">
                <div className="text-xs font-medium text-gray-700">
                  What happens after signup
                </div>
                <p className="mt-1 text-xs leading-5 text-gray-600">
                  Production onboarding also includes payer EDI enrollment —
                  enrolling your NPIs with each payer for claims, ERA, and
                  eligibility transactions. This typically takes 2-6 weeks per
                  payer; we manage the paperwork and follow-up for you. Nothing
                  is needed from you at this step.
                </p>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-0 text-sm">
              <ReviewRow label="Practice">
                {form.legal_name} — {form.specialty}, {form.state} (
                {form.providers_count} providers)
              </ReviewRow>
              <ReviewRow label="Group NPI">
                <CodeChip code={form.group_npi} />
              </ReviewRow>
              <ReviewRow label="Contact">
                {form.contact_name} · {form.contact_email}
              </ReviewRow>
              <ReviewRow label="EHR / PM">{form.ehr_system}</ReviewRow>
              <ReviewRow label="Integration">
                {method.label}
                {Object.entries(form.connection).filter(([, v]) => v).length >
                  0 && (
                  <span className="mt-1 block font-mono text-xs text-gray-500">
                    {Object.entries(form.connection)
                      .filter(([, v]) => v)
                      .map(([k, v]) => `${k}=${v}`)
                      .join("  ")}
                  </span>
                )}
              </ReviewRow>
              <ReviewRow label="Plan">
                {PLANS.find((p) => p.id === form.plan)!.label} —{" "}
                {PLANS.find((p) => p.id === form.plan)!.price}
              </ReviewRow>
              <div className="pt-4 text-xs text-gray-500">
                Submitting creates your practice account with integration in a
                pending state; our team completes the connection during
                onboarding.
              </div>
              {signup.isError && (
                <div className="pt-2 text-xs text-severity-error">
                  Signup failed: {signup.error?.message}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Wizard nav */}
        <div className="mt-4 flex items-center justify-between">
          <button
            type="button"
            className="btn-secondary"
            onClick={() => (step === 0 ? navigate("/") : setStep(step - 1))}
          >
            <ArrowLeft size={14} />
            {step === 0 ? "Cancel" : "Back"}
          </button>
          {step < STEPS.length - 1 ? (
            <button
              type="button"
              className="btn-primary"
              disabled={!stepValid(step)}
              onClick={() => setStep(step + 1)}
            >
              Continue
              <ArrowRight size={14} />
            </button>
          ) : (
            <button
              type="button"
              className="btn-primary"
              disabled={signup.isPending}
              onClick={submit}
            >
              <Check size={14} />
              {signup.isPending ? "Creating account…" : "Create practice account"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------- pieces

function Field({
  label,
  error,
  hint,
  children,
}: {
  label: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-gray-600">
        {label}
      </span>
      {children}
      {error ? (
        <span className="mt-1 block text-xs text-severity-error">{error}</span>
      ) : hint ? (
        <span className="mt-1 block text-xs text-severity-pass">{hint}</span>
      ) : null}
    </label>
  );
}

function RadioCards({
  options,
  value,
  onChange,
}: {
  options: { id: string; title: string; note: string; right?: string }[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="space-y-1.5" role="radiogroup">
      {options.map((o) => {
        const selected = value === o.id;
        return (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(o.id)}
            className={classNames(
              "flex w-full items-center gap-3 rounded border px-3 py-2.5 text-left transition-colors",
              selected
                ? "border-primary bg-primary-subtle"
                : "border-gray-200 hover:border-gray-300 hover:bg-gray-50",
            )}
          >
            <span
              className={classNames(
                "h-2 w-2 shrink-0 rounded-full",
                selected ? "bg-primary" : "bg-gray-300",
              )}
            />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium text-ink">
                {o.title}
              </span>
              <span className="block text-xs text-gray-500">{o.note}</span>
            </span>
            {o.right && (
              <span className="shrink-0 font-mono text-xs text-gray-700">
                {o.right}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

function ReviewRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 border-b border-gray-100 py-2.5 last:border-b-0">
      <span className="w-28 shrink-0 pt-0.5 text-xs text-gray-500">{label}</span>
      <span className="min-w-0 flex-1 text-sm text-gray-700">{children}</span>
    </div>
  );
}
