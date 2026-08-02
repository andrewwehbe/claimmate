/**
 * Synthetic seed data for the multi-portal platform: client practices,
 * appeal cases (shared between /ops/appeals and the payer portal),
 * sync-run history, practice claim rosters, and remittances.
 *
 * All names, NPIs (Luhn-valid), and amounts are fabricated. Dates are
 * generated relative to "now" so SLA timers and turnaround KPIs stay
 * realistic whenever the demo runs.
 *
 * KPI math baked into the decided appeals below:
 *   turnarounds 3+4+2+5+3+4 days over 6 decided -> avg 3.5 days
 *   4 overturned / 6 decided -> 66.7% overturn rate
 *   (vs. the 14-day manual-biller baseline shown in the UI)
 */

import type {
  AppealCase,
  AppealCaseStatus,
  AppealEvent,
  AppealLevel,
  AuditEvent,
  Citation,
  ClaimLifecycleStatus,
  DisputedService,
  PracticeAccount,
  PracticeClaimRow,
  RemittanceRow,
  SubmissionChannel,
  SyncRun,
} from "../types";
import { CARC } from "../lib/carcRarc";
import {
  APPEAL_LEVEL_LONG,
  deadlineDays,
  SUBMISSION_CHANNEL_LABELS,
} from "../lib/appealRules";

const money = (n: number): string => n.toFixed(2);

const DAY = 86_400_000;
const daysAgo = (d: number): string => new Date(Date.now() - d * DAY).toISOString();
const daysAhead = (d: number): string =>
  new Date(Date.now() + d * DAY).toISOString().slice(0, 10);
const isoDateDaysAgo = (d: number): string => daysAgo(d).slice(0, 10);

// --------------------------------------------------------------- practices

function practice(
  p: Omit<
    PracticeAccount,
    "created_at" | "last_sync_at" | "recovered_this_quarter"
  > & {
    created_days_ago: number;
    last_sync_days_ago: number | null;
    recovered: number;
  },
): PracticeAccount {
  const { created_days_ago, last_sync_days_ago, recovered, ...rest } = p;
  return {
    ...rest,
    created_at: daysAgo(created_days_ago),
    last_sync_at: last_sync_days_ago === null ? null : daysAgo(last_sync_days_ago),
    recovered_this_quarter: money(recovered),
  };
}

