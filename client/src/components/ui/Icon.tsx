// Ikon garis sederhana 24×24 (stroke), cukup untuk navigasi.
const PATHS = {
  dashboard: "M4 13h6V4H4v9Zm0 7h6v-4H4v4Zm10 0h6v-9h-6v9Zm0-16v4h6V4h-6Z",
  board: "M4 4h4v16H4zM10 4h4v10h-4zM16 4h4v13h-4z",
  work: "M7 3h8l4 4v14H7zM15 3v4h4M10 12h6M10 16h6",
  chat: "M4 5h16v10H9l-5 4V5Z",
  documents: "M6 3h9l4 4v14H6zM15 3v4h4M9 11h7M9 15h7",
  audit: "M12 3 4 6v6c0 4.4 3.4 8.3 8 9 4.6-.7 8-4.6 8-9V6l-8-3Zm-3 9 2 2 4-4",
  provider: "M9 3v3M15 3v3M9 18v3M15 18v3M3 9h3M3 15h3M18 9h3M18 15h3M7 6h10v12H7z",
  menu: "M4 7h16M4 12h16M4 17h16",
  close: "M6 6l12 12M18 6 6 18",
  download: "M12 4v11M7 10l5 5 5-5M5 20h14",
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d={PATHS[name]} />
    </svg>
  );
}
