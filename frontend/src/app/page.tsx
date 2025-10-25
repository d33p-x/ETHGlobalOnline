// src/app/page.tsx
"use client";

import { MarketList } from "./MarketList";
import { Debug } from "./Debug";
import { SupportedTokens } from "./SupportedTokens";

function App() {
  return (
    <div style={{ maxWidth: "1400px", margin: "0 auto", padding: "2rem" }}>
      {/* Hero Section */}
      <div style={styles.heroSection}>
        <h1 style={styles.heroTitle}>
          <span style={styles.gradient}>p33rX</span>
        </h1>
        <p style={styles.heroSubtitle}>
          Decentralized peer-to-peer trading with Pyth oracle integration
        </p>
        <div style={styles.featureGrid}>
          <div style={styles.featureCard}>
            <div style={styles.featureIcon}>📊</div>
            <h4 style={styles.featureTitle}>Order Book Trading</h4>
            <p style={styles.featureText}>
              Place limit orders with custom price ranges
            </p>
          </div>
          <div style={styles.featureCard}>
            <div style={styles.featureIcon}>⚡</div>
            <h4 style={styles.featureTitle}>Real-time Prices</h4>
            <p style={styles.featureText}>Powered by Pyth Network oracles</p>
          </div>
          <div style={styles.featureCard}>
            <div style={styles.featureIcon}>🎯</div>
            <h4 style={styles.featureTitle}>Zero Slippage</h4>
            <p style={styles.featureText}>
              Execute trades at exact oracle prices
            </p>
          </div>
          <div style={styles.featureCard}>
            <div style={styles.featureIcon}>💰</div>
            <h4 style={styles.featureTitle}>Fair Fees</h4>
            <p style={styles.featureText}>
              Sellers earn 0.05% • Buyers pay 0.1%
            </p>
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
  heroSection: {
    textAlign: "center" as const,
    marginBottom: "3rem",
    padding: "3rem 1rem",
    background:
      "linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(139, 92, 246, 0.1) 100%)",
    borderRadius: "1rem",
    border: "1px solid rgba(59, 130, 246, 0.2)",
  },
  heroTitle: {
    fontSize: "3rem",
    fontWeight: "700",
    marginBottom: "1rem",
    lineHeight: "1.2",
  },
  gradient: {
    background: "linear-gradient(135deg, #00f5ff 0%, #ff0080 100%)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
    backgroundClip: "text",
  },
  heroSubtitle: {
    fontSize: "1.25rem",
    color: "#cbd5e1",
    marginBottom: "2rem",
    maxWidth: "600px",
    margin: "0 auto 2rem auto",
  },
  featureGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
    gap: "1.5rem",
    marginTop: "2rem",
  },
  featureCard: {
    padding: "1.5rem",
    background: "rgba(30, 40, 73, 0.5)",
    borderRadius: "0.75rem",
    border: "1px solid #2d3a5f",
    transition: "all 0.3s ease",
  },
  featureIcon: {
    fontSize: "2.5rem",
    marginBottom: "0.75rem",
  },
  featureTitle: {
    fontSize: "1rem",
    fontWeight: "600",
    color: "#f1f5f9",
    marginBottom: "0.5rem",
  },
  featureText: {
    fontSize: "0.875rem",
    color: "#94a3b8",
    margin: 0,
  },
  section: {
    marginBottom: "2rem",
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
