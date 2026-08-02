/**
 * Synthetic seed data for the MSW mock API.
 *
 * Every name, ID, NPI, and dollar amount here is fabricated. Shapes mirror
 * the backend Pydantic models exactly (see src/types). Decimal fields are
 * strings ("125.00") to match Pydantic v2 JSON serialization.
 */

import type {
  AppealLetter,
  ClaimPayment,
  CodedClaim,
  DashboardMetrics,
  DenialAnalysis,
  DenialRecordView,
  PatientDemographics,
  QueueItemView,
  ScrubFinding,
  ClaimDetailView,
} from "../types";
import { CARC, RARC } from "../lib/carcRarc";

const money = (n: number): string => n.toFixed(2);

/** Hours ago -> ISO datetime, so queue ages stay realistic at any run time. */
const hoursAgo = (h: number): string =>
  new Date(Date.now() - h * 3_600_000).toISOString();

// ---------------------------------------------------------------- patients

function patient(
  p: Partial<PatientDemographics> & {
    first_name: string;
    last_name: string;
    date_of_birth: string;
    member_id: string;
    payer_name: string;
    payer_id: string;
  },
): PatientDemographics {
  return {
    gender: "U",
    group_number: null,
    address_line1: "100 Synthetic Way",
    city: "Springfield",
    state: "IL",
    zip_code: "62704",
    ...p,
  };
}

const PATIENTS = {
  dawson: patient({
    first_name: "James",
    last_name: "Dawson",
    date_of_birth: "1968-03-14",
    gender: "M",
    member_id: "AET448291073",
    group_number: "GRP-88121",
    payer_name: "Aetna PPO",
    payer_id: "60054",
    address_line1: "412 Birchwood Ln",
    city: "Naperville",
  }),
  alvarez: patient({
    first_name: "Maria",
    last_name: "Alvarez",
    date_of_birth: "1957-11-02",
    gender: "F",
    member_id: "UHC902174455",
    group_number: "GRP-70455",
    payer_name: "UnitedHealthcare",
    payer_id: "87726",
    address_line1: "77 Cedar Ct",
    city: "Aurora",
  }),
  kim: patient({
    first_name: "Robert",
    last_name: "Kim",
    date_of_birth: "1979-06-21",
    gender: "M",
    member_id: "CIG550018264",
    payer_name: "Cigna",
    payer_id: "62308",
    address_line1: "230 Willow St",
    city: "Evanston",
  }),
  okafor: patient({
    first_name: "Linda",
    last_name: "Okafor",
    date_of_birth: "1990-09-08",
    gender: "F",
    member_id: "BCB113979820",
    group_number: "GRP-20017",
    payer_name: "BCBS of Illinois",
    payer_id: "00621",
    address_line1: "9 Prairie Ave",
    city: "Joliet",
  }),
  nguyen: patient({
    first_name: "Thomas",
    last_name: "Nguyen",
    date_of_birth: "1951-01-27",
    gender: "M",
    member_id: "MCR73A559012",
    payer_name: "Medicare Part B",
    payer_id: "04112",
    address_line1: "1550 Lakeview Dr",
    city: "Peoria",
  }),
  brooks: patient({
    first_name: "Angela",
    last_name: "Brooks",
    date_of_birth: "1984-05-30",
    gender: "F",
    member_id: "HUM667284100",
    group_number: "GRP-33290",
    payer_name: "Humana",
    payer_id: "61101",
    address_line1: "68 Sycamore Rd",
    city: "Champaign",
  }),
  feldman: patient({
    first_name: "David",
    last_name: "Feldman",
    date_of_birth: "1962-12-05",
    gender: "M",
    member_id: "AET229004718",
    group_number: "GRP-88121",
    payer_name: "Aetna PPO",
    payer_id: "60054",
    address_line1: "301 Kestrel Way",
    city: "Rockford",
  }),
  sharma: patient({
    first_name: "Priya",
    last_name: "Sharma",
    date_of_birth: "1995-08-17",
    gender: "F",
    member_id: "CIG881203657",
    payer_name: "Cigna",
    payer_id: "62308",
    address_line1: "12 Fox Run",
    city: "Schaumburg",
  }),
  mendes: patient({
    first_name: "Carlos",
    last_name: "Mendes",
    date_of_birth: "1973-04-11",
    gender: "M",
    member_id: "UHC330928144",
    group_number: "GRP-70455",
    payer_name: "UnitedHealthcare",
    payer_id: "87726",
    address_line1: "845 Hawthorne Blvd",
    city: "Elgin",
  }),
};

const PROVIDERS = {
  chen: { name: "Dr. Sarah Chen, MD", npi: "1234567893" },
  webb: { name: "Dr. Marcus Webb, DO", npi: "1245319599" },
  osei: { name: "Dr. Abena Osei, MD", npi: "1093812345" },
};

// ---------------------------------------------------------------- claims

