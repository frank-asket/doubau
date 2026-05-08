"use client";

import { useEffect, useRef, useState } from "react";

import { PortraitThumb } from "@/components/avatars/PortraitThumb";
import { FacebookIcon } from "@/components/icons/FacebookIcon";
import { GoogleIcon } from "@/components/icons/GoogleIcon";
import { LinkedInIcon } from "@/components/icons/LinkedInIcon";

type Person = {
  name: string;
  role: string;
  tone: "lime" | "deep" | "sand";
  x: number;
  y: number;
  z: number;
  floatDelayMs: number;
  start: string;
};

const people: Person[] = [
  {
    name: "Maria Angelica",
    role: "Product Designer",
    tone: "lime",
    x: 54,
    y: 22,
    z: 30,
    floatDelayMs: 0,
    start: "Start May 12, 2025",
  },
  {
    name: "Marcus Alexandro",
    role: "Product Manager",
    tone: "deep",
    x: 78,
    y: 50,
    z: 20,
    floatDelayMs: 180,
    start: "Start May 12, 2025",
  },
  {
    name: "Vinco Chen",
    role: "Data Analyst",
    tone: "sand",
    x: 38,
    y: 64,
    z: 40,
    floatDelayMs: 340,
    start: "Start May 12, 2025",
  },
];

function toneClass(tone: Person["tone"]) {
  switch (tone) {
    case "lime":
      return "bg-[color-mix(in_srgb,var(--accent)_18%,transparent)]";
    case "deep":
      return "bg-[color-mix(in_srgb,var(--deep)_14%,transparent)]";
    case "sand":
      return "bg-[color-mix(in_srgb,#ffd38a_26%,transparent)]";
  }
}

function portraitFor(tone: Person["tone"]) {
  switch (tone) {
    case "lime":
      return {
        palette: { skin: "#F1C7A3", hair: "#1F232A", shirt: "#3D7C47" },
        variant: 0 as const,
      };
    case "deep":
      return {
        palette: { skin: "#D9A88E", hair: "#2B1C16", shirt: "#0F1117" },
        variant: 3 as const,
      };
    case "sand":
      return {
        palette: { skin: "#E6B08A", hair: "#111111", shirt: "#F2D79A" },
        variant: 2 as const,
      };
  }
}

