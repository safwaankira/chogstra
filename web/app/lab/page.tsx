import type { Metadata } from "next";
import { Lab } from "./lab";

export const metadata: Metadata = {
  title: "Sound lab · Chogstra",
  description: "Hear how each Chog's traits turn into its instrument.",
};

export default function LabPage() {
  return <Lab />;
}