interface ClaimSeed {
  detail: ClaimDetailView;
  queue: QueueItemView | null;
}

function totalCharge(claim: CodedClaim): number {
  return claim.procedures.reduce((sum, p) => sum + Number(p.charge), 0);
}

/** Deterministic, plausible X12 837P rendering for the bottom drawer. */
function renderEdi837(claim: CodedClaim, controlNumber: number): string {
  const icn = String(controlNumber).padStart(9, "0");
  const dos = claim.encounter.service_date.replace(/-/g, "");
  const total = money(totalCharge(claim));
  const pat = claim.patient;
  const segs: string[] = [
    `ISA*00*          *00*          *ZZ*LAKESIDEFM     *ZZ*${pat.payer_id.padEnd(15, " ")}*260714*0930*^*00501*${icn}*0*T*:`,
    `GS*HC*LAKESIDEFM*${pat.payer_id}*20260714*0930*${controlNumber}*X*005010X222A1`,
    `ST*837*${String(controlNumber).padStart(4, "0")}*005010X222A1`,
    `BHT*0019*00*${claim.claim_id}*20260714*0930*CH`,
    `NM1*41*2*LAKESIDE FAMILY MEDICINE*****46*LAKESIDEFM`,
    `PER*IC*BILLING DEPT*TE*3125550142`,
    `NM1*40*2*${pat.payer_name.toUpperCase()}*****46*${pat.payer_id}`,
    `HL*1**20*1`,
    `NM1*85*2*LAKESIDE FAMILY MEDICINE*****XX*1245319599`,
    `N3*820 CLINIC PARK DR`,
    `N4*SPRINGFIELD*IL*62704`,
    `REF*EI*367204918`,
    `HL*2*1*22*0`,
    `SBR*P*18*${pat.group_number ?? ""}******CI`,
    `NM1*IL*1*${pat.last_name.toUpperCase()}*${pat.first_name.toUpperCase()}****MI*${pat.member_id}`,
    `N3*${pat.address_line1.toUpperCase()}`,
    `N4*${pat.city.toUpperCase()}*${pat.state}*${pat.zip_code}`,
    `DMG*D8*${pat.date_of_birth.replace(/-/g, "")}*${pat.gender}`,
    `CLM*${claim.claim_id}*${total}***${claim.place_of_service}:B:1*Y*A*Y*Y`,
    `HI*${claim.diagnoses
      .map(
        (d, i) => `${i === 0 ? "ABK" : "ABF"}:${d.code.replace(".", "")}`,
      )
      .join("*")}`,
    `NM1*82*1*${claim.encounter.provider_name
      .replace(/^Dr\.\s*/, "")
      .split(",")[0]
      .toUpperCase()}****XX*${claim.encounter.provider_npi}`,
  ];
  claim.procedures.forEach((p, i) => {
    const proc = [p.code, ...p.modifiers].join(":");
    segs.push(`LX*${i + 1}`);
    segs.push(
      `SV1*HC:${proc}*${p.charge}*UN*${p.units}***${p.diagnosis_pointers.join(":")}`,
    );
    segs.push(`DTP*472*D8*${dos}`);
  });
  segs.push(
    `SE*${segs.length - 1}*${String(controlNumber).padStart(4, "0")}`,
    `GE*1*${controlNumber}`,
    `IEA*1*${icn}`,
  );
  return segs.map((s) => `${s}~`).join("\n");
}

function makeClaim(args: {
  itemId: string | null;
  claimId: string;
  pat: PatientDemographics;
  provider: { name: string; npi: string };
  serviceDate: string;
  chiefComplaint: string;
  hpi: string;
  dxText: string[];
  procText: string[];
  fieldConfidence: Record<string, number>;
  warnings?: string[];
  pos?: string;
  diagnoses: CodedClaim["diagnoses"];
  procedures: CodedClaim["procedures"];
  overall: number;
  validationFlags?: string[];
  priorAuth?: string | null;
  findings: ScrubFinding[];
  reasons: string[];
  enqueuedHoursAgo: number;
  controlNumber: number;
}): ClaimSeed {
  const claim: CodedClaim = {
    claim_id: args.claimId,
    patient: args.pat,
    encounter: {
      encounter_id: `ENC-${args.claimId.slice(-4)}`,
      service_date: args.serviceDate,
      chief_complaint: args.chiefComplaint,
      hpi: args.hpi,
      diagnoses: args.dxText,
      procedures: args.procText,
      provider_npi: args.provider.npi,
      provider_name: args.provider.name,
      place_of_service: args.pos ?? "11",
      field_confidence: args.fieldConfidence,
      extraction_warnings: args.warnings ?? [],
    },
    diagnoses: args.diagnoses,
    procedures: args.procedures,
    place_of_service: args.pos ?? "11",
    overall_confidence: args.overall,
    validation_flags: args.validationFlags ?? [],
    prior_auth_number: args.priorAuth ?? null,
  };
  const detail: ClaimDetailView = {
    claim,
    findings: args.findings,
    routing: {
      route_to_human: args.itemId !== null,
      reasons: args.reasons,
    },
    edi_837p: renderEdi837(claim, args.controlNumber),
    review_status: "pending",
  };
  const queue: QueueItemView | null = args.itemId
    ? {
        item_id: args.itemId,
        claim_id: args.claimId,
        reasons: args.reasons,
        confidence: args.overall,
        claim_value: money(totalCharge(claim)),
        findings: args.findings,
        patient_first_name: args.pat.first_name,
        patient_last_name: args.pat.last_name,
        provider_name: args.provider.name,
        enqueued_at: hoursAgo(args.enqueuedHoursAgo),
        review_status: "pending",
      }
    : null;
  return { detail, queue };
}

