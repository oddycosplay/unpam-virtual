import type { ReactNode } from "react";

// Markdown minimal untuk jawaban agent: paragraf, daftar (- / 1.), **tebal**, dan rujukan [n].
// Semua teks dirender sebagai elemen React, jadi tidak ada HTML mentah yang disisipkan.

function inline(text: string, keyPrefix: string): ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*|\[\d+\])/g);
  return parts.map((part, i) => {
    const key = `${keyPrefix}-${i}`;
    if (/^\*\*[^*]+\*\*$/.test(part)) return <strong key={key}>{part.slice(2, -2)}</strong>;
    if (/^\[\d+\]$/.test(part)) return <sup key={key} className="cite">{part}</sup>;
    return part;
  });
}

export function RichText({ text }: { text: string }) {
  const blocks = text.replace(/\r\n/g, "\n").split(/\n\s*\n/);
  return (
    <div className="rich-text">
      {blocks.map((block, b) => {
        const lines = block.split("\n").filter((l) => l.trim());
        if (lines.length === 0) return null;
        const bullet = lines.every((l) => /^\s*[-*]\s+/.test(l));
        const numbered = lines.every((l) => /^\s*\d+[.)]\s+/.test(l));
        if (bullet || numbered) {
          const items = lines.map((l, i) => (
            <li key={i}>{inline(l.replace(/^\s*(?:[-*]|\d+[.)])\s+/, ""), `${b}-${i}`)}</li>
          ));
          return numbered ? <ol key={b}>{items}</ol> : <ul key={b}>{items}</ul>;
        }
        return (
          <p key={b}>
            {lines.map((l, i) => (
              <span key={i}>
                {i > 0 && <br />}
                {inline(l, `${b}-${i}`)}
              </span>
            ))}
          </p>
        );
      })}
    </div>
  );
}
