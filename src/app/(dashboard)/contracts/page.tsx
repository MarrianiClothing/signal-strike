"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { getCache, setCache } from "@/lib/cache";

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);
  return isMobile;
}

interface ContractFile {
  name: string;
  metadata?: { size?: number };
  created_at?: string;
}

interface DealFolder {
  dealId: string;
  dealTitle: string;
  dealCompany: string;
  dealStage: string;
  files: ContractFile[];
}

const STAGE_COLORS: Record<string, string> = {
  prospecting: "#71717a", qualification: "#60a5fa", proposal: "#a78bfa",
  negotiation: "#fbbf24", closed_won: "#C9A84C", closed_lost: "#f87171",
};
const STAGE_LABELS: Record<string, string> = {
  prospecting: "Prospecting", qualification: "Qualified", proposal: "Proposal",
  negotiation: "Negotiation", closed_won: "Won", closed_lost: "Lost",
};

function fileIcon(name: string) {
  const ext = name.split(".").pop()?.toLowerCase() || "";
  if (ext === "pdf") return "📕";
  if (["doc","docx"].includes(ext)) return "📘";
  if (["xls","xlsx"].includes(ext)) return "📗";
  if (["png","jpg","jpeg"].includes(ext)) return "🖼️";
  return "📄";
}