export const PRACTICE_SEEDS: PracticeAccount[] = [
  practice({
    practice_id: "PRAC-001",
    legal_name: "Sunrise Family Medicine, S.C.",
    specialty: "Family Medicine",
    providers_count: 6,
    state: "IL",
    group_npi: "1472583693",
    ehr_system: "athenahealth",
    integration_method: "fhir_api",
    integration_status: "connected",
    plan: "performance",
    contact_name: "Dana Whitfield",
    contact_email: "dwhitfield@sunrisefm.example",
    claims_per_month: 1420,
    denial_rate: 0.061,
    created_days_ago: 210,
    last_sync_days_ago: 0.2,
    recovered: 2190,
  }),
  practice({
    practice_id: "PRAC-002",
    legal_name: "Lakeside Internal Medicine Associates",
    specialty: "Internal Medicine",
    providers_count: 11,
    state: "WI",
    group_npi: "1553278940",
    ehr_system: "Epic",
    integration_method: "direct_db",
    integration_status: "connected",
    plan: "hybrid",
    contact_name: "Marcus Bell",
    contact_email: "mbell@lakesideima.example",
    claims_per_month: 2680,
    denial_rate: 0.054,
    created_days_ago: 180,
    last_sync_days_ago: 0.4,
    recovered: 0,
  }),
  practice({
    practice_id: "PRAC-003",
    legal_name: "Cedar Ridge Pediatrics LLC",
    specialty: "Pediatrics",
    providers_count: 4,
    state: "OH",
    group_npi: "1624097352",
    ehr_system: "eClinicalWorks",
    integration_method: "sftp_flat_file",
    integration_status: "degraded",
    plan: "denial_recovery_share",
    contact_name: "Priya Raman",
    contact_email: "praman@cedarridgepeds.example",
    claims_per_month: 880,
    denial_rate: 0.083,
    created_days_ago: 122,
    last_sync_days_ago: 2.1,
    recovered: 950,
  }),
  practice({
    practice_id: "PRAC-004",
    legal_name: "Bluebonnet Orthopedics PA",
    specialty: "Orthopedics",
    providers_count: 9,
    state: "TX",
    group_npi: "1701582433",
    ehr_system: "AdvancedMD",
    integration_method: "fhir_api",
    integration_status: "connected",
    plan: "performance",
    contact_name: "Grace Okonkwo",
    contact_email: "gokonkwo@bluebonnetortho.example",
    claims_per_month: 1930,
    denial_rate: 0.092,
    created_days_ago: 96,
    last_sync_days_ago: 0.1,
    recovered: 2210,
  }),
  practice({
    practice_id: "PRAC-005",
    legal_name: "Harbor Point Dermatology PC",
    specialty: "Dermatology",
    providers_count: 3,
    state: "MA",
    group_npi: "1886420573",
    ehr_system: "Kareo / Tebra",
    integration_method: "sftp_flat_file",
    integration_status: "error",
    plan: "hybrid",
    contact_name: "Tom Castellano",
    contact_email: "tcastellano@harborpointderm.example",
    claims_per_month: 640,
    denial_rate: 0.071,
    created_days_ago: 64,
    last_sync_days_ago: 4.6,
    recovered: 0,
  }),
  practice({
    practice_id: "PRAC-006",
    legal_name: "Desert Sage Cardiology Group",
    specialty: "Cardiology",
    providers_count: 7,
    state: "AZ",
    group_npi: "1903372153",
    ehr_system: "Epic",
    integration_method: "fhir_api",
    integration_status: "connected",
    plan: "performance",
    contact_name: "Leila Haddad",
    contact_email: "lhaddad@desertsagecards.example",
    claims_per_month: 2140,
    denial_rate: 0.066,
    created_days_ago: 150,
    last_sync_days_ago: 0.3,
    recovered: 685,
  }),
  practice({
    practice_id: "PRAC-007",
    legal_name: "Willow Creek OB/GYN Partners",
    specialty: "OB/GYN",
    providers_count: 5,
    state: "GA",
    group_npi: "1228167346",
    ehr_system: "DrChrono",
    integration_method: "fhir_api",
    integration_status: "connected",
    plan: "hybrid",
    contact_name: "Renee Fontaine",
    contact_email: "rfontaine@willowcreekobgyn.example",
    claims_per_month: 1150,
    denial_rate: 0.058,
    created_days_ago: 88,
    last_sync_days_ago: 0.6,
    recovered: 0,
  }),
  practice({
    practice_id: "PRAC-008",
    legal_name: "Granite State Behavioral Health",
    specialty: "Behavioral Health",
    providers_count: 8,
    state: "NH",
    group_npi: "1369024587",
    ehr_system: "Other",
    integration_method: "sftp_flat_file",
    integration_status: "pending",
    plan: "denial_recovery_share",
    contact_name: "Sam Delgado",
    contact_email: "sdelgado@granitebh.example",
    claims_per_month: 0,
    denial_rate: 0,
    created_days_ago: 6,
    last_sync_days_ago: null,
    recovered: 0,
  }),
];

// ----------------------------------------------------------------- appeals

const CITATION_POOL: Record<string, Citation[]> = {
  medical_necessity: [
    {
      source: "Social Security Act",
      reference: "SSA 1862(a)(1)(A)",
      summary:
        "Coverage extends to services that are reasonable and necessary for the diagnosis or treatment of illness or injury.",
    },
    {
      source: "Medicare Program Integrity Manual",
      reference: "CMS Pub. 100-08, Ch. 13",
      summary:
        "Coverage determinations must be applied consistently with the documented clinical evidence in the medical record.",
    },
  ],
  timely_filing: [
    {
      source: "Code of Federal Regulations",
      reference: "42 CFR 424.44",
      summary:
        "Defines the timely filing period and the evidence acceptable to establish the date of first submission.",
    },
  ],
  default: [
    {
      source: "Code of Federal Regulations",
      reference: "45 CFR 147.136",
      summary:
        "Group health plans must provide a full and fair internal appeals process for adverse benefit determinations.",
    },
  ],
};

interface AppealSeedArgs {
  n: number;
  claimId: string;
  practiceId: string;
  payerName: string;
  carc: string;
  amount: number;
  status: AppealCaseStatus;
  openedDaysAgo: number;
  submittedDaysAgo: number | null;
  decidedDaysAgo: number | null;
  level: AppealLevel;
  channel: SubmissionChannel;
  service: DisputedService;
  responseNote?: string;
}

