"use client";

import { clsx } from "clsx";
import { useRaid } from "@/lib/raidState";
import { siteConfig } from "@/lib/site-config";
import { WalletConnect } from "@/components/WalletConnect";
import { LiveTag, SimTag } from "@/components/ui/Label";
import { pct } from "@/lib/format";

const LINKS = [
  { href: "#rules", label: "Rules" },
  { href: "#ladder", label: "Ladder" },
  { href: "#faq", label: "FAQ" },
];

/**
 * The bar carries the boss's health as a hairline along its bottom edge.
 *
 * Once the page is scrolled past the arena the health bar is gone, and the
 * single most time-sensitive fact on the site goes with it. A one-pixel rule
 * that drains across the top of every section keeps it present without asking
 * for any of the layout back.
 */
export function Navbar() {
  const { state, live } = useRaid();
  const fraction = Math.max(
    0,
    Math.min(1, state.boss.health / state.boss.maxHealth),
  );

  return (
    <header className="sticky top-0 z-30 border-b border-rule bg-abyss/85 backdrop-blur-md">
      <div className="mx-auto flex h-14 w-full max-w-[1400px] items-center gap-4 px-4 sm:px-6">
        <a href="#arena" className="flex items-baseline gap-2">
          <span className="type-title text-bone">{siteConfig.name}</span>
          <span className="type-label text-venom">{siteConfig.ticker}</span>
        </a>

        <nav className="ml-4 hidden items-center gap-5 md:flex">
          {LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="type-label text-bone-muted transition-colors hover:text-bone"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-3">
          <span
            className="type-label hidden text-bone-muted sm:inline"
            title="Current boss health"
          >
            <span className="text-blood">{pct(fraction, 0)}</span> hp
          </span>
          {live ? <LiveTag /> : <SimTag />}
          <WalletConnect />
        </div>
      </div>

      <div
        aria-hidden
        className={clsx(
          "h-px w-full origin-left bg-blood transition-transform duration-200 ease-out",
        )}
        style={{ transform: `scaleX(${fraction})` }}
      />
    </header>
  );
}
