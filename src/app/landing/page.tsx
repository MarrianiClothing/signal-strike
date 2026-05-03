/**
 * Signal Strike — Public Marketing Landing Page
 * Route: /landing  (strike.hilltopave.com/landing)
 * No auth required. No sidebar layout.
 * All styles inline; animations/hover/media queries via a single <style> tag.
 */

export const metadata = {
  title: "Signal Strike — Turn signal into revenue.",
  description:
    "The revenue CRM that unifies pipeline, prospect intelligence, and AI-driven daily briefings. Built for teams that strike first.",
};

const GOLD = "#C9A84C";
const GOLD_HI = "#D4B65C";
const BG = "#0A0A0B";
const CARD = "#111113";
const BORDER = "#27272A";
const TEXT = "#FFFFFF";
const MUTED = "#A1A1AA";
const MUTED_2 = "#71717A";

export default function LandingPage() {
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;500;600;700&family=Montserrat:wght@300;400;500;600;700&display=swap');

        html, body { margin: 0; padding: 0; background: ${BG}; color: ${TEXT}; }
        * { box-sizing: border-box; }

        .ss-heading { font-family: 'Cinzel', serif; letter-spacing: 0.01em; }
        .ss-body    { font-family: 'Montserrat', sans-serif; }

        a { text-decoration: none; }

        /* Buttons */
        .ss-btn-primary { transition: all 0.2s ease; }
        .ss-btn-primary:hover {
          background: ${GOLD_HI} !important;
          transform: translateY(-1px);
          box-shadow: 0 10px 28px rgba(201, 168, 76, 0.32);
        }
        .ss-btn-secondary { transition: all 0.2s ease; }
        .ss-btn-secondary:hover {
          background: rgba(201, 168, 76, 0.08) !important;
          border-color: ${GOLD} !important;
          color: ${GOLD} !important;
        }
        .ss-btn-ghost { transition: color 0.2s ease; }
        .ss-btn-ghost:hover { color: ${GOLD} !important; }

        /* Nav links */
        .ss-nav-link { transition: color 0.2s ease; }
        .ss-nav-link:hover { color: ${GOLD} !important; }

        /* Cards */
        .ss-feature-card { transition: all 0.3s ease; }
        .ss-feature-card:hover {
          border-color: ${GOLD} !important;
          transform: translateY(-4px);
          box-shadow: 0 16px 48px rgba(0, 0, 0, 0.5);
        }
        .ss-pricing-card { transition: all 0.3s ease; }
        .ss-pricing-card:hover {
          border-color: ${GOLD} !important;
          transform: translateY(-4px);
        }

        /* Decorative gold dot */
        .ss-dot {
          width: 6px; height: 6px; border-radius: 50%;
          background: ${GOLD}; display: inline-block;
          box-shadow: 0 0 12px ${GOLD};
        }

        /* Hero glow */
        @keyframes ss-glow {
          0%, 100% { opacity: 0.35; }
          50%      { opacity: 0.55; }
        }
        .ss-hero-glow { animation: ss-glow 6s ease-in-out infinite; }

        /* Section transitions */
        .ss-divider {
          height: 1px;
          background: linear-gradient(90deg, transparent, ${BORDER}, transparent);
        }

        /* Mobile */
        @media (max-width: 960px) {
          .ss-hide-mobile { display: none !important; }
          .ss-nav { padding: 16px 20px !important; }
          .ss-hero { padding: 96px 20px 72px !important; }
          .ss-hero-title { font-size: 2.5rem !important; line-height: 1.15 !important; }
          .ss-hero-sub   { font-size: 1rem !important; }
          .ss-section { padding: 64px 20px !important; }
          .ss-section-title { font-size: 2rem !important; }
          .ss-grid-3 { grid-template-columns: 1fr !important; }
          .ss-grid-2 { grid-template-columns: 1fr !important; gap: 24px !important; }
          .ss-grid-4 { grid-template-columns: 1fr 1fr !important; }
          .ss-cta-row { flex-direction: column !important; align-items: stretch !important; }
          .ss-cta-row > a { width: 100% !important; text-align: center !important; }
          .ss-footer-grid { grid-template-columns: 1fr 1fr !important; gap: 32px !important; }
          .ss-pricing-card { padding: 28px !important; }
          .ss-cta-banner { padding: 40px 24px !important; }
          .ss-cta-banner-title { font-size: 1.75rem !important; }
        }

        @media (max-width: 520px) {
          .ss-grid-4 { grid-template-columns: 1fr !important; }
          .ss-footer-grid { grid-template-columns: 1fr !important; }
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
        {/* ═══════════════════════════ NAV ═══════════════════════════ */}
        <nav
          className="ss-nav"
          style={{
            position: "sticky",
            top: 0,
            zIndex: 50,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "18px 48px",
            background: "rgba(10, 10, 11, 0.82)",
            backdropFilter: "blur(14px)",
            WebkitBackdropFilter: "blur(14px)",
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
              style={{ height: 38, width: "auto", display: "block" }}
            />
            <span
              className="ss-heading"
              style={{
                fontSize: 18,
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

          <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
            <a
              href="#features"
              className="ss-nav-link ss-hide-mobile"
              style={{ color: MUTED, fontSize: 14, fontWeight: 500 }}
            >
              Features
            </a>
            <a
              href="#teams"
              className="ss-nav-link ss-hide-mobile"
              style={{ color: MUTED, fontSize: 14, fontWeight: 500 }}
            >
              For Teams
            </a>
            <a
              href="/login"
              className="ss-btn-ghost"
              style={{
                color: TEXT,
                fontSize: 14,
                fontWeight: 500,
              }}
            >
              Sign In
            </a>
            <a
              href="/trial"
              className="ss-btn-primary"
              style={{
                background: GOLD,
                color: BG,
                padding: "10px 20px",
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 600,
                letterSpacing: "0.01em",
              }}
            >
              Get Started
            </a>
          </div>
        </nav>

        {/* ═══════════════════════════ HERO ═══════════════════════════ */}
        <section
          className="ss-hero"
          style={{
            position: "relative",
            padding: "140px 48px 120px",
            textAlign: "center",
            maxWidth: 1200,
            margin: "0 auto",
          }}
        >
          {/* Radial gold glow */}
          <div
            className="ss-hero-glow"
            aria-hidden
            style={{
              position: "absolute",
              top: "-10%",
              left: "50%",
              transform: "translateX(-50%)",
              width: "80%",
              height: "70%",
              background:
                "radial-gradient(ellipse at center, rgba(201,168,76,0.18) 0%, rgba(201,168,76,0.06) 35%, transparent 70%)",
              filter: "blur(40px)",
              pointerEvents: "none",
              zIndex: 0,
            }}
          />
          <div style={{ position: "relative", zIndex: 1 }}>
            {/* Eyebrow badge */}
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
                marginBottom: 32,
              }}
            >
              <span className="ss-dot" />
              Revenue CRM • Built to Strike
            </div>

            <h1
              className="ss-heading ss-hero-title"
              style={{
                fontSize: "4.2rem",
                fontWeight: 600,
                lineHeight: 1.08,
                margin: "0 0 24px",
                letterSpacing: "-0.015em",
              }}
            >
              Turn signal into{" "}
              <span
                style={{
                  color: GOLD,
                  background: `linear-gradient(135deg, ${GOLD} 0%, ${GOLD_HI} 100%)`,
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}
              >
                revenue.
              </span>
            </h1>

            <p
              className="ss-hero-sub"
              style={{
                fontSize: "1.25rem",
                color: MUTED,
                maxWidth: 680,
                margin: "0 auto 48px",
                lineHeight: 1.6,
                fontWeight: 400,
              }}
            >
              The revenue CRM that unifies pipeline, prospect intelligence, and
              AI-driven daily briefings — so your team strikes first and closes more.
            </p>

            <div
              className="ss-cta-row"
              style={{
                display: "flex",
                gap: 16,
                justifyContent: "center",
                marginBottom: 24,
              }}
            >
              <a
                href="/trial"
                className="ss-btn-primary"
                style={{
                  background: GOLD,
                  color: BG,
                  padding: "16px 32px",
                  borderRadius: 10,
                  fontSize: 15,
                  fontWeight: 600,
                  letterSpacing: "0.01em",
                }}
              >
                Get Started Free →
              </a>
              <a
                href="#demo"
                className="ss-btn-secondary"
                style={{
                  background: "transparent",
                  color: TEXT,
                  padding: "16px 32px",
                  borderRadius: 10,
                  fontSize: 15,
                  fontWeight: 600,
                  border: `1px solid ${BORDER}`,
                }}
              >
                Watch Demo
              </a>
            </div>

            <p style={{ fontSize: 13, color: MUTED_2, margin: 0 }}>
              No credit card required · Cancel anytime
            </p>
          </div>
        </section>

        <div className="ss-divider" />

        {/* ═══════════════════════════ FEATURES ═══════════════════════════ */}
        <section
          id="features"
          className="ss-section"
          style={{
            padding: "120px 48px",
            maxWidth: 1200,
            margin: "0 auto",
          }}
        >
          <div style={{ textAlign: "center", marginBottom: 72 }}>
            <div
              style={{
                fontSize: 12,
                fontWeight: 600,
                letterSpacing: "0.18em",
                color: GOLD,
                textTransform: "uppercase",
                marginBottom: 16,
              }}
            >
              Platform
            </div>
            <h2
              className="ss-heading ss-section-title"
              style={{
                fontSize: "2.75rem",
                fontWeight: 600,
                lineHeight: 1.15,
                margin: "0 0 20px",
                letterSpacing: "-0.01em",
              }}
            >
              Everything you need to strike first.
            </h2>
            <p
              style={{
                fontSize: "1.1rem",
                color: MUTED,
                maxWidth: 600,
                margin: "0 auto",
                lineHeight: 1.6,
              }}
            >
              Six pillars. One platform. Zero noise.
            </p>
          </div>

          <div
            className="ss-grid-3"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: 20,
            }}
          >
            <FeatureCard
              icon="◆"
              title="Pipeline"
              body="See every deal, every stage, every signal. A pipeline that actually reflects how revenue moves — drag, drop, close."
            />
            <FeatureCard
              icon="◈"
              title="Deals"
              body="Full lifecycle tracking from first touch to signed contract. Every interaction, every document, every dollar."
            />
            <FeatureCard
              icon="◇"
              title="Prospects"
              body="HillTop-powered prospect finder with live enrichment. Build targeted hit lists in seconds, not hours."
            />
            <FeatureCard
              icon="✦"
              title="Daily Signal"
              body="AI-generated morning briefing delivered to your inbox with PDF + Excel attachments. Wake up knowing exactly where to strike."
            />
            <FeatureCard
              icon="◉"
              title="Team Management"
              body="Manager dashboards with rolled-up pipeline across the org. Visibility up the chain without killing rep autonomy."
            />
            <FeatureCard
              icon="✧"
              title="Ask Signal AI"
              body="Chat with your entire book of business. Natural-language queries over live CRM data — answers in seconds."
            />
          </div>
        </section>

        <div className="ss-divider" />

        {/* ═══════════════════════════ TEAMS ═══════════════════════════ */}
        <section
          id="teams"
          className="ss-section"
          style={{
            padding: "120px 48px",
            maxWidth: 1200,
            margin: "0 auto",
          }}
        >
          <div
            className="ss-grid-2"
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 64,
              alignItems: "center",
            }}
          >
            <div>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  letterSpacing: "0.18em",
                  color: GOLD,
                  textTransform: "uppercase",
                  marginBottom: 16,
                }}
              >
                For Revenue Teams
              </div>
              <h2
                className="ss-heading ss-section-title"
                style={{
                  fontSize: "2.5rem",
                  fontWeight: 600,
                  lineHeight: 1.15,
                  margin: "0 0 24px",
                  letterSpacing: "-0.01em",
                }}
              >
                Built for revenue teams.
              </h2>
              <p
                style={{
                  fontSize: "1.05rem",
                  color: MUTED,
                  lineHeight: 1.7,
                  margin: "0 0 32px",
                }}
              >
                Signal Strike scales from a solo seller to a full revenue org.
                Manager dashboards roll up every rep&apos;s pipeline, surface
                at-risk deals, and benchmark performance — giving leaders the
                visibility they need without the micromanagement reps hate.
              </p>
              <ul style={{ listStyle: "none", padding: 0, margin: "0 0 32px" }}>
                {[
                  "Team rollups with manager-scoped visibility",
                  "Rep autonomy preserved — no forced updates",
                  "Performance benchmarking across the team",
                  "Row-level security on every query",
                ].map((item) => (
                  <li
                    key={item}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 12,
                      padding: "10px 0",
                      fontSize: 15,
                      color: TEXT,
                    }}
                  >
                    <span
                      style={{
                        color: GOLD,
                        fontSize: 14,
                        marginTop: 2,
                        fontWeight: 700,
                      }}
                    >
                      ✓
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
              <a
                href="/trial"
                className="ss-btn-primary"
                style={{
                  display: "inline-block",
                  background: GOLD,
                  color: BG,
                  padding: "14px 28px",
                  borderRadius: 10,
                  fontSize: 15,
                  fontWeight: 600,
                }}
              >
                Deploy to your team →
              </a>
            </div>

            {/* Manager dashboard callout card */}
            <div
              style={{
                background: CARD,
                border: `1px solid ${BORDER}`,
                borderRadius: 16,
                padding: 32,
                position: "relative",
                overflow: "hidden",
              }}
            >
              <div
                aria-hidden
                style={{
                  position: "absolute",
                  top: -40,
                  right: -40,
                  width: 180,
                  height: 180,
                  background:
                    "radial-gradient(circle, rgba(201,168,76,0.2) 0%, transparent 70%)",
                  pointerEvents: "none",
                }}
              />
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  marginBottom: 20,
                  position: "relative",
                }}
              >
                <span className="ss-dot" />
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    letterSpacing: "0.16em",
                    color: GOLD,
                    textTransform: "uppercase",
                  }}
                >
                  Manager Dashboard
                </span>
              </div>
              <h3
                className="ss-heading"
                style={{
                  fontSize: "1.4rem",
                  fontWeight: 600,
                  margin: "0 0 24px",
                  position: "relative",
                }}
              >
                Your team&apos;s pipeline, rolled up.
              </h3>

              {/* Mock stat rows */}
              {[
                { label: "Team Pipeline", value: "$4.2M", delta: "+18%" },
                { label: "Active Deals", value: "127", delta: "+12" },
                { label: "Close Rate (30d)", value: "34%", delta: "+4pt" },
                { label: "Reps Above Quota", value: "6 / 8", delta: "75%" },
              ].map((row) => (
                <div
                  key={row.label}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "14px 0",
                    borderTop: `1px solid ${BORDER}`,
                    position: "relative",
                  }}
                >
                  <span style={{ fontSize: 13, color: MUTED }}>{row.label}</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span
                      className="ss-heading"
                      style={{
                        fontSize: 18,
                        fontWeight: 600,
                        color: TEXT,
                      }}
                    >
                      {row.value}
                    </span>
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: GOLD,
                        padding: "3px 8px",
                        background: "rgba(201, 168, 76, 0.1)",
                        borderRadius: 6,
                      }}
                    >
                      {row.delta}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <div className="ss-divider" />

        {/* ═══════════════════════════ CTA BANNER ═══════════════════════════ */}
        <section
          className="ss-section"
          style={{ padding: "80px 48px", maxWidth: 1200, margin: "0 auto" }}
        >
          <div
            className="ss-cta-banner"
            style={{
              background: `linear-gradient(135deg, ${CARD} 0%, #0C0C0E 100%)`,
              border: `1px solid ${GOLD}`,
              borderRadius: 20,
              padding: "72px 48px",
              textAlign: "center",
              position: "relative",
              overflow: "hidden",
              boxShadow: "0 20px 60px rgba(201, 168, 76, 0.08)",
            }}
          >
            <div
              aria-hidden
              style={{
                position: "absolute",
                inset: 0,
                background:
                  "radial-gradient(ellipse at top, rgba(201,168,76,0.12) 0%, transparent 60%)",
                pointerEvents: "none",
              }}
            />
            <div style={{ position: "relative" }}>
              <h2
                className="ss-heading ss-cta-banner-title"
                style={{
                  fontSize: "2.5rem",
                  fontWeight: 600,
                  lineHeight: 1.15,
                  margin: "0 0 16px",
                  letterSpacing: "-0.01em",
                }}
              >
                Ready to strike first?
              </h2>
              <p
                style={{
                  fontSize: "1.1rem",
                  color: MUTED,
                  maxWidth: 540,
                  margin: "0 auto 36px",
                  lineHeight: 1.6,
                }}
              >
                Start your free trial today. No credit card, no contracts,
                no noise — just the signal you need to close.
              </p>
              <div
                className="ss-cta-row"
                style={{
                  display: "flex",
                  gap: 14,
                  justifyContent: "center",
                }}
              >
                <a
                  href="/trial"
                  className="ss-btn-primary"
                  style={{
                    background: GOLD,
                    color: BG,
                    padding: "16px 32px",
                    borderRadius: 10,
                    fontSize: 15,
                    fontWeight: 600,
                  }}
                >
                  Get Started Free →
                </a>
                <a
                  href="/login"
                  className="ss-btn-secondary"
                  style={{
                    background: "transparent",
                    color: TEXT,
                    padding: "16px 32px",
                    borderRadius: 10,
                    fontSize: 15,
                    fontWeight: 600,
                    border: `1px solid ${BORDER}`,
                  }}
                >
                  Sign In
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* ═══════════════════════════ FOOTER ═══════════════════════════ */}
        <footer
          style={{
            borderTop: `1px solid ${BORDER}`,
            padding: "56px 48px 40px",
            background: BG,
          }}
        >
          <div style={{ maxWidth: 1200, margin: "0 auto" }}>
            <div
              className="ss-footer-grid"
              style={{
                display: "grid",
                gridTemplateColumns: "2fr 1fr 1fr 1fr",
                gap: 48,
                marginBottom: 48,
              }}
            >
              <div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    marginBottom: 16,
                  }}
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
                </div>
                <p
                  style={{
                    fontSize: 14,
                    color: MUTED,
                    lineHeight: 1.6,
                    margin: "0 0 16px",
                    maxWidth: 320,
                  }}
                >
                  The revenue CRM built for teams that strike first.
                </p>
                <p
                  style={{
                    fontSize: 12,
                    color: MUTED_2,
                    margin: 0,
                  }}
                >
                  A product of Hilltop Ave LLC
                </p>
              </div>

              <FooterCol
                title="Product"
                links={[
                  { label: "Features", href: "#features" },
                  { label: "For Teams", href: "#teams" },
                  { label: "Demo", href: "#demo" },
                ]}
              />
              <FooterCol
                title="Company"
                links={[
                  { label: "About", href: "#" },
                  { label: "Contact", href: "mailto:consulting@hilltopave.com" },
                  { label: "Hilltop Ave", href: "https://hilltopave.com" },
                ]}
              />
              <FooterCol
                title="Legal"
                links={[
                  { label: "Privacy", href: "/privacy" },
                  { label: "Terms", href: "/terms" },
                ]}
              />
            </div>

            <div
              style={{
                borderTop: `1px solid ${BORDER}`,
                paddingTop: 24,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: 16,
              }}
            >
              <div style={{ fontSize: 12, color: MUTED_2 }}>
                © {new Date().getFullYear()} Hilltop Ave LLC. All rights reserved.
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: MUTED_2 }}>
                <span className="ss-dot" />
                <span>Signal Strike · strike.hilltopave.com</span>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}

