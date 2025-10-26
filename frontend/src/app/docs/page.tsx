// src/app/docs/page.tsx
"use client";

import Link from "next/link";

export default function DocsPage() {
  return (
    <div style={styles.container}>
      <div style={styles.content}>
        {/* Hero Section */}
        <div style={styles.hero}>
          <h1 style={styles.title}>
            <span style={styles.titleGradient}>p33rX Protocol</span>
          </h1>
          <p style={styles.subtitle}>
            Zero-slippage decentralized trading with real-time oracle pricing
          </p>
        </div>

        {/* What is p33rX */}
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>What is p33rX?</h2>
          <p style={styles.paragraph}>
            <strong style={styles.strong}>p33rX</strong> is a next-generation
            decentralized peer-to-peer trading platform that implements an
            on-chain order book DEX with{" "}
            <span style={styles.highlight}>zero slippage</span>. Unlike
            traditional AMM-based DEXs, p33rX guarantees execution at exact
            oracle prices powered by Pyth Network.
          </p>
          <div style={styles.featureGrid}>
            <div style={styles.featureCard}>
              <div style={styles.featureIcon}>⚡</div>
              <h3 style={styles.featureTitle}>Zero Slippage</h3>
              <p style={styles.featureText}>
                All trades execute at exact oracle prices, no matter the order
                size
              </p>
            </div>
            <div style={styles.featureCard}>
              <div style={styles.featureIcon}>💰</div>
              <h3 style={styles.featureTitle}>Earn as a Maker</h3>
              <p style={styles.featureText}>
                Sellers receive a 0.15% bonus above oracle price
              </p>
            </div>
            <div style={styles.featureCard}>
              <div style={styles.featureIcon}>🔄</div>
              <h3 style={styles.featureTitle}>Real-Time Pricing</h3>
              <p style={styles.featureText}>
                Pyth Network provides sub-second price updates
              </p>
            </div>
            <div style={styles.featureCard}>
              <div style={styles.featureIcon}>📊</div>
              <h3 style={styles.featureTitle}>FIFO Order Book</h3>
              <p style={styles.featureText}>
                Fair, transparent first-in-first-out order matching
              </p>
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>How It Works</h2>

          <div style={styles.stepContainer}>
            <div style={styles.step}>
              <div style={styles.stepNumber}>1</div>
              <div style={styles.stepContent}>
                <h3 style={styles.stepTitle}>Order Book Architecture</h3>
                <p style={styles.paragraph}>
                  p33rX uses a FIFO (First-In-First-Out) order book where orders
                  are stored on-chain in a linked list queue. When you create a
                  sell order, your tokens are locked in the smart contract and
                  added to the end of the queue.
                </p>
              </div>
            </div>

            <div style={styles.step}>
              <div style={styles.stepNumber}>2</div>
              <div style={styles.stepContent}>
                <h3 style={styles.stepTitle}>Oracle Price Integration</h3>
                <p style={styles.paragraph}>
                  Every trade uses real-time prices from{" "}
                  <strong style={styles.strong}>Pyth Network</strong>, a
                  pull-based oracle system. The protocol fetches fresh price
                  data (updated every few seconds) and ensures prices are less
                  than 15 seconds old. This prevents stale price exploits.
                </p>
              </div>
            </div>

            <div style={styles.step}>
              <div style={styles.stepNumber}>3</div>
              <div style={styles.stepContent}>
                <h3 style={styles.stepTitle}>Order Matching</h3>
                <p style={styles.paragraph}>
                  When a buyer wants to fill orders, the contract processes
                  orders from the head of the queue (oldest first). Up to 50
                  orders can be filled in a single transaction. If your order
                  can't be fully filled, unused tokens are returned
                  automatically.
                </p>
              </div>
            </div>

            <div style={styles.step}>
              <div style={styles.stepNumber}>4</div>
              <div style={styles.stepContent}>
                <h3 style={styles.stepTitle}>Zero Slippage Execution</h3>
                <p style={styles.paragraph}>
                  All trades execute at the exact oracle price (adjusted by
                  fees). There's no AMM-style price impact, so buying 1 ETH has
                  the same unit price as buying 100 ETH.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Fee Structure */}
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>Fee Structure</h2>
          <p style={styles.paragraph}>
            p33rX features a unique{" "}
            <span style={styles.highlight}>maker-friendly fee model</span> that
            incentivizes liquidity provision:
          </p>

          <div style={styles.feeGrid}>
            <div style={styles.feeCard}>
              <div style={styles.feeLabel}>Taker Fee</div>
              <div style={styles.feeValue}>0.20%</div>
              <div style={styles.feeDescription}>
                Buyers pay oracle price × 1.002
              </div>
            </div>
            <div style={styles.feeCard}>
              <div style={styles.feeLabel}>Maker Rebate</div>
              <div style={styles.feeValue}>+0.15%</div>
              <div style={styles.feeDescription}>
                Sellers receive oracle price × 1.0015
              </div>
            </div>
            <div style={styles.feeCard}>
              <div style={styles.feeLabel}>Protocol Fee</div>
              <div style={styles.feeValue}>0.05%</div>
              <div style={styles.feeDescription}>
                Protocol captures the spread
              </div>
            </div>
          </div>

          <div style={styles.exampleBox}>
            <h4 style={styles.exampleTitle}>Example Trade</h4>
            <div style={styles.exampleContent}>
              <p style={styles.exampleLine}>
                <span style={styles.exampleLabel}>Scenario:</span> Buy 1 WETH
                with USDC
              </p>
              <p style={styles.exampleLine}>
                <span style={styles.exampleLabel}>Oracle Price:</span> 1 WETH =
                2,000 USDC
              </p>
              <p style={styles.exampleLine}>
                <span style={styles.exampleLabel}>Buyer Pays:</span> 2,000 ×
                1.002 = <span style={styles.highlight}>2,004 USDC</span>
              </p>
              <p style={styles.exampleLine}>
                <span style={styles.exampleLabel}>Seller Receives:</span> 2,000
                × 1.0015 = <span style={styles.highlight}>2,003 USDC</span>
              </p>
              <p style={styles.exampleLine}>
                <span style={styles.exampleLabel}>Protocol Keeps:</span>{" "}
                <span style={styles.highlight}>1 USDC</span> (0.05%)
              </p>
            </div>
          </div>
        </section>

        {/* Trading Guide */}
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>How to Trade</h2>

          <div style={styles.guideContainer}>
            <div style={styles.guideSection}>
              <h3 style={styles.guideTitle}>
                <span style={styles.guideIcon}>📝</span>
                Creating a Sell Order (Maker)
              </h3>
              <ol style={styles.orderedList}>
                <li style={styles.listItem}>
                  Select a trading pair (e.g., WETH/USDC)
                </li>
                <li style={styles.listItem}>
                  Connect your wallet to Base Sepolia
                </li>
                <li style={styles.listItem}>
                  Approve the token you want to sell
                </li>
                <li style={styles.listItem}>
                  Enter the amount to sell (minimum $10 USD worth)
                </li>
                <li style={styles.listItem}>
                  Optionally set min/max price limits
                </li>
                <li style={styles.listItem}>
                  Submit your order (includes small ETH fee for oracle update)
                </li>
                <li style={styles.listItem}>
                  Your tokens are locked and added to the order queue
                </li>
                <li style={styles.listItem}>
                  Earn 0.15% bonus when your order is filled!
                </li>
              </ol>
            </div>

            <div style={styles.guideSection}>
              <h3 style={styles.guideTitle}>
                <span style={styles.guideIcon}>💸</span>
                Buying Tokens (Taker)
              </h3>
              <ol style={styles.orderedList}>
                <li style={styles.listItem}>
                  Navigate to the desired trading pair
                </li>
                <li style={styles.listItem}>
                  Connect your wallet with sufficient balance
                </li>
                <li style={styles.listItem}>
                  Approve the token you want to spend
                </li>
                <li style={styles.listItem}>
                  Enter the amount you want to spend
                </li>

                <li style={styles.listItem}>
                  Execute the trade at oracle price + 0.20%
                </li>
                <li style={styles.listItem}>Receive your tokens instantly!</li>
              </ol>
            </div>

            <div style={styles.guideSection}>
              <h3 style={styles.guideTitle}>
                <span style={styles.guideIcon}>⚙️</span>
                Managing Orders
              </h3>
              <ul style={styles.unorderedList}>
                <li style={styles.listItem}>
                  View all your active orders in "My Orders"
                </li>
                <li style={styles.listItem}>Cancel orders anytime</li>
                <li style={styles.listItem}>
                  Track fills and trade history in real-time
                </li>
                <li style={styles.listItem}>
                  Monitor market prices with live charts
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* Technical Details */}
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>Technical Details</h2>

          <div style={styles.techGrid}>
            <div style={styles.techCard}>
              <h4 style={styles.techTitle}>Smart Contract</h4>
              <p style={styles.techText}>
                <strong>Address:</strong>
                <code style={styles.code}>0x4F7e...C149</code>
              </p>
              <p style={styles.techText}>
                <strong>Network:</strong> Base Sepolia Testnet
              </p>
              <p style={styles.techText}>
                <strong>Framework:</strong> Foundry (Solidity 0.8.30)
              </p>
            </div>

            <div style={styles.techCard}>
              <h4 style={styles.techTitle}>Oracle Integration</h4>
              <p style={styles.techText}>
                <strong>Provider:</strong> Pyth Network
              </p>
              <p style={styles.techText}>
                <strong>Update Frequency:</strong> Sub-second
              </p>
              <p style={styles.techText}>
                <strong>Staleness Check:</strong> {"< 15 seconds"}
              </p>
            </div>

            <div style={styles.techCard}>
              <h4 style={styles.techTitle}>Supported Tokens</h4>
              <p style={styles.techText}>
                WETH, USDC, USDT, LINK, cbBTC, cbDOGE, SHIB, AERO, cbXRP, PEPE
              </p>
              <p style={{ ...styles.techText, marginTop: "0.5rem" }}>
                <em style={styles.techNote}>
                  All tokens have Pyth price feeds
                </em>
              </p>
            </div>

            <div style={styles.techCard}>
              <h4 style={styles.techTitle}>Order Limits</h4>
              <p style={styles.techText}>
                <strong>Minimum Order:</strong> $10 USD worth
              </p>
              <p style={styles.techText}>
                <strong>Max Orders/Fill:</strong> 50 orders
              </p>
              <p style={styles.techText}>
                <strong>Partial Fills:</strong> Supported
              </p>
            </div>
          </div>
        </section>

        {/* Key Advantages */}
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>Why Choose p33rX?</h2>

          <div style={styles.advantagesList}>
            <div style={styles.advantageItem}>
              <div style={styles.advantageIcon}>✅</div>
              <div>
                <h4 style={styles.advantageTitle}>Predictable Execution</h4>
                <p style={styles.advantageText}>
                  Know exactly what price you'll get before trading. No
                  surprises from slippage or price impact.
                </p>
              </div>
            </div>

            <div style={styles.advantageItem}>
              <div style={styles.advantageIcon}>✅</div>
              <div>
                <h4 style={styles.advantageTitle}>Better for Large Orders</h4>
                <p style={styles.advantageText}>
                  Unlike AMMs where large orders suffer massive slippage, p33rX
                  treats all order sizes equally.
                </p>
              </div>
            </div>

            <div style={styles.advantageItem}>
              <div style={styles.advantageIcon}>✅</div>
              <div>
                <h4 style={styles.advantageTitle}>
                  Earn by Providing Liquidity
                </h4>
                <p style={styles.advantageText}>
                  Market makers earn a 0.15% bonus instead of paying fees,
                  incentivizing deep order books.
                </p>
              </div>
            </div>

            <div style={styles.advantageItem}>
              <div style={styles.advantageIcon}>✅</div>
              <div>
                <h4 style={styles.advantageTitle}>Transparent & Fair</h4>
                <p style={styles.advantageText}>
                  FIFO matching ensures early orders get filled first. No
                  preferential treatment or hidden mechanisms.
                </p>
              </div>
            </div>

            <div style={styles.advantageItem}>
              <div style={styles.advantageIcon}>✅</div>
              <div>
                <h4 style={styles.advantageTitle}>Real-Time Oracle Pricing</h4>
                <p style={styles.advantageText}>
                  Pyth Network's pull-based oracle provides accurate, up-to-date
                  prices with sub-second latency.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section style={styles.ctaSection}>
          <h2 style={styles.ctaTitle}>Ready to Trade?</h2>
          <p style={styles.ctaText}>
            Experience zero-slippage trading on Base Sepolia testnet
          </p>
          <Link href="/markets" style={styles.ctaButton}>
            <span style={styles.ctaButtonText}>Explore Markets</span>
            <span style={styles.ctaButtonIcon}>→</span>
          </Link>
        </section>
      </div>
    </div>
  );
}

