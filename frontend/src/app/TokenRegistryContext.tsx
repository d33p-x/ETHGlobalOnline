
// frontend/src/app/TokenRegistryContext.tsx
"use client";

import { createContext, useContext, ReactNode } from "react";
import { type Address } from "viem";
import { useTokenRegistry } from "./useTokenRegistry";
import { type TokenInfo } from "./tokenConfig";

interface TokenRegistryContextType {
  tokenInfoMap: Record<Address, TokenInfo>;
  isLoading: boolean;
}

const TokenRegistryContext = createContext<TokenRegistryContextType | undefined>(
  undefined
);

export function TokenRegistryProvider({ children }: { children: ReactNode }) {
  const { tokenInfoMap, isLoading } = useTokenRegistry();

  return (
    <TokenRegistryContext.Provider value={{ tokenInfoMap, isLoading }}>
      {children}
    </TokenRegistryContext.Provider>
  );
}

export function useTokenRegistryContext() {
  const context = useContext(TokenRegistryContext);
  if (context === undefined) {
    throw new Error(
      "useTokenRegistryContext must be used within a TokenRegistryProvider"
    );
  }
  return context;
}
