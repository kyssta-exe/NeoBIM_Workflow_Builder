"use client";

import React from "react";
import { Download, Maximize2, Film, Clock, DollarSign, Clapperboard } from "lucide-react";
import { useUIStore } from "@/stores/ui-store";
import type { VideoArtifactData } from "@/types/execution";

interface VideoBodyProps {
  data: VideoArtifactData;
  nodeId?: string;
}

export function VideoBody({ data, nodeId }: VideoBodyProps) {
  const setVideoPlayerNodeId = useUIStore(s => s.setVideoPlayerNodeId);

  const duration = data?.durationSeconds ?? 0;
  const shotCount = data?.shotCount ?? 3;
  const costUsd = data?.costUsd;

  return (
    <div style={{ padding: "0 12px 10px 14px" }}>
      {/* Embedded video player */}
      <div style={{
        position: "relative",
        borderRadius: 8,
        overflow: "hidden",
        background: "#000",
        marginBottom: 8,
      }}>
        <video
          src={data?.videoUrl}
          controls
          preload="metadata"
          style={{
            width: "100%",
            height: 180,
            objectFit: "cover",
            display: "block",
            borderRadius: 8,
          }}
        />
      </div>

      {/* Metadata strip */}
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        marginBottom: 8,
        flexWrap: "wrap",
      }}>
        {/* Duration badge */}
        <span style={{
          display: "inline-flex", alignItems: "center", gap: 3,
          padding: "2px 7px", borderRadius: 4,
          background: "rgba(0,245,255,0.08)",
          border: "1px solid rgba(0,245,255,0.15)",
          fontSize: 9, fontWeight: 600, color: "#00F5FF",
          fontFamily: "'Space Mono', monospace",
        }}>
          <Clock size={8} />
          {duration}s
        </span>

        {/* Shots badge */}
        <span style={{
          display: "inline-flex", alignItems: "center", gap: 3,
          padding: "2px 7px", borderRadius: 4,
          background: "rgba(255,191,0,0.08)",
          border: "1px solid rgba(255,191,0,0.15)",
          fontSize: 9, fontWeight: 600, color: "#FFBF00",
          fontFamily: "'Space Mono', monospace",
        }}>
          <Clapperboard size={8} />
          {shotCount} shots
        </span>

        {/* Pipeline */}
        <span style={{
          display: "inline-flex", alignItems: "center", gap: 3,
          padding: "2px 7px", borderRadius: 4,
          background: "rgba(139,92,246,0.08)",
          border: "1px solid rgba(139,92,246,0.15)",
          fontSize: 9, fontWeight: 500, color: "#8B5CF6",
          fontFamily: "'Space Mono', monospace",
        }}>
          <Film size={8} />
          Kling 3.0
        </span>

        {/* Cost badge */}
        {costUsd != null && (
          <span style={{
            display: "inline-flex", alignItems: "center", gap: 3,
            padding: "2px 7px", borderRadius: 4,
            background: "rgba(255,191,0,0.08)",
            border: "1px solid rgba(255,191,0,0.15)",
            fontSize: 9, fontWeight: 700, color: "#FFBF00",
            fontFamily: "'Space Mono', monospace",
          }}>
            <DollarSign size={8} />
            ${costUsd.toFixed(2)}
          </span>
        )}
      </div>

      {/* Action row */}
      <div style={{ display: "flex", gap: 6 }}>
        {/* Fullscreen button */}
        {nodeId && (
          <button
            onClick={() => setVideoPlayerNodeId(nodeId)}
            style={{
              display: "flex", alignItems: "center", gap: 5,
              padding: "5px 10px", borderRadius: 6,
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.08)",
              fontSize: 10, fontWeight: 500, color: "#8888A0",
              cursor: "pointer", transition: "all 0.15s ease",
            }}
            onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.08)"; e.currentTarget.style.color = "#F0F0F5"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.04)"; e.currentTarget.style.color = "#8888A0"; }}
          >
            <Maximize2 size={10} />
            Fullscreen
          </button>
        )}

        {/* Download button */}
        <a
          href={data?.downloadUrl ?? data?.videoUrl}
          download={data?.name ?? "walkthrough.mp4"}
          style={{
            display: "flex", alignItems: "center", gap: 5,
            padding: "5px 10px", borderRadius: 6,
            background: "rgba(0,245,255,0.08)",
            border: "1px solid rgba(0,245,255,0.2)",
            fontSize: 10, fontWeight: 500, color: "#00F5FF",
            textDecoration: "none", cursor: "pointer",
            transition: "all 0.15s ease",
          }}
          onMouseEnter={e => { e.currentTarget.style.background = "rgba(0,245,255,0.15)"; e.currentTarget.style.borderColor = "rgba(0,245,255,0.4)"; }}
          onMouseLeave={e => { e.currentTarget.style.background = "rgba(0,245,255,0.08)"; e.currentTarget.style.borderColor = "rgba(0,245,255,0.2)"; }}
        >
          <Download size={10} />
          Download
        </a>
      </div>
    </div>
  );
}
