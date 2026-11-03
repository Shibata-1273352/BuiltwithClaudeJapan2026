import { connection } from "next/server";
import { Suspense } from "react";
import { howFacts } from "@/lib/how-facts";
import { landingFacts } from "@/lib/landing-facts";
import { LoadingText } from "../loading-text";
import { HowView } from "./how-view";

export const metadata = { title: "TSUMUGI — しくみ" };

async function How() {
  await connection(); // measured from the stored calls at request time
  const h = howFacts();
  return <HowView stages={h.stages} runs={h.runs} since={h.since} facts={landingFacts()} />;
}

export default function HowPage() {
  return (
    <Suspense fallback={<LoadingText />}>
      <How />
    </Suspense>
  );
}
