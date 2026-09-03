import { SectionHead } from "@/components/ui/Label";
import { healthForBoss, raidRules, siteConfig } from "@/lib/site-config";
import { short } from "@/lib/format";

/**
 * The rules, in four steps and then in numbers.
 *
 * Each step gets a schematic rather than an icon. An icon decorates a
 * sentence; a schematic is the sentence drawn, and for a mechanic this
 * literal — a bar goes down, a pot goes up, the pot gets cut — the drawing is
 * faster to read than the line above it. They are deliberately crude: flat
 * shapes in the same three colours the live page uses, so a reader arriving
 * here from the arena recognises what each colour means before reading a word.
 */

const STEPS = [
  {
    index: "01",
    title: "A boss stands",
    body: "One boss at a time, with its health printed in public. Health is denominated in dollars of buying: a boss on 250,000 dies after 250,000 USDG has been spent on it.",
    art: <Standing />,
  },
  {
    index: "02",
    title: "Every buy is a hit",
    body: `Buying ${siteConfig.ticker} takes health off the boss, one point per USDG. ${raidRules.feeBps / 100}% of that buy goes to the pot, so the thing you are fighting for grows on the same swing that damages it.`,
    art: <Hit />,
  },
  {
    index: "03",
    title: "At zero, the pot is cut",
    body: `The pot is split between every wallet that hit that boss, in proportion to damage dealt. Deal a tenth of the health, take a tenth of the pot. ${(10_000 - raidRules.carryBps) / 100}% is paid out; the rest seeds the next fight.`,
    art: <Split />,
  },
  {
    index: "04",
    title: "A bigger one takes its place",
    body: `The next boss has ${raidRules.growth}× the health, another pair of horns, and a pot that scales with it. Nothing resets — the ladder only goes up.`,
    art: <Escalate />,
  },
];

export function HowItWorks() {
  return (
    <section id="rules" className="border-t border-rule bg-pit">
      <div className="mx-auto w-full max-w-[1400px] px-4 py-16 sm:px-6 sm:py-24">
        <SectionHead
          index="Rules"
          title="Four rules, and none of them are hidden"
          lede="The whole game is a health bar, a fee and a division. Everything on the live page is one of those three things being shown to you as it happens."
        />

        <ol className="mt-12 grid gap-px bg-rule sm:grid-cols-2 xl:grid-cols-4">
          {STEPS.map((step) => (
            <li key={step.index} className="bg-pit-raised p-6">
              <div className="flex h-24 items-center justify-center">
                {step.art}
              </div>
              <p className="type-label mt-6 text-venom">{step.index}</p>
              <h3 className="type-title mt-2 text-bone">{step.title}</h3>
              <p className="type-body mt-3 text-bone-soft">{step.body}</p>
            </li>
          ))}
        </ol>

        {/* The same rules as parameters, so nothing above is a vibe. */}
        <div className="mt-12 grid gap-px border border-rule bg-rule sm:grid-cols-2 lg:grid-cols-5">
          <Param label="Fee into the pot" value={`${raidRules.feeBps / 100}%`} hint="of every buy" />
          <Param label="First boss" value={short(raidRules.baseHealth)} hint="health" />
          <Param label="Each boss after" value={`${raidRules.growth}×`} hint="the one before" />
          <Param
            label="Biggest single hit"
            value={`${raidRules.maxHitBps / 100}%`}
            hint="of a boss's health"
          />
          <Param
            label="Carried forward"
            value={`${raidRules.carryBps / 100}%`}
            hint="seeds the next pot"
          />
        </div>

        <p className="type-data mt-6 max-w-3xl text-bone-muted">
          The hit cap is a game rule, not a safety rail. Without it a single
          wallet can end a boss on its own, and there is no raid to watch, no
          board to climb and no reason for anyone else to swing. At{" "}
          {raidRules.maxHitBps / 100}% a boss needs at least{" "}
          {Math.ceil(10_000 / raidRules.maxHitBps)} hits to fall — boss{" "}
          {roman(1)} is {short(healthForBoss(1))} health, so the smallest
          possible raid on it is {Math.ceil(10_000 / raidRules.maxHitBps)}{" "}
          wallets at {short((healthForBoss(1) * raidRules.maxHitBps) / 10_000)}{" "}
          each.
        </p>
      </div>
    </section>
  );
}