function practiceName(id: string): string {
  return (
    PRACTICE_SEEDS.find((p) => p.practice_id === id)?.legal_name ?? "Unknown"
  );
}

function makeAppeal(a: AppealSeedArgs): AppealCase {
  const carcEntry = CARC[a.carc];
  const category = carcEntry?.category ?? "other";
  const citations =
    CITATION_POOL[category] ?? CITATION_POOL["default"];
  const pName = practiceName(a.practiceId);

  const events: AppealEvent[] = [
    {
      at: daysAgo(a.openedDaysAgo),
      label: "Denial received",
      detail: `CARC ${a.carc}: ${carcEntry?.description ?? "unknown"}`,
    },
    {
      at: daysAgo(a.openedDaysAgo - 0.1),
      label: "Appeal case opened",
      detail: "Automated denial classification routed the claim to appeals.",
    },
  ];
  if (a.submittedDaysAgo !== null) {
    events.push(
      {
        at: daysAgo(a.submittedDaysAgo + 0.2),
        label: "Letter drafted",
        detail: "Appeal letter generated with citations from local reference.",
      },
      {
        at: daysAgo(a.submittedDaysAgo),
        label: `Submitted via ${SUBMISSION_CHANNEL_LABELS[a.channel]}`,
        detail: `${APPEAL_LEVEL_LONG[a.level]} filed with ${a.payerName}.`,
      },
    );
  }
  if (a.status === "payer_responded") {
    events.push({
      at: daysAgo(0.5),
      label: "Payer responded",
      detail: a.responseNote ?? "Additional records requested.",
    });
  }
  if (a.decidedDaysAgo !== null) {
    events.push({
      at: daysAgo(a.decidedDaysAgo),
      label: a.status === "overturned" ? "Overturned" : "Upheld",
      detail:
        a.status === "overturned"
          ? "Denial reversed; claim reprocessed for payment."
          : "Payer maintained the original determination.",
    });
  }

  return {
    appeal_id: `APL-${String(a.n).padStart(4, "0")}`,
    claim_id: a.claimId,
    practice_id: a.practiceId,
    practice_name: pName,
    payer_name: a.payerName,
    carc_code: a.carc,
    denied_amount: money(a.amount),
    status: a.status,
    opened_at: daysAgo(a.openedDaysAgo),
    submitted_at: a.submittedDaysAgo === null ? null : daysAgo(a.submittedDaysAgo),
    decided_at: a.decidedDaysAgo === null ? null : daysAgo(a.decidedDaysAgo),
    // Filing window runs from the denial date per level/payer rules.
    appeal_deadline: daysAhead(
      deadlineDays(a.level, a.payerName) - a.openedDaysAgo,
    ),
    level: a.level,
    submission_channel: a.channel,
    predecessor_id: null,
    successor_id: null,
    letter_subject: `Appeal of claim ${a.claimId} — CARC ${a.carc} (${category.replace(/_/g, " ")})`,
    letter_body: [
      `To the Appeals Department, ${a.payerName}:`,
      ``,
      `We formally appeal the denial of claim ${a.claimId}, denied under CARC ${a.carc}: "${carcEntry?.description ?? "unknown"}"`,
      ``,
      `The disputed service is CPT ${a.service.procedure_code} (${a.service.description}) with billed charges of $${a.service.charge_amount}. The enclosed encounter documentation supports coverage, and the authorities cited below govern this determination.`,
      ``,
      `We request the denial be reversed and the claim reprocessed for payment of $${money(a.amount)}.`,
      ``,
      `Respectfully,`,
      `Appeals Unit, Claimate (on behalf of ${pName})`,
    ].join("\n"),
    citations,
    disputed_services: [a.service],
    events,
    payer_response:
      a.status === "payer_responded"
        ? (a.responseNote ?? "Additional records requested.")
        : a.status === "overturned"
          ? "Determination reversed on appeal. Payment to follow on next remittance cycle."
          : a.status === "upheld"
            ? "Original determination upheld. Denial reasons stand as issued."
            : null,
  };
}

