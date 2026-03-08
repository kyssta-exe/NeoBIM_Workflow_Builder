"use client";

import React, { memo, useState } from "react";
import { getSmoothStepPath, type EdgeProps } from "@xyflow/react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface EdgeData {
  sourceColor?: string;
  targetColor?: string;
  isFlowing?: boolean;
}

// ─── AnimatedEdge — Architectural Section Line Style ─────────────────────────

export const AnimatedEdge = memo(function AnimatedEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  selected,
}: EdgeProps) {
  const [isHovered, setIsHovered] = useState(false);

  const edgeData = data as EdgeData | undefined;
  const sourceColor = edgeData?.sourceColor ?? "#4F8AFF";
  const targetColor = edgeData?.targetColor ?? "#4F8AFF";
  const isFlowing   = edgeData?.isFlowing   ?? false;

  const [edgePath] = getSmoothStepPath({
    sourceX, sourceY, sourcePosition,
    targetX, targetY, targetPosition,
    borderRadius: 14,
  });

  // Unique IDs so multiple edges don't conflict
  const gradientId = `eg-${id}`;
  const glowId     = `ef-${id}`;
  const arrowId    = `ea-${id}`;
  const animGradId = `ag-${id}`;

  // Visual states
  const active     = selected || isHovered;
  const strokeW    = isFlowing ? 2.5 : active ? 2 : 1.5;
  const strokeOp   = isFlowing ? 1 : active ? 0.7 : 0.35;

  return (
    <>
      <defs>
        {/* Directional gradient: source color → target color */}
        <linearGradient
          id={gradientId}
          gradientUnits="userSpaceOnUse"
          x1={sourceX} y1={sourceY}
          x2={targetX} y2={targetY}
        >
          <stop offset="0%"   stopColor={sourceColor} stopOpacity={0.9} />
          <stop offset="50%"  stopColor={`color-mix(in srgb, ${sourceColor} 50%, ${targetColor})`} stopOpacity={0.9} />
          <stop offset="100%" stopColor={targetColor}  stopOpacity={0.9} />
        </linearGradient>

        {/* Animated gradient for flowing state */}
        <linearGradient id={animGradId}>
          <stop offset="0%" stopColor={sourceColor} stopOpacity={1}>
            <animate
              attributeName="stop-opacity"
              values="1;0.5;1"
              dur="2s"
              repeatCount="indefinite"
            />
          </stop>
          <stop offset="50%" stopColor={`color-mix(in srgb, ${sourceColor} 50%, ${targetColor})`} stopOpacity={0.9} />
          <stop offset="100%" stopColor={targetColor} stopOpacity={1}>
            <animate
              attributeName="stop-opacity"
              values="0.5;1;0.5"
              dur="2s"
              repeatCount="indefinite"
            />
          </stop>
        </linearGradient>

        {/* Glow filter */}
        <filter id={glowId} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation={active ? "3.5" : "2.5"} result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        {/* Architectural arrowhead — refined chevron */}
        <marker
          id={arrowId}
          viewBox="0 0 12 8"
          refX="11"
          refY="4"
          markerWidth="10"
          markerHeight="7"
          orient="auto-start-reverse"
        >
          <path
            d="M0,0 L12,4 L0,8 L3,4 Z"
            fill={targetColor}
            opacity={active ? 0.85 : 0.6}
          />
        </marker>
      </defs>

      {/* Wide invisible hit area */}
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={24}
        style={{ cursor: "pointer" }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      />

      {/* Outer glow halo */}
      <path
        d={edgePath}
        fill="none"
        stroke={targetColor}
        strokeWidth={strokeW + (active ? 5 : 3)}
        strokeOpacity={active ? 0.1 : 0.03}
        strokeLinecap="round"
        style={{ transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)" }}
      />

      {/* Main edge with gradient stroke + glow filter */}
      <path
        d={edgePath}
        fill="none"
        stroke={isFlowing ? `url(#${animGradId})` : `url(#${gradientId})`}
        strokeWidth={strokeW}
        strokeOpacity={strokeOp}
        strokeLinecap="round"
        markerEnd={`url(#${arrowId})`}
        filter={`url(#${glowId})`}
        style={{ transition: "all 0.25s cubic-bezier(0.4, 0, 0.2, 1)" }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      />

      {/* Idle: architectural center-line dash pattern (long-short-long) */}
      {!isFlowing && (
        <path
          d={edgePath}
          fill="none"
          stroke={sourceColor}
          strokeWidth={0.8}
          strokeOpacity={active ? 0.35 : 0.12}
          strokeDasharray="14 5 3 5"
          strokeLinecap="round"
          style={{
            pointerEvents: "none",
            transition: "stroke-opacity 0.25s ease",
            animation: "archDashFlow 4s linear infinite",
          }}
        />
      )}

      {/* Flowing: luminous particle with comet trail */}
      {isFlowing && (
        <>
          {/* Bright pulsing track */}
          <path
            d={edgePath}
            fill="none"
            stroke={`url(#${animGradId})`}
            strokeWidth={2.5}
            strokeOpacity={0.9}
            strokeLinecap="round"
            filter={`url(#${glowId})`}
            style={{ pointerEvents: "none" }}
          />

          {/* Comet tail — wide soft glow */}
          <circle r={6} fill={targetColor} opacity={0.12}
            style={{ filter: "blur(3px)" }}>
            <animateMotion
              dur="2s"
              repeatCount="indefinite"
              calcMode="linear"
              path={edgePath}
              begin="0.08s"
            />
          </circle>

          {/* Trailing particle */}
          <circle r={3} fill={sourceColor} opacity={0.35}>
            <animateMotion
              dur="2s"
              repeatCount="indefinite"
              calcMode="linear"
              path={edgePath}
              begin="0.15s"
            />
          </circle>

          {/* Main bright particle */}
          <circle r={3.5} fill="white" opacity={0.9}
            style={{ filter: `drop-shadow(0 0 6px ${targetColor})` }}>
            <animateMotion
              dur="2s"
              repeatCount="indefinite"
              calcMode="linear"
              path={edgePath}
            />
          </circle>
        </>
      )}

      <style>{`
        @keyframes archDashFlow {
          from { stroke-dashoffset: 0; }
          to { stroke-dashoffset: -54; }
        }
      `}</style>
    </>
  );
});

AnimatedEdge.displayName = "AnimatedEdge";