const styles = {
  container: {
    minHeight: "100vh",
    background: "linear-gradient(to bottom, #0f172a 0%, #1e293b 100%)",
    padding: "2rem 1rem",
  } as React.CSSProperties,
  content: {
    maxWidth: "1200px",
    margin: "0 auto",
  } as React.CSSProperties,
  hero: {
    textAlign: "center" as const,
    marginBottom: "4rem",
    paddingTop: "2rem",
  } as React.CSSProperties,
  title: {
    fontSize: "4rem",
    fontWeight: "900",
    marginBottom: "1rem",
    lineHeight: "1.1",
  } as React.CSSProperties,
  titleGradient: {
    background:
      "linear-gradient(135deg, #00f5ff 0%, #60a5fa 50%, #a855f7 100%)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
    backgroundClip: "text",
    filter: "drop-shadow(0 0 30px rgba(0, 245, 255, 0.4))",
  } as React.CSSProperties,
  subtitle: {
    fontSize: "1.5rem",
    color: "#94a3b8",
    fontWeight: "500",
  } as React.CSSProperties,
  section: {
    marginBottom: "4rem",
    padding: "2rem",
    background: "rgba(15, 23, 42, 0.6)",
    border: "1px solid rgba(0, 245, 255, 0.1)",
    borderRadius: "1rem",
    backdropFilter: "blur(10px)",
  } as React.CSSProperties,
  sectionTitle: {
    fontSize: "2.5rem",
    fontWeight: "800",
    color: "#00f5ff",
    marginBottom: "1.5rem",
    textShadow: "0 0 20px rgba(0, 245, 255, 0.3)",
  } as React.CSSProperties,
  paragraph: {
    fontSize: "1.125rem",
    lineHeight: "1.8",
    color: "#cbd5e1",
    marginBottom: "1.5rem",
  } as React.CSSProperties,
  strong: {
    color: "#00f5ff",
    fontWeight: "700",
  } as React.CSSProperties,
  highlight: {
    color: "#00f5ff",
    fontWeight: "600",
  } as React.CSSProperties,
  featureGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
    gap: "1.5rem",
    marginTop: "2rem",
  } as React.CSSProperties,
  featureCard: {
    padding: "2rem",
    background:
      "linear-gradient(135deg, rgba(0, 245, 255, 0.05) 0%, rgba(96, 165, 250, 0.05) 100%)",
    border: "1px solid rgba(0, 245, 255, 0.2)",
    borderRadius: "1rem",
    textAlign: "center" as const,
    transition: "all 0.3s ease",
  } as React.CSSProperties,
  featureIcon: {
    fontSize: "3rem",
    marginBottom: "1rem",
  } as React.CSSProperties,
  featureTitle: {
    fontSize: "1.25rem",
    fontWeight: "700",
    color: "#00f5ff",
    marginBottom: "0.75rem",
  } as React.CSSProperties,
  featureText: {
    fontSize: "1rem",
    color: "#94a3b8",
    lineHeight: "1.6",
  } as React.CSSProperties,
  stepContainer: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "2rem",
  } as React.CSSProperties,
  step: {
    display: "flex",
    gap: "1.5rem",
    alignItems: "flex-start",
  } as React.CSSProperties,
  stepNumber: {
    minWidth: "3rem",
    height: "3rem",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "linear-gradient(135deg, #00f5ff 0%, #60a5fa 100%)",
    borderRadius: "50%",
    fontSize: "1.5rem",
    fontWeight: "900",
    color: "#0f172a",
    flexShrink: 0,
  } as React.CSSProperties,
  stepContent: {
    flex: 1,
  } as React.CSSProperties,
  stepTitle: {
    fontSize: "1.5rem",
    fontWeight: "700",
    color: "#00f5ff",
    marginBottom: "0.75rem",
  } as React.CSSProperties,
  feeGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
    gap: "1.5rem",
    marginTop: "2rem",
  } as React.CSSProperties,
  feeCard: {
    padding: "2rem",
    background:
      "linear-gradient(135deg, rgba(0, 245, 255, 0.08) 0%, rgba(96, 165, 250, 0.08) 100%)",
    border: "1px solid rgba(0, 245, 255, 0.3)",
    borderRadius: "1rem",
    textAlign: "center" as const,
  } as React.CSSProperties,
  feeLabel: {
    fontSize: "0.875rem",
    color: "#94a3b8",
    textTransform: "uppercase" as const,
    letterSpacing: "0.05em",
    marginBottom: "0.5rem",
  } as React.CSSProperties,
  feeValue: {
    fontSize: "2.5rem",
    fontWeight: "900",
    color: "#00f5ff",
    marginBottom: "0.5rem",
  } as React.CSSProperties,
  feeDescription: {
    fontSize: "0.9375rem",
    color: "#cbd5e1",
  } as React.CSSProperties,
  exampleBox: {
    marginTop: "2rem",
    padding: "2rem",
    background: "rgba(0, 245, 255, 0.05)",
    border: "1px solid rgba(0, 245, 255, 0.2)",
    borderRadius: "1rem",
  } as React.CSSProperties,
  exampleTitle: {
    fontSize: "1.25rem",
    fontWeight: "700",
    color: "#00f5ff",
    marginBottom: "1rem",
  } as React.CSSProperties,
  exampleContent: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "0.75rem",
  } as React.CSSProperties,
  exampleLine: {
    fontSize: "1rem",
    color: "#cbd5e1",
    display: "flex",
    gap: "0.5rem",
  } as React.CSSProperties,
  exampleLabel: {
    fontWeight: "600",
    minWidth: "150px",
    color: "#94a3b8",
  } as React.CSSProperties,
  guideContainer: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(350px, 1fr))",
    gap: "2rem",
    marginTop: "2rem",
  } as React.CSSProperties,
  guideSection: {
    padding: "2rem",
    background: "rgba(0, 245, 255, 0.05)",
    border: "1px solid rgba(0, 245, 255, 0.2)",
    borderRadius: "1rem",
  } as React.CSSProperties,
  guideTitle: {
    fontSize: "1.5rem",
    fontWeight: "700",
    color: "#00f5ff",
    marginBottom: "1.5rem",
    display: "flex",
    alignItems: "center",
    gap: "0.75rem",
  } as React.CSSProperties,
  guideIcon: {
    fontSize: "1.75rem",
  } as React.CSSProperties,
  orderedList: {
    paddingLeft: "1.5rem",
    display: "flex",
    flexDirection: "column" as const,
    gap: "0.75rem",
  } as React.CSSProperties,
  unorderedList: {
    paddingLeft: "1.5rem",
    display: "flex",
    flexDirection: "column" as const,
    gap: "0.75rem",
  } as React.CSSProperties,
  listItem: {
    fontSize: "1rem",
    color: "#cbd5e1",
    lineHeight: "1.6",
  } as React.CSSProperties,
  techGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
    gap: "1.5rem",
    marginTop: "2rem",
  } as React.CSSProperties,
  techCard: {
    padding: "1.5rem",
    background: "rgba(0, 245, 255, 0.05)",
    border: "1px solid rgba(0, 245, 255, 0.2)",
    borderRadius: "0.75rem",
  } as React.CSSProperties,
  techTitle: {
    fontSize: "1.125rem",
    fontWeight: "700",
    color: "#00f5ff",
    marginBottom: "1rem",
  } as React.CSSProperties,
  techText: {
    fontSize: "0.9375rem",
    color: "#cbd5e1",
    marginBottom: "0.5rem",
    lineHeight: "1.6",
  } as React.CSSProperties,
  techNote: {
    color: "#94a3b8",
    fontSize: "0.875rem",
  } as React.CSSProperties,
  code: {
    padding: "0.25rem 0.5rem",
    background: "rgba(0, 0, 0, 0.3)",
    borderRadius: "0.25rem",
    fontFamily: "monospace",
    fontSize: "0.875rem",
    color: "#00f5ff",
    wordBreak: "break-all" as const,
  } as React.CSSProperties,
  advantagesList: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "1.5rem",
    marginTop: "2rem",
  } as React.CSSProperties,
  advantageItem: {
    display: "flex",
    gap: "1.5rem",
    padding: "1.5rem",
    background: "rgba(0, 245, 255, 0.05)",
    border: "1px solid rgba(0, 245, 255, 0.2)",
    borderRadius: "0.75rem",
  } as React.CSSProperties,
  advantageIcon: {
    fontSize: "2rem",
    flexShrink: 0,
  } as React.CSSProperties,
  advantageTitle: {
    fontSize: "1.25rem",
    fontWeight: "700",
    color: "#00f5ff",
    marginBottom: "0.5rem",
  } as React.CSSProperties,
  advantageText: {
    fontSize: "1rem",
    color: "#cbd5e1",
    lineHeight: "1.6",
  } as React.CSSProperties,
  ctaSection: {
    textAlign: "center" as const,
    padding: "4rem 2rem",
    background:
      "linear-gradient(135deg, rgba(0, 245, 255, 0.1) 0%, rgba(96, 165, 250, 0.1) 100%)",
    border: "1px solid rgba(0, 245, 255, 0.3)",
    borderRadius: "1rem",
    marginTop: "4rem",
  } as React.CSSProperties,
  ctaTitle: {
    fontSize: "3rem",
    fontWeight: "900",
    color: "#00f5ff",
    marginBottom: "1rem",
    textShadow: "0 0 30px rgba(0, 245, 255, 0.4)",
  } as React.CSSProperties,
  ctaText: {
    fontSize: "1.25rem",
    color: "#94a3b8",
    marginBottom: "2rem",
  } as React.CSSProperties,
  ctaButton: {
    display: "inline-flex",
    alignItems: "center",
    gap: "0.75rem",
    padding: "1rem 2.5rem",
    background: "linear-gradient(135deg, #00f5ff 0%, #60a5fa 100%)",
    border: "none",
    borderRadius: "0.75rem",
    color: "#0f172a",
    fontSize: "1.125rem",
    fontWeight: "700",
    textDecoration: "none",
    transition: "all 0.3s ease",
    boxShadow: "0 8px 24px rgba(0, 245, 255, 0.4)",
  } as React.CSSProperties,
  ctaButtonText: {
    fontSize: "1.125rem",
  } as React.CSSProperties,
  ctaButtonIcon: {
    fontSize: "1.5rem",
    transition: "transform 0.3s ease",
  } as React.CSSProperties,
};
