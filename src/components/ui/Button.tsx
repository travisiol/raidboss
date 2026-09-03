import { clsx } from "clsx";
import type { ButtonHTMLAttributes, ReactNode } from "react";

/*
 * One filled button on the page, in venom, and it is STRIKE. Everything else
 * is an outline. If a second control ever looks as loud as the one that
 * damages the boss, the page has stopped saying what it is for.
 */
const base =
  "type-label inline-flex items-center justify-center gap-2 px-4 py-3 transition-all duration-150 disabled:cursor-not-allowed select-none";

export function Button({
  children,
  variant = "solid",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  variant?: "solid" | "outline" | "ghost";
}) {
  return (
    <button
      type="button"
      className={clsx(
        base,
        variant === "solid" &&
          "bg-venom text-abyss shadow-[0_0_24px_-4px_rgba(174,242,63,0.6)] hover:bg-venom-bright hover:shadow-[0_0_34px_-2px_rgba(174,242,63,0.8)] active:translate-y-px disabled:bg-transparent disabled:text-bone-muted disabled:shadow-none disabled:ring-1 disabled:ring-rule-strong disabled:ring-inset",
        variant === "outline" &&
          "text-bone ring-1 ring-rule-strong ring-inset hover:bg-bone hover:text-abyss disabled:text-bone-muted disabled:hover:bg-transparent disabled:hover:text-bone-muted",
        variant === "ghost" &&
          "text-bone-soft hover:text-bone disabled:text-bone-muted",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function ButtonLink({
  children,
  href,
  className,
}: {
  children: ReactNode;
  href: string;
  className?: string;
}) {
  return (
    <a
      href={href}
      className={clsx(
        base,
        "bg-venom text-abyss hover:bg-venom-bright",
        className,
      )}
    >
      {children}
    </a>
  );
}
