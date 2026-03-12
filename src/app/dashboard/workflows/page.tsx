"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Workflow, ArrowRight, Trash2, ExternalLink, Clock, Sparkles, Box, Image as ImageIcon, Search, FileText, Layers, Zap, FolderOpen, ChevronRight } from "lucide-react";
import { Header } from "@/components/dashboard/Header";
import { api, type WorkflowSummary } from "@/lib/api";
import { formatRelativeTime } from "@/lib/utils";
import { toast } from "sonner";
import { useSession } from "next-auth/react";
import { STRIPE_PLANS } from "@/lib/stripe";

// ─── Workflow type detection ─────────────────────────────────────────────────
type WfType = { key: string; color: string; icon: React.ReactNode; label: string };

function getWorkflowType(name: string): WfType {
  const n = name.toLowerCase();
  if (n.includes("pdf") || n.includes("report") || n.includes("document"))
    return { key: "pdf", color: "#F59E0B", icon: <FileText size={13} color="#F59E0B" />, label: "PDF Reports" };
  if (n.includes("floor plan") || n.includes("2d") || n.includes("floorplan"))
    return { key: "floorplan", color: "#10B981", icon: <Layers size={13} color="#10B981" />, label: "Floor Plans" };
  if (n.includes("render") || n.includes("concept") || n.includes("image"))
    return { key: "render", color: "#8B5CF6", icon: <ImageIcon size={13} color="#8B5CF6" />, label: "Renders" };
  if (n.includes("full pipeline") || n.includes("complete"))
    return { key: "pipeline", color: "#EC4899", icon: <Sparkles size={13} color="#EC4899" />, label: "Full Pipeline" };
  if (n.includes("3d") || n.includes("massing") || n.includes("model"))
    return { key: "3d", color: "#06B6D4", icon: <Box size={13} color="#06B6D4" />, label: "3D Models" };
  return { key: "custom", color: "#00F5FF", icon: <Zap size={13} color="#00F5FF" />, label: "My Workflows" };
}

// Group workflows: template types with 2+ workflows get sections, rest go flat
function groupWorkflows(wfs: WorkflowSummary[]): { grouped: { type: WfType; items: WorkflowSummary[] }[]; ungrouped: WorkflowSummary[] } {
  const byKey = new Map<string, { type: WfType; items: WorkflowSummary[] }>();
  for (const wf of wfs) {
    const t = getWorkflowType(wf.name);
    if (!byKey.has(t.key)) byKey.set(t.key, { type: t, items: [] });
    byKey.get(t.key)!.items.push(wf);
  }
  const grouped: { type: WfType; items: WorkflowSummary[] }[] = [];
  const ungrouped: WorkflowSummary[] = [];
  for (const [, group] of byKey) {
    if (group.type.key === "custom" || group.items.length < 2) {
      ungrouped.push(...group.items);
    } else {
      grouped.push(group);
    }
  }
  return { grouped, ungrouped };
}

