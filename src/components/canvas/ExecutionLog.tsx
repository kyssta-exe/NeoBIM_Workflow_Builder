"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, ChevronUp, Terminal, X } from "lucide-react";

export interface LogEntry {
  timestamp: Date;
  type: "start" | "running" | "success" | "error" | "info";
  message: string;
  detail?: string;
}

interface ExecutionLogProps {
  entries: LogEntry[];
  isRunning: boolean;
  onClose: () => void;
}

const TYPE_COLOR = {
  start:   "#4F8AFF",
  running: "#F59E0B",
  success: "#10B981",
  error:   "#EF4444",
  info:    "#55556A",
};

const TYPE_SYMBOL = {
  start:   "▶",
  running: "◉",
  success: "✓",
  error:   "✗",
  info:    "·",
};

function fmt(d: Date) {
  return d.toTimeString().slice(0, 8);
}

export function ExecutionLog({ entries, isRunning, onClose }: ExecutionLogProps) {
  const [collapsed, setCollapsed] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom as entries appear
  useEffect(() => {
    if (!collapsed) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [entries, collapsed]);

  if (entries.length === 0 && !isRunning) return null;

  return (
    <motion.div
      initial={{ y: 200, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 200, opacity: 0 }}
      transition={{ type: "spring", stiffness: 380, damping: 36 }}
      style={{
        position: "absolute", bottom: 0, left: 0, right: 0,
        zIndex: 30,
        background: "#0A0A0F",
        borderTop: "1px solid #1E1E2E",
        fontFamily: "'JetBrains Mono', 'Fira Mono', 'Menlo', monospace",
      }}
    >
      {/* Title bar */}
      <div style={{
        display: "flex", alignItems: "center", gap: 7,
        padding: "6px 12px", borderBottom: "1px solid #1E1E2E",
        height: 32, flexShrink: 0,
      }}>
        <Terminal size={11} style={{ color: "#3A3A4E" }} />
        <span style={{ fontSize: 11, color: "#55556A", fontWeight: 600, flex: 1 }}>
          Execution Log
          {isRunning && (
            <span style={{ color: "#F59E0B", marginLeft: 8, animation: "logPulse 1s ease-in-out infinite" }}>
              ● running
            </span>
          )}
        </span>
        <button
          onClick={() => setCollapsed(c => !c)}
          style={{ background: "none", border: "none", cursor: "pointer", color: "#3A3A4E", padding: 2 }}
          onMouseEnter={e => { e.currentTarget.style.color = "#8888A0"; }}
          onMouseLeave={e => { e.currentTarget.style.color = "#3A3A4E"; }}
        >
          {collapsed ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </button>
        {!isRunning && (
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", cursor: "pointer", color: "#3A3A4E", padding: 2 }}
            onMouseEnter={e => { e.currentTarget.style.color = "#EF4444"; }}
            onMouseLeave={e => { e.currentTarget.style.color = "#3A3A4E"; }}
          >
            <X size={12} />
          </button>
        )}
      </div>

      {/* Log body */}
      <AnimatePresence>
        {!collapsed && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: 180 }}
            exit={{ height: 0 }}
            style={{ overflow: "hidden" }}
          >
            <div style={{
              height: 180, overflowY: "auto", padding: "8px 12px",
              display: "flex", flexDirection: "column", gap: 2,
            }}>
              {entries.map((entry, i) => (
                <div key={i} style={{ display: "flex", gap: 10, fontSize: 11, lineHeight: 1.5 }}>
                  <span style={{ color: "#2A2A3E", flexShrink: 0 }}>{fmt(entry.timestamp)}</span>
                  <span style={{ color: TYPE_COLOR[entry.type], flexShrink: 0 }}>
                    {TYPE_SYMBOL[entry.type]}
                  </span>
                  <span style={{ color: "#C0C0D0", flex: 1 }}>
                    {entry.message}
                    {entry.detail && (
                      <span style={{ color: "#55556A" }}> — {entry.detail}</span>
                    )}
                  </span>
                </div>
              ))}
              <div ref={bottomRef} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        @keyframes logPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </motion.div>
  );
}
