import type { Metadata } from "next";
import { Hall } from "../hall/hall";

export const metadata: Metadata = {
  title: "Guest · Chogstra",
  description: "Play a Guest Chog inside the live onchain song. Browser only, nothing written onchain.",
};

export default function GuestPage() {
  return <Hall guest />;
}
