import { SectionHead } from "@/components/ui/Label";
import { raidRules, siteConfig } from "@/lib/site-config";

/**
 * Built on <details> so every answer is in the DOM, open to search engines and
 * to anyone who hits Ctrl-F, and works with the JavaScript switched off. The
 * two questions people actually arrive with — "can I lose money" and "what
 * stops a whale ending it" — are answered first and without hedging, because
 * a page this loud has to be boring in exactly those two places.
 */
const ITEMS = [
  {
    q: "Can I lose money?",
    a: `Yes. Striking means buying ${siteConfig.ticker}, and the token can be worth less afterwards than what you paid. The pot pays back a share of the fees collected on a boss, not your position — a wallet can take a payout on a kill and still be down overall. Nothing here is a return, a yield or a promise, and none of it is advice.`,
  },
  {
    q: "What stops one wallet ending a boss on its own?",
    a: `No single buy may deal more than ${raidRules.maxHitBps / 100}% of a boss's health, so a boss needs at least ${Math.ceil(10_000 / raidRules.maxHitBps)} separate hits to fall. A wallet can of course hit repeatedly, and buying that much means paying that much fee into the pot it is trying to win — which is the point. The cap only stops the fight being over before anyone sees it.`,
  },
  {
    q: "Do I get more for landing the killing blow?",
    a: "No. The pot is split strictly in proportion to damage dealt to that boss. The last hit is worth exactly what it is worth as damage, so there is no advantage to sitting out and sniping the end of a fight, and no reason to stop hitting early.",
  },
  {
    q: "What happens to my damage when the boss dies?",
    a: `Your share is settled against that boss and set aside for you to claim, and the counter resets to zero for the next one. Damage does not carry over — each boss is its own fight with its own pot. ${(10_000 - raidRules.carryBps) / 100}% of a pot is paid out and ${raidRules.carryBps / 100}% seeds the next one, so a fresh boss always has something on it.`,
  },
  {
    q: "What if nobody finishes a boss?",
    a: "It stands. There is no timer and no expiry: the health bar stays where the last hit left it and the pot stays where it is until someone takes the boss the rest of the way down. Nothing is lost by waiting, and nothing is gained by it either.",
  },
  {
    q: "Where does the fee actually go?",
    a: `${raidRules.feeBps / 100}% of every buy is set aside as the boss's pot, in USDG, and paid out when it dies. How that is enforced depends on what is deployed: with a raid contract the buy and the hit are one call, so there is no path that takes the price without paying the fee. Without one, the fee is collected from the token's own take and distributed against the published split — which is why that split is on this page as a table anyone can check, rather than a number you have to take on faith.`,
  },
  {
    q: "Why is each boss bigger?",
    a: `Health rises ${raidRules.growth}× per boss and the pot is a fixed share of health, so the pot rises with it. A ladder that reset would pay the same every round no matter how much volume the thing had done; this one makes the reward for a clear scale with the size of the crowd that turned up to make the clear possible.`,
  },
  {
    q: "Is the boss on screen real?",
    a: "The health bar, the pot, the damage board and the log are one state, derived from one set of rules, so they cannot disagree with each other. Where that state comes from is stated on the page at all times: LIVE means it is read off the chain — either from a raid contract, or by watching buys arrive at the pool and replaying them — and SIMULATION means nothing is deployed yet and the rules are running locally. The tag is in the nav, in the arena and on the strike button, and it changes on its own when the addresses are configured.",
  },
];

export function Faq() {
  return (
    <section id="faq" className="border-t border-rule bg-pit">
      <div className="mx-auto w-full max-w-[1400px] px-4 py-16 sm:px-6 sm:py-24">
        <SectionHead
          index="FAQ"
          title="The awkward questions first"
          lede="If any of these read like they are dodging, that is a bug — say so."
        />

        <div className="mt-12 grid gap-px border border-rule bg-rule lg:grid-cols-2">
          {ITEMS.map((item) => (
            <details key={item.q} className="group bg-pit-raised">
              <summary className="type-title flex cursor-pointer items-center justify-between gap-4 px-5 py-4 text-bone transition-colors hover:text-venom">
                {item.q}
                <span
                  aria-hidden
                  className="type-figure shrink-0 text-bone-muted transition-transform duration-200 group-open:rotate-45"
                >
                  +
                </span>
              </summary>
              <p className="type-body px-5 pb-5 text-bone-soft">{item.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
