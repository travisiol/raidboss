import { Arena } from "@/components/Arena";
import { Pitch } from "@/components/Pitch";
import { BoardRow } from "@/components/BoardRow";
import { HowItWorks } from "@/components/HowItWorks";
import { BossLadder } from "@/components/BossLadder";
import { PayoutLedger } from "@/components/PayoutLedger";
import { Faq } from "@/components/Faq";
import { Footer } from "@/components/Footer";

/*
 * The page in causal order: the fight, what the fight is, who is winning it,
 * the rules, the ladder it sits on, then the objections. Anyone who scrolls
 * past the arena has already decided the mechanic is interesting, so
 * everything below it is answering "yes but how", never re-pitching.
 */
export default function Page() {
  return (
    <>
      <Arena />
      <Pitch />
      <BoardRow />
      <HowItWorks />
      <BossLadder />
      <PayoutLedger />
      <Faq />
      <Footer />
    </>
  );
}