export function HeroVisual() {
  const ref = useRef<HTMLDivElement | null>(null);
  const [p, setP] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (mql.matches) return;

    let raf = 0;
    const onMove = (ev: PointerEvent) => {
      const rect = el.getBoundingClientRect();
      const px = (ev.clientX - rect.left) / rect.width - 0.5;
      const py = (ev.clientY - rect.top) / rect.height - 0.5;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setP({ x: px, y: py }));
    };

    el.addEventListener("pointermove", onMove);
    return () => {
      cancelAnimationFrame(raf);
      el.removeEventListener("pointermove", onMove);
    };
  }, []);

  return (
    <div
      ref={ref}
      className="relative mx-auto h-[520px] w-full max-w-[520px] rounded-[32px] border border-[var(--border)] bg-[color-mix(in_srgb,var(--background)_92%,transparent)] shadow-[var(--shadow)] overflow-hidden"
    >
      <div className="absolute inset-0">
        <div className="absolute left-1/2 top-[-80px] h-[280px] w-[380px] -translate-x-1/2 rounded-full bg-[color-mix(in_srgb,var(--accent)_20%,transparent)] blur-3xl" />
        <div className="absolute right-[-120px] bottom-[-160px] h-[360px] w-[360px] rounded-full bg-[color-mix(in_srgb,var(--deep)_14%,transparent)] blur-3xl" />
      </div>

      <div className="absolute inset-7 rounded-[24px] border border-[var(--border)] bg-[color-mix(in_srgb,var(--background)_88%,transparent)]" />

      {/* subtle lines */}
      <svg
        className="absolute inset-0"
        viewBox="0 0 520 520"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M250 254 C 312 188, 376 188, 410 220"
          stroke="rgba(15,17,23,0.12)"
          strokeWidth="1"
        />
        <path
          d="M258 270 C 300 320, 330 360, 356 406"
          stroke="rgba(15,17,23,0.12)"
          strokeWidth="1"
        />
        <path
          d="M242 266 C 204 304, 176 334, 150 368"
          stroke="rgba(15,17,23,0.10)"
          strokeWidth="1"
        />
      </svg>

      <div
        className="absolute left-1/2 top-1/2 h-20 w-20 -translate-x-1/2 -translate-y-1/2 rounded-3xl bg-[var(--foreground)] text-[var(--background)] shadow-[var(--shadow)] flex items-center justify-center font-semibold"
        style={{
          transform: `translate(-50%, -50%) translate3d(${p.x * 8}px, ${
            p.y * 8
          }px, 0)`,
        }}
      >
        DouBow
      </div>

      {people.map((person) => {
        const dx = (person.z / 40) * p.x * 14;
        const dy = (person.z / 40) * p.y * 14;
        return (
          <div
            key={person.name}
            className={[
              "absolute -translate-x-1/2 -translate-y-1/2",
              "w-[252px] rounded-[16px]",
              "border border-black/5",
              "bg-white/75 backdrop-blur-[10px]",
              "shadow-[0_18px_60px_rgba(15,17,23,0.10),0_1px_0_rgba(255,255,255,0.55)_inset]",
              "flex items-center gap-3 px-4 py-3",
              "floaty",
            ].join(" ")}
            style={{
              left: `${person.x}%`,
              top: `${person.y}%`,
              zIndex: person.z,
              animationDelay: `${person.floatDelayMs}ms`,
              transform: `translate(-50%, -50%) translate3d(${dx}px, ${dy}px, 0)`,
            }}
          >
            <div className="relative h-10 w-10">
              <div
                className={[
                  "absolute inset-0 rounded-full",
                  "bg-[color-mix(in_srgb,var(--background)_30%,transparent)]",
                  "shadow-[0_16px_36px_rgba(15,17,23,0.10)]",
                  toneClass(person.tone),
                ].join(" ")}
                aria-hidden="true"
              />
              <PortraitThumb
                {...portraitFor(person.tone)}
                size={40}
                className="relative z-[1] ring-1 ring-black/10"
              />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-[13px] font-semibold tracking-tight leading-5 text-[var(--foreground)]">
                    {person.name}
                  </div>
                  <div className="truncate text-[11px] leading-4 text-[var(--muted)]">
                    {person.role}
                  </div>
                </div>
                <div className="mt-[2px] flex h-6 w-6 items-center justify-center rounded-md text-[var(--muted)]">
                  <span className="flex items-center gap-[3px]" aria-hidden="true">
                    <span className="h-[3px] w-[3px] rounded-full bg-black/35" />
                    <span className="h-[3px] w-[3px] rounded-full bg-black/35" />
                    <span className="h-[3px] w-[3px] rounded-full bg-black/35" />
                  </span>
                </div>
              </div>

              <div className="mt-1 flex items-center gap-2">
                <span className="truncate text-[10.5px] leading-4 text-[color-mix(in_srgb,var(--muted)_88%,transparent)]">
                  {person.start}
                </span>
                <span className="ml-auto flex items-center gap-1.5" aria-hidden="true">
                  <span className="grid h-5 w-5 place-items-center rounded-full bg-white/75 ring-1 ring-black/5">
                    <GoogleIcon width={12} height={12} style={{ color: "#4285F4" }} />
                  </span>
                  <span className="grid h-5 w-5 place-items-center rounded-full bg-white/75 ring-1 ring-black/5">
                    <LinkedInIcon width={12} height={12} style={{ color: "#0A66C2" }} />
                  </span>
                  <span className="grid h-5 w-5 place-items-center rounded-full bg-white/75 ring-1 ring-black/5">
                    <FacebookIcon width={12} height={12} style={{ color: "#1877F2" }} />
                  </span>
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

