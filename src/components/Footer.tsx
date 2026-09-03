import { chainConfig, isLive, siteConfig } from "@/lib/site-config";
import { robinhoodChain } from "@/lib/chain";
import { shortAddress } from "@/lib/format";

/**
 * The footer states what is and is not deployed. A page that animates this
 * hard owes the reader one place that is completely flat about its own status,
 * and social links that are not configured are omitted rather than rendered
 * dead — a link to nothing is worse than no link.
 */
export function Footer() {
  const socials = [
    siteConfig.x && { href: siteConfig.x, label: "X" },
    siteConfig.discord && { href: siteConfig.discord, label: "Discord" },
  ].filter(Boolean) as { href: string; label: string }[];

  return (
    <footer className="border-t border-rule bg-abyss">
      <div className="mx-auto w-full max-w-[1400px] px-4 py-12 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-8">
          <div>
            <p className="type-title text-bone">
              {siteConfig.name}{" "}
              <span className="text-venom">{siteConfig.ticker}</span>
            </p>
            <p className="type-data mt-2 max-w-sm text-bone-muted">
              {siteConfig.seoDescription}
            </p>
          </div>

          <dl className="grid gap-3">
            <Line term="Network" value={robinhoodChain.name} />
            <Line
              term="Raid contract"
              value={
                chainConfig.contractAddress
                  ? shortAddress(chainConfig.contractAddress)
                  : "Not deployed"
              }
            />
            <Line
              term="Status"
              value={isLive ? "Reading from chain" : "Simulated — no contract"}
              tone={isLive ? "text-jade" : "text-gold"}
            />
          </dl>

          {socials.length > 0 && (
            <nav className="flex gap-4">
              {socials.map((social) => (
                <a
                  key={social.label}
                  href={social.href}
                  className="type-label text-bone-muted transition-colors hover:text-bone"
                  rel="noreferrer"
                  target="_blank"
                >
                  {social.label}
                </a>
              ))}
            </nav>
          )}
        </div>

        <p className="type-data mt-10 border-t border-rule pt-6 text-bone-muted">
          {siteConfig.name} is a game played with a token. Buying{" "}
          {siteConfig.ticker} can lose you money, payouts are a share of fees
          already paid and not a return on anything, and nothing on this site is
          financial advice. Check the contract before you send it anything.
        </p>
      </div>
    </footer>
  );
}

function Line({
  term,
  value,
  tone = "text-bone-soft",
}: {
  term: string;
  value: string;
  tone?: string;
}) {
  return (
    <div className="flex items-baseline gap-3">
      <dt className="type-label w-28 text-bone-muted">{term}</dt>
      <dd className={`type-data ${tone}`}>{value}</dd>
    </div>
  );
}
