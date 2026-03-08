"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  CheckCircle2, Sparkles, Compass, Cable, Lock,
  ChevronRight, Zap, ArrowRight, Lightbulb, Crown,
  FileText, Play, Workflow, Activity,
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
  hidden: { opacity: 0, y: 24 },
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
    <div className="flex items-center gap-3 mb-7">
      <span style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        width: 30, height: 30, borderRadius: 8,
        background: "rgba(184,115,51,0.1)", border: "1px solid rgba(184,115,51,0.2)",
        fontSize: 12, fontWeight: 700, color: "#B87333",
        fontFamily: "var(--font-jetbrains), monospace",
        boxShadow: "0 0 12px rgba(184,115,51,0.08)",
      }}>
        {number}
      </span>
      <span style={{ fontSize: 17, fontWeight: 700, color: "#E2E8F0", letterSpacing: "-0.02em" }}>
        {title}
      </span>
      <div style={{
        flex: 1, height: 1,
        background: "linear-gradient(90deg, rgba(184,115,51,0.18), rgba(184,115,51,0.04) 60%, transparent)",
      }} />
      {right}
    </div>
  );
}

// ─── Mission Icon helper ─────────────────────────────────────────────────────
const MISSION_ICONS: Record<string, React.ReactNode> = {
  check:    <CheckCircle2 size={20} />,
  sparkles: <Sparkles size={20} />,
  compass:  <Compass size={20} />,
  cable:    <Cable size={20} />,
};

// ─── Default data ────────────────────────────────────────────────────────────
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

