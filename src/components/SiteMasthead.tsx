import { Moon, Sun } from "lucide-react";
import { BrandMark } from "./BrandMark";

const SITE = "https://welbournesecurity.com";

/**
 * The shared Welbourne Security site header, mirrored from the main site so the Alchemist
 * subdomain opens inside the same familiar frame: radar brand-mark, primary nav (absolute
 * links back to the main site, with Alchemist marked current), and the theme toggle.
 */
const NAV_LINKS: Array<{ label: string; href: string; current?: boolean }> = [
  { label: "Home", href: `${SITE}/` },
  { label: "Writeups", href: `${SITE}/writeups/` },
  { label: "Alchemist", href: "https://alchemist.welbournesecurity.com/", current: true },
  { label: "Observer", href: `${SITE}/observer/` },
  { label: "Blue Team", href: `${SITE}/blue-team/` },
  { label: "Contact", href: `${SITE}/contact/` }
];

interface SiteMastheadProps {
  theme: "dark" | "light";
  onToggleTheme: () => void;
}

export function SiteMasthead({ theme, onToggleTheme }: SiteMastheadProps) {
  return (
    <header className="site-header">
      <a className="brand" href={`${SITE}/`} aria-label="Back to Welbourne Security home">
        <BrandMark />
        <span className="brand-copy">
          <strong>Welbourne Security</strong>
          <small>Alchemist</small>
        </span>
      </a>
      <div className="header-actions">
        <nav className="site-nav" aria-label="Primary navigation">
          {NAV_LINKS.map((link) => (
            // Keep the current item an anchor (matching the main site) so it
            // still renders as a cell in the mobile bottom nav bar.
            <a
              key={link.label}
              href={link.href}
              className={link.current ? "is-current" : undefined}
              aria-current={link.current ? "page" : undefined}
            >
              {link.label}
            </a>
          ))}
        </nav>
        <button
          type="button"
          className="theme-toggle"
          onClick={onToggleTheme}
          aria-label="Toggle light and dark mode"
          title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
        >
          {theme === "dark" ? <Sun size={17} aria-hidden="true" /> : <Moon size={17} aria-hidden="true" />}
        </button>
      </div>
    </header>
  );
}
