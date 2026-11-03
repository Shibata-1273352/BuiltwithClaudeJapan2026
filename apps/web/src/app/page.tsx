import { landingFacts } from "@/lib/landing-facts";
import { Landing } from "./landing";

export default function Home() {
  return <Landing facts={landingFacts()} />;
}