// ─── Hover Card Wrapper ──────────────────────────────────────────────────────
function HoverCard({
  children,
  href,
  disabled,
  className,
  style,
}: {
  children: React.ReactNode;
  href: string;
  disabled?: boolean;
  className?: string;
  style?: React.CSSProperties;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <Link
      href={disabled ? "#" : href}
      className={className}
      onMouseEnter={() => !disabled && setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        ...style,
        textDecoration: "none",
        transform: hovered ? "translateY(-4px)" : "translateY(0)",
        boxShadow: hovered
          ? `${style?.boxShadow ?? ""}, 0 16px 48px rgba(0,0,0,0.35), 0 8px 16px rgba(0,0,0,0.2)`.replace(/^, /, "")
          : style?.boxShadow ?? "none",
        transition: "all 300ms cubic-bezier(0.25, 0.4, 0.25, 1)",
        cursor: disabled ? "not-allowed" : "pointer",
      }}
    >
      {children}
    </Link>
  );
}

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
        if (d && Array.isArray(d.missions)) setData(d);
      })
      .catch(() => {});
    const timeout = setTimeout(() => controller.abort(), 5000);
    return () => { clearTimeout(timeout); controller.abort(); };
  }, []);

  const statusColor = useCallback((s: string) =>
    s === "completed" ? "#34D399" : s === "in_progress" ? "#B87333" : "#556070", []);

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ background: "#0a0c10" }}>

      {/* ── Ambient Background Layers ───────────────────────────────── */}
      {/* Blueprint grid */}
      <div style={{
        position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0,
        backgroundImage: "linear-gradient(rgba(184,115,51,0.015) 1px, transparent 1px), linear-gradient(90deg, rgba(184,115,51,0.015) 1px, transparent 1px)",
        backgroundSize: "60px 60px",
      }} />
      {/* Floating orb — warm copper (top-left) */}
      <div className="dashboard-orb-1" style={{
        position: "fixed", top: "-5%", left: "10%", width: 500, height: 500,
        borderRadius: "50%", pointerEvents: "none", zIndex: 0,
        background: "radial-gradient(circle, rgba(184,115,51,0.06) 0%, transparent 70%)",
        filter: "blur(80px)",
      }} />
      {/* Floating orb — cool cyan (bottom-right) */}
      <div className="dashboard-orb-2" style={{
        position: "fixed", bottom: "10%", right: "5%", width: 400, height: 400,
        borderRadius: "50%", pointerEvents: "none", zIndex: 0,
        background: "radial-gradient(circle, rgba(0,245,255,0.04) 0%, transparent 70%)",
        filter: "blur(80px)",
      }} />
      {/* Vignette */}
      <div style={{
        position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0,
        background: "radial-gradient(ellipse 80% 60% at 50% 50%, transparent 50%, rgba(7,8,9,0.6) 100%)",
      }} />

      <main className="flex-1 overflow-y-auto relative" style={{ zIndex: 1 }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "36px 48px 64px", width: "100%" }}>

          {/* ════════════════════════════════════════════════════════════
              HEADER — Design Studio
              ════════════════════════════════════════════════════════════ */}
          <motion.div
            initial="hidden"
            animate="visible"
            variants={{ visible: { transition: { staggerChildren: 0.1 } } }}
          >
            <div className="flex items-start justify-between mb-12" style={{ gap: 24 }}>
              <div style={{ flex: 1 }}>
                {/* Blueprint annotation */}
                <motion.div
                  variants={fadeUp}
                  transition={{ duration: 0.5, ease: smoothEase }}
                  className="font-mono-data"
                  style={{
                    fontSize: 10, fontWeight: 600, letterSpacing: "2.5px",
                    textTransform: "uppercase" as const,
                    color: "rgba(184,115,51,0.4)", marginBottom: 12,
                  }}
                >
                  WORKSPACE / HOME
                </motion.div>

                <motion.h1
                  variants={fadeUp}
                  transition={{ duration: 0.6, ease: smoothEase }}
                  style={{
                    fontSize: 40, fontWeight: 800,
                    letterSpacing: "-1.5px", lineHeight: 1.1, marginBottom: 12,
                  }}
                >
                  <span style={{ color: "#E2E8F0" }}>Design </span>
                  <span style={{
                    background: "linear-gradient(135deg, #B87333 0%, #FFBF00 100%)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    backgroundClip: "text",
                  }}>
                    Studio
                  </span>
                </motion.h1>

                <motion.p
                  variants={fadeUp}
                  transition={{ duration: 0.5, ease: smoothEase }}
                  style={{ fontSize: 15, color: "#8898A8", maxWidth: 420, lineHeight: 1.6 }}
                >
                  Your concept design workspace — from brief to 3D in minutes.
                </motion.p>

                {/* Accent line */}
                <motion.div
                  variants={fadeUp}
                  transition={{ duration: 0.5, ease: smoothEase }}
                  style={{
                    width: 48, height: 3, borderRadius: 2, marginTop: 16,
                    background: "linear-gradient(90deg, #B87333, #FFBF00)",
                  }}
                />
              </div>

              {/* ── Stat Cards ────────────────────────────────────────── */}
              <motion.div
                variants={fadeRight}
                transition={{ duration: 0.6, ease: smoothEase }}
                style={{ display: "flex", gap: 14, flexShrink: 0 }}
              >
                <StatCard
                  label="Workflows"
                  value={data.workflowCount}
                  icon={<Workflow size={15} />}
                  color="#B87333"
                  delay={0.3}
                />
                <StatCard
                  label="Executions"
                  value={data.executionCount}
                  icon={<Activity size={15} />}
                  color="#00F5FF"
                  delay={0.4}
                />
              </motion.div>
            </div>
          </motion.div>

          {/* ════════════════════════════════════════════════════════════
              SECTION 01 — Getting Started
              ════════════════════════════════════════════════════════════ */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.5 }}
          >
            <SectionLabel number="01" title="Getting Started" />
          </motion.div>

          <div className="grid grid-cols-4 gap-4 mb-16">
            {(data.missions ?? []).map((mission, i) => {
              const isCompleted = mission.status === "completed";
              const isActive = mission.status === "in_progress";
              const isLocked = mission.status === "locked";
              const color = statusColor(mission.status);
              const stepNum = String(i + 1).padStart(2, "0");

              return (
                <motion.div
                  key={mission.id}
                  initial={{ opacity: 0, y: 24 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.35 + i * 0.08, duration: 0.5, ease: smoothEase }}
                >
                  <HoverCard
                    href={mission.href}
                    disabled={isLocked}
                    className="block"
                    style={{
                      background: isActive
                        ? "rgba(18,18,30,0.9)"
                        : "rgba(15,18,24,0.85)",
                      backdropFilter: "blur(16px) saturate(1.2)",
                      WebkitBackdropFilter: "blur(16px) saturate(1.2)",
                      borderRadius: 14, padding: "22px 20px 20px",
                      border: isCompleted
                        ? "1px solid rgba(52,211,153,0.3)"
                        : isActive
                          ? "1px solid rgba(184,115,51,0.35)"
                          : "1px solid rgba(255,255,255,0.06)",
                      boxShadow: isActive
                        ? "0 0 24px rgba(184,115,51,0.1), inset 0 1px 0 rgba(184,115,51,0.1)"
                        : isCompleted
                          ? "0 0 20px rgba(52,211,153,0.06)"
                          : "none",
                      opacity: isLocked ? 0.45 : 1,
                      height: "100%",
                      display: "flex", flexDirection: "column" as const,
                      position: "relative" as const,
                      overflow: "hidden" as const,
                    }}
                  >
                    {/* Top glow for active card */}
                    {isActive && (
                      <div style={{
                        position: "absolute", top: 0, left: "10%", right: "10%", height: 1,
                        background: "linear-gradient(90deg, transparent, rgba(184,115,51,0.5), transparent)",
                        pointerEvents: "none",
                      }} />
                    )}

                    <div className="flex items-start justify-between mb-4">
                      <div style={{
                        width: 44, height: 44, borderRadius: 12,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        background: isCompleted
                          ? "rgba(52,211,153,0.12)"
                          : isActive
                            ? "linear-gradient(135deg, rgba(184,115,51,0.15), rgba(255,191,0,0.08))"
                            : "rgba(255,255,255,0.04)",
                        border: isCompleted
                          ? "1px solid rgba(52,211,153,0.2)"
                          : isActive
                            ? "1px solid rgba(184,115,51,0.25)"
                            : "1px solid rgba(255,255,255,0.06)",
                        color,
                        boxShadow: isActive ? "0 0 16px rgba(184,115,51,0.1)" : "none",
                      }}>
                        {isLocked ? <Lock size={17} style={{ color: "#556070" }} /> : MISSION_ICONS[mission.icon]}
                      </div>
                      <div className="flex items-center gap-2">
                        {isCompleted && <CheckCircle2 size={15} style={{ color: "#34D399" }} />}
                        {isActive && (
                          <span className="dashboard-pulse-dot" style={{
                            width: 7, height: 7, borderRadius: "50%",
                            background: "#B87333", display: "inline-block",
                            boxShadow: "0 0 8px rgba(184,115,51,0.4)",
                          }} />
                        )}
                        <span className="font-mono-data" style={{
                          fontSize: 9, color: "#556070", letterSpacing: "0.08em",
                        }}>
                          {stepNum}
                        </span>
                      </div>
                    </div>

                    <div style={{ fontSize: 14, fontWeight: 650, color: "#E2E8F0", marginBottom: 6, letterSpacing: "-0.01em" }}>
                      {mission.title}
                    </div>
                    <div style={{ fontSize: 12, color: "#8898A8", lineHeight: 1.55, flex: 1 }}>
                      {mission.description}
                    </div>

                    {isActive && (
                      <div style={{
                        marginTop: 14, display: "flex", alignItems: "center", gap: 6,
                        fontSize: 11, fontWeight: 600, color: "#B87333",
                        fontFamily: "var(--font-jetbrains), monospace",
                      }}>
                        Get started <ArrowRight size={12} />
                      </div>
                    )}
                  </HoverCard>
                </motion.div>
              );
            })}
          </div>

          {/* ════════════════════════════════════════════════════════════
              SECTION 02 — Design Templates
              ════════════════════════════════════════════════════════════ */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.65, duration: 0.5 }}
          >
            <SectionLabel
              number="02"
              title="Design Templates"
              right={
                <Link href="/dashboard/templates" className="dashboard-link-hover" style={{
                  fontSize: 12, fontWeight: 600, color: "#B87333",
                  textDecoration: "none", display: "flex", alignItems: "center", gap: 4,
                  transition: "all 200ms ease",
                }}>
                  All Templates <ChevronRight size={14} />
                </Link>
              }
            />
          </motion.div>

          <div className="grid grid-cols-3 gap-5 mb-16">
            {(data.blueprints ?? []).map((bp, i) => {
              const workflow = PREBUILT_WORKFLOWS[bp.workflowIndex];
              const name = workflow?.name ?? "Template";
              const desc = workflow?.description ?? "";
              const category = workflow?.category ?? "Concept Design";
              const categoryColor = TEMPLATE_CATEGORY_COLORS[category] ?? "#3B82F6";
              const diagramNodes = (workflow?.tileGraph?.nodes ?? []).map((n: { data: { label: string; category: string } }) => ({
                label: n.data.label,
                category: n.data.category,
              }));

              return (
                <motion.div
                  key={bp.workflowIndex}
                  initial={{ opacity: 0, y: 24 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.7 + i * 0.1, duration: 0.5, ease: smoothEase }}
                >
                  <TemplateCard
                    unlocked={bp.unlocked}
                    name={name}
                    desc={desc}
                    category={category}
                    categoryColor={categoryColor}
                    diagramNodes={diagramNodes}
                  />
                </motion.div>
              );
            })}
          </div>

          {/* ════════════════════════════════════════════════════════════
              SECTION 03 — Recent Activity
              ════════════════════════════════════════════════════════════ */}
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
                    <Link href="/dashboard/workflows" className="dashboard-link-hover" style={{
                      fontSize: 12, fontWeight: 600, color: "#B87333",
                      textDecoration: "none", display: "flex", alignItems: "center", gap: 4,
                      transition: "all 200ms ease",
                    }}>
                      All Workflows <ChevronRight size={14} />
                    </Link>
                  }
                />
              </motion.div>

              <div className="grid grid-cols-3 gap-4 mb-16">
                {(data.recentWorkflows ?? []).map((wf, i) => (
                  <motion.div
                    key={wf.id}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.95 + i * 0.07, duration: 0.4, ease: smoothEase }}
                  >
                    <HoverCard
                      href={`/dashboard/canvas?id=${wf.id}`}
                      className="block"
                      style={{
                        background: "rgba(15,18,24,0.85)",
                        backdropFilter: "blur(12px)",
                        WebkitBackdropFilter: "blur(12px)",
                        border: "1px solid rgba(255,255,255,0.06)",
                        borderRadius: 14, padding: "20px",
                        position: "relative" as const,
                        overflow: "hidden" as const,
                      }}
                    >
                      {/* Subtle top accent */}
                      <div style={{
                        position: "absolute", top: 0, left: "20%", right: "20%", height: 1,
                        background: "linear-gradient(90deg, transparent, rgba(79,138,255,0.15), transparent)",
                        pointerEvents: "none",
                      }} />

                      <div className="flex items-center gap-3 mb-3">
                        <div style={{
                          width: 38, height: 38, borderRadius: 10, flexShrink: 0,
                          background: "linear-gradient(135deg, rgba(79,138,255,0.1), rgba(99,102,241,0.06))",
                          border: "1px solid rgba(79,138,255,0.15)",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          boxShadow: "0 0 12px rgba(79,138,255,0.06)",
                        }}>
                          <FileText size={15} style={{ color: "#4F8AFF" }} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{
                            fontSize: 14, fontWeight: 600, color: "#E2E8F0",
                            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                          }}>
                            {wf.name}
                          </div>
                          <div className="font-mono-data" style={{ fontSize: 10, color: "#556070" }}>
                            {timeAgo(wf.updatedAt)}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 mb-3">
                        <span className="font-mono-data" style={{ fontSize: 10, color: "#556070", display: "flex", alignItems: "center", gap: 4 }}>
                          <Zap size={10} style={{ color: "#B87333" }} /> {wf.nodeCount} nodes
                        </span>
                        <span className="font-mono-data" style={{ fontSize: 10, color: "#556070", display: "flex", alignItems: "center", gap: 4 }}>
                          <Play size={9} style={{ color: "#34D399" }} /> {wf.executionCount} runs
                        </span>
                      </div>

                      <div style={{
                        textAlign: "center",
                        padding: "8px 0", borderRadius: 8,
                        background: "rgba(184,115,51,0.06)", border: "1px solid rgba(184,115,51,0.12)",
                        fontSize: 11, fontWeight: 600, color: "#B87333",
                        fontFamily: "var(--font-jetbrains), monospace",
                        letterSpacing: "0.04em",
                      }}>
                        Open Workflow
                      </div>
                    </HoverCard>
                  </motion.div>
                ))}
              </div>
            </>
          )}

          {/* ════════════════════════════════════════════════════════════
              TIP CARD
              ════════════════════════════════════════════════════════════ */}
          {data.flashEvent && !data.flashEvent.completed && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.0, duration: 0.5, ease: smoothEase }}
            >
              <Link
                href={data.flashEvent.href}
                className="block dashboard-tip-card"
                style={{
                  background: "rgba(15,18,24,0.85)",
                  backdropFilter: "blur(16px)",
                  WebkitBackdropFilter: "blur(16px)",
                  border: "1px solid rgba(184,115,51,0.12)",
                  borderRadius: 14, padding: "20px 24px",
                  textDecoration: "none",
                  display: "flex", alignItems: "center", gap: 18,
                  transition: "all 300ms cubic-bezier(0.25, 0.4, 0.25, 1)",
                  position: "relative",
                  overflow: "hidden",
                }}
              >
                {/* Left accent bar */}
                <div style={{
                  position: "absolute", left: 0, top: "20%", bottom: "20%", width: 3,
                  borderRadius: "0 4px 4px 0",
                  background: "linear-gradient(180deg, #B87333, #FFBF00)",
                }} />

                <div style={{
                  width: 42, height: 42, borderRadius: 11, flexShrink: 0,
                  background: "linear-gradient(135deg, rgba(184,115,51,0.12), rgba(255,191,0,0.06))",
                  border: "1px solid rgba(184,115,51,0.2)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  boxShadow: "0 0 16px rgba(184,115,51,0.08)",
                }}>
                  <Lightbulb size={18} style={{ color: "#B87333" }} />
                </div>

                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "#E2E8F0", marginBottom: 3 }}>
                    {data.flashEvent.title}
                  </div>
                  <div style={{ fontSize: 13, color: "#8898A8", lineHeight: 1.5 }}>
                    {data.flashEvent.description}
                  </div>
                </div>

                <div style={{
                  width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                  background: "rgba(184,115,51,0.08)",
                  border: "1px solid rgba(184,115,51,0.15)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <ArrowRight size={14} style={{ color: "#B87333" }} />
                </div>
              </Link>
            </motion.div>
          )}

        </div>
      </main>
    </div>
  );
}