export const CLAIM_SEEDS: ClaimSeed[] = [
  makeClaim({
    itemId: "HITL-0001",
    claimId: "CLM-2026-0142",
    pat: PATIENTS.dawson,
    provider: PROVIDERS.chen,
    serviceDate: "2026-07-28",
    chiefComplaint: "Intermittent chest discomfort with exertion",
    hpi: "58-year-old male with known hypertension reports three episodes of substernal chest pressure over the past two weeks, each lasting 5-10 minutes, occurring with brisk walking and resolving with rest. Denies radiation, diaphoresis, or dyspnea at rest. Home BP readings 145-155 systolic.",
    dxText: [
      "Chest pain, unspecified, likely exertional",
      "Essential hypertension, suboptimally controlled",
    ],
    procText: [
      "Detailed evaluation and management, established patient",
      "12-lead electrocardiogram with interpretation",
    ],
    fieldConfidence: {
      chief_complaint: 0.96,
      hpi: 0.61,
      diagnoses: 0.64,
      procedures: 0.9,
    },
    warnings: ["HPI section partially illegible in source note"],
    diagnoses: [
      { code: "R07.9", description: "Chest pain, unspecified", confidence: 0.64 },
      { code: "I10", description: "Essential (primary) hypertension", confidence: 0.97 },
    ],
    procedures: [
      {
        code: "99214",
        description: "Office/outpatient visit, established patient, moderate complexity",
        modifiers: ["25"],
        units: 1,
        charge: money(185),
        diagnosis_pointers: [1, 2],
        confidence: 0.88,
      },
      {
        code: "93000",
        description: "Electrocardiogram, complete with interpretation and report",
        modifiers: [],
        units: 1,
        charge: money(75),
        diagnosis_pointers: [1],
        confidence: 0.95,
      },
    ],
    overall: 0.64,
    findings: [
      {
        rule_id: "DX_SPECIFICITY",
        severity: "WARNING",
        message:
          "R07.9 is an unspecified code; payer medical policy prefers a more specific chest pain code when documentation supports it.",
        procedure_code: null,
        field: "diagnoses[0]",
      },
      {
        rule_id: "EXTRACTION_CONFIDENCE",
        severity: "INFO",
        message: "HPI extraction confidence 0.61 is below the 0.70 review threshold.",
        procedure_code: null,
        field: "hpi",
      },
    ],
    reasons: ["Low extraction confidence (hpi 0.61)", "Unspecified diagnosis code"],
    enqueuedHoursAgo: 2,
    controlNumber: 142,
  }),
  makeClaim({
    itemId: "HITL-0002",
    claimId: "CLM-2026-0139",
    pat: PATIENTS.alvarez,
    provider: PROVIDERS.webb,
    serviceDate: "2026-07-27",
    chiefComplaint: "Right knee pain, worsening over 3 months",
    hpi: "68-year-old female with radiographically confirmed right knee osteoarthritis, failed 8 weeks of NSAIDs and physical therapy. Persistent pain 7/10 with ambulation. Discussed intra-articular corticosteroid injection; consented today.",
    dxText: ["Primary osteoarthritis, right knee"],
    procText: [
      "Aspiration and injection of major joint (right knee) with ultrasound guidance not used",
      "Triamcinolone acetonide 40 mg injected",
      "Established patient visit, moderate complexity",
    ],
    fieldConfidence: {
      chief_complaint: 0.98,
      hpi: 0.94,
      diagnoses: 0.96,
      procedures: 0.92,
    },
    diagnoses: [
      {
        code: "M17.11",
        description: "Unilateral primary osteoarthritis, right knee",
        confidence: 0.97,
      },
    ],
    procedures: [
      {
        code: "20610",
        description: "Arthrocentesis, aspiration and/or injection, major joint",
        modifiers: ["RT"],
        units: 1,
        charge: money(210),
        diagnosis_pointers: [1],
        confidence: 0.94,
      },
      {
        code: "J3301",
        description: "Triamcinolone acetonide injection, 10 mg",
        modifiers: [],
        units: 4,
        charge: money(48),
        diagnosis_pointers: [1],
        confidence: 0.9,
      },
      {
        code: "99214",
        description: "Office/outpatient visit, established patient, moderate complexity",
        modifiers: ["25"],
        units: 1,
        charge: money(1282),
        diagnosis_pointers: [1],
        confidence: 0.85,
      },
    ],
    overall: 0.91,
    validationFlags: ["FEE_ABOVE_SCHEDULE:99214"],
    findings: [
      {
        rule_id: "AUTH_REQUIRED",
        severity: "ERROR",
        message:
          "UnitedHealthcare requires prior authorization for repeat intra-articular injections within 90 days; no auth number on claim.",
        procedure_code: "20610",
        field: "prior_auth_number",
      },
      {
        rule_id: "FEE_ABOVE_SCHEDULE",
        severity: "WARNING",
        message:
          "Charge 1282.00 for 99214 exceeds contracted fee schedule amount 185.00 by more than 5x; verify charge entry.",
        procedure_code: "99214",
        field: "procedures[2].charge",
      },
    ],
    reasons: ["High-value claim ($1,540.00)", "Scrub error: AUTH_REQUIRED"],
    enqueuedHoursAgo: 5,
    controlNumber: 139,
  }),
  makeClaim({
    itemId: "HITL-0003",
    claimId: "CLM-2026-0137",
    pat: PATIENTS.kim,
    provider: PROVIDERS.chen,
    serviceDate: "2026-07-27",
    chiefComplaint: "Diabetes follow-up, medication refill",
    hpi: "47-year-old male with type 2 diabetes on metformin 1000 mg BID. Reports good adherence, no hypoglycemia. Last A1c 7.4% three months ago. Fasting labs drawn today.",
    dxText: [
      "Type 2 diabetes mellitus without complications",
      "Mixed hyperlipidemia",
    ],
    procText: [
      "Established patient visit, low complexity",
      "Venipuncture",
      "Comprehensive metabolic panel",
    ],
    fieldConfidence: {
      chief_complaint: 0.97,
      hpi: 0.92,
      diagnoses: 0.85,
      procedures: 0.88,
    },
    diagnoses: [
      {
        code: "E11.9",
        description: "Type 2 diabetes mellitus without complications",
        confidence: 0.95,
      },
      { code: "E78.5", description: "Hyperlipidemia, unspecified", confidence: 0.82 },
    ],
    procedures: [
      {
        code: "99213",
        description: "Office/outpatient visit, established patient, low complexity",
        modifiers: [],
        units: 1,
        charge: money(125),
        diagnosis_pointers: [1, 2],
        confidence: 0.93,
      },
      {
        code: "36415",
        description: "Collection of venous blood by venipuncture",
        modifiers: [],
        units: 1,
        charge: money(12),
        diagnosis_pointers: [1],
        confidence: 0.97,
      },
      {
        code: "80053",
        description: "Comprehensive metabolic panel",
        modifiers: [],
        units: 1,
        charge: money(45),
        diagnosis_pointers: [1],
        confidence: 0.96,
      },
    ],
    overall: 0.82,
    findings: [
      {
        rule_id: "DX_SPECIFICITY",
        severity: "INFO",
        message:
          "E78.5 is unspecified; note documents mixed hyperlipidemia (E78.2 may be more specific).",
        procedure_code: null,
        field: "diagnoses[1]",
      },
    ],
    reasons: ["Overall confidence 0.82 below auto-approve threshold (0.90)"],
    enqueuedHoursAgo: 9,
    controlNumber: 137,
  }),
  makeClaim({
    itemId: "HITL-0004",
    claimId: "CLM-2026-0135",
    pat: PATIENTS.okafor,
    provider: PROVIDERS.osei,
    serviceDate: "2026-07-26",
    chiefComplaint: "Laceration of right index finger",
    hpi: "35-year-old female sustained a 3.2 cm laceration to the dorsal right index finger while cooking approximately 2 hours prior to arrival. No tendon involvement on exam, full range of motion, sensation intact. Tetanus up to date.",
    dxText: [
      "Laceration without foreign body of right index finger, initial encounter",
    ],
    procText: [
      "Simple repair of superficial wound, 3.2 cm, layered closure not required",
      "New patient evaluation, straightforward",
    ],
    fieldConfidence: {
      chief_complaint: 0.99,
      hpi: 0.95,
      diagnoses: 0.93,
      procedures: 0.84,
    },
    diagnoses: [
      {
        code: "S61.218A",
        description:
          "Laceration without damage to nail of other finger, initial encounter",
        confidence: 0.86,
      },
    ],
    procedures: [
      {
        code: "12002",
        description:
          "Simple repair of superficial wounds of extremities, 2.6 cm to 7.5 cm",
        modifiers: [],
        units: 1,
        charge: money(265),
        diagnosis_pointers: [1],
        confidence: 0.91,
      },
      {
        code: "99203",
        description: "Office/outpatient visit, new patient, low complexity",
        modifiers: [],
        units: 1,
        charge: money(130),
        diagnosis_pointers: [1],
        confidence: 0.89,
      },
    ],
    overall: 0.86,
    validationFlags: ["NCCI_PTP:99203-12002"],
    findings: [
      {
        rule_id: "MOD25_MISSING",
        severity: "ERROR",
        message:
          "E/M 99203 billed same day as minor procedure 12002 without modifier 25; NCCI PTP edit will deny the visit.",
        procedure_code: "99203",
        field: "procedures[1].modifiers",
      },
    ],
    reasons: ["Scrub error: MOD25_MISSING"],
    enqueuedHoursAgo: 26,
    controlNumber: 135,
  }),
  makeClaim({
    itemId: "HITL-0005",
    claimId: "CLM-2026-0133",
    pat: PATIENTS.nguyen,
    provider: PROVIDERS.webb,
    serviceDate: "2026-07-25",
    chiefComplaint: "Productive cough for 10 days",
    hpi: "75-year-old male with 10 days of productive cough, low-grade fever resolved, no dyspnea. Lungs with scattered rhonchi. Chest x-ray ordered to rule out pneumonia given age.",
    dxText: ["Acute bronchitis, unspecified"],
    procText: [
      "Established patient visit, moderate complexity",
      "Chest x-ray, 2 views",
    ],
    fieldConfidence: {
      chief_complaint: 0.94,
      hpi: 0.51,
      diagnoses: 0.58,
      procedures: 0.83,
    },
    warnings: [
      "Assessment section truncated in source note",
      "Plan section inferred from order log",
    ],
    diagnoses: [
      { code: "J20.9", description: "Acute bronchitis, unspecified", confidence: 0.58 },
    ],
    procedures: [
      {
        code: "99214",
        description: "Office/outpatient visit, established patient, moderate complexity",
        modifiers: ["25"],
        units: 1,
        charge: money(185),
        diagnosis_pointers: [1],
        confidence: 0.8,
      },
      {
        code: "71046",
        description: "Radiologic examination, chest, 2 views",
        modifiers: [],
        units: 1,
        charge: money(125),
        diagnosis_pointers: [1],
        confidence: 0.87,
      },
    ],
    overall: 0.58,
    findings: [
      {
        rule_id: "EXTRACTION_CONFIDENCE",
        severity: "WARNING",
        message:
          "Diagnosis extraction confidence 0.58; assessment section was truncated in the source note.",
        procedure_code: null,
        field: "diagnoses",
      },
    ],
    reasons: ["Low extraction confidence (diagnoses 0.58)"],
    enqueuedHoursAgo: 30,
    controlNumber: 133,
  }),
  makeClaim({
    itemId: "HITL-0006",
    claimId: "CLM-2026-0130",
    pat: PATIENTS.brooks,
    provider: PROVIDERS.osei,
    serviceDate: "2026-07-24",
    chiefComplaint: "Annual preventive exam",
    hpi: "42-year-old female presenting for annual preventive visit. No new complaints. Up to date on screening except influenza vaccination, administered today.",
    dxText: [
      "Encounter for general adult medical examination without abnormal findings",
    ],
    procText: [
      "Preventive medicine visit, established patient, 40-64 years",
      "Influenza vaccine, quadrivalent, administered IM",
      "Immunization administration",
    ],
    fieldConfidence: {
      chief_complaint: 0.99,
      hpi: 0.96,
      diagnoses: 0.97,
      procedures: 0.95,
    },
    diagnoses: [
      {
        code: "Z00.00",
        description:
          "Encounter for general adult medical examination without abnormal findings",
        confidence: 0.98,
      },
    ],
    procedures: [
      {
        code: "99396",
        description: "Periodic preventive medicine visit, established patient, 40-64 years",
        modifiers: [],
        units: 1,
        charge: money(230),
        diagnosis_pointers: [1],
        confidence: 0.97,
      },
      {
        code: "90686",
        description: "Influenza virus vaccine, quadrivalent, preservative free",
        modifiers: [],
        units: 1,
        charge: money(38),
        diagnosis_pointers: [1],
        confidence: 0.95,
      },
      {
        code: "90471",
        description: "Immunization administration, one vaccine",
        modifiers: [],
        units: 1,
        charge: money(17),
        diagnosis_pointers: [1],
        confidence: 0.95,
      },
    ],
    overall: 0.93,
    findings: [
      {
        rule_id: "POS_MISMATCH",
        severity: "ERROR",
        message:
          "Place of service 11 conflicts with scheduling system record (telehealth flag set); confirm POS before submission.",
        procedure_code: null,
        field: "place_of_service",
      },
    ],
    reasons: ["Scrub error: POS_MISMATCH"],
    enqueuedHoursAgo: 49,
    controlNumber: 130,
  }),
  makeClaim({
    itemId: "HITL-0007",
    claimId: "CLM-2026-0128",
    pat: PATIENTS.feldman,
    provider: PROVIDERS.chen,
    serviceDate: "2026-07-23",
    chiefComplaint: "Palpitations, follow-up of atrial fibrillation",
    hpi: "63-year-old male with paroxysmal atrial fibrillation on apixaban reports increased palpitation frequency over two weeks. No syncope or chest pain. Exercise stress test performed to evaluate rate control with exertion.",
    dxText: ["Paroxysmal atrial fibrillation"],
    procText: [
      "Established patient visit, high complexity",
      "Exercise treadmill stress test with physician supervision and interpretation",
    ],
    fieldConfidence: {
      chief_complaint: 0.97,
      hpi: 0.78,
      diagnoses: 0.9,
      procedures: 0.72,
    },
    diagnoses: [
      {
        code: "I48.0",
        description: "Paroxysmal atrial fibrillation",
        confidence: 0.92,
      },
    ],
    procedures: [
      {
        code: "99215",
        description: "Office/outpatient visit, established patient, high complexity",
        modifiers: ["25"],
        units: 1,
        charge: money(240),
        diagnosis_pointers: [1],
        confidence: 0.76,
      },
      {
        code: "93015",
        description:
          "Cardiovascular stress test with supervision, interpretation and report",
        modifiers: [],
        units: 1,
        charge: money(950),
        diagnosis_pointers: [1],
        confidence: 0.72,
      },
    ],
    overall: 0.72,
    findings: [
      {
        rule_id: "MEDICAL_NECESSITY_DOC",
        severity: "WARNING",
        message:
          "Aetna LCD for 93015 expects documented failed rate-control or symptoms at rest; HPI support is borderline.",
        procedure_code: "93015",
        field: null,
      },
    ],
    reasons: ["High-value claim ($1,190.00)", "Overall confidence 0.72"],
    enqueuedHoursAgo: 74,
    controlNumber: 128,
  }),
  makeClaim({
    itemId: "HITL-0008",
    claimId: "CLM-2026-0125",
    pat: PATIENTS.sharma,
    provider: PROVIDERS.osei,
    serviceDate: "2026-07-22",
    chiefComplaint: "Anxiety, difficulty sleeping",
    hpi: "30-year-old female reports four months of excessive worry, restlessness, and initial insomnia affecting work performance. GAD-7 score 14 (moderate). Discussed therapy referral and initiated SSRI.",
    dxText: ["Generalized anxiety disorder"],
    procText: ["Established patient visit, moderate complexity, >50% counseling"],
    fieldConfidence: {
      chief_complaint: 0.95,
      hpi: 0.67,
      diagnoses: 0.71,
      procedures: 0.66,
    },
    warnings: ["Time-based billing statement not found in note"],
    diagnoses: [
      { code: "F41.1", description: "Generalized anxiety disorder", confidence: 0.84 },
    ],
    procedures: [
      {
        code: "99214",
        description: "Office/outpatient visit, established patient, moderate complexity",
        modifiers: [],
        units: 1,
        charge: money(185),
        diagnosis_pointers: [1],
        confidence: 0.66,
      },
    ],
    overall: 0.66,
    findings: [
      {
        rule_id: "TIME_DOC_MISSING",
        severity: "WARNING",
        message:
          "Counseling-time billing asserted but total time statement is missing from the note.",
        procedure_code: "99214",
        field: "hpi",
      },
    ],
    reasons: ["Low extraction confidence (procedures 0.66)"],
    enqueuedHoursAgo: 78,
    controlNumber: 125,
  }),
  makeClaim({
    itemId: "HITL-0009",
    claimId: "CLM-2026-0121",
    pat: PATIENTS.mendes,
    provider: PROVIDERS.webb,
    serviceDate: "2026-07-21",
    chiefComplaint: "Asthma follow-up with spirometry",
    hpi: "53-year-old male with moderate persistent asthma on ICS/LABA. Reports rescue inhaler use twice weekly. Spirometry performed to assess control; FEV1 78% predicted.",
    dxText: ["Moderate persistent asthma, uncomplicated"],
    procText: [
      "Established patient visit, moderate complexity",
      "Spirometry with interpretation",
    ],
    fieldConfidence: {
      chief_complaint: 0.98,
      hpi: 0.93,
      diagnoses: 0.95,
      procedures: 0.94,
    },
    diagnoses: [
      {
        code: "J45.40",
        description: "Moderate persistent asthma, uncomplicated",
        confidence: 0.96,
      },
    ],
    procedures: [
      {
        code: "99214",
        description: "Office/outpatient visit, established patient, moderate complexity",
        modifiers: ["25"],
        units: 1,
        charge: money(185),
        diagnosis_pointers: [1],
        confidence: 0.95,
      },
      {
        code: "94010",
        description: "Spirometry, including graphic record",
        modifiers: [],
        units: 1,
        charge: money(80),
        diagnosis_pointers: [1],
        confidence: 0.93,
      },
    ],
    overall: 0.94,
    findings: [
      {
        rule_id: "DUPLICATE_SUSPECT",
        severity: "ERROR",
        message:
          "A claim for the same patient, provider, and service date with CPT 94010 was submitted on 2026-07-14 (CLM-2026-0104); confirm this is not a duplicate.",
        procedure_code: "94010",
        field: null,
      },
    ],
    reasons: ["Scrub error: DUPLICATE_SUSPECT"],
    enqueuedHoursAgo: 100,
    controlNumber: 121,
  }),
];

