"use client";

/**
 * Signal Strike — Manage Billing button (client component)
 *
 * Lives inside the server-rendered /account page. When clicked, calls
 * POST /api/stripe/portal which returns the Stripe-hosted portal URL,
 * then window.location's the user there.
 */

import { useState } from "react";

export function ManageBillingButton() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/stripe/portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const data: { url?: string; error?: string } = await res.json();

      if (!res.ok || !data.url) {
        throw new Error(data.error ?? `Portal request failed (${res.status})`);
      }

      window.location.href = data.url;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unexpected error";
      setError(message);
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        style={{
          background: "#C9A84C",
          color: "#0A0A0B",
          border: "none",
          padding: "12px 24px",
          borderRadius: "8px",
          fontWeight: 600,
          fontSize: "15px",
          cursor: loading ? "not-allowed" : "pointer",
          opacity: loading ? 0.6 : 1,
          fontFamily: "inherit",
          display: "inline-flex",
          alignItems: "center",
          gap: "8px",
        }}
      >
        {loading ? "Opening portal…" : "Manage billing →"}
      </button>
      {error && (
        <p
          style={{
            color: "#FCA5A5",
            fontSize: "13px",
            marginTop: "12px",
          }}
        >
          {error}
        </p>
      )}
    </div>
  );
}
