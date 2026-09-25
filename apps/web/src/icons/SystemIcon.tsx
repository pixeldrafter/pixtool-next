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
  | "folder"
  | "tools"
  | "notes"
  | "browser"
  | "games"
  | "backups";

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
function ToolsIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="3" y="18" width="26" height="9" rx="2.5" fill="#c0392b" />
      <rect x="3" y="18" width="26" height="3" rx="1.5" fill="#e05244" />
      <path d="M9 18v-4h2v4zM11 12h9v2H11z" fill="#b8c1cc" />
      <rect x="7" y="8" width="12" height="4" rx="1.5" fill="#8b98a8" />
      <path d="M21 7l3.2 12.2h-6.4z" fill="#f2c14e" />
      <path d="M21 10.5l1.6 6h-3.2z" fill="#fff3cd" />
      <circle cx="21" cy="6" r="1.8" fill="#e8eef5" />
    </Svg>
  );
}

function NotesIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="4" y="7" width="16" height="16" rx="2" fill="#ffd166" transform="rotate(-8 12 15)" />
      <rect x="10" y="5" width="18" height="18" rx="2.5" fill="#7ee787" />
      <path d="M14 11h10M14 15h10M14 19h6" stroke="#2f6b3a" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M10 5h18v2H10z" fill="#b7f0be" />
    </Svg>
  );
}

function BrowserIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="16" cy="16" r="12" fill="#1f6fe0" />
      <ellipse cx="16" cy="16" rx="5.2" ry="12" fill="none" stroke="#bfe3ff" strokeWidth="1.4" />
      <path d="M4.4 12h23.2M4.4 20h23.2" stroke="#bfe3ff" strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="16" cy="16" r="12" fill="none" stroke="#0b2b4d" strokeWidth="1.4" />
    </Svg>
  );
}

function GamesIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="3" y="10" width="26" height="14" rx="7" fill="#3f3f46" />
      <rect x="3" y="10" width="26" height="5" rx="2.5" fill="#52525b" />
      <path d="M9.5 15v4M7.5 17h4" stroke="#e4e4e7" strokeWidth="1.7" strokeLinecap="round" />
      <circle cx="21" cy="15.5" r="1.6" fill="#f2c14e" />
      <circle cx="23.6" cy="18.6" r="1.6" fill="#7ee787" />
      <circle cx="18.4" cy="18.6" r="1.6" fill="#ff6b6b" />
    </Svg>
  );
}

function BackupsIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="4" y="6" width="24" height="20" rx="2.5" fill="#2f6fd0" />
      <rect x="4" y="6" width="24" height="5" rx="2.5" fill="#4a8ee8" />
      <circle cx="16" cy="18" r="5" fill="none" stroke="#bfe3ff" strokeWidth="2" />
      <path d="M16 15.6V18l1.8 1.4" stroke="#dbeaff" strokeWidth="1.8" strokeLinecap="round" />
    </Svg>
  );
}

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
  tools: ToolsIcon,
  notes: NotesIcon,
  browser: BrowserIcon,
  games: GamesIcon,
  backups: BackupsIcon,
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