export const APPEAL_SEEDS: AppealCase[] = [
  // ---- active
  makeAppeal({
    n: 1,
    claimId: "CLM-2026-0098",
    practiceId: "PRAC-001",
    payerName: "Aetna PPO",
    carc: "50",
    amount: 950,
    status: "awaiting_payer",
    openedDaysAgo: 4,
    submittedDaysAgo: 2,
    decidedDaysAgo: null,
    level: "reconsideration",
    channel: "payer_portal",
    service: {
      procedure_code: "93015",
      description: "Cardiovascular stress test",
      charge_amount: money(950),
    },
  }),
  makeAppeal({
    n: 2,
    claimId: "CLM-2026-0092",
    practiceId: "PRAC-004",
    payerName: "UnitedHealthcare",
    carc: "197",
    amount: 1540,
    status: "awaiting_payer",
    openedDaysAgo: 3,
    submittedDaysAgo: 1,
    decidedDaysAgo: null,
    level: "reconsideration",
    channel: "electronic_275",
    service: {
      procedure_code: "20610",
      description: "Major joint injection",
      charge_amount: money(1540),
    },
  }),
  makeAppeal({
    n: 3,
    claimId: "CLM-2026-0112",
    practiceId: "PRAC-002",
    payerName: "Cigna",
    carc: "151",
    amount: 420,
    status: "drafting",
    openedDaysAgo: 1,
    submittedDaysAgo: null,
    decidedDaysAgo: null,
    level: "reconsideration",
    channel: "payer_portal",
    service: {
      procedure_code: "99215",
      description: "Office visit, high complexity",
      charge_amount: money(420),
    },
  }),
  makeAppeal({
    n: 4,
    claimId: "CLM-2026-0108",
    practiceId: "PRAC-003",
    payerName: "BCBS of Illinois",
    carc: "16",
    amount: 185,
    status: "drafting",
    openedDaysAgo: 50, // aging draft: deadline pressure (60d level-1 window)
    submittedDaysAgo: null,
    decidedDaysAgo: null,
    level: "level_1",
    channel: "fax",
    service: {
      procedure_code: "99214",
      description: "Office visit, moderate complexity",
      charge_amount: money(185),
    },
  }),
  makeAppeal({
    n: 5,
    claimId: "CLM-2026-0104",
    practiceId: "PRAC-006",
    payerName: "Aetna PPO",
    carc: "167",
    amount: 760,
    status: "awaiting_payer",
    openedDaysAgo: 5,
    submittedDaysAgo: 3,
    decidedDaysAgo: null,
    level: "reconsideration",
    channel: "certified_mail",
    service: {
      procedure_code: "93306",
      description: "Echocardiogram, complete",
      charge_amount: money(760),
    },
  }),
  makeAppeal({
    n: 6,
    claimId: "CLM-2026-0101",
    practiceId: "PRAC-002",
    payerName: "UnitedHealthcare",
    carc: "50",
    amount: 1895,
    status: "payer_responded",
    openedDaysAgo: 7,
    submittedDaysAgo: 5,
    decidedDaysAgo: null,
    level: "level_1",
    channel: "certified_mail",
    responseNote:
      "Payer requested complete operative note and prior imaging before reconsideration.",
    service: {
      procedure_code: "45380",
      description: "Colonoscopy with biopsy",
      charge_amount: money(1895),
    },
  }),
  // ---- decided (turnarounds: 3, 4, 2, 5 overturned; 3, 4 upheld -> avg 3.5d)
  makeAppeal({
    n: 7,
    claimId: "CLM-2026-0074",
    practiceId: "PRAC-001",
    payerName: "Aetna PPO",
    carc: "50",
    amount: 1240,
    status: "overturned",
    openedDaysAgo: 12,
    submittedDaysAgo: 10,
    decidedDaysAgo: 7,
    level: "reconsideration",
    channel: "payer_portal",
    service: {
      procedure_code: "93015",
      description: "Cardiovascular stress test",
      charge_amount: money(1240),
    },
  }),
  makeAppeal({
    n: 8,
    claimId: "CLM-2026-0069",
    practiceId: "PRAC-004",
    payerName: "UnitedHealthcare",
    carc: "197",
    amount: 2210,
    status: "overturned",
    openedDaysAgo: 14,
    submittedDaysAgo: 12,
    decidedDaysAgo: 8,
    level: "reconsideration",
    channel: "electronic_275",
    service: {
      procedure_code: "29881",
      description: "Knee arthroscopy with meniscectomy",
      charge_amount: money(2210),
    },
  }),
  makeAppeal({
    n: 9,
    claimId: "CLM-2026-0066",
    practiceId: "PRAC-006",
    payerName: "Cigna",
    carc: "11",
    amount: 685,
    status: "overturned",
    openedDaysAgo: 11,
    submittedDaysAgo: 9,
    decidedDaysAgo: 7,
    level: "level_1",
    channel: "fax",
    service: {
      procedure_code: "93306",
      description: "Echocardiogram, complete",
      charge_amount: money(685),
    },
  }),
  makeAppeal({
    n: 10,
    claimId: "CLM-2026-0061",
    practiceId: "PRAC-003",
    payerName: "Aetna PPO",
    carc: "29",
    amount: 950,
    status: "overturned",
    openedDaysAgo: 17,
    submittedDaysAgo: 15,
    decidedDaysAgo: 10,
    level: "reconsideration",
    channel: "certified_mail",
    service: {
      procedure_code: "90460",
      description: "Immunization administration with counseling",
      charge_amount: money(950),
    },
  }),
  makeAppeal({
    n: 11,
    claimId: "CLM-2026-0058",
    practiceId: "PRAC-005",
    payerName: "Humana",
    carc: "96",
    amount: 310,
    status: "upheld",
    openedDaysAgo: 10,
    submittedDaysAgo: 8,
    decidedDaysAgo: 5,
    level: "reconsideration",
    channel: "payer_portal",
    service: {
      procedure_code: "17110",
      description: "Destruction of benign lesions",
      charge_amount: money(310),
    },
  }),
  makeAppeal({
    n: 12,
    claimId: "CLM-2026-0054",
    practiceId: "PRAC-007",
    payerName: "Aetna PPO",
    carc: "204",
    amount: 530,
    status: "upheld",
    openedDaysAgo: 13,
    submittedDaysAgo: 11,
    decidedDaysAgo: 7,
    level: "level_1",
    channel: "fax",
    service: {
      procedure_code: "76817",
      description: "Transvaginal ultrasound",
      charge_amount: money(530),
    },
  }),
];