/* ─────────────────────────── Subcomponents ─────────────────────────── */

function FeatureCard({
  icon,
  title,
  body,
}: {
  icon: string;
  title: string;
  body: string;
}) {
  return (
    <div
      className="ss-feature-card"
      style={{
        background: CARD,
        border: `1px solid ${BORDER}`,
        borderRadius: 14,
        padding: 32,
      }}
    >
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: 10,
          background: "rgba(201, 168, 76, 0.08)",
          border: `1px solid ${BORDER}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: GOLD,
          fontSize: 20,
          marginBottom: 20,
        }}
      >
        {icon}
      </div>
      <h3
        className="ss-heading"
        style={{
          fontSize: "1.2rem",
          fontWeight: 600,
          margin: "0 0 10px",
          color: TEXT,
        }}
      >
        {title}
      </h3>
      <p
        style={{
          fontSize: 14,
          color: MUTED,
          lineHeight: 1.65,
          margin: 0,
        }}
      >
        {body}
      </p>
    </div>
  );
}

function FooterCol({
  title,
  links,
}: {
  title: string;
  links: { label: string; href: string }[];
}) {
  return (
    <div>
      <div
        style={{
          fontSize: 12,
          fontWeight: 600,
          letterSpacing: "0.14em",
          color: TEXT,
          textTransform: "uppercase",
          marginBottom: 16,
        }}
      >
        {title}
      </div>
      <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {links.map((l) => (
          <li key={l.label} style={{ marginBottom: 10 }}>
            <a
              href={l.href}
              className="ss-nav-link"
              style={{ fontSize: 14, color: MUTED }}
            >
              {l.label}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
