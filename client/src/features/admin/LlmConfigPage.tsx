import { useEffect, useState, type FormEvent } from "react";
import type { LlmConfigView, LlmProviderKind, LlmTestResult } from "@unpam/shared";
import { api } from "../../api/http";

export function LlmConfigPage() {
  const [config, setConfig] = useState<LlmConfigView | null>(null);
  const [provider, setProvider] = useState<LlmProviderKind>("anthropic");
  const [baseUrl, setBaseUrl] = useState("");
  const [model, setModel] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [test, setTest] = useState<LlmTestResult | null>(null);
  const [busy, setBusy] = useState(false);

  function apply(c: LlmConfigView) {
    setConfig(c);
    setProvider(c.provider);
    setBaseUrl(c.baseUrl);
    setModel(c.model);
  }

  useEffect(() => {
    api<{ config: LlmConfigView }>("/api/admin/llm-config").then((r) => apply(r.config));
  }, []);

  async function onSave(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const r = await api<{ config: LlmConfigView }>("/api/admin/llm-config", {
        method: "PUT",
        body: { provider, baseUrl, model, apiKey: apiKey || undefined },
      });
      apply(r.config);
      setApiKey("");
      setMessage({ kind: "ok", text: "Konfigurasi tersimpan." });
    } catch (err) {
      setMessage({ kind: "error", text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  }

  async function onTest() {
    setBusy(true);
    setTest(null);
    try {
      setTest(await api<LlmTestResult>("/api/admin/llm-config/test", { method: "POST" }));
    } finally {
      setBusy(false);
    }
  }

  if (!config) return <p className="muted">Memuat…</p>;

  return (
    <section className="card narrow">
      <h2>Provider AI</h2>
      <p className="muted">
        Sumber aktif: {config.source === "database" ? "panel admin" : "file .env"}
        {config.updatedAt && ` · diperbarui ${new Date(config.updatedAt).toLocaleString("id-ID")}`}
      </p>
      <form onSubmit={onSave}>
        <label>
          Provider
          <select value={provider} onChange={(e) => setProvider(e.target.value as LlmProviderKind)}>
            <option value="anthropic">Anthropic (Claude API)</option>
            <option value="openai-compatible">OpenAI-compatible (OpenRouter, 9router, Ollama)</option>
          </select>
        </label>
        <label>
          Base URL
          <input
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder={provider === "anthropic" ? "Kosongkan untuk Claude API resmi" : "http://localhost:11434/v1"}
          />
        </label>
        <label>
          Model
          <input value={model} onChange={(e) => setModel(e.target.value)} required />
        </label>
        <label>
          API key
          <input
            type="password"
            autoComplete="off"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={config.hasApiKey ? `Tersimpan (…${config.apiKeyLast4}). Kosongkan bila tidak diganti.` : "Belum ada"}
          />
        </label>
        {message && <p className={message.kind === "ok" ? "success" : "error"}>{message.text}</p>}
        <div className="row">
          <button type="submit" disabled={busy}>
            Simpan
          </button>
          <button type="button" className="secondary" onClick={onTest} disabled={busy}>
            Uji koneksi
          </button>
        </div>
      </form>
      {test && (
        <div className={`test-result ${test.ok ? "success" : "error"}`} role="status">
          {test.ok
            ? `Terhubung ke ${test.model} dalam ${test.latencyMs} ms. Balasan: "${test.reply}"`
            : `Gagal (${test.latencyMs} ms): ${test.error}`}
        </div>
      )}
    </section>
  );
}
