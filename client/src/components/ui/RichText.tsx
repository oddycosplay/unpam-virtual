import type { ReactNode } from "react";

// Markdown minimal untuk jawaban agent: paragraf, daftar (- / * / 1.), **tebal**, dan rujukan [n].
// Semua teks dirender sebagai elemen React, jadi tidak ada HTML mentah yang disisipkan.

const BULLET = /^\s*[-*•]\s+/;
const NUMBERED = /^\s*\d+[.)]\s+/;

function inline(text: string, keyPrefix: string): ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*|\[\d+\])/g);
  return parts.map((part, i) => {
    const key = `${keyPrefix}-${i}`;
    if (/^\*\*[^*]+\*\*$/.test(part)) return <strong key={key}>{part.slice(2, -2)}</strong>;
    if (/^\[\d+\]$/.test(part)) return <sup key={key} className="cite">{part}</sup>;
    return part;
  });
}

type Segment = { kind: "p" | "ul" | "ol"; lines: string[] };

/** Pecah satu blok menjadi paragraf dan daftar; baris daftar boleh bercampur dengan baris biasa. */
function segments(lines: string[]): Segment[] {
  const out: Segment[] = [];
  for (const line of lines) {
    const kind: Segment["kind"] = BULLET.test(line) ? "ul" : NUMBERED.test(line) ? "ol" : "p";
    const last = out.at(-1);
    if (last && last.kind === kind) last.lines.push(line);
    else out.push({ kind, lines: [line] });
  }
  return out;
}

export function RichText({ text }: { text: string }) {
  const blocks = text.replace(/\r\n/g, "\n").split(/\n\s*\n/);
  return (
    <div className="rich-text">
      {blocks.flatMap((block, b) =>
        segments(block.split("\n").filter((l) => l.trim())).map((seg, s) => {
          const key = `${b}-${s}`;
          if (seg.kind === "p") {
            return (
              <p key={key}>
                {seg.lines.map((l, i) => (
                  <span key={i}>
                    {i > 0 && <br />}
                    {inline(l, `${key}-${i}`)}
                  </span>
                ))}
              </p>
            );
          }
          const items = seg.lines.map((l, i) => <li key={i}>{inline(l.replace(seg.kind === "ul" ? BULLET : NUMBERED, ""), `${key}-${i}`)}</li>);
          return seg.kind === "ol" ? <ol key={key}>{items}</ol> : <ul key={key}>{items}</ul>;
        }),
      )}
    </div>
  );
}
