/**
 * Wide claim-lifecycle diagram drawn with the product palette.
 * Pure inline SVG — no images, no gradients. Scales to container width.
 */
export function ClaimFlowDiagram() {
  const gray200 = "#E4E4E7";
  const gray500 = "#71717A";
  const ink = "#0A0A0A";
  const blue = "#2563EB";
  const blueSubtle = "#EFF6FF";
  const red = "#DC2626";
  const green = "#16A34A";

  return (
    <svg
      viewBox="0 0 1200 360"
      role="img"
      aria-label="Claim flow: your EHR feeds ClaimMate, which codes, scrubs and submits claims to the payer. Paid claims post automatically; denied claims are appealed automatically and recovered."
      className="h-auto w-full"
    >
      <defs>
        <marker
          id="arrow-gray"
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="7"
          markerHeight="7"
          orient="auto-start-reverse"
        >
          <path d="M 0 1 L 9 5 L 0 9 z" fill={gray500} />
        </marker>
        <marker
          id="arrow-red"
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="7"
          markerHeight="7"
          orient="auto-start-reverse"
        >
          <path d="M 0 1 L 9 5 L 0 9 z" fill={red} />
        </marker>
        <marker
          id="arrow-green"
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="7"
          markerHeight="7"
          orient="auto-start-reverse"
        >
          <path d="M 0 1 L 9 5 L 0 9 z" fill={green} />
        </marker>
      </defs>

      {/* Your EHR */}
      <rect x="30" y="100" width="220" height="120" rx="16" fill="#FAFAFA" stroke={gray200} strokeWidth="1.5" />
      <text x="140" y="150" textAnchor="middle" fontSize="20" fontWeight="600" fill={ink}>
        Your EHR
      </text>
      <text x="140" y="178" textAnchor="middle" fontSize="13" fill={gray500}>
        Epic · athenahealth · eCW
      </text>
      <text x="140" y="198" textAnchor="middle" fontSize="13" fill={gray500}>
        Tebra · DrChrono · more
      </text>

      {/* EHR -> engine */}
      <line x1="250" y1="160" x2="380" y2="160" stroke={gray500} strokeWidth="1.5" markerEnd="url(#arrow-gray)" />
      <text x="315" y="148" textAnchor="middle" fontSize="12" fill={gray500}>
        charts
      </text>

      {/* ClaimMate engine */}
      <rect x="390" y="70" width="300" height="180" rx="16" fill={blueSubtle} stroke={blue} strokeWidth="1.5" />
      <text x="540" y="115" textAnchor="middle" fontSize="22" fontWeight="600" fill={ink}>
        ClaimMate
      </text>
      <text x="540" y="145" textAnchor="middle" fontSize="14" fill={gray500}>
        codes · scrubs · checks eligibility
      </text>
      <text x="540" y="167" textAnchor="middle" fontSize="14" fill={gray500}>
        submits clean claims
      </text>
      {/* HITL note */}
      <circle cx="465" cy="205" r="4" fill={blue} />
      <text x="480" y="210" fontSize="13" fill={gray500}>
        certified coder reviews anything uncertain
      </text>

      {/* engine -> payer */}
      <line x1="690" y1="160" x2="820" y2="160" stroke={gray500} strokeWidth="1.5" markerEnd="url(#arrow-gray)" />
      <text x="755" y="148" textAnchor="middle" fontSize="12" fill={gray500}>
        837P
      </text>

      {/* Payer */}
      <rect x="830" y="100" width="180" height="120" rx="16" fill="#FAFAFA" stroke={gray200} strokeWidth="1.5" />
      <text x="920" y="150" textAnchor="middle" fontSize="20" fontWeight="600" fill={ink}>
        Payer
      </text>
      <text x="920" y="178" textAnchor="middle" fontSize="13" fill={gray500}>
        adjudicates
      </text>

      {/* Payer -> Paid */}
      <line x1="1010" y1="135" x2="1090" y2="110" stroke={green} strokeWidth="1.5" markerEnd="url(#arrow-green)" />
      <rect x="1095" y="86" width="90" height="44" rx="12" fill="#FFFFFF" stroke={green} strokeWidth="1.5" />
      <circle cx="1117" cy="108" r="4" fill={green} />
      <text x="1130" y="113" fontSize="15" fontWeight="600" fill={ink}>
        Paid
      </text>

      {/* Payer -> Denied */}
      <line x1="1010" y1="185" x2="1090" y2="210" stroke={red} strokeWidth="1.5" markerEnd="url(#arrow-red)" />
      <rect x="1095" y="188" width="100" height="44" rx="12" fill="#FFFFFF" stroke={red} strokeWidth="1.5" />
      <circle cx="1117" cy="210" r="4" fill={red} />
      <text x="1130" y="215" fontSize="15" fontWeight="600" fill={ink}>
        Denied
      </text>

      {/* Denied loop back to engine (auto-appeal) */}
      <path
        d="M 1145 232 C 1145 310, 700 320, 545 260"
        fill="none"
        stroke={red}
        strokeWidth="1.5"
        strokeDasharray="6 5"
        markerEnd="url(#arrow-red)"
      />
      <text x="880" y="318" textAnchor="middle" fontSize="13" fill={gray500}>
        every appealable denial is appealed automatically, with cited authority
      </text>

      {/* Engine -> Recovered */}
      <path
        d="M 690 230 C 900 285, 1040 275, 1105 252"
        fill="none"
        stroke={green}
        strokeWidth="1.5"
        markerEnd="url(#arrow-green)"
      />
      <rect x="1082" y="252" width="112" height="40" rx="12" fill="#FFFFFF" stroke={green} strokeWidth="1.5" />
      <circle cx="1102" cy="272" r="4" fill={green} />
      <text x="1114" y="277" fontSize="14" fontWeight="600" fill={ink}>
        Recovered
      </text>
    </svg>
  );
}
