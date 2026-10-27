import { useState } from "react";
import {
  AlertTriangle,
  CpuChip01,
  Database01,
  ShieldTick,
  Ticket01,
} from "@untitledui/icons";
import { XyraMark } from "@/components/common/XyraLogo";

type FlowMode = "system" | "audit";

export default function ProjectFlowIllustration() {
  const [mode, setMode] = useState<FlowMode>("system");

  return (
    <div className="relative flex h-full w-full flex-col items-center justify-center overflow-hidden bg-black p-6 select-none">
      {/* Background Subtle Radial Glow */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-96 w-96 rounded-full bg-brand-500/5 blur-3xl" />
      </div>

      {/* Clean Minimal Header (no explanations, just the heading) */}
      <div className="relative z-10 mb-8 flex flex-col items-center text-center">
        <span className="text-[11px] font-semibold tracking-widest text-brand-400 uppercase">
          Continuous Controls Monitoring
        </span>
        <h2 className="mt-1 text-2xl font-bold tracking-tight text-white lg:text-3xl">
          Automated Compliance Flow
        </h2>

        {/* Minimal Mode Pill Switch */}
        <div className="mt-4 inline-flex items-center rounded-full border border-white/10 bg-[#121214] p-1 shadow-inner">
          <button
            type="button"
            onClick={() => setMode("system")}
            className={`rounded-full px-3.5 py-1 text-xs font-medium transition-all ${
              mode === "system"
                ? "bg-white/10 text-white shadow-sm"
                : "text-neutral-400 hover:text-white"
            }`}
          >
            System Flow
          </button>
          <button
            type="button"
            onClick={() => setMode("audit")}
            className={`rounded-full px-3.5 py-1 text-xs font-medium transition-all ${
              mode === "audit"
                ? "bg-white/10 text-white shadow-sm"
                : "text-neutral-400 hover:text-white"
            }`}
          >
            Audit Report
          </button>
        </div>
      </div>

      {/* DIAGRAM CANVAS */}
      <div className="relative z-10 flex w-full max-w-[480px] items-center justify-center">
        {mode === "system" ? (
          /* SYSTEM FLOW (Matches User's Image 3) */
          <div className="relative h-[380px] w-[460px]">
            {/* SVG Connecting Paths & Animated Beams */}
            <svg
              className="pointer-events-none absolute inset-0 h-full w-full"
              viewBox="0 0 460 380"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              {/* Static Background Curves */}
              <path d="M 230 74 L 230 148" stroke="rgba(255, 255, 255, 0.12)" strokeWidth="1.5" />
              <path d="M 230 202 L 230 292" stroke="rgba(255, 255, 255, 0.12)" strokeWidth="1.5" />
              <path
                d="M 230 202 C 230 260, 75 235, 75 292"
                stroke="rgba(255, 255, 255, 0.12)"
                strokeWidth="1.5"
                fill="none"
              />
              <path
                d="M 230 202 C 230 260, 385 235, 385 292"
                stroke="rgba(255, 255, 255, 0.12)"
                strokeWidth="1.5"
                fill="none"
              />

              {/* Animated Glowing Laser Beams */}
              {/* Top to Center (Cyan) */}
              <path
                d="M 230 74 L 230 148"
                stroke="#38bdf8"
                strokeWidth="2"
                strokeDasharray="20 120"
                strokeLinecap="round"
                style={{ filter: "drop-shadow(0 0 6px #38bdf8)" }}
              >
                <animate attributeName="stroke-dashoffset" from="140" to="0" dur="2s" repeatCount="indefinite" />
              </path>

              {/* Center to Left (Emerald) */}
              <path
                d="M 230 202 C 230 260, 75 235, 75 292"
                stroke="#34d399"
                strokeWidth="2"
                strokeDasharray="26 220"
                strokeLinecap="round"
                fill="none"
                style={{ filter: "drop-shadow(0 0 6px #34d399)" }}
              >
                <animate attributeName="stroke-dashoffset" from="246" to="0" dur="2.4s" repeatCount="indefinite" />
              </path>

              {/* Center to Middle (Purple) */}
              <path
                d="M 230 202 L 230 292"
                stroke="#c084fc"
                strokeWidth="2"
                strokeDasharray="22 150"
                strokeLinecap="round"
                style={{ filter: "drop-shadow(0 0 6px #c084fc)" }}
              >
                <animate attributeName="stroke-dashoffset" from="172" to="0" dur="2.1s" repeatCount="indefinite" />
              </path>

              {/* Center to Right (Amber) */}
              <path
                d="M 230 202 C 230 260, 385 235, 385 292"
                stroke="#fbbf24"
                strokeWidth="2"
                strokeDasharray="26 220"
                strokeLinecap="round"
                fill="none"
                style={{ filter: "drop-shadow(0 0 6px #fbbf24)" }}
              >
                <animate attributeName="stroke-dashoffset" from="246" to="0" dur="2.4s" repeatCount="indefinite" />
              </path>
            </svg>

            {/* TOP CARD: Data Source (SAP S/4HANA) */}
            <div className="absolute top-[20px] left-1/2 -translate-x-1/2">
              <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-[#121214] px-5 py-3 shadow-xl">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-500/20 bg-cyan-500/10 text-cyan-400">
                  <Database01 className="h-5 w-5" />
                </div>
                <div className="text-left">
                  <div className="text-xs font-semibold text-white">Data Source</div>
                  <div className="text-[11px] font-medium text-neutral-400">SAP S/4HANA</div>
                </div>
              </div>
            </div>

            {/* CENTER HUB: Xyra Mark */}
            <div className="absolute top-[148px] left-1/2 -translate-x-1/2">
              <div className="relative flex h-13 w-13 items-center justify-center rounded-full border border-white/10 bg-[#121214] shadow-[0_0_24px_rgba(70,95,255,0.2)]">
                <XyraMark className="h-6 w-auto object-contain" />
              </div>
            </div>

            {/* BOTTOM NODES (3 Pills) */}
            <div className="absolute top-[292px] left-0 right-0 flex items-center justify-between px-2">
              {/* Left: Deviations */}
              <div className="flex items-center gap-2.5 rounded-full border border-white/10 bg-[#121214] px-4 py-2.5 shadow-lg">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-emerald-500/20 bg-emerald-500/10 text-emerald-400">
                  <AlertTriangle className="h-4 w-4 text-emerald-400" />
                </div>
                <span className="text-xs font-medium text-white">Deviations</span>
              </div>

              {/* Middle: Review Queue */}
              <div className="flex items-center gap-2.5 rounded-full border border-white/10 bg-[#121214] px-4 py-2.5 shadow-lg">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-purple-500/20 bg-purple-500/10 text-purple-400">
                  <ShieldTick className="h-4 w-4 text-purple-400" />
                </div>
                <span className="text-xs font-medium text-white">Review Queue</span>
              </div>

              {/* Right: Jira Sync */}
              <div className="flex items-center gap-2.5 rounded-full border border-white/10 bg-[#121214] px-4 py-2.5 shadow-lg">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-amber-500/20 bg-amber-500/10 text-amber-400">
                  <Ticket01 className="h-4 w-4 text-amber-400" />
                </div>
                <span className="text-xs font-medium text-white">Jira Sync</span>
              </div>
            </div>
          </div>
        ) : (
          /* AUDIT REPORT FLOW (Matches User's Image 1) */
          <div className="relative h-[430px] w-[460px]">
            {/* SVG Connecting Paths & Animated Beams */}
            <svg
              className="pointer-events-none absolute inset-0 h-full w-full"
              viewBox="0 0 460 430"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              {/* Static Background Curves converging into Center */}
              <path
                d="M 75 110 C 75 160, 230 140, 230 188"
                stroke="rgba(255, 255, 255, 0.12)"
                strokeWidth="1.5"
                fill="none"
              />
              <path d="M 230 110 L 230 188" stroke="rgba(255, 255, 255, 0.12)" strokeWidth="1.5" />
              <path
                d="M 385 110 C 385 160, 230 140, 230 188"
                stroke="rgba(255, 255, 255, 0.12)"
                strokeWidth="1.5"
                fill="none"
              />
              {/* Center to Bottom Card */}
              <path d="M 230 242 L 230 300" stroke="rgba(255, 255, 255, 0.12)" strokeWidth="1.5" />

              {/* Animated Laser Beams */}
              <path
                d="M 75 110 C 75 160, 230 140, 230 188"
                stroke="#38bdf8"
                strokeWidth="2"
                strokeDasharray="24 200"
                strokeLinecap="round"
                fill="none"
                style={{ filter: "drop-shadow(0 0 6px #38bdf8)" }}
              >
                <animate attributeName="stroke-dashoffset" from="224" to="0" dur="2.4s" repeatCount="indefinite" />
              </path>

              <path
                d="M 230 110 L 230 188"
                stroke="#34d399"
                strokeWidth="2"
                strokeDasharray="20 120"
                strokeLinecap="round"
                style={{ filter: "drop-shadow(0 0 6px #34d399)" }}
              >
                <animate attributeName="stroke-dashoffset" from="140" to="0" dur="2s" repeatCount="indefinite" />
              </path>

              <path
                d="M 385 110 C 385 160, 230 140, 230 188"
                stroke="#fbbf24"
                strokeWidth="2"
                strokeDasharray="24 200"
                strokeLinecap="round"
                fill="none"
                style={{ filter: "drop-shadow(0 0 6px #fbbf24)" }}
              >
                <animate attributeName="stroke-dashoffset" from="224" to="0" dur="2.4s" repeatCount="indefinite" />
              </path>

              {/* Center to Invoice (Purple Glow Beam, exactly like Image 1) */}
              <path
                d="M 230 242 L 230 300"
                stroke="#a855f7"
                strokeWidth="2"
                strokeDasharray="20 100"
                strokeLinecap="round"
                style={{ filter: "drop-shadow(0 0 6px #a855f7)" }}
              >
                <animate attributeName="stroke-dashoffset" from="120" to="0" dur="1.8s" repeatCount="indefinite" />
              </path>
            </svg>

            {/* TOP 3 CARDS WITH SKELETON LINES (Image 1 Style) */}
            <div className="absolute top-[10px] left-0 right-0 flex items-center justify-between px-2">
              {/* Card 1: SAP Telemetry */}
              <div className="w-[125px] rounded-xl border border-white/10 bg-[#121214] p-3 shadow-lg">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-white">SAP S/4</span>
                  <Database01 className="h-3.5 w-3.5 text-cyan-400" />
                </div>
                <div className="mt-2.5 flex flex-col gap-1.5">
                  <div className="h-1 w-full rounded-full bg-white/10" />
                  <div className="h-1 w-4/5 rounded-full bg-white/10" />
                  <div className="h-1 w-3/5 rounded-full bg-white/10" />
                </div>
              </div>

              {/* Card 2: Rule Engine */}
              <div className="w-[125px] rounded-xl border border-white/10 bg-[#121214] p-3 shadow-lg">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-white">Rules</span>
                  <CpuChip01 className="h-3.5 w-3.5 text-emerald-400" />
                </div>
                <div className="mt-2.5 flex flex-col gap-1.5">
                  <div className="h-1 w-full rounded-full bg-white/10" />
                  <div className="h-1 w-4/5 rounded-full bg-white/10" />
                  <div className="h-1 w-3/5 rounded-full bg-white/10" />
                </div>
              </div>

              {/* Card 3: SOD Matrix */}
              <div className="w-[125px] rounded-xl border border-white/10 bg-[#121214] p-3 shadow-lg">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-white">SOD Matrix</span>
                  <ShieldTick className="h-3.5 w-3.5 text-amber-400" />
                </div>
                <div className="mt-2.5 flex flex-col gap-1.5">
                  <div className="h-1 w-full rounded-full bg-white/10" />
                  <div className="h-1 w-4/5 rounded-full bg-white/10" />
                  <div className="h-1 w-3/5 rounded-full bg-white/10" />
                </div>
              </div>
            </div>

            {/* CENTER HUB */}
            <div className="absolute top-[188px] left-1/2 -translate-x-1/2">
              <div className="relative flex h-13 w-13 items-center justify-center rounded-full border border-white/10 bg-[#121214] shadow-[0_0_24px_rgba(70,95,255,0.2)]">
                <XyraMark className="h-6 w-auto object-contain" />
              </div>
            </div>

            {/* BOTTOM INVOICE/AUDIT CARD (Image 1 Style) */}
            <div className="absolute top-[300px] left-1/2 -translate-x-1/2">
              <div className="relative w-[150px] rounded-xl border border-white/10 bg-[#121214] p-3.5 shadow-2xl">
                <div className="text-xs font-bold tracking-wider text-white">
                  SOX REPORT
                </div>
                <div className="mt-2.5 flex flex-col gap-1.5">
                  <div className="h-1 w-full rounded-full bg-white/10" />
                  <div className="h-1 w-4/5 rounded-full bg-white/10" />
                  <div className="h-1 w-3/5 rounded-full bg-white/10" />
                  <div className="h-1 w-2/3 rounded-full bg-white/10" />
                </div>

                {/* Red PDF Badge (exact match to Image 1) */}
                <div className="absolute -bottom-2 -right-2">
                  <span className="inline-flex items-center rounded-md bg-rose-600 px-2 py-0.5 text-[10px] font-bold text-white shadow-[0_0_12px_rgba(225,29,72,0.8)]">
                    PDF
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