// ─── Stat Card ────────────────────────────────────────────────────────────────
function StatCard({ label, value, icon, color, delay }: {
  label: string;
  value: number;
  icon: React.ReactNode;
  color: string;
  delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay, duration: 0.5, ease: smoothEase }}
      style={{
        background: "rgba(15,18,24,0.85)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 14, padding: "18px 22px",
        minWidth: 130,
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Subtle top glow */}
      <div style={{
        position: "absolute", top: 0, left: "15%", right: "15%", height: 1,
        background: `linear-gradient(90deg, transparent, ${color}30, transparent)`,
        pointerEvents: "none",
      }} />

      <div className="flex items-center justify-between mb-3">
        <div className="font-mono-data" style={{
          fontSize: 9, color: "#556070", letterSpacing: "0.12em",
          textTransform: "uppercase" as const,
        }}>
          {label}
        </div>
        <div style={{
          width: 26, height: 26, borderRadius: 7,
          background: `${color}12`, border: `1px solid ${color}20`,
          display: "flex", alignItems: "center", justifyContent: "center",
          color,
        }}>
          {icon}
        </div>
      </div>

      <div style={{
        fontSize: 32, fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1,
        background: `linear-gradient(135deg, #E2E8F0, ${color})`,
        WebkitBackgroundClip: "text",
        WebkitTextFillColor: "transparent",
        backgroundClip: "text",
      }}>
        {value}
      </div>
    </motion.div>
  );
}

