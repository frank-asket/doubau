import type { CSSProperties } from "react";
import { useId, useMemo } from "react";

type Variant = 0 | 1 | 2 | 3 | 4;

type Palette = {
  skin: string;
  hair: string;
  shirt: string;
};

type Vars = CSSProperties & Record<"--skin" | "--hair" | "--shirt", string>;

export function PortraitThumb({
  palette,
  variant = 0,
  size = 40,
  className = "",
}: {
  palette: Palette;
  variant?: Variant;
  size?: number;
  className?: string;
}) {
  const uid = useId().replace(/:/g, "");
  const bgId = `bg-${uid}`;
  const skinId = `skin-${uid}`;
  const shadowId = `shadow-${uid}`;
  const motionOk = useMemo(
    () =>
      typeof window !== "undefined" &&
      !window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches,
    [],
  );

  const vars: Vars = {
    "--skin": palette.skin,
    "--hair": palette.hair,
    "--shirt": palette.shirt,
  };

  return (
    <div
      className={[
        "relative overflow-hidden rounded-full",
        "border-2 border-white/95",
        "bg-white/70 shadow-[0_14px_32px_rgba(15,17,23,0.10)]",
        className,
      ].join(" ")}
      style={{ width: size, height: size, ...vars }}
      aria-hidden="true"
    >
      <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full" aria-hidden="true">
        <defs>
          <linearGradient id={bgId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="rgba(255,255,255,0.92)" />
            <stop offset="1" stopColor="rgba(15,17,23,0.08)" />
          </linearGradient>
          <radialGradient id={skinId} cx="35%" cy="28%" r="70%">
            <stop offset="0" stopColor="rgba(255,255,255,0.42)" />
            <stop offset="0.5" stopColor="rgba(255,255,255,0.06)" />
            <stop offset="1" stopColor="rgba(0,0,0,0.10)" />
          </radialGradient>
          <filter id={shadowId} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="2" stdDeviation="2.2" floodColor="rgba(15,17,23,0.25)" />
          </filter>
        </defs>

        <rect x="0" y="0" width="100" height="100" rx="22" fill={`url(#${bgId})`} />

        {/* neck / shirt */}
        <path
          d="M18 110 C24 82, 36 70, 50 70 C64 70, 76 82, 82 110 Z"
          fill="var(--shirt)"
          opacity="0.92"
        />
        <path
          d="M26 86 C33 80, 41 76, 50 76 C59 76, 67 80, 74 86"
          fill="none"
          stroke="rgba(255,255,255,0.22)"
          strokeWidth="3"
          strokeLinecap="round"
          opacity="0.8"
        />

        {/* face */}
        <g filter={`url(#${shadowId})`}>
          <ellipse cx="50" cy="46" rx="22" ry="26" fill="var(--skin)" />
          <ellipse cx="50" cy="44" rx="22" ry="26" fill={`url(#${skinId})`} opacity="0.9" />
        </g>

        {/* hair variants */}
        {variant === 0 ? (
          <path
            d="M28 44 C28 24, 42 18, 50 18 C62 18, 74 26, 74 44
               C72 36, 64 30, 56 30 C44 30, 38 36, 28 44 Z"
            fill="var(--hair)"
            opacity="0.98"
          />
        ) : variant === 1 ? (
          <path
            d="M26 48 C26 24, 40 16, 52 16 C66 16, 76 28, 76 48
               C72 40, 66 36, 56 34 C46 32, 38 36, 26 48 Z"
            fill="var(--hair)"
            opacity="0.98"
          />
        ) : variant === 2 ? (
          <>
            <path
              d="M26 46 C26 24, 42 14, 52 14 C66 14, 78 26, 78 46
                 C76 34, 66 30, 58 28 C46 26, 38 32, 26 46 Z"
              fill="var(--hair)"
              opacity="0.98"
            />
            <circle cx="76" cy="30" r="10" fill="var(--hair)" opacity="0.95" />
          </>
        ) : variant === 3 ? (
          <>
            {/* short hair + glasses */}
            <path
              d="M28 44 C28 26, 40 20, 52 20 C66 20, 74 30, 74 44
                 C70 38, 62 36, 54 34 C44 32, 36 36, 28 44 Z"
              fill="var(--hair)"
              opacity="0.98"
            />
            <path
              d="M36 53 C38 50, 42 50, 44 53 C42 57, 38 57, 36 53Z
                 M56 53 C58 50, 62 50, 64 53 C62 57, 58 57, 56 53Z"
              fill="none"
              stroke="rgba(15,17,23,0.46)"
              strokeWidth="2.2"
              strokeLinejoin="round"
            />
            <path
              d="M44 53H56"
              stroke="rgba(15,17,23,0.34)"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </>
        ) : (
          <>
            {/* longer hair */}
            <path
              d="M26 48 C26 22, 44 16, 54 16 C70 16, 80 30, 80 48
                 C76 40, 68 38, 60 36 C46 33, 36 37, 26 48 Z"
              fill="var(--hair)"
              opacity="0.98"
            />
            <path
              d="M30 54 C28 64, 28 74, 33 82"
              fill="none"
              stroke="var(--hair)"
              strokeWidth="10"
              strokeLinecap="round"
              opacity="0.75"
            />
          </>
        )}

        {/* eyes */}
        <path
          d="M39 48 C41 46, 44 46, 46 48"
          fill="none"
          stroke="rgba(15,17,23,0.60)"
          strokeWidth="2.2"
          strokeLinecap="round"
        />
        <path
          d="M54 48 C56 46, 59 46, 61 48"
          fill="none"
          stroke="rgba(15,17,23,0.60)"
          strokeWidth="2.2"
          strokeLinecap="round"
        />
        <circle cx="43.3" cy="50.4" r="1.6" fill="rgba(15,17,23,0.70)" />
        <circle cx="57.7" cy="50.4" r="1.6" fill="rgba(15,17,23,0.70)" />

        {/* nose */}
        <path
          d="M50 52 C49.2 56, 48.8 58.4, 50.8 60"
          fill="none"
          stroke="rgba(15,17,23,0.22)"
          strokeWidth="2"
          strokeLinecap="round"
        />

        {/* mouth */}
        <path
          d="M44 66 C47 69, 53 69, 56 66"
          fill="none"
          stroke="rgba(15,17,23,0.34)"
          strokeWidth="2.2"
          strokeLinecap="round"
        />

        {/* optional subtle grain (disabled for prefers-reduced-motion / SSR) */}
        {motionOk ? (
          <g opacity="0.18">
            <filter id={`grain-${uid}`}>
              <feTurbulence
                type="fractalNoise"
                baseFrequency="0.75"
                numOctaves="1"
                stitchTiles="stitch"
              />
              <feColorMatrix
                type="matrix"
                values="
                  1 0 0 0 0
                  0 1 0 0 0
                  0 0 1 0 0
                  0 0 0 0.10 0"
              />
            </filter>
            <rect
              x="0"
              y="0"
              width="100"
              height="100"
              rx="22"
              filter={`url(#grain-${uid})`}
            />
          </g>
        ) : null}
      </svg>
    </div>
  );
}