export default function WorkflowsPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [workflows, setWorkflows] = useState<WorkflowSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  const userRole = (session?.user as { role?: string })?.role || "FREE";
  const maxWorkflows = STRIPE_PLANS.FREE.limits.maxWorkflows;
  const isAtLimit = userRole === "FREE" && workflows.length >= maxWorkflows;

  const handleNewWorkflow = useCallback(() => {
    if (isAtLimit) {
      toast.error(`Free plan allows up to ${maxWorkflows} workflows. Upgrade to Pro for unlimited workflows.`, {
        action: {
          label: "Upgrade",
          onClick: () => router.push("/dashboard/billing"),
        },
        duration: 6000,
      });
      return;
    }
    router.push("/dashboard/workflows/new");
  }, [isAtLimit, maxWorkflows, router]);

  const load = useCallback(async () => {
    try {
      const { workflows } = await api.workflows.list();
      setWorkflows(workflows);
    } catch {
      // User not authenticated or server error — silent fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    try {
      await api.workflows.delete(id);
      setWorkflows(prev => prev.filter(w => w.id !== id));
      toast.success("Workflow deleted");
    } catch {
      toast.error("Failed to delete workflow");
    }
  }

  const filteredWorkflows = workflows.filter(wf =>
    wf.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const { grouped, ungrouped } = useMemo(() => groupWorkflows(filteredWorkflows), [filteredWorkflows]);

  // Render a single workflow card
  function renderCard(wf: WorkflowSummary, idx: number) {
    const wfType = getWorkflowType(wf.name);
    return (
      <motion.div
        key={wf.id}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: Math.min(idx * 0.03, 0.5), duration: 0.3 }}
        style={{
          background: "rgba(255,255,255,0.02)",
          border: "1px solid rgba(255,255,255,0.06)",
          borderRadius: 12, padding: 16, cursor: "pointer",
          transition: "all 0.2s ease",
          display: "flex", flexDirection: "column", gap: 10,
        }}
        onMouseEnter={e => {
          const el = e.currentTarget as HTMLElement;
          el.style.borderColor = `${wfType.color}25`;
          el.style.background = "rgba(255,255,255,0.04)";
          el.style.transform = "translateY(-1px)";
          el.style.boxShadow = `0 4px 20px rgba(0,0,0,0.25)`;
        }}
        onMouseLeave={e => {
          const el = e.currentTarget as HTMLElement;
          el.style.borderColor = "rgba(255,255,255,0.06)";
          el.style.background = "rgba(255,255,255,0.02)";
          el.style.transform = "translateY(0)";
          el.style.boxShadow = "none";
        }}
        onClick={() => router.push(`/dashboard/canvas?id=${wf.id}`)}
      >
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 0 }}>
            <div style={{
              width: 34, height: 34, borderRadius: 9, flexShrink: 0,
              background: `${wfType.color}12`,
              border: `1px solid ${wfType.color}20`,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              {wfType.icon}
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{
                fontSize: 13, fontWeight: 600, color: "#F0F0F5",
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>
                {wf.name}
              </div>
              {wf.description && (
                <div style={{
                  fontSize: 11, color: "#5C5C78", marginTop: 1,
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>
                  {wf.description}
                </div>
              )}
            </div>
          </div>

          <div style={{ display: "flex", gap: 3, flexShrink: 0 }}>
            <button
              onClick={e => { e.stopPropagation(); router.push(`/dashboard/canvas?id=${wf.id}`); }}
              style={{
                width: 26, height: 26, borderRadius: 6, border: "1px solid rgba(255,255,255,0.06)",
                background: "transparent", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "#5C5C78", transition: "all 0.15s ease",
              }}
              onMouseEnter={e => { e.currentTarget.style.color = "#00F5FF"; e.currentTarget.style.borderColor = "rgba(0,245,255,0.3)"; }}
              onMouseLeave={e => { e.currentTarget.style.color = "#5C5C78"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)"; }}
              title="Open in canvas"
            >
              <ExternalLink size={11} />
            </button>
            <button
              onClick={e => { e.stopPropagation(); handleDelete(wf.id, wf.name); }}
              style={{
                width: 26, height: 26, borderRadius: 6, border: "1px solid rgba(255,255,255,0.06)",
                background: "transparent", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "#5C5C78", transition: "all 0.15s ease",
              }}
              onMouseEnter={e => { e.currentTarget.style.color = "#EF4444"; e.currentTarget.style.borderColor = "rgba(239,68,68,0.3)"; }}
              onMouseLeave={e => { e.currentTarget.style.color = "#5C5C78"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)"; }}
              title="Delete"
            >
              <Trash2 size={11} />
            </button>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, color: "#4A4A60" }}>
            <Clock size={9} />
            {formatRelativeTime(new Date(wf.updatedAt))}
          </div>
          <span style={{ color: "rgba(255,255,255,0.06)" }}>·</span>
          <div style={{ fontSize: 10, color: "#4A4A60" }}>
            {wf._count.executions} run{wf._count.executions !== 1 ? "s" : ""}
          </div>
          {wf.isPublished && (
            <>
              <span style={{ color: "rgba(255,255,255,0.06)" }}>·</span>
              <div style={{ fontSize: 9, color: "#10B981", fontWeight: 600 }}>Published</div>
            </>
          )}
        </div>
      </motion.div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ position: "relative" }}>
      {/* Subtle ambient glow */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none", zIndex: 0,
        background: "radial-gradient(ellipse 60% 40% at 15% 5%, rgba(0,245,255,0.03) 0%, transparent 70%)",
      }} />

      <Header
        title="My Workflows"
        subtitle="Your personal workflow workspace"
      />

      <main className="flex-1 overflow-y-auto p-6" style={{ position: "relative", zIndex: 1 }}>
        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "80px 0", gap: 14 }}>
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
              style={{
                width: 36, height: 36, borderRadius: 10,
                border: "2px solid rgba(0,245,255,0.12)",
                borderTopColor: "#00F5FF",
              }}
            />
            <div style={{ fontSize: 13, color: "#5C5C78" }}>Loading workflows…</div>
          </div>
        ) : workflows.length === 0 ? (
          /* ── Empty State ──────────────────────────────────────────────── */
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="flex flex-col items-center justify-center py-16 text-center"
          >
            <div style={{
              width: 72, height: 72, borderRadius: 20,
              background: "rgba(0,245,255,0.05)",
              border: "1px solid rgba(0,245,255,0.12)",
              display: "flex", alignItems: "center", justifyContent: "center",
              marginBottom: 20,
            }}>
              <FolderOpen size={28} style={{ color: "rgba(0,245,255,0.4)" }} strokeWidth={1.2} />
            </div>
            <h3 style={{ fontSize: 18, fontWeight: 700, color: "#F0F0F5", marginBottom: 6 }}>
              Try Your First Workflow
            </h3>
            <p style={{ fontSize: 13, color: "#5C5C78", maxWidth: 400, lineHeight: 1.6, marginBottom: 24 }}>
              Start with a template below, or build your own from scratch. Each workflow runs in under 2 minutes.
            </p>
            <div className="flex items-center gap-3 mb-8">
              <button
                onClick={handleNewWorkflow}
                style={{
                  display: "flex", alignItems: "center", gap: 7,
                  padding: "9px 20px", borderRadius: 10,
                  background: "linear-gradient(135deg, #00F5FF 0%, #0EA5E9 100%)",
                  color: "#0a0c10", fontSize: 13, fontWeight: 700,
                  border: "none", cursor: "pointer",
                  boxShadow: "0 0 16px rgba(0,245,255,0.15)",
                  transition: "all 0.2s ease",
                }}
                onMouseEnter={e => { e.currentTarget.style.boxShadow = "0 0 24px rgba(0,245,255,0.3)"; e.currentTarget.style.transform = "translateY(-1px)"; }}
                onMouseLeave={e => { e.currentTarget.style.boxShadow = "0 0 16px rgba(0,245,255,0.15)"; e.currentTarget.style.transform = "translateY(0)"; }}
              >
                <Plus size={14} strokeWidth={2.5} />
                New Workflow
              </button>
              <Link
                href="/dashboard/templates"
                className="flex items-center gap-2 rounded-lg border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.03)] px-4 py-2.5 text-sm font-medium text-[#F0F0F5] hover:border-[rgba(0,245,255,0.15)] hover:bg-[rgba(0,245,255,0.03)] transition-all"
                style={{ textDecoration: "none" }}
              >
                Browse Templates
                <ArrowRight size={13} />
              </Link>
            </div>

            {/* Quick-start template suggestions */}
            <div style={{ width: "100%", maxWidth: 640 }}>
              <p style={{ fontSize: 11, color: "#5C5C78", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600, marginBottom: 12 }}>
                Popular starting points
              </p>
              <div className="workflows-page-templates" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                {[
                  { label: "Brief → 3D Concept", desc: "Analyze a brief and generate 3D massing", icon: <Box size={16} className="text-[#8B5CF6]" />, color: "#8B5CF6", rgb: "139,92,246" },
                  { label: "Brief → Render", desc: "Go from project brief to AI concept render", icon: <ImageIcon size={16} className="text-[#10B981]" />, color: "#10B981", rgb: "16,185,129" },
                  { label: "Brief → Full Pipeline", desc: "Brief analysis, massing, render, and BOQ", icon: <Sparkles size={16} className="text-[#F59E0B]" />, color: "#F59E0B", rgb: "245,158,11" },
                ].map((tpl, i) => (
                  <Link
                    key={i}
                    href="/dashboard/templates"
                    style={{
                      display: "block",
                      background: "rgba(255,255,255,0.02)",
                      border: "1px solid rgba(255,255,255,0.06)",
                      borderRadius: 10,
                      padding: "14px 12px",
                      textAlign: "left",
                      textDecoration: "none",
                      transition: "all 0.15s ease",
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = `rgba(${tpl.rgb},0.25)`; e.currentTarget.style.background = `rgba(${tpl.rgb},0.03)`; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)"; e.currentTarget.style.background = "rgba(255,255,255,0.02)"; }}
                  >
                    <div style={{ marginBottom: 8 }}>{tpl.icon}</div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "#E0E0EA", marginBottom: 4 }}>{tpl.label}</div>
                    <div style={{ fontSize: 10, color: "#5C5C78", lineHeight: 1.4 }}>{tpl.desc}</div>
                  </Link>
                ))}
              </div>
            </div>
          </motion.div>
        ) : (
          /* ── Workflow List ────────────────────────────────────────────── */
          <div>
            {/* Header row */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 24 }}
            >
              <div style={{ position: "relative", width: 280 }}>
                <Search size={13} style={{
                  position: "absolute", left: 11, top: "50%",
                  transform: "translateY(-50%)", color: "#55556A",
                  pointerEvents: "none",
                }} />
                <input
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search workflows…"
                  aria-label="Search workflows"
                  style={{
                    width: "100%", paddingLeft: 34, paddingRight: 12,
                    height: 36, borderRadius: 8,
                    border: "1px solid rgba(255,255,255,0.06)",
                    background: "rgba(255,255,255,0.03)", color: "#F0F0F5",
                    fontSize: 12, outline: "none",
                    boxSizing: "border-box",
                    transition: "all 0.15s ease",
                  }}
                  onFocus={e => { e.currentTarget.style.borderColor = "rgba(0,245,255,0.25)"; }}
                  onBlur={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)"; }}
                />
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ fontSize: 12, color: "#5C5C78", whiteSpace: "nowrap" }}>
                  {filteredWorkflows.length} workflow{filteredWorkflows.length !== 1 ? "s" : ""}
                </span>
                <button
                  onClick={handleNewWorkflow}
                  style={{
                    display: "flex", alignItems: "center", gap: 6,
                    padding: "7px 14px", borderRadius: 8,
                    background: "linear-gradient(135deg, #00F5FF 0%, #0EA5E9 100%)",
                    color: "#0a0c10", fontSize: 12, fontWeight: 700,
                    border: "none", cursor: "pointer",
                    boxShadow: "0 0 12px rgba(0,245,255,0.12)",
                    transition: "all 0.2s ease",
                  }}
                  onMouseEnter={e => { e.currentTarget.style.boxShadow = "0 0 20px rgba(0,245,255,0.25)"; e.currentTarget.style.transform = "translateY(-1px)"; }}
                  onMouseLeave={e => { e.currentTarget.style.boxShadow = "0 0 12px rgba(0,245,255,0.12)"; e.currentTarget.style.transform = "translateY(0)"; }}
                >
                  <Plus size={12} strokeWidth={2.5} />
                  New Workflow
                </button>
              </div>
            </motion.div>

            <AnimatePresence mode="wait">
            {filteredWorkflows.length === 0 ? (
              <motion.div
                key="no-results"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                style={{ padding: "60px 0", textAlign: "center" }}
              >
                <p style={{ fontSize: 14, color: "#3A3A50", marginBottom: 8 }}>
                  No workflows matching &ldquo;{searchQuery}&rdquo;
                </p>
                <button
                  onClick={() => setSearchQuery("")}
                  style={{
                    fontSize: 12, color: "#00F5FF", background: "none",
                    border: "none", cursor: "pointer", fontWeight: 600,
                  }}
                >
                  Clear search
                </button>
              </motion.div>
            ) : (
              <motion.div key="sections" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                {/* Template-grouped sections */}
                {grouped.map((group, gi) => (
                  <div key={group.type.key} style={{ marginBottom: 28 }}>
                    {/* Section header */}
                    <div style={{
                      display: "flex", alignItems: "center", gap: 8,
                      marginBottom: 12, paddingBottom: 8,
                      borderBottom: `1px solid ${group.type.color}12`,
                    }}>
                      <div style={{
                        width: 26, height: 26, borderRadius: 7,
                        background: `${group.type.color}10`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}>
                        {group.type.icon}
                      </div>
                      <span style={{ fontSize: 13, fontWeight: 600, color: "#E0E0EA" }}>
                        {group.type.label}
                      </span>
                      <span style={{
                        fontSize: 10, color: group.type.color, fontWeight: 600,
                        padding: "1px 6px", borderRadius: 4,
                        background: `${group.type.color}10`,
                      }}>
                        {group.items.length}
                      </span>
                      <ChevronRight size={12} style={{ color: "#3A3A50" }} />
                    </div>
                    {/* Cards grid */}
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
                      {group.items.map((wf, i) => renderCard(wf, gi * 10 + i))}
                    </div>
                  </div>
                ))}

                {/* Ungrouped / custom workflows */}
                {ungrouped.length > 0 && (
                  <div style={{ marginBottom: 28 }}>
                    {grouped.length > 0 && (
                      <div style={{
                        display: "flex", alignItems: "center", gap: 8,
                        marginBottom: 12, paddingBottom: 8,
                        borderBottom: "1px solid rgba(0,245,255,0.08)",
                      }}>
                        <div style={{
                          width: 26, height: 26, borderRadius: 7,
                          background: "rgba(0,245,255,0.08)",
                          display: "flex", alignItems: "center", justifyContent: "center",
                        }}>
                          <Workflow size={13} color="#00F5FF" />
                        </div>
                        <span style={{ fontSize: 13, fontWeight: 600, color: "#E0E0EA" }}>
                          My Workflows
                        </span>
                        <span style={{
                          fontSize: 10, color: "#00F5FF", fontWeight: 600,
                          padding: "1px 6px", borderRadius: 4,
                          background: "rgba(0,245,255,0.08)",
                        }}>
                          {ungrouped.length}
                        </span>
                      </div>
                    )}
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
                      {ungrouped.map((wf, i) => renderCard(wf, 100 + i))}
                    </div>
                  </div>
                )}
              </motion.div>
            )}
            </AnimatePresence>
          </div>
        )}
      </main>
    </div>
  );
}
