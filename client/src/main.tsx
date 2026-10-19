import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { App } from "./app/App";
import { AuthProvider } from "./features/auth/AuthContext";
import "./theme/theme.css";

// Pasang tema sebelum render pertama agar tidak berkedip terang → gelap.
try {
  const saved = localStorage.getItem("unpam:theme");
  const dark = saved === "dark" || (saved !== "light" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
} catch {
  // Penyimpanan diblokir: PreferencesProvider tetap memasang tema setelah render.
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
