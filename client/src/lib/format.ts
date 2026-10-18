/** Waktu dari server: SQLite "YYYY-MM-DD HH:MM:SS" (UTC) atau ISO. */
export function parseServerTime(value: string): Date {
  return new Date(value.includes("T") ? value : `${value.replace(" ", "T")}Z`);
}

export function formatDateTime(value: string): string {
  return parseServerTime(value).toLocaleString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function timeAgo(value: string): string {
  const diff = (Date.now() - parseServerTime(value).getTime()) / 1000;
  if (diff < 60) return "baru saja";
  if (diff < 3600) return `${Math.floor(diff / 60)} mnt lalu`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} jam lalu`;
  return formatDateTime(value);
}

export function rupiah(n: number): string {
  return `Rp${Math.round(n).toLocaleString("id-ID")}`;
}
