/**
 * Signal Strike — Account / Billing page
 * /account
 *
 * Server component. Auth-gated. Shows the user's plan, status, trial
 * countdown, and a Manage Billing button that opens the Stripe portal.
 *
 * Visual: dark theme matching the rest of the app. Gold accent for the
 * tier name, status badge color-coded (green/amber/red).
 */

import { redirect } from "next/navigation";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { ManageBillingButton } from "./manage-billing-button";
import { TimezoneSelector } from "./timezone-selector";

export const dynamic = "force-dynamic";

const TIER_LABELS: Record<string, string> = {
  scout: "Scout",
  strike: "Strike",
  command: "Command",
};

const TIER_PRICES: Record<string, string> = {
  scout: "$29 / month",
  strike: "$79 / month",
  command: "$129 / month",
};

const TIER_DESCRIPTIONS: Record<string, string> = {
  scout: "Individual rep tier",
  strike: "Serious closer tier",
  command: "Revenue leader tier",
};

type Subscription = {
  tier: string | null;
  status: string | null;
  trial_end: string | null;
  current_period_end: string | null;
  cancel_at: string | null;
  canceled_at: string | null;
  stripe_subscription_id: string | null;
};

export default async function AccountPage() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: () => {
          // No-op: server component, can't set cookies here.
        },
      },
    },
  );

  // 1. Auth check
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // 2. Load subscription. Profile already exists thanks to the auth.users trigger.
  const { data: subscription } = await supabase
    .from("subscriptions")
    .select(
      "tier, status, trial_end, current_period_end, cancel_at, canceled_at, stripe_subscription_id",
    )
    .eq("user_id", user.id)
    .maybeSingle<Subscription>();

  // Load profile for timezone
  const { data: profile } = await supabase
    .from("profiles")
    .select("timezone")
    .eq("id", user.id)
    .maybeSingle<{ timezone: string | null }>();

  return (
    <main
      style={{
        minHeight: "100dvh",
        background: "#0A0A0B",
        color: "#FAFAFA",
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;500;600;700&family=Montserrat:wght@400;500;600&display=swap');

        /* Account page responsive */
        [data-ss="account-nav"] {
          padding: 20px 32px;
          flex-wrap: wrap;
          gap: 12px;
        }
        [data-ss="account-nav-email"] {
          display: inline;
        }
        [data-ss="account-body"] {
          padding: 64px 32px;
        }
        [data-ss="account-heading"] {
          font-size: 32px;
        }
        [data-ss="account-card"] {
          padding: 32px;
        }
        [data-ss="account-card-header"] {
          flex-direction: row;
          gap: 16px;
        }

        @media (max-width: 640px) {
          [data-ss="account-nav"] {
            padding: 14px 18px;
          }
          [data-ss="account-nav-email"] {
            display: none;
          }
          [data-ss="account-body"] {
            padding: 32px 18px;
          }
          [data-ss="account-heading"] {
            font-size: 26px;
          }
          [data-ss="account-card"] {
            padding: 22px 20px;
          }
          [data-ss="account-card-header"] {
            flex-direction: column;
            align-items: flex-start !important;
            gap: 12px;
          }
        }

        [data-ss="account-back"] {
          transition: color 0.15s, border-color 0.15s;
        }
        [data-ss="account-back"]:hover {
          color: #C9A84C;
          border-color: #C9A84C;
        }
      `}</style>

      <Nav email={user.email ?? ""} />

      <div
        data-ss="account-body"
        style={{
          maxWidth: "880px",
          margin: "0 auto",
        }}
      >
        <h1
          data-ss="account-heading"
          style={{
            fontWeight: 600,
            marginBottom: "8px",
            fontFamily: "Cinzel, serif",
            letterSpacing: "0.01em",
          }}
        >
          Account
        </h1>
        <p
          style={{
            color: "#A1A1AA",
            fontSize: "15px",
            marginBottom: "40px",
          }}
        >
          Manage your subscription, billing, and preferences.
        </p>

        {subscription ? (
          <SubscriptionCard subscription={subscription} />
        ) : (
          <NoSubscriptionCard />
        )}

        <TimezoneSelector
          userId={user.id}
          initialTimezone={profile?.timezone ?? null}
        />
      </div>
    </main>
  );
}

function Nav({ email }: { email: string }) {
  return (
    <nav
      data-ss="account-nav"
      style={{
        borderBottom: "1px solid #27272A",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      {/* Left: logo + wordmark — links to dashboard */}
      <a
        href="/dashboard"
        style={{
          display: "flex",
          alignItems: "center",
          gap: "10px",
          textDecoration: "none",
          color: "inherit",
        }}
      >
        <img
          src="/logo-white.png"
          alt="Signal Strike"
          style={{ width: 28, height: "auto", opacity: 0.9 }}
        />
        <div
          style={{
            fontFamily: "Cinzel, serif",
            fontSize: "18px",
            fontWeight: 700,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            color: "#FAFAFA",
          }}
        >
          Signal <span style={{ color: "#C9A84C" }}>Strike</span>
        </div>
      </a>

      {/* Right: dashboard back link + email + sign out */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "12px",
          fontSize: "14px",
          color: "#A1A1AA",
          flexWrap: "wrap",
          justifyContent: "flex-end",
        }}
      >
        <a
          href="/dashboard"
          data-ss="account-back"
          style={{
            color: "#A1A1AA",
            textDecoration: "none",
            border: "1px solid #27272A",
            borderRadius: "6px",
            padding: "8px 14px",
            fontSize: "13px",
            fontWeight: 500,
            letterSpacing: "0.02em",
          }}
        >
          ← Dashboard
        </a>
        <span data-ss="account-nav-email">{email}</span>
        <form action="/auth/signout" method="POST" style={{ margin: 0 }}>
          <button
            type="submit"
            style={{
              background: "transparent",
              border: "1px solid #27272A",
              color: "#FAFAFA",
              padding: "8px 16px",
              borderRadius: "6px",
              fontSize: "14px",
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            Sign out
          </button>
        </form>
      </div>
    </nav>
  );
}

function SubscriptionCard({ subscription }: { subscription: Subscription }) {
  const tier = subscription.tier ?? "scout";
  const tierLabel = TIER_LABELS[tier] ?? "Unknown";
  const tierPrice = TIER_PRICES[tier] ?? "";
  const tierDescription = TIER_DESCRIPTIONS[tier] ?? "";

  const status = subscription.status ?? "unknown";
  const statusBadge = renderStatusBadge(status);

  const dateLabel = renderDateLabel(subscription);

  return (
    <div
      data-ss="account-card"
      style={{
        background: "#111113",
        border: "1px solid #27272A",
        borderRadius: "12px",
      }}
    >
      <div
        data-ss="account-card-header"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: "24px",
        }}
      >
        <div>
          <div
            style={{
              fontSize: "13px",
              color: "#71717A",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              marginBottom: "8px",
            }}
          >
            Current plan
          </div>
          <div
            style={{
              fontSize: "28px",
              fontWeight: 600,
              color: "#C9A84C",
              fontFamily: "Cinzel, serif",
              marginBottom: "4px",
            }}
          >
            {tierLabel}
          </div>
          <div style={{ fontSize: "15px", color: "#FAFAFA" }}>{tierPrice}</div>
          <div style={{ fontSize: "13px", color: "#71717A", marginTop: "4px" }}>
            {tierDescription}
          </div>
        </div>
        <div>{statusBadge}</div>
      </div>

      {dateLabel && (
        <div
          style={{
            padding: "16px",
            background: "#0A0A0B",
            borderRadius: "8px",
            border: "1px solid #27272A",
            fontSize: "14px",
            color: "#D4D4D8",
            marginBottom: "24px",
          }}
        >
          {dateLabel}
        </div>
      )}

      <ManageBillingButton />
    </div>
  );
}

function NoSubscriptionCard() {
  return (
    <div
      data-ss="account-card"
      style={{
        background: "#111113",
        border: "1px solid #27272A",
        borderRadius: "12px",
        textAlign: "center",
      }}
    >
      <h2 style={{ fontSize: "20px", fontWeight: 600, marginBottom: "8px" }}>
        No active subscription
      </h2>
      <p
        style={{
          color: "#A1A1AA",
          fontSize: "14px",
          marginBottom: "24px",
        }}
      >
        Start a 14-day trial to access Signal Strike.
      </p>
      <a
        href="/trial"
        style={{
          display: "inline-block",
          background: "#C9A84C",
          color: "#0A0A0B",
          padding: "12px 24px",
          borderRadius: "8px",
          fontWeight: 600,
          textDecoration: "none",
          fontSize: "15px",
        }}
      >
        Start trial →
      </a>
    </div>
  );
}

function renderStatusBadge(status: string) {
  const styleMap: Record<
    string,
    { bg: string; color: string; label: string }
  > = {
    trialing: { bg: "#1E3A2A", color: "#86EFAC", label: "Trial" },
    active: { bg: "#1E3A2A", color: "#86EFAC", label: "Active" },
    past_due: { bg: "#3A2A1E", color: "#FCD34D", label: "Past due" },
    unpaid: { bg: "#3A1E1E", color: "#FCA5A5", label: "Unpaid" },
    canceled: { bg: "#27272A", color: "#A1A1AA", label: "Canceled" },
    incomplete: { bg: "#27272A", color: "#A1A1AA", label: "Incomplete" },
    incomplete_expired: {
      bg: "#27272A",
      color: "#A1A1AA",
      label: "Expired",
    },
    paused: { bg: "#27272A", color: "#A1A1AA", label: "Paused" },
  };

  const style = styleMap[status] ?? {
    bg: "#27272A",
    color: "#A1A1AA",
    label: status,
  };

  return (
    <span
      style={{
        background: style.bg,
        color: style.color,
        padding: "6px 12px",
        borderRadius: "999px",
        fontSize: "12px",
        fontWeight: 600,
        textTransform: "uppercase",
        letterSpacing: "0.05em",
      }}
    >
      {style.label}
    </span>
  );
}

function renderDateLabel(sub: Subscription): string | null {
  const fmt = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return iso;
    }
  };

  if (sub.canceled_at && sub.status === "canceled") {
    return `Canceled on ${fmt(sub.canceled_at)}.`;
  }

  if (sub.cancel_at) {
    return `Subscription will cancel on ${fmt(sub.cancel_at)}.`;
  }

  if (sub.status === "trialing" && sub.trial_end) {
    const daysLeft = Math.max(
      0,
      Math.ceil(
        (new Date(sub.trial_end).getTime() - Date.now()) /
          (1000 * 60 * 60 * 24),
      ),
    );
    return `Trial ends on ${fmt(sub.trial_end)} (${daysLeft} day${daysLeft === 1 ? "" : "s"} left).`;
  }

  if (sub.status === "active" && sub.current_period_end) {
    return `Next billing date: ${fmt(sub.current_period_end)}.`;
  }

  if (sub.status === "past_due") {
    return "Your last payment failed. Please update your payment method.";
  }

  return null;
}
