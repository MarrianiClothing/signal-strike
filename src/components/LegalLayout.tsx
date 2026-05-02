"use client";
import Link from "next/link";
import { ReactNode } from "react";

interface LegalLayoutProps {
  title: string;
  effectiveDate: string;
  lastUpdated: string;
  children: ReactNode;
}

export default function LegalLayout({ title, effectiveDate, lastUpdated, children }: LegalLayoutProps) {
  return (
    <div style={{
      minHeight: "100vh",
      background: "#0a0a0a",
      color: "#e4e4e7",
      fontFamily: "var(--font-montserrat, sans-serif)",
      padding: "32px 20px 80px",
    }}>
      <div style={{ maxWidth: 760, margin: "0 auto" }}>

        {/* Top bar */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 48 }}>
          <Link href="/" style={{
            color: "#C9A84C",
            textDecoration: "none",
            fontSize: "0.85rem",
            fontWeight: 500,
            letterSpacing: "0.05em",
          }}>
            ← Back to Signal Strike
          </Link>
          <div style={{
            fontFamily: "var(--font-cinzel, serif)",
            fontSize: "1rem",
            color: "#fafafa",
            letterSpacing: "0.1em",
          }}>
            SIGNAL STRIKE
          </div>
        </div>

        {/* Title */}
        <h1 style={{
          fontFamily: "var(--font-cinzel, serif)",
          fontSize: "2.4rem",
          fontWeight: 600,
          color: "#fafafa",
          marginBottom: 16,
          letterSpacing: "0.02em",
        }}>
          {title}
        </h1>

        {/* Effective + updated dates */}
        <div style={{
          fontSize: "0.85rem",
          color: "#71717a",
          marginBottom: 40,
          paddingBottom: 24,
          borderBottom: "1px solid #27272a",
        }}>
          <p style={{ margin: 0 }}><strong style={{ color: "#a1a1aa" }}>Effective Date:</strong> {effectiveDate}</p>
          <p style={{ margin: "4px 0 0" }}><strong style={{ color: "#a1a1aa" }}>Last Updated:</strong> {lastUpdated}</p>
        </div>

        {/* Body content */}
        <div style={{
          fontSize: "0.95rem",
          lineHeight: 1.75,
          color: "#d4d4d8",
        }} className="legal-prose">
          {children}
        </div>

        {/* Footer */}
        <div style={{
          marginTop: 80,
          paddingTop: 32,
          borderTop: "1px solid #27272a",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 16,
          fontSize: "0.8rem",
          color: "#71717a",
        }}>
          <div>© {new Date().getFullYear()} Hilltop Ave LLC. All rights reserved.</div>
          <div style={{ display: "flex", gap: 20 }}>
            <Link href="/terms" style={{ color: "#a1a1aa", textDecoration: "none" }}>Terms</Link>
            <Link href="/privacy" style={{ color: "#a1a1aa", textDecoration: "none" }}>Privacy</Link>
            <Link href="/" style={{ color: "#a1a1aa", textDecoration: "none" }}>Home</Link>
          </div>
        </div>
      </div>

      <style jsx global>{`
        .legal-prose h2 {
          font-family: var(--font-cinzel, serif);
          font-size: 1.5rem;
          font-weight: 600;
          color: #fafafa;
          margin-top: 48px;
          margin-bottom: 16px;
          letter-spacing: 0.02em;
        }
        .legal-prose h3 {
          font-size: 1.1rem;
          font-weight: 600;
          color: #fafafa;
          margin-top: 32px;
          margin-bottom: 12px;
        }
        .legal-prose p {
          margin: 0 0 16px;
        }
        .legal-prose ul {
          margin: 0 0 16px;
          padding-left: 24px;
        }
        .legal-prose li {
          margin-bottom: 8px;
        }
        .legal-prose strong {
          color: #fafafa;
          font-weight: 600;
        }
        .legal-prose a {
          color: #C9A84C;
          text-decoration: none;
        }
        .legal-prose a:hover {
          text-decoration: underline;
        }
        .legal-prose hr {
          border: none;
          border-top: 1px solid #27272a;
          margin: 40px 0;
        }
      `}</style>
    </div>
  );
}
