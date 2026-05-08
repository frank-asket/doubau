import type { SVGProps } from "react";

type Props = SVGProps<SVGSVGElement>;

export function CompassIcon(props: Props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="M14.9 9.1L13.4 13.4L9.1 14.9L10.6 10.6L14.9 9.1Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path
        d="M12 7.4V6.2M12 17.8V16.6M6.2 12H7.4M16.6 12H17.8"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        opacity="0.85"
      />
    </svg>
  );
}

export function UsersIcon(props: Props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path
        d="M9.3 11.2c1.8 0 3.3-1.45 3.3-3.25S11.1 4.7 9.3 4.7 6 6.15 6 7.95s1.5 3.25 3.3 3.25Z"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <path
        d="M14.9 10.4c1.5 0 2.7-1.2 2.7-2.65S16.4 5.1 14.9 5.1"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        opacity="0.9"
      />
      <path
        d="M4.9 18.8c.55-3.1 2.9-5.1 6-5.1s5.45 2 6 5.1"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <path
        d="M16.5 13.95c1.9.55 3.2 2.1 3.55 4.85"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        opacity="0.9"
      />
    </svg>
  );
}

export function ChatIcon(props: Props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path
        d="M6.4 17.8l-1.9 1.5v-3.1c-1.1-1.2-1.8-2.7-1.8-4.3 0-4 4.2-7.2 9.3-7.2s9.3 3.2 9.3 7.2-4.2 7.2-9.3 7.2c-2 0-3.9-.5-5.6-1.3Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path
        d="M8.2 11.9h.01M12 11.9h.01M15.8 11.9h.01"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

