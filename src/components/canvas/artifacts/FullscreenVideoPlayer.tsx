"use client";

import React, { useRef, useState, useEffect } from "react";
import { motion } from "framer-motion";
import { X, Download, Clock, Clapperboard, Film, DollarSign } from "lucide-react";
import { useUIStore } from "@/stores/ui-store";
import { useExecutionStore } from "@/stores/execution-store";

export function FullscreenVideoPlayer() {
  const nodeId = useUIStore(s => s.videoPlayerNodeId);
  const close = useUIStore(s => s.setVideoPlayerNodeId);
  const artifact = useExecutionStore(s => nodeId ? s.artifacts.get(nodeId) : undefined);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    if (!videoRef.current) return;
    const v = videoRef.current;
    const onTime = () => setCurrentTime(v.currentTime);
    const onMeta = () => setDuration(v.duration);
    v.addEventListener("timeupdate", onTime);
    v.addEventListener("loadedmetadata", onMeta);
    return () => {
      v.removeEventListener("timeupdate", onTime);
      v.removeEventListener("loadedmetadata", onMeta);
    };
  }, [nodeId]);

  if (!nodeId || !artifact || artifact.type !== "video") return null;

  const d = artifact.data as Record<string, unknown>;
  const videoUrl = (d?.videoUrl as string) ?? (d?.downloadUrl as string) ?? "";
  const downloadUrl = (d?.downloadUrl as string) ?? videoUrl;
  const fileName = (d?.name as string) ?? "walkthrough.mp4";
  const shotCount = (d?.shotCount as number) ?? (d?.metadata as Record<string, unknown>)?.shotCount as number ?? 3;
  const durationSec = (d?.durationSeconds as number) ?? 15;
  const pipeline = (d?.pipeline as string) ?? (d?.metadata as Record<string, unknown>)?.pipeline as string ?? "Kling 3.0";
  const costUsd = (d?.costUsd as number) ?? (d?.metadata as Record<string, unknown>)?.costUsd as number ?? null;

  const shotDuration = duration > 0 ? duration / shotCount : durationSec / shotCount;
  const currentShot = Math.min(Math.floor(currentTime / shotDuration), shotCount - 1);

  const handleShotClick = (shotIndex: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = shotIndex * shotDuration;
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: "absolute", inset: 0, zIndex: 60,
        background: "rgba(4,4,8,0.98)",
        display: "flex", flexDirection: "column",
        overflow: "auto",
      }}
    >
      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "12px 20px",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        flexShrink: 0,
      }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: "#F0F0F5" }}>
          Cinematic Video Walkthrough
        </span>
        <button
          onClick={() => close(null)}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "6px 14px", borderRadius: 8,
            background: "rgba(255,255,255,0.06)", border: "none",
            color: "#8888A0", fontSize: 12, fontWeight: 500,
            cursor: "pointer",
          }}
        >
          <X size={12} /> Close
        </button>
      </div>

      {/* Content */}
      <div style={{
        flex: 1, display: "flex", flexDirection: "column",
        alignItems: "center", padding: "32px 24px",
        gap: 24,
      }}>
        {/* Video player */}
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          style={{
            width: "100%", maxWidth: 900,
            borderRadius: 12,
            overflow: "hidden",
            boxShadow: "0 24px 80px rgba(0,0,0,0.8), 0 0 60px rgba(0,245,255,0.08)",
            background: "#000",
          }}
        >
          <video
            ref={videoRef}
            src={videoUrl}
            controls
            autoPlay
            style={{
              width: "100%",
              display: "block",
              borderRadius: 12,
            }}
          />
        </motion.div>

        {/* Shot timeline bar */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          style={{
            width: "100%", maxWidth: 900,
            display: "flex", gap: 4,
          }}
        >
          {Array.from({ length: shotCount }, (_, i) => {
            const isActive = i === currentShot;
            const shotStart = i * shotDuration;
            const shotEnd = (i + 1) * shotDuration;
            const progress = isActive
              ? Math.min(((currentTime - shotStart) / (shotEnd - shotStart)) * 100, 100)
              : i < currentShot ? 100 : 0;

            return (
              <button
                key={i}
                onClick={() => handleShotClick(i)}
                style={{
                  flex: 1,
                  height: 32,
                  borderRadius: 6,
                  background: isActive
                    ? "rgba(0,245,255,0.1)"
                    : "rgba(255,255,255,0.03)",
                  border: `1px solid ${isActive ? "rgba(0,245,255,0.3)" : "rgba(255,255,255,0.06)"}`,
                  cursor: "pointer",
                  position: "relative",
                  overflow: "hidden",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transition: "all 0.15s ease",
                }}
              >
                {/* Progress fill */}
                <div style={{
                  position: "absolute", left: 0, top: 0, bottom: 0,
                  width: `${progress}%`,
                  background: isActive
                    ? "rgba(0,245,255,0.15)"
                    : "rgba(0,245,255,0.06)",
                  transition: "width 0.2s linear",
                }} />
                <span style={{
                  position: "relative", zIndex: 1,
                  fontSize: 9, fontWeight: 600,
                  color: isActive ? "#00F5FF" : "#5C5C78",
                  fontFamily: "'Space Mono', monospace",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}>
                  Shot {i + 1}
                </span>
              </button>
            );
          })}
        </motion.div>

        {/* Metadata grid */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          style={{
            width: "100%", maxWidth: 900,
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 12,
          }}
        >
          {[
            { label: "Duration", value: `${durationSec}s`, icon: <Clock size={14} />, color: "#00F5FF" },
            { label: "Shots", value: String(shotCount), icon: <Clapperboard size={14} />, color: "#FFBF00" },
            { label: "Pipeline", value: "Kling 3.0", icon: <Film size={14} />, color: "#8B5CF6" },
            { label: "Cost", value: costUsd != null ? `$${costUsd.toFixed(2)}` : "—", icon: <DollarSign size={14} />, color: "#FFBF00" },
          ].map((card, i) => (
            <motion.div
              key={card.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 + i * 0.05 }}
              style={{
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.06)",
                borderRadius: 8,
                padding: "14px 16px",
                textAlign: "center",
              }}
            >
              <div style={{ color: card.color, marginBottom: 6, display: "flex", justifyContent: "center" }}>
                {card.icon}
              </div>
              <div style={{
                fontSize: 18, fontWeight: 700, color: "#F0F0F5",
                lineHeight: 1.1, marginBottom: 4,
                fontFamily: "'Space Mono', monospace",
              }}>
                {card.value}
              </div>
              <div style={{
                fontSize: 10, color: "#5C5C78", textTransform: "uppercase",
                letterSpacing: "0.05em", fontWeight: 500,
              }}>
                {card.label}
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* Download button */}
        <motion.a
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45 }}
          href={downloadUrl}
          download={fileName}
          style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            padding: "12px 28px", borderRadius: 8,
            background: "rgba(0,245,255,0.1)",
            border: "1px solid rgba(0,245,255,0.3)",
            color: "#00F5FF", fontSize: 14, fontWeight: 600,
            textDecoration: "none", cursor: "pointer",
            transition: "all 0.15s ease",
          }}
          onMouseEnter={e => { e.currentTarget.style.background = "rgba(0,245,255,0.18)"; e.currentTarget.style.borderColor = "rgba(0,245,255,0.5)"; e.currentTarget.style.boxShadow = "0 0 24px rgba(0,245,255,0.15)"; }}
          onMouseLeave={e => { e.currentTarget.style.background = "rgba(0,245,255,0.1)"; e.currentTarget.style.borderColor = "rgba(0,245,255,0.3)"; e.currentTarget.style.boxShadow = "none"; }}
        >
          <Download size={16} />
          Download Video
        </motion.a>

        {/* Pipeline info */}
        <div style={{ fontSize: 10, color: "#4A4A60", fontStyle: "italic" }}>
          {pipeline}
        </div>
      </div>
    </motion.div>
  );
}
