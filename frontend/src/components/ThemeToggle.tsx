import { Moon, Sun } from "lucide-react";

import { classNames } from "../lib/format";
import { useTheme } from "../lib/theme";

/** Small sun/moon theme switch. Subtle; used in TopBar and public pages. */
export function ThemeToggle({ className }: { className?: string }) {
  const { theme, toggle } = useTheme();
  const label =
    theme === "dark" ? "Switch to light theme" : "Switch to dark theme";
  return (
    <button
      type="button"
      onClick={toggle}
      title={label}
      aria-label={label}
      className={classNames(
        "flex h-6 w-6 items-center justify-center rounded-sm text-gray-500 transition-colors hover:bg-gray-100 hover:text-ink",
        className,
      )}
    >
      {theme === "dark" ? <Sun size={13} /> : <Moon size={13} />}
    </button>
  );
}
