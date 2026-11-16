import type { ReactNode } from "react";

type IconProps = { size?: number };

function Svg({ size = 24, children }: IconProps & { children: ReactNode }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}

export function MenuIcon({ size }: IconProps) {
  return (
    <Svg size={size}>
      <path d="M4 7h16" />
      <path d="M4 12h16" />
      <path d="M4 17h16" />
    </Svg>
  );
}

export function PlusIcon({ size }: IconProps) {
  return (
    <Svg size={size}>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </Svg>
  );
}

export function ArrowRightIcon({ size }: IconProps) {
  return (
    <Svg size={size}>
      <path d="M5 12h14" />
      <path d="m13 6 6 6-6 6" />
    </Svg>
  );
}

export function ArrowUpRightIcon({ size }: IconProps) {
  return (
    <Svg size={size}>
      <path d="M7 17 17 7" />
      <path d="M8 7h9v9" />
    </Svg>
  );
}

export function CloseIcon({ size }: IconProps) {
  return (
    <Svg size={size}>
      <path d="M6 6l12 12" />
      <path d="M18 6 6 18" />
    </Svg>
  );
}

export function SearchIcon({ size }: IconProps) {
  return (
    <Svg size={size}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </Svg>
  );
}

export function ChevronIcon({ size }: IconProps) {
  return (
    <Svg size={size}>
      <path d="m9 6 6 6-6 6" />
    </Svg>
  );
}

export function CheckIcon({ size }: IconProps) {
  return (
    <Svg size={size}>
      <path d="m5 12 5 5L20 7" />
    </Svg>
  );
}

export function FlameIcon({ size }: IconProps) {
  return (
    <Svg size={size}>
      <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.4-.5-2-1-3-1.1-2.1-.2-4 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.2.4-2.3 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
    </Svg>
  );
}

export function BookIcon({ size }: IconProps) {
  return (
    <Svg size={size}>
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </Svg>
  );
}

export function InfoIcon({ size }: IconProps) {
  return (
    <Svg size={size}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v6" />
      <path d="M12 8h.01" />
    </Svg>
  );
}

export function BackIcon({ size }: IconProps) {
  return (
    <Svg size={size}>
      <path d="M15 6 9 12l6 6" />
    </Svg>
  );
}

export function WordIcon({ size }: IconProps) {
  return <Svg size={size}><text x="2" y="18" fill="currentColor" stroke="none" fontFamily="Georgia, serif" fontSize="18">Aa</text></Svg>;
}