// ---------------------------------------------------------------- denials

function denial(args: {
  denialId: string;
  claimId: string;
  payerName: string;
  paymentDate: string;
  carc: string;
  rarcs: string[];
  procedure: string;
  charge: number;
  deniedAmount: number;
  paid?: number;
  patientResp?: number;
  payerClaimNumber: string;
  appealStatus: DenialRecordView["appeal_status"];
  notes: string;
}): DenialRecordView {
  const entry = CARC[args.carc];
  const analysis: DenialAnalysis = {
    claim_id: args.claimId,
    category: entry?.category ?? "other",
    carc_code: args.carc,
    carc_description: entry?.description ?? "Unknown adjustment reason code.",
    rarc_codes: args.rarcs,
    rarc_descriptions: Object.fromEntries(
      args.rarcs.map((c) => [c, RARC[c] ?? "Unknown remark code."]),
    ),
    denied_amount: money(args.deniedAmount),
    is_appealable: entry?.appealable ?? false,
    notes: args.notes,
  };
  const payment: ClaimPayment = {
    claim_id: args.claimId,
    status_code: args.paid && args.paid > 0 ? 1 : 4,
    charge_amount: money(args.charge),
    paid_amount: money(args.paid ?? 0),
    patient_responsibility: money(args.patientResp ?? 0),
    payer_claim_number: args.payerClaimNumber,
    adjustments: [],
    remark_codes: [],
    service_lines: [
      {
        procedure_code: args.procedure,
        charge_amount: money(args.charge),
        paid_amount: money(args.paid ?? 0),
        adjustments: [
          {
            group_code: "CO",
            reason_code: args.carc,
            amount: money(args.deniedAmount),
            quantity: null,
          },
        ],
        remark_codes: args.rarcs,
      },
    ],
  };
  return {
    analysis,
    payment,
    payer_name: args.payerName,
    payment_date: args.paymentDate,
    appeal_status: args.appealStatus,
  };
}

