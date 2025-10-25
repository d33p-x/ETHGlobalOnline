// src/app/layout.tsx
import "./globals.css";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { headers } from "next/headers";
import { type ReactNode } from "react";
import { cookieToInitialState } from "wagmi";

import { getConfig } from "../wagmi";
import { Providers } from "./providers";
import { Header } from "./Header"; // <-- 1. Import the new Header

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "p33rX",
  description: "Decentralized P2P Trading Platform",
  icons: {
    icon: '/favicon.svg',
  },
};

export default async function RootLayout(props: { children: ReactNode }) {
  const initialState = cookieToInitialState(
    getConfig(),
    (await headers()).get("cookie")
  );
  return (
    <html lang="en">
      <body className={inter.className}>
        <Providers initialState={initialState}>
          <Header /> {/* <-- 2. Add the Header here */}
          <main className="main-content">{props.children}</main>
        </Providers>
      </body>
    </html>
  );
}
