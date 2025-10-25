// src/app/page.tsx
"use client";

import { MarketList } from "./MarketList";
import { Debug } from "./Debug";
import { SupportedTokens } from "./SupportedTokens";

function App() {
  return (
    <div style={styles.container}>
      {/* Hero Section */}
      <div style={styles.heroSection}>
        <div style={styles.heroContent}>
          <div style={styles.badge}>
            <span style={styles.poweredByText}>Powered by</span>
            <img
              src="/Pyth_Logotype_Dark.svg"
              alt="Pyth Network"
              style={styles.pythLogo}
            />
          </div>
          <h1 style={styles.heroTitle}>
            <span style={styles.gradient}>p33rX</span>
          </h1>
          <p style={styles.heroSubtitle}>
            Next-generation decentralized peer-to-peer trading platform with
            real-time oracle pricing
          </p>

          <div style={styles.statsBar}>
            <div style={styles.statItem}>
              <div style={styles.statValue}>0.05%</div>
              <div style={styles.statLabel}>Seller Bonus</div>
            </div>
            <div style={styles.statDivider}></div>
            <div style={styles.statItem}>
              <div style={styles.statValue}>0.10%</div>
              <div style={styles.statLabel}>Buyer Fee</div>
            </div>
            <div style={styles.statDivider}></div>
            <div style={styles.statItem}>
              <div style={styles.statValue}>0%</div>
              <div style={styles.statLabel}>Slippage</div>
            </div>
          </div>

          <div style={styles.featureGrid}>
            <div style={styles.featureCard}>
              <div style={styles.featureIconWrapper}>
                <svg
                  style={styles.featureIcon}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <rect x="3" y="3" width="7" height="7" />
                  <rect x="14" y="3" width="7" height="7" />
                  <rect x="14" y="14" width="7" height="7" />
                  <rect x="3" y="14" width="7" height="7" />
                </svg>
              </div>
              <h4 style={styles.featureTitle}>Order Book Trading</h4>
              <p style={styles.featureText}>
                Place limit orders with custom price ranges and full control
              </p>
            </div>
            <div style={styles.featureCard}>
              <div style={styles.featureIconWrapper}>
                <svg
                  style={styles.featureIcon}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                </svg>
              </div>
              <h4 style={styles.featureTitle}>Real-time Prices</h4>
              <p style={styles.featureText}>
                Lightning-fast price feeds powered by Pyth Network
              </p>
            </div>
            <div style={styles.featureCard}>
              <div style={styles.featureIconWrapper}>
                <svg
                  style={styles.featureIcon}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 6v6l4 2" />
                </svg>
              </div>
              <h4 style={styles.featureTitle}>Zero Slippage</h4>
              <p style={styles.featureText}>
                Execute trades at exact oracle prices, guaranteed
              </p>
            </div>
            <div style={styles.featureCard}>
              <div style={styles.featureIconWrapper}>
                <svg
                  style={styles.featureIcon}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
              </div>
              <h4 style={styles.featureTitle}>Secure & Trustless</h4>
              <p style={styles.featureText}>
                Non-custodial trading with smart contract security
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Debug Component - Collapsible */}
      <Debug />

      {/* Markets Section */}
      <div style={styles.section}>
        <MarketList />
      </div>

      {/* Supported Tokens */}
      <div style={styles.section}>
        <SupportedTokens />
      </div>
    </div>
  );
}

