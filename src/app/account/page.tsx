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

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#0A0A0B",
        color: "#FAFAFA",
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@600&family=Montserrat:wght@400;500;600&display=swap');
      `}</style>

      <Nav email={user.email ?? ""} />

      <div
        style={{
          maxWidth: "880px",
          margin: "0 auto",
          padding: "64px 32px",
        }}
      >
        <h1
          style={{
            fontSize: "32px",
            fontWeight: 600,
            marginBottom: "8px",
            fontFamily: "Cinzel, serif",
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
          {user.email}
        </p>

        {subscription ? (
          <SubscriptionCard subscription={subscription} />
        ) : (
          <NoSubscriptionCard />
        )}
      </div>
    </main>
  );
}

function Nav({ email }: { email: string }) {
  return (
    <nav
      style={{
        borderBottom: "1px solid #27272A",
        padding: "20px 32px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      <div
        style={{
          fontFamily: "Cinzel, serif",
          fontSize: "20px",
          letterSpacing: "0.16em",
          textTransform: "uppercase",
        }}
      >
        SIGNAL <span style={{ color: "#C9A84C" }}>STRIKE</span>
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "16px",
          fontSize: "14px",
          color: "#A1A1AA",
        }}
      >
        <span>{email}</span>
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
      style={{
        background: "#111113",
        border: "1px solid #27272A",
        borderRadius: "12px",
        padding: "32px",
      }}
    >
      <div
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
      style={{
        background: "#111113",
        border: "1px solid #27272A",
        borderRadius: "12px",
        padding: "32px",
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
