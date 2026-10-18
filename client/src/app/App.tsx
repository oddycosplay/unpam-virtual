import type { ReactNode } from "react";
import { Link, NavLink, Navigate, Route, Routes } from "react-router-dom";
import { hasPermission, type Permission } from "@unpam/shared";
import { useAuth } from "../features/auth/AuthContext";
import { LoginPage } from "../features/auth/LoginPage";
import { DashboardPage } from "../features/dashboard/DashboardPage";
import { LlmConfigPage } from "../features/admin/LlmConfigPage";
import { DocumentsPage } from "../features/admin/DocumentsPage";
import { ChatPage } from "../features/chat/ChatPage";
import { RoleBadge } from "../components/ui/RoleBadge";
import { NotificationBell } from "../features/notifications/NotificationBell";
import { TasksPage } from "../features/tasks/TasksPage";
import { WorkPage } from "../features/submissions/WorkPage";
import { NewProposalPage } from "../features/submissions/NewProposalPage";
import { SubmissionPage } from "../features/submissions/SubmissionPage";

function Guard({ permission, fullBleed, children }: { permission?: Permission; fullBleed?: boolean; children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <p className="center muted">Memuat…</p>;
  if (!user) return <Navigate to="/login" replace />;
  if (permission && !hasPermission(user.role, permission)) {
    return <p className="center error">Peran Anda tidak punya akses ke halaman ini.</p>;
  }
  return <Shell fullBleed={fullBleed}>{children}</Shell>;
}

function Shell({ fullBleed, children }: { fullBleed?: boolean; children: ReactNode }) {
  const { user, logout } = useAuth();
  return (
    <div className={fullBleed ? "shell shell-dark" : "shell"}>
      <header className="topbar">
        <Link to="/" className="brand small">
          <span className="brand-mark" aria-hidden />
          Unpam Virtual
        </Link>
        <nav>
          <NavLink to="/" end>
            Dashboard
          </NavLink>
          <NavLink to="/tugas">Papan Tugas</NavLink>
          {user && (hasPermission(user.role, "proposal:create") || hasPermission(user.role, "submission:comment")) && (
            <NavLink to="/hasil-kerja">Hasil Kerja</NavLink>
          )}
          {user && hasPermission(user.role, "agent:chat") && <NavLink to="/chat">Agent Akademik</NavLink>}
          {user && hasPermission(user.role, "admin:documents") && <NavLink to="/admin/documents">Dokumen</NavLink>}
          {user && hasPermission(user.role, "admin:config") && <NavLink to="/admin/llm">Provider AI</NavLink>}
        </nav>
        <div className="topbar-user">
          {user && (
            <>
              <NotificationBell />
              <span className="topbar-name">{user.name}</span>
              <RoleBadge role={user.role} />
              <button className="ghost" onClick={logout}>
                Keluar
              </button>
            </>
          )}
        </div>
      </header>
      <main className={fullBleed ? "page-full" : "page"}>{children}</main>
    </div>
  );
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <Guard fullBleed>
            <DashboardPage />
          </Guard>
        }
      />
      <Route
        path="/tugas"
        element={
          <Guard>
            <TasksPage />
          </Guard>
        }
      />
      <Route
        path="/hasil-kerja"
        element={
          <Guard>
            <WorkPage />
          </Guard>
        }
      />
      <Route
        path="/proposal/baru"
        element={
          <Guard permission="proposal:create">
            <NewProposalPage />
          </Guard>
        }
      />
      <Route
        path="/pengajuan/:id"
        element={
          <Guard>
            <SubmissionPage />
          </Guard>
        }
      />
      <Route
        path="/chat"
        element={
          <Guard permission="agent:chat">
            <ChatPage />
          </Guard>
        }
      />
      <Route
        path="/admin/documents"
        element={
          <Guard permission="admin:documents">
            <DocumentsPage />
          </Guard>
        }
      />
      <Route
        path="/admin/llm"
        element={
          <Guard permission="admin:config">
            <LlmConfigPage />
          </Guard>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
