"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ArrowLeft, X, Search } from "lucide-react";

const STAGE_LABELS: Record<string, string> = {
  lead: "Lead", contacted: "Contacted", qualified: "Qualified",
  proposal: "Proposal", negotiation: "Negotiation",
  closed_won: "Won", closed_lost: "Lost",
};
const STAGE_COLORS: Record<string, string> = {
  lead: "#71717a", contacted: "#6366f1", qualified: "#0ea5e9",
  proposal: "#f59e0b", negotiation: "#C9A84C",
  closed_won: "#4ade80", closed_lost: "#f87171",
};

const fmt = (n: number) =>
  n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(2)}M`
    : n >= 1_000 ? `$${(n / 1_000).toFixed(1)}K`
    : `$${n.toFixed(0)}`;

type ResultRow = {
  kind: "deal" | "project" | "expense" | "contract" | "team";
  id: string;
  title: string;
  subtitle?: string;
  pillLabel?: string;
  pillColor?: string;
  value?: number;
  href: string;
};

function initialsFor(s: string): string {
  return s.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]?.toUpperCase()).join("") || "?";
}

export default function SignalSearchModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const supabase = createClient();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  // Per-entity result buckets
  const [deals, setDeals] = useState<ResultRow[]>([]);
  const [projects, setProjects] = useState<ResultRow[]>([]);
  const [expenses, setExpenses] = useState<ResultRow[]>([]);
  const [contracts, setContracts] = useState<ResultRow[]>([]);
  const [team, setTeam] = useState<ResultRow[]>([]);

  // Get current user once
  useEffect(() => {
    let alive = true;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (alive) setUserId(user?.id ?? null);
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Autofocus + lock body scroll when open
  useEffect(() => {
    if (open) {
      const t = setTimeout(() => inputRef.current?.focus(), 240); // wait for slide-in
      document.body.style.overflow = "hidden";
      return () => {
        clearTimeout(t);
        document.body.style.overflow = "";
      };
    }
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Clear results when modal closes
  useEffect(() => {
    if (!open) {
      setQuery("");
      setDeals([]); setProjects([]); setExpenses([]); setContracts([]); setTeam([]);
    }
  }, [open]);

  // Run the search whenever query or userId changes
  const runSearch = useCallback(async (q: string) => {
    if (!userId || q.trim().length < 1) {
      setDeals([]); setProjects([]); setExpenses([]); setContracts([]); setTeam([]);
      return;
    }
    setLoading(true);
    const ilike = `%${q.trim()}%`;

    // Run all queries in parallel
    const [
      dealsRes,
      projectsRes,
      expensesRes,
      contractsRes,
      teamRes,
    ] = await Promise.all([
      // Deals — search title, company, contact_name, contact_email, notes
      supabase.from("deals")
        .select("id, title, company, contact_name, value, stage")
        .eq("user_id", userId)
        .or(`title.ilike.${ilike},company.ilike.${ilike},contact_name.ilike.${ilike},contact_email.ilike.${ilike},notes.ilike.${ilike}`)
        .limit(10),

      // Projects — search via joined deal (title, company) + wo_number
      // Note: we fetch broadly then filter client-side since cross-table OR is messy.
      supabase.from("projects")
        .select("id, wo_number, status, deals(title, company, value)")
        .eq("user_id", userId)
        .limit(50),

      // Expenses — search description, vendor
      supabase.from("expenses")
        .select("id, description, vendor, amount, expense_date")
        .eq("user_id", userId)
        .or(`description.ilike.${ilike},vendor.ilike.${ilike}`)
        .limit(10),

      // Contracts — fetch broadly, filter client-side (name field varies)
      supabase.from("contracts")
        .select("id, file_name, name, created_at")
        .eq("user_id", userId)
        .limit(50),

      // Team members — search via joined profile
      supabase.from("team_members")
        .select("user_id, role, profiles(full_name, email)")
        .limit(50),
    ]);

    const ql = q.trim().toLowerCase();

    // ---- Deals
    const dealRows: ResultRow[] = (dealsRes.data || []).map((d: any) => ({
      kind: "deal" as const,
      id: d.id,
      title: d.title || d.company || "(untitled deal)",
      subtitle: [d.company, d.contact_name].filter(Boolean).join(" · "),
      pillLabel: STAGE_LABELS[d.stage] || d.stage,
      pillColor: STAGE_COLORS[d.stage] || "#71717a",
      value: d.value,
      href: `/deals/${d.id}`,
    }));

    // ---- Projects (client-side filter)
    const projectRows: ResultRow[] = (projectsRes.data || [])
      .filter((p: any) => {
        const title = (p.deals?.title || "").toLowerCase();
        const company = (p.deals?.company || "").toLowerCase();
        const wo = String(p.wo_number || "").toLowerCase();
        return title.includes(ql) || company.includes(ql) || wo.includes(ql);
      })
      .slice(0, 10)
      .map((p: any) => ({
        kind: "project" as const,
        id: p.id,
        title: p.deals?.title || `WO #${p.wo_number}` || "(untitled job)",
        subtitle: [p.deals?.company, p.status].filter(Boolean).join(" · "),
        pillLabel: p.status || "active",
        pillColor: "#6366f1",
        value: p.deals?.value,
        href: `/projects/${p.id}`,
      }));

    // ---- Expenses
    const expenseRows: ResultRow[] = (expensesRes.data || []).map((e: any) => ({
      kind: "expense" as const,
      id: e.id,
      title: e.description || e.vendor || "(expense)",
      subtitle: [e.vendor, e.expense_date].filter(Boolean).join(" · "),
      value: e.amount,
      href: `/expenses`,
    }));

    // ---- Contracts (client-side filter)
    const contractRows: ResultRow[] = (contractsRes.data || [])
      .filter((c: any) => {
        const fn = (c.file_name || "").toLowerCase();
        const nm = (c.name || "").toLowerCase();
        return fn.includes(ql) || nm.includes(ql);
      })
      .slice(0, 10)
      .map((c: any) => ({
        kind: "contract" as const,
        id: c.id,
        title: c.name || c.file_name || "(contract)",
        subtitle: c.created_at ? new Date(c.created_at).toLocaleDateString() : undefined,
        href: `/contracts`,
      }));

    // ---- Team (client-side filter)
    const teamRows: ResultRow[] = (teamRes.data || [])
      .filter((t: any) => {
        const fn = (t.profiles?.full_name || "").toLowerCase();
        const em = (t.profiles?.email || "").toLowerCase();
        return fn.includes(ql) || em.includes(ql);
      })
      .slice(0, 10)
      .map((t: any) => ({
        kind: "team" as const,
        id: t.user_id,
        title: t.profiles?.full_name || t.profiles?.email || "(team member)",
        subtitle: [t.profiles?.email, t.role].filter(Boolean).join(" · "),
        pillLabel: t.role,
        pillColor: "#C9A84C",
        href: `/team`,
      }));

    setDeals(dealRows);
    setProjects(projectRows);
    setExpenses(expenseRows);
    setContracts(contractRows);
    setTeam(teamRows);
    setLoading(false);
  }, [userId, supabase]);

  // Debounce: re-run search 180ms after typing stops
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => { runSearch(query); }, 180);
    return () => clearTimeout(t);
  }, [query, open, runSearch]);

  const totalResults = deals.length + projects.length + expenses.length + contracts.length + team.length;

  const handleResultClick = (href: string) => {
    onClose();
    router.push(href);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        background: "#0a0a0b",
        transform: open ? "translateX(0)" : "translateX(100%)",
        transition: "transform 0.22s cubic-bezier(0.32, 0.72, 0, 1)",
        display: "flex", flexDirection: "column",
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "env(safe-area-inset-bottom)",
        pointerEvents: open ? "auto" : "none",
      }}
    >
      {/* Search bar */}
      <div style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: "12px 14px",
        background: "#0a0a0b",
        borderBottom: "1px solid #18181b",
      }}>
        <button
          onClick={onClose}
          aria-label="Close search"
          style={{
            width: 40, height: 40, borderRadius: 20,
            display: "flex", alignItems: "center", justifyContent: "center",
            background: "transparent", border: "none", cursor: "pointer",
            color: "#C9A84C", padding: 0, flexShrink: 0,
          }}
        ><ArrowLeft size={22} /></button>

        <div style={{
          flex: 1, position: "relative",
          background: "#18181b",
          border: "1px solid #27272a",
          borderRadius: 24,
          display: "flex", alignItems: "center",
          padding: "0 12px",
          height: 44,
        }}>
          <Search size={18} color="#52525b" style={{ flexShrink: 0, marginRight: 8 }} />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search deals, jobs, team, contracts..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            style={{
              flex: 1, minWidth: 0,
              background: "transparent", border: "none", outline: "none",
              color: "#fafafa", fontSize: "16px",
              fontFamily: "inherit",
            }}
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              aria-label="Clear search"
              style={{
                width: 28, height: 28, borderRadius: 14,
                display: "flex", alignItems: "center", justifyContent: "center",
                background: "transparent", border: "none", cursor: "pointer",
                color: "#71717a", padding: 0, flexShrink: 0,
              }}
            ><X size={16} /></button>
          )}
        </div>
      </div>

      {/* Results */}
      <div style={{ flex: 1, overflowY: "auto", padding: "8px 0 24px" }}>
        {query.trim().length < 1 ? (
          <div style={{ padding: "32px 24px", textAlign: "center", color: "#52525b", fontSize: "0.9rem" }}>
            Start typing to search across deals, jobs, expenses, contracts, and team.
          </div>
        ) : loading && totalResults === 0 ? (
          <div style={{ padding: "32px 24px", textAlign: "center", color: "#52525b", fontSize: "0.9rem" }}>
            Searching…
          </div>
        ) : totalResults === 0 ? (
          <div style={{ padding: "32px 24px", textAlign: "center", color: "#52525b", fontSize: "0.9rem" }}>
            No results for &ldquo;{query.trim()}&rdquo;.
          </div>
        ) : (
          <>
            <ResultSection title="Deals"     rows={deals}     onClick={handleResultClick} />
            <ResultSection title="Jobs"      rows={projects}  onClick={handleResultClick} />
            <ResultSection title="Expenses"  rows={expenses}  onClick={handleResultClick} />
            <ResultSection title="Contracts" rows={contracts} onClick={handleResultClick} />
            <ResultSection title="Team"      rows={team}      onClick={handleResultClick} />
          </>
        )}
      </div>
    </div>
  );
}

