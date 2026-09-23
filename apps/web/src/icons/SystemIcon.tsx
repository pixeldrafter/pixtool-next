/**
 * Sistem ikonları — elle çizilmiş SVG.
 *
 * Neden SVG (emoji yerine)?
 *   • Emoji font/OS'a göre değişir → tutarsız görünüm
 *   • SVG keskin, ölçeklenebilir ve renk kontrolü tam
 *   • Windows/Fluent görsel diline yaklaşır
 *
 * Her ikon 32×32 kutuya göredir, `currentColor` kullanmaz (renk katmanlı).
 */

import type { SVGProps } from "react";

export type SystemIconName =
  | "overview"
  | "scripts"
  | "terminal"
  | "files"
  | "users"
  | "database"
  | "resources"
  | "status"
  | "settings"
  | "about"
  | "note"
  | "folder";

interface IconProps extends SVGProps<SVGSVGElement> {
  size?: number;
}

/** Ortak sarmalayıcı — 32×32 görünüm kutusu. */
function Svg({ size = 32, children, ...rest }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...rest}
    >
      {children}
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  Pano / grafik                                                      */
/* ------------------------------------------------------------------ */
function OverviewIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="3" y="5" width="26" height="22" rx="2.5" fill="#2f6fd0" />
      <rect x="3" y="5" width="26" height="5" rx="2.5" fill="#4a8ee8" />
      <rect x="6" y="13" width="6" height="10" rx="1" fill="#8fd4ff" />
      <rect x="13.5" y="17" width="6" height="6" rx="1" fill="#b6e4ff" />
      <rect x="21" y="14" width="5" height="9" rx="1" fill="#5fb0f0" />
    </Svg>
  );
}

function ResourcesIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="3" y="4" width="26" height="24" rx="3" fill="#1f5aa8" />
      <path d="M7 22l5-7 4 4 5-9 4 12" stroke="#7fe3a0" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </Svg>
  );
}

function StatusIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="4" y="5" width="24" height="17" rx="2.5" fill="#2b579a" />
      <rect x="6" y="7.5" width="20" height="12" rx="1" fill="#63b3f5" />
      <path d="M12 22h8v3h-8z" fill="#8fa8c8" />
      <circle cx="16" cy="13.5" r="3.2" fill="#0d3a6b" opacity="0.75" />
      <path d="M16 11.6v2.2l1.5 1" stroke="#dbeaff" strokeWidth="1.3" strokeLinecap="round" />
    </Svg>
  );
}

/* ------------------------------------------------------------------ */
/*  Kod / script                                                       */
/* ------------------------------------------------------------------ */
function ScriptsIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M7 3h12l6 6v20a1.6 1.6 0 0 1-1.6 1.6H7A1.6 1.6 0 0 1 5.4 29V4.6A1.6 1.6 0 0 1 7 3z" fill="#f4f6f9" />
      <path d="M19 3l6 6h-6z" fill="#c6d2e0" />
      <path d="M10.5 13.5l-2.6 3 2.6 3M15 12l-2 9M18.2 13.5l2.6 3-2.6 3" stroke="#3c78c8" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </Svg>
  );
}

function TerminalIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="3" y="5" width="26" height="22" rx="2.5" fill="#0c0c0c" />
      <rect x="3" y="5" width="26" height="4.5" rx="2.5" fill="#2b2b2b" />
      <circle cx="6.5" cy="7.2" r="1" fill="#ff5f57" />
      <circle cx="9.8" cy="7.2" r="1" fill="#febc2e" />
      <circle cx="13.1" cy="7.2" r="1" fill="#28c840" />
      <path d="M7 14l3.4 3L7 20" stroke="#4ee06a" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <path d="M13 20.5h6" stroke="#9be4a8" strokeWidth="1.8" strokeLinecap="round" />
    </Svg>
  );
}

/* ------------------------------------------------------------------ */
/*  Klasör / dosya                                                     */
/* ------------------------------------------------------------------ */
function FolderShape({ front = "#ffd166", back = "#f0b429" }: { front?: string; back?: string }) {
  return (
    <>
      <path d="M3 8.5A2.5 2.5 0 0 1 5.5 6h6.2l2.6 3h12a2.5 2.5 0 0 1 2.5 2.5v13A2.5 2.5 0 0 1 26.3 27H5.5A2.5 2.5 0 0 1 3 24.5z" fill={back} />
      <path d="M3 12.5A2.5 2.5 0 0 1 5.5 10h21A2.5 2.5 0 0 1 29 12.5v12A2.5 2.5 0 0 1 26.5 27h-21A2.5 2.5 0 0 1 3 24.5z" fill={front} />
      <path d="M3 14h26v2H3z" fill="#ffffff" opacity="0.22" />
    </>
  );
}

function FilesIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <FolderShape />
    </Svg>
  );
}

/* ------------------------------------------------------------------ */
/*  Veri / kullanıcı                                                   */
/* ------------------------------------------------------------------ */
function DatabaseIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <ellipse cx="16" cy="7" rx="10" ry="4" fill="#8f6ad6" />
      <path d="M6 7v18c0 2.2 4.5 4 10 4s10-1.8 10-4V7" fill="#a98ae4" />
      <ellipse cx="16" cy="7" rx="10" ry="4" fill="#c4b0f5" />
      <ellipse cx="16" cy="15" rx="10" ry="4" fill="none" stroke="#6b4bb5" strokeWidth="1.2" opacity="0.7" />
      <ellipse cx="16" cy="22" rx="10" ry="4" fill="none" stroke="#6b4bb5" strokeWidth="1.2" opacity="0.7" />
    </Svg>
  );
}

function UsersIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="11" r="4.6" fill="#5aa9e6" />
      <path d="M3.5 26c0-4.7 3.8-8.2 8.5-8.2s8.5 3.5 8.5 8.2z" fill="#7fc1f0" />
      <circle cx="22.5" cy="12.5" r="3.5" fill="#8ad48a" />
      <path d="M15 26c0-4 3.2-7 7.2-7s6.8 3 6.8 7z" fill="#a8e0a8" />
    </Svg>
  );
}

/* ------------------------------------------------------------------ */
/*  Ayar / bilgi / not                                                */
/* ------------------------------------------------------------------ */
function SettingsIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path
        d="M16 3.2l2.3 2.1 3-.6.9 2.9 2.7 1.4-1 2.9 1 2.9-2.7 1.4-.9 2.9-3-.6-2.3 2.1-2.3-2.1-3 .6-.9-2.9-2.7-1.4 1-2.9-1-2.9 2.7-1.4.9-2.9 3 .6z"
        fill="#9aa7b5"
      />
      <circle cx="16" cy="16" r="4.4" fill="#3b4654" />
      <circle cx="16" cy="16" r="1.8" fill="#cfd8e3" />
    </Svg>
  );
}

function AboutIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="16" cy="16" r="13" fill="#2d7dd2" />
      <circle cx="16" cy="16" r="13" fill="url(#aboutGrad)" />
      <defs>
        <linearGradient id="aboutGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.28" />
          <stop offset="100%" stopColor="#000000" stopOpacity="0.18" />
        </linearGradient>
      </defs>
      <circle cx="16" cy="10" r="1.9" fill="#ffffff" />
      <rect x="14.2" y="13.4" width="3.6" height="10" rx="1.4" fill="#ffffff" />
    </Svg>
  );
}

function NoteIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M5 4.5A1.5 1.5 0 0 1 6.5 3h19A1.5 1.5 0 0 1 27 4.5V20l-7 9H6.5A1.5 1.5 0 0 1 5 27.5z" fill="#ffe066" />
      <path d="M20 29l7-9h-7z" fill="#f0c419" />
      <path d="M9 9h14M9 13.5h14M9 18h9" stroke="#b09000" strokeWidth="1.5" strokeLinecap="round" />
    </Svg>
  );
}

/* ------------------------------------------------------------------ */
/*  Kayıt defteri                                                      */
/* ------------------------------------------------------------------ */
const REGISTRY = {
  overview: OverviewIcon,
  resources: ResourcesIcon,
  status: StatusIcon,
  scripts: ScriptsIcon,
  terminal: TerminalIcon,
  files: FilesIcon,
  folder: FilesIcon,
  users: UsersIcon,
  database: DatabaseIcon,
  settings: SettingsIcon,
  about: AboutIcon,
  note: NoteIcon,
} as const;

/** İsimle sistem ikonu çizer. */
export function SystemIcon({
  name,
  size = 32,
  ...rest
}: IconProps & { name: SystemIconName }) {
  const Component = REGISTRY[name] ?? OverviewIcon;
  return <Component size={size} {...rest} />;
}