/** Keyed by denial id (used in /api/denials/:id/appeal). */
export const DENIAL_SEEDS: Record<string, DenialRecordView> = {
  "DEN-0098": denial({
    denialId: "DEN-0098",
    claimId: "CLM-2026-0098",
    payerName: "Aetna PPO",
    paymentDate: "20260722",
    carc: "50",
    rarcs: ["N115", "M25"],
    procedure: "93015",
    charge: 950,
    deniedAmount: 950,
    payerClaimNumber: "AET-98-104472",
    appealStatus: "draft",
    notes:
      "Stress test denied as not medically necessary per LCD; chart documents failed rate control and exertional symptoms.",
  }),
  "DEN-0092": denial({
    denialId: "DEN-0092",
    claimId: "CLM-2026-0092",
    payerName: "UnitedHealthcare",
    paymentDate: "20260719",
    carc: "197",
    rarcs: ["M62"],
    procedure: "20610",
    charge: 980,
    deniedAmount: 980,
    payerClaimNumber: "UHC-77-300281",
    appealStatus: "submitted",
    notes:
      "Injection denied for missing prior authorization; auth OP-88213 was issued 2026-06-30 but not transmitted on the claim.",
  }),
  "DEN-0087": denial({
    denialId: "DEN-0087",
    claimId: "CLM-2026-0087",
    payerName: "Cigna",
    paymentDate: "20260716",
    carc: "16",
    rarcs: ["M76"],
    procedure: "99214",
    charge: 185,
    deniedAmount: 185,
    payerClaimNumber: "CIG-31-887140",
    appealStatus: "none",
    notes:
      "Claim rejected for missing/invalid diagnosis; diagnosis pointer referenced a deleted code. Correct and resubmit rather than appeal.",
  }),
  "DEN-0081": denial({
    denialId: "DEN-0081",
    claimId: "CLM-2026-0081",
    payerName: "BCBS of Illinois",
    paymentDate: "20260710",
    carc: "29",
    rarcs: [],
    procedure: "99215",
    charge: 420,
    deniedAmount: 420,
    payerClaimNumber: "BCB-55-661029",
    appealStatus: "won",
    notes:
      "Timely filing denial overturned on appeal: original submission 2026-02-11 was within the 180-day window (proof of timely filing attached).",
  }),
  "DEN-0076": denial({
    denialId: "DEN-0076",
    claimId: "CLM-2026-0076",
    payerName: "Humana",
    paymentDate: "20260708",
    carc: "45",
    rarcs: ["N130"],
    procedure: "99396",
    charge: 230,
    deniedAmount: 63.5,
    paid: 166.5,
    payerClaimNumber: "HUM-20-114953",
    appealStatus: "none",
    notes: "Contractual write-off above fee schedule; not appealable.",
  }),
  "DEN-0070": denial({
    denialId: "DEN-0070",
    claimId: "CLM-2026-0070",
    payerName: "Medicare Part B",
    paymentDate: "20260703",
    carc: "22",
    rarcs: ["N479"],
    procedure: "99214",
    charge: 185,
    deniedAmount: 185,
    payerClaimNumber: "MCR-04-720018",
    appealStatus: "none",
    notes:
      "Medicare Secondary Payer flag: employer group health plan appears primary. Obtain primary EOB and resubmit.",
  }),
};

