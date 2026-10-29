import type { ReactNode } from "react";

interface IconProps {
  size?: number;
  strokeWidth?: number;
  className?: string;
}

function Icon({ size = 16, strokeWidth = 2, className, children }: IconProps & { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {children}
    </svg>
  );
}

export const HomeIcon = (p: IconProps) => (
  <Icon strokeWidth={2.2} {...p}>
    <path d="M3 11.5 12 4l9 7.5" />
    <path d="M5 10v9h14v-9" />
  </Icon>
);

export const UsersIcon = (p: IconProps) => (
  <Icon strokeWidth={2.2} {...p}>
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </Icon>
);

/** Arrow pointing toward the reading direction's start; used on "back"/"enter" links. */
export const ArrowIcon = (p: IconProps) => (
  <Icon size={14} {...p}>
    <path d="M19 12H5M12 19l-7-7 7-7" />
  </Icon>
);

export const WrenchIcon = (p: IconProps) => (
  <Icon size={14} {...p}>
    <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94z" />
  </Icon>
);