// ─── Template Card ────────────────────────────────────────────────────────────
function TemplateCard({ unlocked, name, desc, category, categoryColor, diagramNodes }: {
  unlocked: boolean;
  name: string;
  desc: string;
  category: string;
  categoryColor: string;
  diagramNodes: Array<{ label: string; category: string }>;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: "rgba(15,18,24,0.85)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        border: hovered && unlocked
          ? `1px solid ${categoryColor}40`
          : "1px solid rgba(255,255,255,0.07)",
        borderRadius: 14, overflow: "hidden",
        transition: "all 350ms cubic-bezier(0.25, 0.4, 0.25, 1)",
        transform: hovered && unlocked ? "translateY(-6px)" : "translateY(0)",
        boxShadow: hovered && unlocked
          ? `0 20px 60px rgba(0,0,0,0.3), 0 0 30px ${categoryColor}10`
          : "none",
      }}
    >
      {/* Diagram area */}
      <div style={{
        height: 170, position: "relative", overflow: "hidden",
        background: `linear-gradient(135deg, ${categoryColor}06, rgba(255,255,255,0.02))`,
      }}>
        {/* Blueprint grid inside diagram */}
        <div style={{
          position: "absolute", inset: 0, pointerEvents: "none",
          backgroundImage: `linear-gradient(${categoryColor}08 1px, transparent 1px), linear-gradient(90deg, ${categoryColor}08 1px, transparent 1px)`,
          backgroundSize: "24px 24px",
          opacity: 0.5,
        }} />

        {unlocked ? (
          <MiniWorkflowDiagram nodes={diagramNodes} size="lg" />
        ) : (
          <div style={{
            position: "absolute", inset: 0,
            background: "rgba(10,12,16,0.8)",
            backdropFilter: "blur(4px)",
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8,
          }}>
            <Lock size={24} style={{ color: "#556070" }} />
            <span className="font-mono-data" style={{ fontSize: 9, color: "#556070", letterSpacing: "0.1em" }}>
              PRO TEMPLATE
            </span>
          </div>
        )}

        {/* Bottom fade */}
        <div style={{
          position: "absolute", bottom: 0, left: 0, right: 0, height: 60,
          background: "linear-gradient(transparent, rgba(15,18,24,0.85))",
          pointerEvents: "none",
        }} />

        {/* Category chip overlay */}
        <div style={{
          position: "absolute", top: 12, left: 12,
          display: "inline-flex", alignItems: "center", gap: 5,
          padding: "4px 10px", borderRadius: 20,
          background: "rgba(10,12,16,0.75)", backdropFilter: "blur(8px)",
          border: `1px solid ${categoryColor}25`,
          fontSize: 10, fontWeight: 600, letterSpacing: "0.02em",
          color: categoryColor,
        }}>
          <span style={{
            width: 5, height: 5, borderRadius: "50%",
            background: categoryColor,
            boxShadow: `0 0 6px ${categoryColor}60`,
          }} />
          {category}
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: "16px 18px 20px" }}>
        <div style={{
          fontSize: 16, fontWeight: 700,
          color: unlocked ? "#E2E8F0" : "#556070",
          marginBottom: 6, letterSpacing: "-0.01em",
          lineHeight: 1.3,
        }}>
          {name}
        </div>
        <div style={{ fontSize: 12, color: "#8898A8", lineHeight: 1.55, marginBottom: 16 }}>
          {desc}
        </div>

        {unlocked ? (
          <Link
            href="/dashboard/workflows/new"
            className="dashboard-template-btn"
            style={{
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              textAlign: "center",
              padding: "10px 16px", borderRadius: 10,
              background: "linear-gradient(135deg, #B87333, #D4943D)",
              color: "#0a0c10",
              fontSize: 12, fontWeight: 700, letterSpacing: "0.03em",
              textDecoration: "none",
              fontFamily: "var(--font-jetbrains), monospace",
              transition: "all 250ms ease",
              boxShadow: "0 2px 12px rgba(184,115,51,0.2)",
            }}
          >
            Use Template <ArrowRight size={13} />
          </Link>
        ) : (
          <div style={{
            textAlign: "center", padding: "10px 16px", borderRadius: 10,
            background: "rgba(255,255,255,0.03)", color: "#556070",
            border: "1px solid rgba(255,255,255,0.06)",
            fontSize: 12, fontWeight: 700, letterSpacing: "0.04em",
            fontFamily: "var(--font-jetbrains), monospace",
            cursor: "not-allowed",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
          }}>
            <Crown size={12} /> PRO
          </div>
        )}
      </div>
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