// --------------------------------------------------------------- sync runs

function syncRun(
  n: number,
  practiceId: string,
  daysBack: number,
  status: SyncRun["status"],
  imported: number,
  failed: number,
  error: string | null,
): SyncRun {
  return {
    run_id: `SYNC-${practiceId.slice(-3)}-${String(n).padStart(3, "0")}`,
    practice_id: practiceId,
    started_at: daysAgo(daysBack),
    finished_at: status === "running" ? null : daysAgo(daysBack - 0.01),
    status,
    rows_imported: imported,
    rows_failed: failed,
    error_message: error,
  };
}

export const SYNC_RUN_SEEDS: SyncRun[] = [
  // Sunrise (healthy, FHIR)
  syncRun(1, "PRAC-001", 2.2, "success", 212, 0, null),
  syncRun(2, "PRAC-001", 1.2, "success", 198, 0, null),
  syncRun(3, "PRAC-001", 0.2, "success", 187, 2, null),
  // Lakeside (healthy, direct DB)
  syncRun(1, "PRAC-002", 1.4, "success", 431, 0, null),
  syncRun(2, "PRAC-002", 0.4, "success", 402, 1, null),
  // Cedar Ridge (degraded, SFTP)
  syncRun(1, "PRAC-003", 4.1, "success", 118, 0, null),
  syncRun(2, "PRAC-003", 3.1, "partial", 96, 22, "22 rows rejected: missing rendering-provider NPI column."),
  syncRun(3, "PRAC-003", 2.1, "partial", 101, 17, "17 rows rejected: malformed service-date format (DD/MM/YYYY)."),
  // Bluebonnet (healthy)
  syncRun(1, "PRAC-004", 1.1, "success", 305, 0, null),
  syncRun(2, "PRAC-004", 0.1, "success", 297, 0, null),
  // Harbor Point (error)
  syncRun(1, "PRAC-005", 6.6, "success", 88, 3, null),
  syncRun(2, "PRAC-005", 5.6, "failed", 0, 0, "SFTP authentication failed: password expired on practice server."),
  syncRun(3, "PRAC-005", 4.6, "failed", 0, 0, "SFTP authentication failed: password expired on practice server."),
  // Desert Sage / Willow Creek (healthy)
  syncRun(1, "PRAC-006", 1.3, "success", 344, 0, null),
  syncRun(2, "PRAC-006", 0.3, "success", 351, 4, null),
  syncRun(1, "PRAC-007", 1.6, "success", 176, 0, null),
  syncRun(2, "PRAC-007", 0.6, "success", 181, 0, null),
  // Granite State: pending, no runs
];