const styles = {
  container: {
    maxWidth: "1400px",
    margin: "0 auto",
    padding: "2rem",
  },
  heroSection: {
    textAlign: "center" as const,
    marginBottom: "4rem",
    padding: "4rem 2rem",
    background:
      "radial-gradient(ellipse at top, rgba(59, 130, 246, 0.15) 0%, transparent 60%), linear-gradient(135deg, rgba(102, 126, 234, 0.08) 0%, rgba(118, 75, 162, 0.08) 100%)",
    borderRadius: "1.5rem",
    border: "1px solid rgba(59, 130, 246, 0.2)",
    boxShadow: "0 20px 60px -15px rgba(59, 130, 246, 0.3)",
    position: "relative" as const,
    overflow: "hidden" as const,
  },
  heroContent: {
    position: "relative" as const,
    zIndex: 1,
  },
  badge: {
    display: "inline-flex",
    alignItems: "center",
    padding: "0.5rem 1.25rem",
    background:
      "linear-gradient(135deg, rgba(59, 130, 246, 0.2) 0%, rgba(139, 92, 246, 0.2) 100%)",
    border: "1px solid rgba(59, 130, 246, 0.3)",
    borderRadius: "2rem",
    marginBottom: "1.5rem",
    backdropFilter: "blur(10px)",
  },
  badgeText: {
    fontSize: "0.875rem",
    fontWeight: "600",
    color: "#60a5fa",
    letterSpacing: "0.05em",
  },
  poweredByText: {
    fontSize: "0.875rem",
    fontWeight: "600",
    color: "#94a3b8",
    marginRight: "0.5rem",
  },
  pythLogo: {
    height: "24px",
    width: "auto",
    display: "block",
    filter: "brightness(0) invert(1)",
  },
  heroTitle: {
    fontSize: "4rem",
    fontWeight: "800",
    marginBottom: "1.5rem",
    lineHeight: "1.1",
    letterSpacing: "-0.02em",
  },
  gradient: {
    background:
      "linear-gradient(135deg, #00f5ff 0%, #a855f7 50%, #ff0080 100%)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
    backgroundClip: "text",
    backgroundSize: "200% auto",
    animation: "gradient 3s ease infinite",
  },
  heroSubtitle: {
    fontSize: "1.25rem",
    color: "#cbd5e1",
    marginBottom: "2.5rem",
    maxWidth: "700px",
    margin: "0 auto 2.5rem auto",
    lineHeight: "1.6",
  },
  statsBar: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    gap: "2rem",
    padding: "1.5rem 2rem",
    background: "rgba(30, 40, 73, 0.6)",
    borderRadius: "1rem",
    border: "1px solid rgba(59, 130, 246, 0.2)",
    marginBottom: "3rem",
    maxWidth: "600px",
    margin: "0 auto 3rem auto",
    backdropFilter: "blur(10px)",
  },
  statItem: {
    textAlign: "center" as const,
  },
  statValue: {
    fontSize: "1.75rem",
    fontWeight: "700",
    color: "#60a5fa",
    marginBottom: "0.25rem",
  },
  statLabel: {
    fontSize: "0.875rem",
    color: "#94a3b8",
    textTransform: "uppercase" as const,
    letterSpacing: "0.05em",
  },
  statDivider: {
    width: "1px",
    height: "40px",
    background: "rgba(59, 130, 246, 0.2)",
  },
  featureGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
    gap: "1.5rem",
    marginTop: "3rem",
  },
  featureCard: {
    padding: "2rem 1.5rem",
    background: "rgba(30, 40, 73, 0.4)",
    borderRadius: "1rem",
    border: "1px solid rgba(59, 130, 246, 0.15)",
    transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
    cursor: "default",
    backdropFilter: "blur(10px)",
    position: "relative" as const,
    overflow: "hidden" as const,
  },
  featureIconWrapper: {
    width: "64px",
    height: "64px",
    margin: "0 auto 1.25rem auto",
    background:
      "linear-gradient(135deg, rgba(59, 130, 246, 0.2) 0%, rgba(139, 92, 246, 0.2) 100%)",
    borderRadius: "1rem",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    border: "1px solid rgba(59, 130, 246, 0.3)",
  },
  featureIcon: {
    width: "32px",
    height: "32px",
    color: "#60a5fa",
  },
  featureTitle: {
    fontSize: "1.125rem",
    fontWeight: "600",
    color: "#f1f5f9",
    marginBottom: "0.75rem",
    letterSpacing: "-0.01em",
  },
  featureText: {
    fontSize: "0.9375rem",
    color: "#94a3b8",
    margin: 0,
    lineHeight: "1.6",
  },
  section: {
    marginBottom: "3rem",
  },
  bottomGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(450px, 1fr))",
    gap: "2rem",
    marginTop: "2rem",
  },
  gridItem: {
    minWidth: 0,
  },
};

export default App;
