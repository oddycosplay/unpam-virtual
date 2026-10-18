import type { UsageView } from "@unpam/shared";

export function formatTokens(n: number): string {
  return n >= 1000 ? `${(n / 1000).toLocaleString("id-ID", { maximumFractionDigits: 1 })} rb` : String(n);
}

/** Bilah pemakaian token AI hari ini terhadap batasnya. */
export function UsageBar({ usage, compact = false }: { usage: UsageView; compact?: boolean }) {
  const ratio = Math.min(1, usage.used / Math.max(1, usage.limit));
  const tone = ratio >= 1 ? "bad" : ratio >= 0.8 ? "warn" : "ok";
  return (
    <div className={`usage ${compact ? "compact" : ""}`}>
      <div
        className="usage-track"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={usage.limit}
        aria-valuenow={usage.used}
        aria-label="Pemakaian token AI hari ini"
      >
        <span className={`usage-fill ${tone}`} style={{ width: `${ratio * 100}%` }} />
      </div>
      <span className="usage-text">
        {formatTokens(usage.used)} / {formatTokens(usage.limit)} token
      </span>
    </div>
  );
}
