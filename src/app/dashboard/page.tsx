"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  CheckCircle2, Sparkles, Compass, Cable, Lock,
  ChevronRight, Zap, ArrowRight, Lightbulb, Crown,
  FileText, Play,
} from "lucide-react";
import { PREBUILT_WORKFLOWS } from "@/constants/prebuilt-workflows";
import { MiniWorkflowDiagram } from "@/components/shared/MiniWorkflowDiagram";

// ─── Types ───────────────────────────────────────────────────────────────────
interface DashboardData {
  xp: number;
  level: number;
  progress: number;
  xpInLevel: number;
  xpForNext: number;
  workflowCount: number;
  executionCount: number;
  missions: Array<{
    id: string;
    title: string;
    description: string;
    action: string;
    href: string;
    icon: string;
    status: "completed" | "in_progress" | "locked";
  }>;
  blueprints: Array<{
    workflowIndex: number;
    rarity: string;
    requiredLevel: number;
    unlocked: boolean;
  }>;
  achievements: Array<{ action: string; xp: number; date: string }>;
  flashEvent: {
    key: string;
    eventKey: string;
    title: string;
    description: string;
    href: string;
    completed: boolean;
    msRemaining: number;
  };
  recentWorkflows: Array<{
    id: string;
    name: string;
    updatedAt: string;
    nodeCount: number;
    executionCount: number;
  }>;
}

// ─── Animation presets ────────────────────────────────────────────────────────
const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};
const fadeRight = {
  hidden: { opacity: 0, x: 30 },
  visible: { opacity: 1, x: 0 },
};
const smoothEase: [number, number, number, number] = [0.22, 1, 0.36, 1];

// ─── Template category colors ─────────────────────────────────────────────────
const TEMPLATE_CATEGORY_COLORS: Record<string, string> = {
  "Concept Design": "#3B82F6",
  "Visualization": "#10B981",
  "BIM Export": "#F59E0B",
  "Cost Estimation": "#8B5CF6",
  "Full Pipeline": "#06B6D4",
  "Site Analysis": "#10B981",
};

// ─── Section Label ────────────────────────────────────────────────────────────
function SectionLabel({ number, title, right }: { number: string; title: string; right?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 mb-6">
      <span style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        width: 28, height: 28, borderRadius: 6,
        background: "rgba(184,115,51,0.12)", border: "1px solid rgba(184,115,51,0.25)",
        fontSize: 12, fontWeight: 700, color: "#B87333",
        fontFamily: "var(--font-jetbrains), monospace",
      }}>
        {number}
      </span>
      <span style={{ fontSize: 18, fontWeight: 700, color: "#F0F0F5", letterSpacing: "-0.02em" }}>
        {title}
      </span>
      <div style={{ flex: 1, height: 1, background: "linear-gradient(90deg, rgba(184,115,51,0.2), transparent)" }} />
      {right}
    </div>
  );
}

// ─── Mission Icon helper ─────────────────────────────────────────────────────
const MISSION_ICONS: Record<string, React.ReactNode> = {
  check:    <CheckCircle2 size={22} />,
  sparkles: <Sparkles size={22} />,
  compass:  <Compass size={22} />,
  cable:    <Cable size={22} />,
};

