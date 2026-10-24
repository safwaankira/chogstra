import type { Metadata } from "next";
import { Fairness } from "./fairness";

export const metadata: Metadata = {
  title: "Fair draw · Chogstra",
  description: "Check any Movement's random seed, its key, tempo and mood, and its Spotlight Chogs against the contract.",
};

export default function FairnessPage() {
  return <Fairness />;
}
