import { useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { Menu, X } from "lucide-react";

import { classNames } from "../../lib/format";

/**
 * Shared chrome for the marketing pages (/, /how-it-works, /trust).
 * Wide, calm, iOS-inspired: big type, white surfaces, 12-16px radii
 * (marketing only — the console keeps its dense 6px language).
 */

const NAV = [
  { to: "/how-it-works", label: "How it works" },
  { to: "/trust", label: "Trust & compliance" },
];

export function MarketingLayout() {
  const [open, setOpen] = useState(false);
  const location = useLocation();

  return (
    <div className="min-h-screen bg-surface text-ink">
      <header className="sticky top-0 z-20 border-b border-gray-100 bg-surface">
        <div className="mx-auto flex h-16 w-full max-w-[1360px] items-center justify-between px-5 lg:px-10">
          <Link
            to="/"
            className="text-md font-semibold tracking-tight"
            onClick={() => setOpen(false)}
          >
            ClaimMate
          </Link>

          {/* Desktop nav */}
          <nav className="hidden items-center gap-8 md:flex">
            {NAV.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                className={({ isActive }) =>
                  classNames(
                    "text-sm font-medium transition-colors",
                    isActive ? "text-ink" : "text-gray-500 hover:text-ink",
                  )
                }
              >
                {n.label}
              </NavLink>
            ))}
            <Link
              to="/practice"
              className="text-sm font-medium text-gray-500 transition-colors hover:text-ink"
            >
              Practice sign in
            </Link>
            <Link
              to="/practice/signup"
              className="inline-flex h-10 items-center rounded-lg bg-primary px-5 text-sm font-medium text-on-accent transition-colors hover:bg-primary-hover"
            >
              Get started
            </Link>
          </nav>

          {/* Mobile menu button */}
          <button
            type="button"
            className="flex h-10 w-10 items-center justify-center rounded-lg text-gray-600 hover:bg-gray-50 md:hidden"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            onClick={() => setOpen((o) => !o)}
          >
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        {/* Mobile nav panel */}
        {open && (
          <nav className="border-t border-gray-100 bg-surface px-5 py-4 md:hidden">
            <div className="flex flex-col gap-1">
              {NAV.map((n) => (
                <Link
                  key={n.to}
                  to={n.to}
                  onClick={() => setOpen(false)}
                  className="rounded-lg px-3 py-3 text-base font-medium text-gray-700 hover:bg-gray-50"
                >
                  {n.label}
                </Link>
              ))}
              <Link
                to="/practice"
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-3 text-base font-medium text-gray-700 hover:bg-gray-50"
              >
                Practice sign in
              </Link>
              <Link
                to="/practice/signup"
                onClick={() => setOpen(false)}
                className="mt-2 inline-flex h-12 items-center justify-center rounded-lg bg-primary px-5 text-base font-medium text-on-accent"
              >
                Get started
              </Link>
            </div>
          </nav>
        )}
      </header>

      <main key={location.pathname}>
        <Outlet />
      </main>

      <footer className="border-t border-gray-100">
        <div className="mx-auto w-full max-w-[1360px] px-5 py-10 lg:px-10">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="text-sm font-semibold tracking-tight">ClaimMate</div>
              <p className="mt-1 max-w-xs text-xs leading-5 text-gray-500">
                Automated claims and denial recovery for small and medium US
                private practices.
              </p>
            </div>
            <nav className="flex flex-col gap-2 text-sm">
              <Link to="/how-it-works" className="text-gray-500 hover:text-ink">
                How it works
              </Link>
              <Link to="/trust" className="text-gray-500 hover:text-ink">
                Trust & compliance
              </Link>
              <Link to="/practice/signup" className="text-gray-500 hover:text-ink">
                Get started
              </Link>
              <Link to="/practice" className="text-gray-500 hover:text-ink">
                Practice sign in
              </Link>
            </nav>
          </div>
          <div className="mt-8 flex flex-col gap-2 border-t border-gray-100 pt-5 text-xs text-gray-400 sm:flex-row sm:items-center sm:justify-between">
            <span>
              ClaimMate, Inc. — a fictional company for this demo. All
              patients, claims, providers, and dollar amounts are synthetic.
            </span>
            <span>
              For ClaimMate staff & demo:{" "}
              <Link to="/ops" className="text-gray-500 hover:text-ink">
                Operations
              </Link>
              {" · "}
              <Link to="/payer" className="text-gray-500 hover:text-ink">
                Payer Simulator
              </Link>
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
