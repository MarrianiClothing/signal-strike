/**
 * Signal Strike — Trial Checkout Success Page
 * Route: /trial/success
 *
 * Shown after Stripe-hosted Checkout completes. The Supabase user
 * account creation happens via webhook (Session 4) — typically by the
 * time this page renders, but it can take a few seconds either way.
 */

const GOLD = "#C9A84C";
const BG = "#0A0A0B";
const CARD = "#111113";
const BORDER = "#27272A";
const TEXT = "#FFFFFF";
const MUTED = "#A1A1AA";

export const metadata = {
  title: "Welcome to Signal Strike",
  description: "Your trial is active. Check your email to set up your account.",
};

export default function TrialSuccessPage() {
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;500;600;700&family=Montserrat:wght@300;400;500;600;700&display=swap');
        html, body { margin: 0; padding: 0; background: ${BG}; color: ${TEXT}; }
        * { box-sizing: border-box; }
        .ss-heading { font-family: 'Cinzel', serif; letter-spacing: 0.01em; }
        .ss-body    { font-family: 'Montserrat', sans-serif; }
        a { text-decoration: none; transition: all 0.2s ease; }
        .ss-cta:hover {
          background: #D4B65C !important;
          transform: translateY(-1px);
          box-shadow: 0 10px 28px rgba(201, 168, 76, 0.32);
        }
      `}</style>

      <div
        className="ss-body"
        style={{
          background: BG,
          color: TEXT,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "48px 24px",
        }}
      >
        <div
          style={{
            background: CARD,
            border: `1px solid ${BORDER}`,
            borderRadius: 20,
            padding: "56px 48px",
            maxWidth: 560,
            width: "100%",
            textAlign: "center",
            position: "relative",
            overflow: "hidden",
          }}
        >
          <div
            aria-hidden
            style={{
              position: "absolute",
              top: -60,
              left: "50%",
              transform: "translateX(-50%)",
              width: 240,
              height: 240,
              background:
                "radial-gradient(circle, rgba(201,168,76,0.18) 0%, transparent 70%)",
              pointerEvents: "none",
            }}
          />

          <div
            aria-hidden
            style={{
              width: 64,
              height: 64,
              borderRadius: "50%",
              background: "rgba(201, 168, 76, 0.12)",
              border: `1px solid ${GOLD}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 24px",
              color: GOLD,
              fontSize: 28,
              fontWeight: 600,
              position: "relative",
            }}
          >
            ✓
          </div>

          <h1
            className="ss-heading"
            style={{
              fontSize: "2rem",
              fontWeight: 600,
              margin: "0 0 16px",
              letterSpacing: "-0.005em",
              position: "relative",
            }}
          >
            Welcome to{" "}
            <span style={{ color: GOLD }}>Signal Strike</span>.
          </h1>

          <p
            style={{
              fontSize: "1rem",
              color: MUTED,
              lineHeight: 1.65,
              margin: "0 0 32px",
              position: "relative",
            }}
          >
            Your trial is active. We just emailed you a link to set up your
            password and sign in. If it doesn't arrive in a minute or two,
            check your spam folder or reach out to support.
          </p>

          <a
            href="/login"
            className="ss-cta"
            style={{
              display: "inline-block",
              background: GOLD,
              color: BG,
              padding: "14px 32px",
              borderRadius: 10,
              fontSize: 15,
              fontWeight: 600,
              fontFamily: "'Montserrat', sans-serif",
              position: "relative",
            }}
          >
            Go to Sign In →
          </a>

          <div
            style={{
              marginTop: 32,
              paddingTop: 24,
              borderTop: `1px solid ${BORDER}`,
              fontSize: 12,
              color: MUTED,
              lineHeight: 1.6,
              position: "relative",
            }}
          >
            You were charged $1.00 today. Your standard monthly subscription
            begins on day 15. You can cancel anytime from your account
            settings.
          </div>
        </div>
      </div>
    </>
  );
}