function roman(value: number): string {
  return ["", "I", "II", "III", "IV", "V"][value] ?? String(value);
}

function Param({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="bg-pit-raised p-5">
      <p className="type-label text-bone-muted">{label}</p>
      <p className="type-count mt-2 text-bone">{value}</p>
      <p className="type-data mt-1 text-bone-muted">{hint}</p>
    </div>
  );
}

/* ---- Schematics --------------------------------------------------------- */

function Standing() {
  return (
    <svg viewBox="0 0 160 80" className="h-full w-auto" aria-hidden>
      <rect x="8" y="14" width="144" height="12" fill="#0b0f15" />
      <rect x="8" y="14" width="144" height="12" fill="var(--blood)" />
      <path
        d="M80 74c-16 0-26-9-26-20 0-9 6-15 12-19-2-6 1-12 6-14-1 6 2 9 8 9s9-3 8-9c5 2 8 8 6 14 6 4 12 10 12 19 0 11-10 20-26 20Z"
        fill="var(--slab-lit)"
        stroke="var(--rule-strong)"
      />
      <circle cx="70" cy="48" r="3" fill="var(--blood)" />
      <circle cx="90" cy="48" r="3" fill="var(--blood)" />
    </svg>
  );
}

function Hit() {
  return (
    <svg viewBox="0 0 160 80" className="h-full w-auto" aria-hidden>
      <circle cx="26" cy="40" r="13" fill="none" stroke="var(--gold)" strokeWidth="2" />
      <text
        x="26"
        y="45"
        textAnchor="middle"
        fill="var(--gold)"
        fontSize="12"
        fontFamily="var(--font-mono)"
      >
        $
      </text>
      <path d="M44 32h44" stroke="var(--venom)" strokeWidth="2" />
      <path d="M82 27l7 5-7 5" fill="none" stroke="var(--venom)" strokeWidth="2" />
      <path d="M44 52h44" stroke="var(--gold)" strokeWidth="2" strokeDasharray="3 3" />
      <path d="M82 47l7 5-7 5" fill="none" stroke="var(--gold)" strokeWidth="2" />
      <rect x="98" y="22" width="54" height="18" fill="var(--venom)" opacity="0.85" />
      <text x="125" y="35" textAnchor="middle" fill="var(--abyss)" fontSize="10" fontFamily="var(--font-mono)">
        DMG
      </text>
      <rect x="98" y="44" width="54" height="18" fill="none" stroke="var(--gold)" />
      <text x="125" y="57" textAnchor="middle" fill="var(--gold)" fontSize="10" fontFamily="var(--font-mono)">
        POT
      </text>
    </svg>
  );
}

function Split() {
  const slices = [38, 26, 18, 11, 7];
  let x = 8;
  return (
    <svg viewBox="0 0 160 80" className="h-full w-auto" aria-hidden>
      <rect x="8" y="12" width="144" height="16" fill="none" stroke="var(--gold)" />
      <text x="80" y="24" textAnchor="middle" fill="var(--gold)" fontSize="10" fontFamily="var(--font-mono)">
        POT
      </text>
      <path d="M80 32v10" stroke="var(--rule-strong)" />
      {slices.map((width, index) => {
        const w = (width / 100) * 144;
        const rect = (
          <g key={index}>
            <rect
              x={x}
              y={46}
              width={w - 2}
              height={22}
              fill={index === 0 ? "var(--venom)" : "var(--venom-deep)"}
              opacity={index === 0 ? 1 : 0.85 - index * 0.13}
            />
          </g>
        );
        x += w;
        return rect;
      })}
    </svg>
  );
}

function Escalate() {
  const bars = [18, 30, 46, 66];
  return (
    <svg viewBox="0 0 160 80" className="h-full w-auto" aria-hidden>
      {bars.map((height, index) => (
        <g key={index}>
          <rect
            x={14 + index * 36}
            y={72 - height}
            width="24"
            height={height}
            fill={index === bars.length - 1 ? "var(--blood)" : "var(--slab-lit)"}
            stroke="var(--rule-strong)"
          />
          <text
            x={26 + index * 36}
            y={78}
            textAnchor="middle"
            fill="var(--bone-muted)"
            fontSize="8"
            fontFamily="var(--font-mono)"
          >
            {["I", "II", "III", "IV"][index]}
          </text>
        </g>
      ))}
    </svg>
  );
}