function ResultSection({
  title, rows, onClick,
}: {
  title: string; rows: ResultRow[]; onClick: (href: string) => void;
}) {
  if (rows.length === 0) return null;
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{
        padding: "10px 18px 6px",
        color: "#C9A84C",
        fontSize: "0.72rem",
        fontWeight: 700,
        letterSpacing: "0.12em",
        textTransform: "uppercase",
      }}>
        {title} <span style={{ color: "#52525b", fontWeight: 600 }}>({rows.length})</span>
      </div>
      {rows.map(row => (
        <button
          key={`${row.kind}-${row.id}`}
          onClick={() => onClick(row.href)}
          style={{
            display: "flex", alignItems: "center", gap: 12,
            width: "100%", padding: "12px 16px",
            background: "transparent", border: "none", borderBottom: "1px solid #111113",
            cursor: "pointer", textAlign: "left",
            transition: "background 0.12s",
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "#111113"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
        >
          <div style={{
            width: 40, height: 40, borderRadius: 20,
            background: "rgba(201,168,76,0.15)",
            color: "#C9A84C",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "0.78rem", fontWeight: 700, flexShrink: 0,
          }}>{initialsFor(row.title)}</div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              color: "#fafafa", fontSize: "0.95rem", fontWeight: 600,
              whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
            }}>{row.title}</div>
            {row.subtitle && (
              <div style={{
                color: "#71717a", fontSize: "0.78rem", marginTop: 2,
                whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
              }}>{row.subtitle}</div>
            )}
          </div>

          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, flexShrink: 0 }}>
            {row.pillLabel && (
              <span style={{
                padding: "3px 10px",
                borderRadius: 12,
                background: `${row.pillColor}22`,
                color: row.pillColor,
                fontSize: "0.7rem",
                fontWeight: 600,
                textTransform: "capitalize",
                whiteSpace: "nowrap",
              }}>{row.pillLabel}</span>
            )}
            {typeof row.value === "number" && row.value > 0 && (
              <span style={{
                color: "#C9A84C",
                fontSize: "0.88rem",
                fontWeight: 700,
                fontFamily: "var(--font-cinzel, serif)",
              }}>{fmt(row.value)}</span>
            )}
          </div>
        </button>
      ))}
    </div>
  );
}
