/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    fontFamily: {
      sans: [
        "Inter",
        "system-ui",
        "-apple-system",
        "Segoe UI",
        "Roboto",
        "sans-serif",
      ],
      mono: [
        "JetBrains Mono",
        "ui-monospace",
        "SFMono-Regular",
        "Menlo",
        "Consolas",
        "monospace",
      ],
    },
    fontSize: {
      xs: ["12px", { lineHeight: "16px" }],
      sm: ["13px", { lineHeight: "20px" }],
      base: ["14px", { lineHeight: "20px" }],
      md: ["16px", { lineHeight: "24px" }],
      lg: ["20px", { lineHeight: "28px" }],
      xl: ["24px", { lineHeight: "32px" }],
    },
    borderRadius: {
      none: "0px",
      sm: "4px",
      DEFAULT: "6px",
      md: "6px",
      full: "9999px", // reserved for dots only, never buttons
    },
    extend: {
      colors: {
        // 9-step neutral scale
        gray: {
          50: "#FAFAFA",
          100: "#F4F4F5",
          200: "#E4E4E7",
          300: "#D4D4D8",
          400: "#A1A1AA",
          500: "#71717A",
          600: "#52525B",
          700: "#3F3F46",
          900: "#18181B",
        },
        ink: "#0A0A0A",
        primary: {
          DEFAULT: "#2563EB",
          hover: "#1D4ED8",
          subtle: "#EFF6FF",
        },
        severity: {
          error: "#DC2626",
          warning: "#D97706",
          info: "#6B7280",
          pass: "#16A34A",
        },
      },
      spacing: {
        // 4/8/12/16/24/32/48 map to tailwind 1/2/3/4/6/8/12 (default 4px scale)
      },
      boxShadow: {
        sm: "0 1px 2px 0 rgb(0 0 0 / 0.05)",
        panel: "0 1px 3px 0 rgb(0 0 0 / 0.08)",
      },
    },
  },
  plugins: [],
};
