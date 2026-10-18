import type { Role } from "./roles";
import type { AgentStatus, TaskStatus } from "./status";

export interface PublicUser {
  id: number;
  email: string;
  name: string;
  role: Role;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export type LlmProviderKind = "anthropic" | "openai-compatible";

export interface LlmConfigView {
  provider: LlmProviderKind;
  baseUrl: string;
  model: string;
  /** API key tidak pernah dikirim balik; hanya penanda dan 4 karakter terakhir. */
  hasApiKey: boolean;
  apiKeyLast4: string | null;
  source: "database" | "env";
  updatedAt: string | null;
}

export interface LlmConfigUpdate {
  provider: LlmProviderKind;
  baseUrl: string;
  model: string;
  /** Kosong/undefined = pertahankan key lama. */
  apiKey?: string;
}

export interface LlmTestResult {
  ok: boolean;
  provider: LlmProviderKind;
  model: string;
  latencyMs: number;
  reply?: string;
  error?: string;
}

export interface ChatSource {
  /** Nomor rujukan yang dipakai agent di jawaban, mis. [1]. */
  ref: number;
  documentId: number;
  documentTitle: string;
  section: string | null;
  page: number | null;
  excerpt: string;
}

export interface ChatMessageView {
  id: number;
  role: "user" | "assistant";
  content: string;
  sources: ChatSource[];
  status: "ok" | "error";
  createdAt: string;
}

export interface ChatReply {
  userMessage: ChatMessageView;
  reply: ChatMessageView;
}

export interface KnowledgeDocumentView {
  id: number;
  title: string;
  fileName: string;
  mimeType: string;
  agentScope: string;
  chunkCount: number;
  createdAt: string;
}

export interface AgentStatusView {
  id: "orkestrator" | "akademik" | "hima";
  name: string;
  status: AgentStatus;
  /** Teks pendek untuk label di atas agent, mis. "Menjawab pertanyaan jadwal". */
  activity: string;
  active: boolean;
}

export interface ActivityItem {
  id: number;
  at: string;
  /** Kalimat siap tampil, mis. "Agent Akademik menjawab pertanyaan (4,1 dtk)". */
  text: string;
  kind: "agent" | "user" | "system" | "error";
}

export interface DashboardSummary {
  agents: AgentStatusView[];
  stats: {
    questionsToday: number;
    answersToday: number;
    errorsToday: number;
    avgLatencyMs: number | null;
    documents: number;
    chunks: number;
    users: number;
    pendingApprovals: number;
    decidedToday: number;
    tasks: Record<TaskStatus, number>;
  };
  /** Jumlah jawaban agent per jam, 12 jam terakhir (index terakhir = jam ini). */
  answersPerHour: number[];
  recentActivity: ActivityItem[];
}

// ---------- Proposal, pengajuan, persetujuan (tahap 3) ----------

export interface ProposalBrief {
  namaKegiatan: string;
  deskripsi: string;
  tanggal?: string;
  tempat?: string;
  perkiraanPeserta?: number;
  anggaranMaksimal?: number;
}

export interface BudgetItem {
  pos: string;
  jumlah: number;
  satuan: string;
  hargaSatuan: number;
}

export interface ScheduleItem {
  waktu: string;
  kegiatan: string;
}

/** Isi proposal kegiatan HIMA sesuai struktur SOP. */
export interface ProposalContent {
  judul: string;
  latarBelakang: string;
  tujuan: string[];
  sasaran: string;
  waktu: string;
  tempat: string;
  panitia: string[];
  rencanaKegiatan: ScheduleItem[];
  anggaran: BudgetItem[];
  penutup: string;
}

export const SUBMISSION_STATUSES = ["menyusun", "gagal", "draft", "menunggu_persetujuan", "revisi", "disetujui", "ditolak"] as const;
export type SubmissionStatus = (typeof SUBMISSION_STATUSES)[number];

export const SUBMISSION_STATUS_LABEL: Record<SubmissionStatus, string> = {
  menyusun: "Disusun agent",
  gagal: "Gagal disusun",
  draft: "Draf",
  menunggu_persetujuan: "Menunggu Persetujuan",
  revisi: "Perlu Revisi",
  disetujui: "Disetujui",
  ditolak: "Ditolak",
};

export type Decision = "disetujui" | "ditolak" | "revisi";

export interface SubmissionSummary {
  id: number;
  title: string;
  status: SubmissionStatus;
  version: number;
  owner: { id: number; name: string };
  updatedAt: string;
  submittedAt: string | null;
}

export interface SubmissionVersionView {
  version: number;
  author: string;
  byAgent: boolean;
  note: string | null;
  createdAt: string;
}

export interface ApprovalView {
  version: number;
  decision: Decision;
  note: string | null;
  decider: string;
  createdAt: string;
}

export interface CommentView {
  id: number;
  author: string;
  role: Role;
  body: string;
  createdAt: string;
}

export interface SubmissionDetail extends SubmissionSummary {
  content: ProposalContent | null;
  brief: ProposalBrief | null;
  error: string | null;
  versions: SubmissionVersionView[];
  approvals: ApprovalView[];
  comments: CommentView[];
  /** Apa yang boleh dilakukan pengguna yang sedang melihat. */
  can: { edit: boolean; submit: boolean; decide: boolean; comment: boolean; retry: boolean };
}

export interface TaskView {
  id: number;
  title: string;
  status: TaskStatus;
  agentId: string | null;
  owner: string;
  submissionId: number | null;
  submissionStatus: SubmissionStatus | null;
  updatedAt: string;
}

export interface NotificationView {
  id: number;
  title: string;
  body: string;
  link: string | null;
  read: boolean;
  createdAt: string;
}

// ---------- Log audit (tahap 4) ----------

export const AUDIT_CATEGORIES = ["auth", "agent", "task", "submission", "document", "config"] as const;
export type AuditCategory = (typeof AUDIT_CATEGORIES)[number];

export const AUDIT_CATEGORY_LABEL: Record<AuditCategory, string> = {
  auth: "Login",
  agent: "Agent",
  task: "Papan tugas",
  submission: "Pengajuan",
  document: "Dokumen",
  config: "Konfigurasi",
};

export interface AuditEntryView {
  id: number;
  at: string;
  actorType: "user" | "agent" | "system";
  /** Pengguna yang melakukan atau meminta tindakan. */
  actorName: string | null;
  actorAgent: string | null;
  action: string;
  category: AuditCategory | null;
  summary: string;
  kind: ActivityItem["kind"];
  targetType: string | null;
  targetId: string | null;
  link: string | null;
  approverName: string | null;
  details: Record<string, unknown> | null;
}

export interface AuditFilters {
  type?: "user" | "agent" | "system";
  category?: AuditCategory;
  q?: string;
  /** Tanggal lokal YYYY-MM-DD, inklusif. */
  from?: string;
  to?: string;
}

export interface AuditPage {
  entries: AuditEntryView[];
  total: number;
  /** Kirim sebagai `before` untuk halaman berikutnya; null bila sudah habis. */
  nextBefore: number | null;
}

export interface ApiError {
  error: string;
}
