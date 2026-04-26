"use client";

/**
 * Signal Strike — Public trial sign-up page
 * Route: /trial
 *
 * No auth required. User picks a tier; we POST to /api/stripe/checkout
 * and redirect them to the Stripe-hosted Checkout page where they enter
 * email + card details. Stripe charges $1 today, then $29/$79/$129
 * starting day 15.
 */

import { useState } from "react";

const GOLD = "#C9A84C";
const GOLD_HI = "#D4B65C";
const BG = "#0A0A0B";
const CARD = "#111113";
const BORDER = "#27272A";
const TEXT = "#FFFFFF";
const MUTED = "#A1A1AA";
const MUTED_2 = "#71717A";
const RED = "#EF4444";

type Tier = "scout" | "strike" | "command";

const PLANS: Array<{
  tier: Tier;
  name: string;
  price: number;
  tagline: string;
  features: string[];
  featured?: boolean;
}> = [
  {
    tier: "scout",
    name: "Scout",
    price: 29,
    tagline: "For individual reps getting started.",
    features: [
      "Visual pipeline & deals",
      "Up to 500 prospects",
      "Daily Signal email",
      "HillTop prospect finder",
      "Email support",
    ],
  },
  {
    tier: "strike",
    name: "Strike",
    price: 79,
    tagline: "For serious closers who want every edge.",
    featured: true,
    features: [
      "Everything in Scout",
      "Unlimited prospects",
      "Ask Signal AI chat",
      "Advanced analytics",
      "PDF + Excel exports",
      "Priority support",
    ],
  },
  {
    tier: "command",
    name: "Command",
    price: 129,
    tagline: "For revenue leaders running the show.",
    features: [
      "Everything in Strike",
      "Unlimited AI credits",
      "Custom reports",
      "API access",
      "Dedicated success manager",
      "SSO & advanced security",
    ],
  },
];