// ---------------------------------------------------------------- appeals

function appealLetter(
  denialId: string,
  version: number,
): AppealLetter | null {
  const rec = DENIAL_SEEDS[denialId];
  if (!rec || !rec.analysis.is_appealable) return null;
  const a = rec.analysis;
  const svc = rec.payment.service_lines[0];
  const variantNote =
    version > 1
      ? " We respectfully request expedited reconsideration given the complete documentation enclosed."
      : "";
  const citations =
    a.category === "medical_necessity"
      ? [
          {
            source: "Social Security Act",
            reference: "SSA 1862(a)(1)(A)",
            summary:
              "Medicare covers services that are reasonable and necessary for the diagnosis or treatment of illness or injury.",
          },
          {
            source: "Medicare Program Integrity Manual",
            reference: "CMS Pub. 100-08, Ch. 13",
            summary:
              "Local Coverage Determinations must be applied consistently with documented clinical evidence in the medical record.",
          },
        ]
      : a.category === "timely_filing"
        ? [
            {
              source: "Code of Federal Regulations",
              reference: "42 CFR 424.44",
              summary:
                "Defines the timely filing period for claims and the evidence acceptable to establish the date of first submission.",
            },
          ]
        : [
            {
              source: "Code of Federal Regulations",
              reference: "45 CFR 147.136",
              summary:
                "Requires group health plans to provide a full and fair internal appeals process for adverse benefit determinations.",
            },
          ];
  return {
    claim_id: a.claim_id,
    subject: `Appeal of claim ${a.claim_id} — CARC ${a.carc_code} (${a.category.replace(/_/g, " ")})`,
    body: [
      `To the Appeals Department, ${rec.payer_name}:`,
      ``,
      `We are writing to formally appeal the denial of claim ${a.claim_id} (payer claim number ${rec.payment.payer_claim_number ?? "on file"}), adjudicated on your remittance dated ${rec.payment_date.slice(4, 6)}/${rec.payment_date.slice(6, 8)}/${rec.payment_date.slice(0, 4)}. The claim was denied under reason code CARC ${a.carc_code}: "${a.carc_description}"`,
      ``,
      `The disputed service is CPT ${svc.procedure_code} with billed charges of $${svc.charge_amount}. ${a.notes}`,
      ``,
      `Supporting clinical documentation is enclosed, including the complete encounter note for the date of service. Based on the enclosed record and the authorities cited below, we request that the denial be reversed and the claim reprocessed for payment of the denied amount of $${a.denied_amount}.${variantNote}`,
      ``,
      `Please direct any questions to the billing office at Lakeside Family Medicine, (312) 555-0142.`,
      ``,
      `Respectfully,`,
      `Revenue Cycle Department`,
      `Lakeside Family Medicine`,
    ].join("\n"),
    citations,
    generated_by: version > 1 ? "AnthropicLLMClient" : "TemplateLLMClient",
  };
}

export function generateAppealLetter(
  denialId: string,
  version: number,
): AppealLetter | null {
  return appealLetter(denialId, version);
}

// -------------------------------------------------------------- dashboard

export const DASHBOARD_SEED: Omit<DashboardMetrics, "hitl_queue_value"> = {
  claims_processed: 1284,
  auto_approval_rate: 0.83,
  denial_rate: 0.072,
  clean_claim_rate_series: [
    { date: "2026-05-11", rate: 0.887 },
    { date: "2026-05-18", rate: 0.894 },
    { date: "2026-05-25", rate: 0.881 },
    { date: "2026-06-01", rate: 0.902 },
    { date: "2026-06-08", rate: 0.911 },
    { date: "2026-06-15", rate: 0.905 },
    { date: "2026-06-22", rate: 0.918 },
    { date: "2026-06-29", rate: 0.923 },
    { date: "2026-07-06", rate: 0.917 },
    { date: "2026-07-13", rate: 0.931 },
    { date: "2026-07-20", rate: 0.938 },
    { date: "2026-07-27", rate: 0.942 },
  ],
};