// --------------------------------------------------------- practice claims

const CLAIM_FIRST = ["Nora", "Elias", "Ava", "Miguel", "Ruth", "Ken", "Fatima", "Owen", "Iris", "Leo", "Tessa", "Hugo"];
const CLAIM_LAST = ["Whitman", "Vargas", "Cole", "Bishop", "Ito", "Farrell", "Nassar", "Doyle", "Klein", "Marsh", "Ortiz", "Beck"];
const CLAIM_PAYERS = ["Aetna PPO", "UnitedHealthcare", "Cigna", "BCBS of Illinois", "Humana", "Medicare Part B"];
const CLAIM_STATUSES: ClaimLifecycleStatus[] = [
  "paid", "paid", "payer_received", "submitted_to_clearinghouse", "paid",
  "denied", "clearinghouse_accepted", "denied", "payer_received", "paid",
  "clearinghouse_rejected", "generated",
];
const CLAIM_AMOUNTS = [125, 185, 240, 950, 76, 310, 185, 1540, 130, 685, 445, 92];

/** Deterministic per-practice claim roster (no RNG so the demo is stable). */
export function practiceClaims(practiceId: string): PracticeClaimRow[] {
  const seedNum = Number(practiceId.replace(/\D/g, "")) || 1;
  return CLAIM_STATUSES.map((status, i) => {
    const k = (i + seedNum) % 12;
    return {
      claim_id: `CLM-2026-${String(300 + seedNum * 20 + i).padStart(4, "0")}`,
      patient_first_name: CLAIM_FIRST[k],
      patient_last_name: CLAIM_LAST[(k + seedNum) % 12],
      service_date: isoDateDaysAgo(2 + i * 2 + (seedNum % 3)),
      payer_name: CLAIM_PAYERS[(k + i) % CLAIM_PAYERS.length],
      amount: money(CLAIM_AMOUNTS[k]),
      status,
    };
  });
}

// ------------------------------------------------------------- remittances

/** Build one remittance row from a decided appeal. */
export function remittanceFromAppeal(
  a: AppealCase,
  opts: { posted: boolean; methodSeed?: number },
): RemittanceRow {
  const overturned = a.status === "overturned";
  return {
    remit_id: `RMT-${a.appeal_id.slice(-4)}`,
    payer_name: a.payer_name,
    payment_date: (a.decided_at ?? new Date().toISOString()).slice(0, 10),
    payment_method: (opts.methodSeed ?? 0) % 3 === 2 ? "CHK" : "ACH",
    payment_amount: overturned ? a.denied_amount : "0.00",
    claims_count: 1,
    trace_number: `TRN${String(881000 + (opts.methodSeed ?? 0) * 37)}`,
    claim_id: a.claim_id,
    practice_id: a.practice_id,
    service_lines: a.disputed_services.map((s) => ({
      procedure_code: s.procedure_code,
      paid_amount: overturned ? s.charge_amount : "0.00",
    })),
    adjustments: overturned
      ? []
      : [
          {
            group_code: "CO",
            reason_code: a.carc_code,
            amount: a.denied_amount,
          },
        ],
    posted: opts.posted,
  };
}

/**
 * Initial remittance store: rows for the decided seed appeals (APL-0010 left
 * Unposted to demo payment posting) + routine non-appeal payment cycles.
 */