export default function TrialPage() {
  const [loadingTier, setLoadingTier] = useState<Tier | null>(null);
  const [error, setError] = useState<string | null>(null);

  const startCheckout = async (tier: Tier) => {
    setError(null);
    setLoadingTier(tier);

    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier }),
      });

      const data = await res.json();

      if (!res.ok || !data?.url) {
        throw new Error(data?.error || "Could not start checkout. Please try again.");
      }

      // Hand off to Stripe-hosted Checkout
      window.location.href = data.url;
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong. Please try again.",
      );
      setLoadingTier(null);
    }
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;500;600;700&family=Montserrat:wght@300;400;500;600;700&display=swap');

        html, body { margin: 0; padding: 0; background: ${BG}; color: ${TEXT}; }
        * { box-sizing: border-box; }
        .ss-heading { font-family: 'Cinzel', serif; letter-spacing: 0.01em; }
        .ss-body    { font-family: 'Montserrat', sans-serif; }
        a { text-decoration: none; }

        .ss-btn-primary { transition: all 0.2s ease; }
        .ss-btn-primary:hover:not(:disabled) {
          background: ${GOLD_HI} !important;
          transform: translateY(-1px);
          box-shadow: 0 10px 28px rgba(201, 168, 76, 0.32);
        }
        .ss-btn-primary:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }

        .ss-card { transition: all 0.3s ease; }
        .ss-card:hover { border-color: ${GOLD} !important; transform: translateY(-4px); }

        .ss-link:hover { color: ${GOLD} !important; }

        .ss-dot {
          width: 6px; height: 6px; border-radius: 50%;
          background: ${GOLD}; display: inline-block;
          box-shadow: 0 0 12px ${GOLD};
        }

        @keyframes ss-spin {
          to { transform: rotate(360deg); }
        }
        .ss-spinner {
          width: 14px; height: 14px;
          border: 2px solid rgba(10,10,11,0.3);
          border-top-color: ${BG};
          border-radius: 50%;
          display: inline-block;
          animation: ss-spin 0.7s linear infinite;
          vertical-align: -2px;
          margin-right: 8px;
        }

        @media (max-width: 960px) {
          .ss-hero { padding: 96px 20px 48px !important; }
          .ss-hero-title { font-size: 2.25rem !important; line-height: 1.15 !important; }
          .ss-section { padding: 0 20px 96px !important; }
          .ss-grid-3 { grid-template-columns: 1fr !important; }
          .ss-pricing-card { padding: 28px !important; }
        }
      `}</style>

      <div
        className="ss-body"
        style={{
          background: BG,
          color: TEXT,
          minHeight: "100vh",
          overflowX: "hidden",
        }}
      >
        {/* Minimal nav — just the wordmark linking home */}
        <nav
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "20px 32px",
            borderBottom: `1px solid ${BORDER}`,
          }}
        >
          <a
            href="/landing"
            style={{ display: "flex", alignItems: "center", gap: 12 }}
          >
            <img
              src="/logo-white.png"
              alt=""
              style={{ height: 34, width: "auto", display: "block" }}
            />
            <span
              className="ss-heading"
              style={{
                fontSize: 17,
                fontWeight: 600,
                letterSpacing: "0.16em",
                color: TEXT,
                textTransform: "uppercase",
                lineHeight: 1,
                whiteSpace: "nowrap",
              }}
            >
              Signal <span style={{ color: GOLD }}>Strike</span>
            </span>
          </a>
          <a
            href="/login"
            className="ss-link"
            style={{ color: MUTED, fontSize: 14, fontWeight: 500 }}
          >
            Already have an account? Sign in
          </a>
        </nav>

        {/* Hero */}
        <section
          className="ss-hero"
          style={{
            position: "relative",
            padding: "96px 32px 48px",
            textAlign: "center",
            maxWidth: 900,
            margin: "0 auto",
          }}
        >
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 10,
              padding: "8px 16px",
              borderRadius: 999,
              border: `1px solid ${BORDER}`,
              background: "rgba(201, 168, 76, 0.06)",
              fontSize: 12,
              fontWeight: 600,
              letterSpacing: "0.14em",
              color: GOLD,
              textTransform: "uppercase",
              marginBottom: 28,
            }}
          >
            <span className="ss-dot" />
            Start Your Trial
          </div>

          <h1
            className="ss-heading ss-hero-title"
            style={{
              fontSize: "3rem",
              fontWeight: 600,
              lineHeight: 1.1,
              margin: "0 0 20px",
              letterSpacing: "-0.015em",
            }}
          >
            Pick your plan. Pay{" "}
            <span
              style={{
                background: `linear-gradient(135deg, ${GOLD} 0%, ${GOLD_HI} 100%)`,
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              $1 today.
            </span>
          </h1>

          <p
            style={{
              fontSize: "1.1rem",
              color: MUTED,
              maxWidth: 620,
              margin: "0 auto 8px",
              lineHeight: 1.6,
            }}
          >
            Get full access for 14 days. Your card will be charged the standard
            monthly price on day 15. Cancel anytime before then and you only
            pay the $1.
          </p>
        </section>

        {/* Plan cards */}
        <section
          className="ss-section"
          style={{
            padding: "0 32px 120px",
            maxWidth: 1200,
            margin: "0 auto",
          }}
        >
          {error && (
            <div
              role="alert"
              style={{
                background: "rgba(239, 68, 68, 0.08)",
                border: `1px solid ${RED}`,
                color: TEXT,
                padding: "14px 18px",
                borderRadius: 10,
                marginBottom: 28,
                fontSize: 14,
                lineHeight: 1.5,
                maxWidth: 760,
                margin: "0 auto 28px",
              }}
            >
              <strong style={{ color: RED, marginRight: 8 }}>Error:</strong>
              {error}
            </div>
          )}

          <div
            className="ss-grid-3"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: 24,
            }}
          >
            {PLANS.map((plan) => (
              <PlanCard
                key={plan.tier}
                plan={plan}
                loading={loadingTier === plan.tier}
                disabled={loadingTier !== null && loadingTier !== plan.tier}
                onSelect={() => startCheckout(plan.tier)}
              />
            ))}
          </div>

          <p
            style={{
              textAlign: "center",
              fontSize: 13,
              color: MUTED_2,
              marginTop: 32,
              maxWidth: 720,
              marginInline: "auto",
              lineHeight: 1.6,
            }}
          >
            By starting your trial you authorize us to charge $1.00 today and
            the standard monthly price on day 15. You can cancel anytime from
            your account settings before day 15 and you will not be charged
            beyond the initial $1.
          </p>
        </section>
      </div>
    </>
  );
}

/* ─────────────────────────── Subcomponents ─────────────────────────── */

interface PlanCardProps {
  plan: (typeof PLANS)[number];
  loading: boolean;
  disabled: boolean;
  onSelect: () => void | Promise<void>;
}

function PlanCard({
  plan,
  loading,
  disabled,
  onSelect,
}: PlanCardProps) {
  return (
    <div
      className="ss-card ss-pricing-card"
      style={{
        background: CARD,
        border: plan.featured ? `1px solid ${GOLD}` : `1px solid ${BORDER}`,
        borderRadius: 16,
        padding: 36,
        position: "relative",
        boxShadow: plan.featured ? "0 16px 48px rgba(201, 168, 76, 0.12)" : "none",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {plan.featured && (
        <div
          style={{
            position: "absolute",
            top: -12,
            left: "50%",
            transform: "translateX(-50%)",
            background: GOLD,
            color: BG,
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            padding: "5px 14px",
            borderRadius: 999,
          }}
        >
          Most Popular
        </div>
      )}

      <div
        className="ss-heading"
        style={{
          fontSize: "1.4rem",
          fontWeight: 600,
          margin: "0 0 8px",
          color: plan.featured ? GOLD : TEXT,
          letterSpacing: "0.02em",
        }}
      >
        {plan.name}
      </div>
      <p style={{ fontSize: 13, color: MUTED, margin: "0 0 24px", lineHeight: 1.5 }}>
        {plan.tagline}
      </p>

      <div style={{ marginBottom: 8 }}>
        <span
          className="ss-heading"
          style={{
            fontSize: "2.6rem",
            fontWeight: 600,
            lineHeight: 1,
            color: GOLD,
          }}
        >
          $1
        </span>
        <span style={{ fontSize: 14, color: MUTED, marginLeft: 8 }}>
          today
        </span>
      </div>
      <div style={{ fontSize: 13, color: MUTED_2, marginBottom: 28 }}>
        Then ${plan.price}/user/mo starting day 15
      </div>

      <ul style={{ listStyle: "none", padding: 0, margin: "0 0 32px", flex: 1 }}>
        {plan.features.map((f) => (
          <li
            key={f}
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 10,
              padding: "8px 0",
              fontSize: 14,
              color: TEXT,
              lineHeight: 1.5,
            }}
          >
            <span style={{ color: GOLD, fontWeight: 700, marginTop: 1 }}>✓</span>
            {f}
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={onSelect}
        disabled={loading || disabled}
        className="ss-btn-primary"
        style={{
          background: plan.featured ? GOLD : "transparent",
          color: plan.featured ? BG : TEXT,
          padding: "14px 24px",
          borderRadius: 10,
          fontSize: 14,
          fontWeight: 600,
          border: plan.featured ? "none" : `1px solid ${GOLD}`,
          cursor: "pointer",
          width: "100%",
          fontFamily: "'Montserrat', sans-serif",
        }}
      >
        {loading ? (
          <>
            <span className="ss-spinner" aria-hidden />
            Setting up checkout…
          </>
        ) : (
          <>Continue with {plan.name} →</>
        )}
      </button>
    </div>
  );
}
