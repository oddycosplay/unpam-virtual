import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import type { ChatMessageView, ChatReply, ChatSource } from "@unpam/shared";
import { api } from "../../api/http";
import { RichText } from "../../components/ui/RichText";

const AGENT_ID = "akademik";
const SUGGESTIONS = ["Kapan jadwal UTS semester ini?", "Bagaimana cara mengisi KRS?", "Apa syarat mengajukan judul skripsi?"];

function Sources({ sources }: { sources: ChatSource[] }) {
  if (sources.length === 0) return null;
  return (
    <div className="sources">
      <p className="sources-title">Sumber</p>
      <ol>
        {sources.map((s) => (
          <li key={s.ref} value={s.ref}>
            <details>
              <summary>
                <strong>{s.documentTitle}</strong>
                {s.section && <span className="muted"> · {s.section}</span>}
              </summary>
              <blockquote>{s.excerpt}</blockquote>
            </details>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function ChatPage() {
  const [messages, setMessages] = useState<ChatMessageView[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api<{ messages: ChatMessageView[] }>(`/api/agents/${AGENT_ID}/messages`)
      .then((r) => setMessages(r.messages))
      .catch((e: Error) => setError(e.message));
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, sending]);

  async function send(text: string) {
    const message = text.trim();
    if (!message || sending) return;
    setSending(true);
    setError(null);
    setDraft("");
    try {
      const r = await api<ChatReply>(`/api/agents/${AGENT_ID}/chat`, { method: "POST", body: { message } });
      setMessages((prev) => [...prev, r.userMessage, r.reply]);
    } catch (e) {
      setError((e as Error).message);
      setDraft(message);
    } finally {
      setSending(false);
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void send(draft);
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send(draft);
    }
  }

  return (
    <section className="chat card">
      <header className="chat-header">
        <span className="agent-avatar" aria-hidden>
          A
        </span>
        <div>
          <h2>Agent Akademik</h2>
          <p className="muted small">
            Asisten AI, bukan sumber resmi kampus. Jawaban diambil dari dokumen yang diunggah admin.
          </p>
        </div>
      </header>

      <div className="chat-log" aria-live="polite">
        {messages.length === 0 && !sending && (
          <div className="chat-empty">
            <p className="muted">Tanyakan jadwal, prosedur, atau kalender akademik.</p>
            <div className="row">
              {SUGGESTIONS.map((s) => (
                <button key={s} type="button" className="chip" onClick={() => void send(s)}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m) => (
          <div key={m.id} className={`bubble ${m.role} ${m.status === "error" ? "is-error" : ""}`}>
            {m.role === "assistant" ? (
              <>
                <RichText text={m.content} />
                <Sources sources={m.sources} />
              </>
            ) : (
              <p>{m.content}</p>
            )}
          </div>
        ))}
        {sending && <div className="bubble assistant pending">Mencari di dokumen akademik…</div>}
        <div ref={endRef} />
      </div>

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <form className="chat-input" onSubmit={onSubmit}>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Tulis pertanyaan… (Enter untuk kirim)"
          rows={2}
          maxLength={2000}
          aria-label="Pertanyaan untuk Agent Akademik"
        />
        <button type="submit" disabled={sending || !draft.trim()}>
          Kirim
        </button>
      </form>
    </section>
  );
}