function fmtSize(bytes?: number) {
  if (!bytes) return "";
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

function fmtDate(iso?: string) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function ContractsPage() {
  const router   = useRouter();
  const supabase = createClient();
  const isMobile = useIsMobile();

  const { userId: authUserId, ready: authReady } = useAuth();
  const [userId,   setUserId]   = useState(authUserId);
  const [folders,  setFolders]  = useState<DealFolder[]>(() => getCache<DealFolder[]>("contracts_folders") ?? []);
  const [loading,  setLoading]  = useState(!getCache<DealFolder[]>("contracts_folders"));
  const [search,   setSearch]   = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [totalFiles, setTotalFiles] = useState(() => {
    const cached = getCache<DealFolder[]>("contracts_folders");
    return cached ? cached.reduce((sum, f) => sum + f.files.length, 0) : 0;
  });

  useEffect(() => {
    if (authReady && authUserId) setUserId(authUserId);
  }, [authReady, authUserId]);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);

      // Load all deals for name/company lookup
      const { data: deals } = await supabase
        .from("deals")
        .select("id, title, company, stage")
        .eq("user_id", user.id);

      const dealMap: Record<string, { title: string; company: string; stage: string }> = {};
      for (const d of deals || []) {
        dealMap[d.id] = { title: d.title, company: d.company, stage: d.stage };
      }

      // Load all contract folders via server-side API
      const res  = await fetch(`/api/contracts/list?prefix=${user.id}&all=1`);
      const json = await res.json();

      const enriched: DealFolder[] = (json.folders || []).map((f: any) => ({
        dealId:      f.dealId,
        dealTitle:   dealMap[f.dealId]?.title   ?? "Unknown Deal",
        dealCompany: dealMap[f.dealId]?.company  ?? "",
        dealStage:   dealMap[f.dealId]?.stage    ?? "",
        files:       f.files,
      }));

      enriched.sort((a, b) => a.dealTitle.localeCompare(b.dealTitle));
      setFolders(enriched);
      setTotalFiles(enriched.reduce((sum, f) => sum + f.files.length, 0));
      setCache("contracts_folders", enriched);

      // Auto-expand if only one deal
      if (enriched.length === 1) {
        setExpanded(new Set([enriched[0].dealId]));
      }
      setLoading(false);
    }
    load();
  }, []);

  function getPublicUrl(dealId: string, fileName: string) {
    const { data } = supabase.storage
      .from("contracts")
      .getPublicUrl(`${userId}/${dealId}/${fileName}`);
    return data.publicUrl;
  }

  async function handleDelete(dealId: string, fileName: string) {
    if (!confirm(`Delete "${fileName.replace(/^\d+_/, "")}"? This cannot be undone.`)) return;
    const path = `${userId}/${dealId}/${fileName}`;
    const { error } = await supabase.storage.from("contracts").remove([path]);
    if (error) { alert("Delete failed: " + error.message); return; }
    setFolders(prev => prev
      .map(f => f.dealId === dealId
        ? { ...f, files: f.files.filter(c => c.name !== fileName) }
        : f
      )
      .filter(f => f.files.length > 0)
    );
    setTotalFiles(t => t - 1);
  }

  const filtered = folders.filter(f =>
    !search ||
    f.dealTitle.toLowerCase().includes(search.toLowerCase()) ||
    f.dealCompany.toLowerCase().includes(search.toLowerCase()) ||
    f.files.some(c => c.name.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div style={{ padding: isMobile ? 16 : 32, maxWidth: 1000 }}>

      {/* Header */}
      <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", justifyContent: "space-between", alignItems: isMobile ? "flex-start" : "center", gap: 16, marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: "1.6rem", fontWeight: 800, color: "#fafafa", marginBottom: 4, fontFamily: "var(--font-cinzel, serif)", letterSpacing: "0.06em", textTransform: "uppercase" }}>
            Contracts & Documents
          </h1>
          <p style={{ color: "#52525b", fontSize: "0.82rem", margin: 0 }}>
            {loading ? "Loading..." : `${totalFiles} file${totalFiles !== 1 ? "s" : ""} across ${folders.length} deal${folders.length !== 1 ? "s" : ""}`}
          </p>
        </div>

        {/* Search */}
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search deals or files..."
          style={{
            background: "#111113", border: "1px solid #27272a", borderRadius: 8,
            padding: "9px 14px", color: "#fafafa", fontSize: "0.85rem",
            width: isMobile ? "100%" : 260, outline: "none",
          }}
        />
      </div>

      {loading ? (
        <div style={{ color: "#52525b", fontSize: "0.9rem", padding: "48px 0", textAlign: "center" }}>
          Loading contracts...
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: "64px 0", color: "#3f3f46" }}>
          <div style={{ fontSize: "3rem", marginBottom: 12 }}>📁</div>
          <p style={{ fontSize: "0.95rem", margin: "0 0 6px", color: "#52525b" }}>
            {search ? "No results match your search" : "No contracts uploaded yet"}
          </p>
          <p style={{ fontSize: "0.8rem", margin: 0, color: "#3f3f46" }}>
            Attach files to deals from the Deal Detail page
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {filtered.map(folder => {
            const isOpen = expanded.has(folder.dealId);
            const stageColor = STAGE_COLORS[folder.dealStage] ?? "#71717a";
            return (
              <div key={folder.dealId} style={{ background: "#111113", border: "1px solid #27272a", borderRadius: 12, overflow: "hidden" }}>

                {/* Deal header row — click to expand */}
                <button
                  onClick={() => setExpanded(prev => {
                    const next = new Set(prev);
                    next.has(folder.dealId) ? next.delete(folder.dealId) : next.add(folder.dealId);
                    return next;
                  })}
                  style={{
                    width: "100%", display: "flex", alignItems: "center", gap: 12,
                    padding: "14px 18px", background: "none", border: "none",
                    cursor: "pointer", textAlign: "left",
                  }}
                >
                  {/* Chevron */}
                  <span style={{ color: "#52525b", fontSize: "0.7rem", flexShrink: 0, transition: "transform 0.2s", transform: isOpen ? "rotate(90deg)" : "rotate(0deg)" }}>▶</span>

                  {/* Deal info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <span style={{ color: "#fafafa", fontWeight: 700, fontSize: "0.9rem" }}>{folder.dealTitle}</span>
                      {folder.dealCompany && (
                        <span style={{ color: "#52525b", fontSize: "0.78rem" }}>· {folder.dealCompany}</span>
                      )}
                      {folder.dealStage && (
                        <span style={{
                          fontSize: "0.68rem", fontWeight: 600, padding: "2px 8px", borderRadius: 4,
                          color: stageColor, background: stageColor + "22",
                        }}>
                          {STAGE_LABELS[folder.dealStage] ?? folder.dealStage}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* File count badge */}
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                    <span style={{ background: "#1c1c1f", border: "1px solid #27272a", borderRadius: 6, padding: "3px 10px", color: "#a1a1aa", fontSize: "0.75rem", fontWeight: 600 }}>
                      {folder.files.length} file{folder.files.length !== 1 ? "s" : ""}
                    </span>
                    <button
                      onClick={e => { e.stopPropagation(); router.push(`/deals/${folder.dealId}`); }}
                      style={{
                        background: "#1c1c1f", border: "1px solid #27272a", borderRadius: 6,
                        padding: "4px 10px", color: "#71717a", fontSize: "0.72rem",
                        cursor: "pointer", whiteSpace: "nowrap",
                      }}
                    >
                      View Deal →
                    </button>
                  </div>
                </button>

                {/* File list */}
                {isOpen && (
                  <div style={{ borderTop: "1px solid #1c1c1f", padding: "8px 12px 12px" }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {folder.files.map(file => {
                        const rawName = file.name.replace(/^\d+_/, "");
                        const sizeStr = fmtSize(file.metadata?.size);
                        const dateStr = fmtDate(file.created_at);
                        return (
                          <div key={file.name} style={{
                            display: "flex", alignItems: "center", gap: 10,
                            padding: "10px 14px", background: "#18181b",
                            borderRadius: 8, border: "1px solid #27272a",
                          }}>
                            <span style={{ fontSize: "1.1rem", flexShrink: 0 }}>{fileIcon(rawName)}</span>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <p style={{ color: "#fafafa", fontSize: "0.85rem", fontWeight: 600, margin: "0 0 2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{rawName}</p>
                              <p style={{ color: "#52525b", fontSize: "0.72rem", margin: 0 }}>
                                {[sizeStr, dateStr].filter(Boolean).join(" · ")}
                              </p>
                            </div>
                            <a
                              href={getPublicUrl(folder.dealId, file.name)}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{
                                background: "#27272a", border: "none", color: "#a1a1aa",
                                borderRadius: 6, padding: "5px 10px", cursor: "pointer",
                                fontSize: "0.75rem", textDecoration: "none", flexShrink: 0,
                              }}
                            >
                              View
                            </a>
                            <a
                              href={getPublicUrl(folder.dealId, file.name)}
                              download={rawName}
                              style={{
                                background: "rgba(201,168,76,0.08)", border: "1px solid rgba(201,168,76,0.2)",
                                color: "#C9A84C", borderRadius: 6, padding: "5px 10px",
                                fontSize: "0.75rem", textDecoration: "none", flexShrink: 0,
                              }}
                            >
                              ↓
                            </a>
                            <button
                              onClick={() => handleDelete(folder.dealId, file.name)}
                              style={{
                                background: "rgba(248,113,113,0.08)", border: "none",
                                color: "#f87171", borderRadius: 6, padding: "5px 10px",
                                cursor: "pointer", fontSize: "0.75rem", flexShrink: 0,
                              }}
                            >
                              ✕
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
