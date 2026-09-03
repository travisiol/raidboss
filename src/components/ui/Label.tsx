import { clsx } from "clsx";
import type { ReactNode } from "react";

/** A key on the readout: mono, tracked out, uppercase. */
export function Label({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span className={clsx("type-label text-bone-muted", className)}>
      {children}
    </span>
  );
}

/**
 * Says out loud that the raid on screen is not on a chain.
 *
 * The page is a live instrument and it is convincing, which is exactly why
 * this tag has to be persistent and legible rather than a footnote: a moving
 * health bar and a rising pot assert activity, and until a contract address is
 * configured that activity is generated locally. The tag comes off on its own
 * the moment the address is set.
 */
export function SimTag({ className }: { className?: string }) {
  return (
    <span
      className={clsx(
        "type-label inline-flex items-center gap-1.5 border border-gold/40 bg-gold/10 px-2 py-1 text-gold",
        className,
      )}
    >
      <span className="h-1.5 w-1.5 bg-gold breathe" />
      Simulation
    </span>
  );
}

/** The counterpart, once real reads are coming off the chain. */
export function LiveTag({ className }: { className?: string }) {
  return (
    <span
      className={clsx(
        "type-label inline-flex items-center gap-1.5 border border-jade/40 bg-jade/10 px-2 py-1 text-jade",
        className,
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-jade breathe" />
      Live
    </span>
  );
}

/** A titled block of the page. Numbered, because the rules are a sequence. */
export function SectionHead({
  index,
  title,
  lede,
  className,
}: {
  index: string;
  title: string;
  lede?: string;
  className?: string;
}) {
  return (
    <div className={clsx("max-w-2xl", className)}>
      <div className="flex items-center gap-3">
        <span className="type-label text-venom">{index}</span>
        <span className="h-px flex-1 bg-rule" />
      </div>
      <h2 className="type-display mt-4 text-bone">{title}</h2>
      {lede && <p className="type-body mt-3 text-bone-soft">{lede}</p>}
    </div>
  );
}
