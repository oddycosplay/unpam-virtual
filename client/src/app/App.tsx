import { useEffect, useState, type ReactNode } from "react";
import { Link, Navigate, Outlet, Route, Routes, useLocation } from "react-router-dom";
import { hasPermission, type Permission } from "@unpam/shared";
import { useAuth } from "../features/auth/AuthContext";
import { LoginPage } from "../features/auth/LoginPage";
import { DashboardPage } from "../features/dashboard/DashboardPage";
import { LlmConfigPage } from "../features/admin/LlmConfigPage";
import { DocumentsPage } from "../features/admin/DocumentsPage";
import { AuditPage } from "../features/admin/AuditPage";
import { ChatPage } from "../features/chat/ChatPage";
import { RoleBadge } from "../components/ui/RoleBadge";
import { Icon } from "../components/ui/Icon";
import { NotificationBell } from "../features/notifications/NotificationBell";
import { TasksPage } from "../features/tasks/TasksPage";
import { WorkPage } from "../features/submissions/WorkPage";
import { NewProposalPage } from "../features/submissions/NewProposalPage";
import { SubmissionPage } from "../features/submissions/SubmissionPage";
import { Sidebar } from "./Sidebar";

/** Halaman yang hanya untuk peran tertentu. */
function Allow({ permission, children }: { permission: Permission; children: ReactNode }) {
  const { user } = useAuth();
  if (!user || !hasPermission(user.role, permission)) {
    return <p className="center error">Peran Anda tidak punya akses ke halaman ini.</p>;
  }
  return <>{children}</>;
}

/** Kerangka untuk semua halaman setelah login: sidebar, topbar, dan isi. */
function Layout() {
  const { user, loading, logout } = useAuth();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const fullBleed = location.pathname === "/";

  // Tutup laci menu (mobile) saat pindah halaman atau menekan Escape.
  useEffect(() => setMenuOpen(false), [location.pathname]);
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenuOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  if (loading) return <p className="center muted">Memuat…</p>;
  if (!user) return <Navigate to="/login" replace />;

  return (
    <div className={fullBleed ? "shell shell-dark" : "shell"}>
      <Sidebar role={user.role} open={menuOpen} onClose={() => setMenuOpen(false)} />
      {menuOpen && <div className="sidebar-backdrop" onClick={() => setMenuOpen(false)} aria-hidden />}
      <div className="shell-main">
        <header className="topbar">
          <button
            type="button"
            className="icon-button menu-button"
            aria-label="Buka menu"
            aria-controls="sidebar"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen(true)}
          >
            <Icon name="menu" />
          </button>
          <Link to="/" className="brand small topbar-brand">
            <span className="brand-mark" aria-hidden />
            Unpam Virtual
          </Link>
          <div className="topbar-user">
            <NotificationBell />
            <span className="topbar-name">{user.name}</span>
            <RoleBadge role={user.role} />
            <button className="ghost" onClick={logout}>
              Keluar
            </button>
          </div>
        </header>
        <main className={fullBleed ? "page-full" : "page"}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<Layout />}>
        <Route index element={<DashboardPage />} />
        <Route path="tugas" element={<TasksPage />} />
        <Route path="hasil-kerja" element={<WorkPage />} />
        <Route
          path="proposal/baru"
          element={
            <Allow permission="proposal:create">
              <NewProposalPage />
            </Allow>
          }
        />
        <Route path="pengajuan/:id" element={<SubmissionPage />} />
        <Route
          path="chat"
          element={
            <Allow permission="agent:chat">
              <ChatPage />
            </Allow>
          }
        />
        <Route
          path="admin/documents"
          element={
            <Allow permission="admin:documents">
              <DocumentsPage />
            </Allow>
          }
        />
        <Route
          path="admin/audit"
          element={
            <Allow permission="audit:view">
              <AuditPage />
            </Allow>
          }
        />
        <Route
          path="admin/llm"
          element={
            <Allow permission="admin:config">
              <LlmConfigPage />
            </Allow>
          }
        />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