// ─── Default data (shown when API fails or user is new) ──────────────────────
const DEFAULT_DATA: DashboardData = {
  xp: 0,
  level: 1,
  progress: 0,
  xpInLevel: 0,
  xpForNext: 500,
  workflowCount: 0,
  executionCount: 0,
  missions: [
    { id: "m1", title: "Create Your First Workflow", description: "Set up your first empty canvas to begin designing.", action: "workflow-created", href: "/dashboard/workflows/new", icon: "check", status: "in_progress" },
    { id: "m2", title: "Try AI-Assisted Design", description: "Generate a workflow using a natural language prompt.", action: "ai-prompt-used", href: "/dashboard/workflows/new", icon: "sparkles", status: "locked" },
    { id: "m3", title: "Browse Design Templates", description: "Explore and fork a pre-built workflow template.", action: "template-cloned", href: "/dashboard/templates", icon: "compass", status: "locked" },
    { id: "m4", title: "Run a Complete Pipeline", description: "Execute a full workflow from input to output.", action: "render-generated", href: "/dashboard/workflows/new", icon: "cable", status: "locked" },
  ],
  blueprints: [
    { workflowIndex: 0, rarity: "rare", requiredLevel: 1, unlocked: true },
    { workflowIndex: 1, rarity: "epic", requiredLevel: 5, unlocked: false },
    { workflowIndex: 2, rarity: "legendary", requiredLevel: 8, unlocked: false },
  ],
  achievements: [],
  flashEvent: {
    key: "run-3-workflows", eventKey: "run-3-workflows:fallback",
    title: "Run 3 workflows today", description: "Execute three different workflows before midnight UTC.",
    href: "/dashboard/workflows", completed: false, msRemaining: 43200000,
  },
  recentWorkflows: [],
};

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const [data, setData] = useState<DashboardData>(DEFAULT_DATA);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/user/dashboard-stats", { signal: controller.signal })
      .then(r => {
        if (!r.ok) throw new Error("API error");
        return r.json();
      })
      .then((d: DashboardData) => {
        if (d && Array.isArray(d.missions)) {
          setData(d);
        }
      })
      .catch(() => {
        // Use default data — dashboard already rendered
      });
    // Timeout: if API takes >5s, abort
    const timeout = setTimeout(() => controller.abort(), 5000);
    return () => { clearTimeout(timeout); controller.abort(); };
  }, []);

  const statusColor = (s: string) =>
    s === "completed" ? "#00E676" : s === "in_progress" ? "#B87333" : "#6B6B8A";

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ background: "#0a0c10" }}>
      {/* Subtle grid overlay */}
      <div style={{
        position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0,
        backgroundImage: "linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)",
        backgroundSize: "60px 60px",
        opacity: 0.5,
      }} />

      <main className="flex-1 overflow-y-auto relative" style={{ zIndex: 1 }}>
        <div style={{ padding: "32px 40px 48px", width: "100%" }}>

          {/* ── HEADER — Design Studio ─────────────────────────────────── */}
          <motion.div initial="hidden" animate="visible" variants={{ visible: { transition: { staggerChildren: 0.1 } } }}>
            <div className="flex items-start justify-between mb-10">
              <div>
                <motion.h1
                  variants={fadeUp}
                  transition={{ duration: 0.6, ease: smoothEase }}
                  style={{
                    fontSize: 36, fontWeight: 800,
                    letterSpacing: "-1px", lineHeight: 1.1, marginBottom: 10,
                    color: "#F0F0F5",
                  }}
                >
                  Design Studio
                </motion.h1>

                <motion.p
                  variants={fadeUp}
                  transition={{ duration: 0.5, ease: smoothEase }}
                  style={{ fontSize: 15, color: "#5C5C78", maxWidth: 480 }}
                >
                  Your concept design workspace — from brief to 3D in minutes.
                </motion.p>
              </div>

              {/* Stat Cards */}
              <motion.div
                variants={fadeRight}
                transition={{ duration: 0.6, ease: smoothEase }}
                style={{ display: "flex", gap: 12, flexShrink: 0 }}
              >
                {/* Workflows count */}
                <div style={{
                  background: "#0F1218",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 12, padding: "16px 20px",
                  minWidth: 110,
                }}>
                  <div className="font-mono-data" style={{ fontSize: 9, color: "#5C5C78", letterSpacing: "0.1em", textTransform: "uppercase" as const, marginBottom: 4 }}>
                    Workflows
                  </div>
                  <div style={{ fontSize: 28, fontWeight: 800, color: "#F0F0F5", letterSpacing: "-0.02em", lineHeight: 1 }}>
                    {data.workflowCount}
                  </div>
                </div>

                {/* Executions count */}
                <div style={{
                  background: "#0F1218",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 12, padding: "16px 20px",
                  minWidth: 110,
                }}>
                  <div className="font-mono-data" style={{ fontSize: 9, color: "#5C5C78", letterSpacing: "0.1em", textTransform: "uppercase" as const, marginBottom: 4 }}>
                    Executions
                  </div>
                  <div style={{ fontSize: 28, fontWeight: 800, color: "#F0F0F5", letterSpacing: "-0.02em", lineHeight: 1 }}>
                    {data.executionCount}
                  </div>
                </div>
              </motion.div>
            </div>
          </motion.div>

          {/* ── SECTION 01 — Getting Started ────────────────────────────── */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.5 }}
          >
            <SectionLabel number="01" title="Getting Started" />
          </motion.div>

          <div className="grid grid-cols-4 gap-4 mb-14">
            {(data.missions ?? []).map((mission, i) => {
              const isCompleted = mission.status === "completed";
              const isActive = mission.status === "in_progress";
              const isLocked = mission.status === "locked";
              const color = statusColor(mission.status);

              return (
                <motion.div
                  key={mission.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.35 + i * 0.075, duration: 0.5, ease: smoothEase }}
                >
                  <Link
                    href={isLocked ? "#" : mission.href}
                    className="block"
                    style={{
                      background: "#0F1218",
                      borderRadius: 12, padding: 20,
                      border: isCompleted
                        ? "1px solid rgba(0,230,118,0.3)"
                        : isActive
                          ? "1px solid rgba(184,115,51,0.5)"
                          : "1px solid rgba(255,255,255,0.06)",
                      boxShadow: isActive ? "0 0 20px rgba(184,115,51,0.12)" : "none",
                      opacity: isLocked ? 0.5 : 1,
                      textDecoration: "none",
                      transition: "all 200ms ease",
                      cursor: isLocked ? "not-allowed" : "pointer",
                      height: "100%",
                      display: "flex", flexDirection: "column" as const,
                    }}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div style={{
                        width: 42, height: 42, borderRadius: 10,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        background: isCompleted
                          ? "rgba(0,230,118,0.12)"
                          : isActive
                            ? "rgba(184,115,51,0.12)"
                            : "rgba(255,255,255,0.04)",
                        color,
                      }}>
                        {isLocked ? <Lock size={18} style={{ color: "#6B6B8A" }} /> : MISSION_ICONS[mission.icon]}
                      </div>
                      {/* Icon-only status indicator */}
                      <span style={{ color }}>
                        {isCompleted ? <CheckCircle2 size={16} /> : isActive ? <Zap size={16} /> : <Lock size={14} />}
                      </span>
                    </div>

                    <div style={{ fontSize: 15, fontWeight: 600, color: "#F0F0F5", marginBottom: 4 }}>
                      {mission.title}
                    </div>
                    <div style={{ fontSize: 12, color: "#5C5C78", lineHeight: 1.5, flex: 1 }}>
                      {mission.description}
                    </div>
                  </Link>
                </motion.div>
              );
            })}
          </div>

          {/* ── SECTION 02 — Design Templates ──────────────────────────── */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.65, duration: 0.5 }}
          >
            <SectionLabel
              number="02"
              title="Design Templates"
              right={
                <Link href="/dashboard/templates" style={{
                  fontSize: 12, fontWeight: 600, color: "#B87333",
                  textDecoration: "none", display: "flex", alignItems: "center", gap: 4,
                }}>
                  All Templates <ChevronRight size={14} />
                </Link>
              }
            />
          </motion.div>

          <div className="grid grid-cols-3 gap-5 mb-14">
            {(data.blueprints ?? []).map((bp, i) => {
              const workflow = PREBUILT_WORKFLOWS[bp.workflowIndex];
              const name = workflow?.name ?? "Template";
              const desc = workflow?.description ?? "";
              const category = workflow?.category ?? "Concept Design";
              const categoryColor = TEMPLATE_CATEGORY_COLORS[category] ?? "#3B82F6";

              // Extract diagram nodes from the workflow template
              const diagramNodes = (workflow?.tileGraph?.nodes ?? []).map((n: { data: { label: string; category: string } }) => ({
                label: n.data.label,
                category: n.data.category,
              }));

              return (
                <motion.div
                  key={bp.workflowIndex}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.7 + i * 0.1, duration: 0.5, ease: smoothEase }}
                  style={{
                    background: "#0F1218",
                    border: "1px solid rgba(255,255,255,0.07)",
                    borderRadius: 12, overflow: "hidden",
                    transition: "all 300ms ease",
                  }}
                >
                  {/* Diagram area */}
                  <div style={{
                    height: 180, position: "relative", overflow: "hidden",
                    background: "rgba(255,255,255,0.02)",
                  }}>
                    {bp.unlocked ? (
                      <MiniWorkflowDiagram nodes={diagramNodes} size="lg" />
                    ) : (
                      <div style={{
                        position: "absolute", inset: 0,
                        background: "rgba(10,12,16,0.75)",
                        backdropFilter: "blur(4px)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}>
                        <Lock size={28} style={{ color: "#6B6B8A" }} />
                      </div>
                    )}
                    <div style={{
                      position: "absolute", bottom: 0, left: 0, right: 0, height: 60,
                      background: "linear-gradient(transparent, #0F1218)",
                    }} />
                  </div>

                  {/* Content */}
                  <div style={{ padding: "14px 18px 18px" }}>
                    {/* Category chip */}
                    <div style={{
                      display: "inline-flex", alignItems: "center", gap: 4, marginBottom: 8,
                      padding: "3px 10px", borderRadius: 20,
                      background: `${categoryColor}15`, border: `1px solid ${categoryColor}30`,
                      fontSize: 10, fontWeight: 600, letterSpacing: "0.02em",
                      color: categoryColor,
                    }}>
                      {category}
                    </div>

                    <div style={{
                      fontSize: 17, fontWeight: 700,
                      color: bp.unlocked ? "#F0F0F5" : "#5C5C78",
                      marginBottom: 6, letterSpacing: "-0.01em",
                    }}>
                      {name}
                    </div>
                    <div style={{ fontSize: 12, color: "#5C5C78", lineHeight: 1.5, marginBottom: 14 }}>
                      {desc}
                    </div>

                    {bp.unlocked ? (
                      <Link
                        href="/dashboard/workflows/new"
                        style={{
                          display: "block", textAlign: "center",
                          padding: "10px 16px", borderRadius: 8,
                          background: "#B87333", color: "#0a0c10",
                          fontSize: 12, fontWeight: 700, letterSpacing: "0.04em",
                          textDecoration: "none",
                          fontFamily: "var(--font-jetbrains), monospace",
                          transition: "all 200ms ease",
                        }}
                      >
                        Use Template
                      </Link>
                    ) : (
                      <div style={{
                        textAlign: "center", padding: "10px 16px", borderRadius: 8,
                        background: "rgba(255,255,255,0.04)", color: "#3A3A50",
                        fontSize: 12, fontWeight: 700, letterSpacing: "0.04em",
                        fontFamily: "var(--font-jetbrains), monospace",
                        cursor: "not-allowed",
                        display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                      }}>
                        <Crown size={12} /> PRO
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>

          {/* ── SECTION 03 — Recent Activity ──────────────────────────── */}
          {(data.recentWorkflows ?? []).length > 0 && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.9, duration: 0.5 }}
              >
                <SectionLabel
                  number="03"
                  title="Recent Activity"
                  right={
                    <Link href="/dashboard/workflows" style={{
                      fontSize: 12, fontWeight: 600, color: "#4F8AFF",
                      textDecoration: "none", display: "flex", alignItems: "center", gap: 4,
                    }}>
                      All Workflows <ChevronRight size={14} />
                    </Link>
                  }
                />
              </motion.div>

              <div className="grid grid-cols-3 gap-4 mb-14">
                {(data.recentWorkflows ?? []).map((wf, i) => (
                  <motion.div
                    key={wf.id}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.95 + i * 0.07, duration: 0.4, ease: smoothEase }}
                  >
                    <Link
                      href={`/dashboard/canvas?id=${wf.id}`}
                      style={{
                        display: "block", textDecoration: "none",
                        background: "#0F1218",
                        border: "1px solid rgba(255,255,255,0.06)",
                        borderRadius: 12, padding: "18px 20px",
                        transition: "all 200ms ease",
                      }}
                    >
                      <div className="flex items-center gap-3 mb-3">
                        <div style={{
                          width: 36, height: 36, borderRadius: 8, flexShrink: 0,
                          background: "rgba(79,138,255,0.08)", border: "1px solid rgba(79,138,255,0.15)",
                          display: "flex", alignItems: "center", justifyContent: "center",
                        }}>
                          <FileText size={16} style={{ color: "#4F8AFF" }} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{
                            fontSize: 14, fontWeight: 600, color: "#F0F0F5",
                            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                          }}>
                            {wf.name}
                          </div>
                          <div className="font-mono-data" style={{ fontSize: 10, color: "#5C5C78" }}>
                            {timeAgo(wf.updatedAt)}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="font-mono-data" style={{ fontSize: 10, color: "#3A3A50", display: "flex", alignItems: "center", gap: 3 }}>
                          <Zap size={10} style={{ color: "#4F8AFF" }} /> {wf.nodeCount} nodes
                        </span>
                        <span className="font-mono-data" style={{ fontSize: 10, color: "#3A3A50", display: "flex", alignItems: "center", gap: 3 }}>
                          <Play size={9} style={{ color: "#10B981" }} /> {wf.executionCount} runs
                        </span>
                      </div>
                      <div style={{
                        marginTop: 12, textAlign: "center",
                        padding: "7px 0", borderRadius: 6,
                        background: "rgba(79,138,255,0.06)", border: "1px solid rgba(79,138,255,0.12)",
                        fontSize: 11, fontWeight: 600, color: "#4F8AFF",
                        fontFamily: "var(--font-jetbrains), monospace",
                        letterSpacing: "0.03em",
                      }}>
                        Open
                      </div>
                    </Link>
                  </motion.div>
                ))}
              </div>
            </>
          )}

          {/* ── Tip Card (replaces Flash Event) ────────────────────────── */}
          {data.flashEvent && !data.flashEvent.completed && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.0, duration: 0.5, ease: smoothEase }}
          >
            <Link
              href={data.flashEvent.href}
              className="block"
              style={{
                background: "#0F1218",
                border: "1px solid rgba(184,115,51,0.15)",
                borderRadius: 12, padding: "18px 24px",
                textDecoration: "none",
                display: "flex", alignItems: "center", gap: 16,
                transition: "all 200ms ease",
              }}
            >
              <div style={{
                width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                background: "rgba(184,115,51,0.1)",
                border: "1px solid rgba(184,115,51,0.2)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <Lightbulb size={18} style={{ color: "#B87333" }} />
              </div>

              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: "#F0F0F5", marginBottom: 2 }}>
                  {data.flashEvent.title}
                </div>
                <div style={{ fontSize: 13, color: "#5C5C78", lineHeight: 1.5 }}>
                  {data.flashEvent.description}
                </div>
              </div>

              <ArrowRight size={18} style={{ color: "#B87333", flexShrink: 0 }} />
            </Link>
          </motion.div>
          )}

        </div>
      </main>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}
