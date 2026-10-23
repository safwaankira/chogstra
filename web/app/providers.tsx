"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { WagmiProvider } from "wagmi";
import { config } from "@/lib/wagmi";

export function Providers({ children }: { children: ReactNode }) {
  // Public RPCs throttle bursts; retry chain reads patiently with backoff.
  const [queryClient] = useState(
    () => new QueryClient({ defaultOptions: { queries: { retry: 5, retryDelay: (n) => Math.min(1000 * 2 ** n, 15_000) } } }),
  );
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}
