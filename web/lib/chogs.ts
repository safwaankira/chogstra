// Chog metadata from data/chogs.json (dumped once by scripts/dump-chogs.ts).

export type Chog = {
  tokenId: number;
  name: string;
  image: string;
  traits: Record<string, string>;
};

export const CHOG_COUNT = 1969;

// Metadata is never fetched from IPFS at runtime, but the portraits still live
// there. Filebase is the gateway that held up during the metadata dump.
const IMAGE_GATEWAY = "https://ipfs.filebase.io/ipfs/";

export function chogImageUrl(chog: Chog): string {
  return chog.image.startsWith("ipfs://") ? IMAGE_GATEWAY + chog.image.slice("ipfs://".length) : chog.image;
}

/** Loads all 1,969 Chogs as a lazy client chunk, indexed by tokenId. */
export async function loadChogs(): Promise<Map<number, Chog>> {
  const { default: list } = (await import("@/data/chogs.json")) as { default: Chog[] };
  return new Map(list.map((c) => [c.tokenId, c]));
}
