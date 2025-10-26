'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { type ReactNode, useState } from 'react'
import { type State, WagmiProvider } from 'wagmi'

import { getConfig } from '@/wagmi'
import { TokenRegistryProvider } from './TokenRegistryContext'

export function Providers(props: {
  children: ReactNode
  initialState?: State
}) {
  const [config] = useState(() => getConfig())
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        // Cache data for 30 seconds before marking as stale
        staleTime: 30_000,
        // Keep unused data in cache for 5 minutes
        gcTime: 5 * 60 * 1000,
        // Reduce refetching on window focus
        refetchOnWindowFocus: false,
        // Retry failed requests only once
        retry: 1,
      },
    },
  }))

  return (
    <WagmiProvider config={config} initialState={props.initialState}>
      <QueryClientProvider client={queryClient}>
        <TokenRegistryProvider>{props.children}</TokenRegistryProvider>
      </QueryClientProvider>
    </WagmiProvider>
  )
}
