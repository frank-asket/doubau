import type { SVGProps } from "react";

type Variant = "black" | "white";

export function DouBowMark({
  variant = "black",
  size = 28,
  ...props
}: { variant?: Variant; size?: number } & Omit<SVGProps<SVGSVGElement>, "width" | "height">) {
  const fg = variant === "white" ? "#FFFFFF" : "#0D0D0D";
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      aria-hidden="true"
      {...props}
    >
      <path
        d="M32 6 55.2 19.4v25.2L32 58 8.8 44.6V19.4L32 6Z"
        stroke={fg}
        strokeWidth="3.5"
        strokeLinejoin="round"
      />
      <path
        d="M26 22h8.7c7.5 0 13.3 5.3 13.3 13.5S42.2 49 34.7 49H26V22Z"
        stroke={fg}
        strokeWidth="3.5"
        strokeLinejoin="round"
      />
      <path
        d="M26 35.5h9.2"
        stroke={fg}
        strokeWidth="3.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function DouBowWordmark({
  variant = "black",
  size = 28,
  text = "DouBow",
  ...props
}: {
  variant?: Variant;
  size?: number;
  text?: string;
} & Omit<SVGProps<SVGSVGElement>, "width" | "height">) {
  const fg = variant === "white" ? "#FFFFFF" : "#0D0D0D";
  return (
    <svg
      width={Math.round(size * 4.1)}
      height={size}
      viewBox="0 0 220 52"
      fill="none"
      aria-hidden="true"
      {...props}
    >
      <text
        x="0"
        y="38"
        fill={fg}
        fontFamily="Newsreader, ui-serif, Georgia, serif"
        fontSize="40"
        fontWeight="600"
        letterSpacing="-0.5"
      >
        {text}
      </text>
    </svg>
  );
}

export function DouBowLogo({
  variant = "black",
  text = "DouBow",
  size = 28,
}: {
  variant?: Variant;
  text?: string;
  size?: number;
}) {
  const fg = variant === "white" ? "#FFFFFF" : "#0D0D0D";
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 10, color: fg }}>
      <DouBowMark variant={variant} size={size} />
      <span
        style={{
          fontFamily: "var(--font-display), Newsreader, ui-serif, Georgia, serif",
          fontWeight: 600,
          letterSpacing: "-0.02em",
          fontSize: 18,
          lineHeight: 1,
        }}
      >
        {text}
      </span>
    </span>
  );
}

