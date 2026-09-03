/**
 * Formatting for a readout that is mostly numbers.
 *
 * Two rules run through all of it. Damage and pot figures are compacted
 * ("1.34M", not "1,340,000") because they appear at poster size next to a
 * health bar and a seven-digit run of glyphs stops being a quantity and
 * becomes a texture. Anything a person might check against their wallet —
 * their own damage, their own payout — is written out in full, because that
 * is a number they are entitled to count.
 */

const compact = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 2,
});

const plain = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 0,
});

const money = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Big headline quantities: health, pot, total damage. */
export function short(value: number): string {
  if (!Number.isFinite(value)) return "—";
  if (Math.abs(value) < 1000) return plain.format(Math.round(value));
  return compact.format(value).replace(/([KMBT])$/, "$1");
}

/** Full precision, grouped. For figures a person will verify. */
export function full(value: number): string {
  if (!Number.isFinite(value)) return "—";
  return plain.format(Math.round(value));
}

/** USDG with cents, no symbol — the label says USDG. */
export function usdg(value: number): string {
  if (!Number.isFinite(value)) return "—";
  return money.format(value);
}

/** A share, as a percentage with just enough resolution to move. */
export function pct(fraction: number, digits = 1): string {
  if (!Number.isFinite(fraction)) return "—";
  const value = fraction * 100;
  if (value > 0 && value < 0.1) return "<0.1%";
  return `${value.toFixed(digits)}%`;
}

/** 0x1234…abcd */
export function shortAddress(address: string): string {
  if (address.length < 12) return address;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

/** "12s ago", "4m ago". The feed is live; nothing in it is old enough for a date. */
export function ago(timestamp: number, now: number): string {
  const seconds = Math.max(0, Math.round((now - timestamp) / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

/** Elapsed time as mm:ss / h:mm:ss — how long this boss has been standing. */
export function duration(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const seconds = total % 60;
  const minutes = Math.floor(total / 60) % 60;
  const hours = Math.floor(total / 3600);
  const mm = String(minutes).padStart(2, "0");
  const ss = String(seconds).padStart(2, "0");
  return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`;
}