export function buildRemittanceSeeds(appeals: AppealCase[]): RemittanceRow[] {
  const rows: RemittanceRow[] = appeals
    .filter((a) => a.decided_at !== null)
    .map((a, i) =>
      remittanceFromAppeal(a, {
        posted: a.appeal_id !== "APL-0010", // leave one Unposted for the demo
        methodSeed: i,
      }),
    );
  // Routine (non-appeal) remittance cycles so the list reads realistically.
  const routine: [string, number, number, number][] = [
    ["Aetna PPO", 3, 14832.4, 41],
    ["Aetna PPO", 10, 12277.15, 36],
    ["UnitedHealthcare", 4, 22409.87, 63],
    ["UnitedHealthcare", 11, 19781.5, 55],
    ["Cigna", 6, 9204.32, 28],
    ["Humana", 8, 5110.75, 17],
  ];
  routine.forEach(([payer, back, amount, count], i) => {
    rows.push({
      remit_id: `RMT-C${String(100 + i)}`,
      payer_name: payer,
      payment_date: isoDateDaysAgo(back),
      payment_method: "ACH",
      payment_amount: money(amount),
      claims_count: count,
      trace_number: `TRN${String(770500 + i * 91)}`,
      claim_id: null,
      practice_id: null,
      service_lines: [],
      adjustments: [],
      posted: true,
    });
  });
  return rows.sort((a, b) => (a.payment_date < b.payment_date ? 1 : -1));
}

// ---------------------------------------------------------------- audit log

/** Seeded audit history (append-only; runtime actions append after these). */
export function buildAuditSeeds(): AuditEvent[] {
  const OPS = "Alex Reyes · Denials Operations Lead";
  const OPS2 = "Mia Tran · RCM Operations Analyst";
  const AETNA = "Aetna Health Inc · Appeals Reviewer";
  const UHC = "UnitedHealthcare · Appeals Reviewer";
  let n = 0;
  const ev = (
    daysBack: number,
    actor: string,
    portal: string,
    action: string,
    entityType: string,
    entityId: string,
    summary: string,
  ): AuditEvent => ({
    id: `AUD-${String(++n).padStart(4, "0")}`,
    timestamp: daysAgo(daysBack),
    actor,
    portal,
    action,
    entity_type: entityType,
    entity_id: entityId,
    summary,
  });
  return [
    ev(6.2, "Sam Delgado · Practice signup", "practice", "practice.signup", "practice", "PRAC-008", "none -> account created (Granite State Behavioral Health, pending integration)"),
    ev(5.1, OPS2, "ops", "sync.rerun", "practice", "PRAC-005", "sync requested -> failed (SFTP authentication)"),
    ev(15, OPS, "ops", "appeal.submit", "appeal", "APL-0010", "drafting -> awaiting_payer (via certified mail)"),
    ev(12, OPS, "ops", "appeal.submit", "appeal", "APL-0008", "drafting -> awaiting_payer (via electronic 275)"),
    ev(11, OPS2, "ops", "appeal.submit", "appeal", "APL-0012", "drafting -> awaiting_payer (via fax)"),
    ev(10, OPS, "ops", "appeal.submit", "appeal", "APL-0007", "drafting -> awaiting_payer (via payer portal)"),
    ev(10, AETNA, "payer", "payer.overturn", "appeal", "APL-0010", "awaiting_payer -> overturned ($950.00)"),
    ev(9, OPS2, "ops", "appeal.submit", "appeal", "APL-0009", "drafting -> awaiting_payer (via fax)"),
    ev(8, UHC, "payer", "payer.overturn", "appeal", "APL-0008", "awaiting_payer -> overturned ($2,210.00)"),
    ev(8, OPS, "ops", "appeal.submit", "appeal", "APL-0011", "drafting -> awaiting_payer (via payer portal)"),
    ev(7, AETNA, "payer", "payer.overturn", "appeal", "APL-0007", "awaiting_payer -> overturned ($1,240.00)"),
    ev(7, AETNA, "payer", "payer.uphold", "appeal", "APL-0012", "awaiting_payer -> upheld"),
    ev(6.8, OPS, "ops", "remittance.post", "remittance", "RMT-0007", "unposted -> posted ($1,240.00)"),
    ev(6.5, OPS2, "ops", "remittance.post", "remittance", "RMT-0008", "unposted -> posted ($2,210.00)"),
    ev(2.5, OPS, "ops", "claim.approve", "claim", "CLM-2026-0146", "pending -> approved"),
    ev(1.8, OPS2, "ops", "claim.reject", "claim", "CLM-2026-0144", "pending -> rejected (documentation insufficient)"),
    ev(0.9, OPS, "ops", "claim.codes_edit", "claim", "CLM-2026-0143", "99213 -> 99214 (documentation supports moderate complexity)"),
  ];
}
