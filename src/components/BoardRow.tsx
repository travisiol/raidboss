import { CombatFeed } from "@/components/CombatFeed";
import { DamageBoard } from "@/components/DamageBoard";
import { SectionHead } from "@/components/ui/Label";

/**
 * The log and the board, side by side, because they are the same event told
 * two ways: what just happened, and what it is worth. Split apart they read as
 * two widgets; together the eye moves from a hit landing on the left to a row
 * climbing on the right, which is the whole loop in one glance.
 */
export function BoardRow() {
  return (
    <section id="board" className="border-t border-rule bg-pit">
      <div className="mx-auto w-full max-w-[1400px] px-4 py-16 sm:px-6 sm:py-24">
        <SectionHead
          index="Live"
          title="Who is owed what, right now"
          lede="Both panels describe the boss currently standing. The moment it dies these settle, pay out, and empty for the next one."
        />

        <div className="mt-10 grid gap-6 lg:grid-cols-2">
          <CombatFeed />
          <DamageBoard />
        </div>
      </div>
    </section>
  );
}
