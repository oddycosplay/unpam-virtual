import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";

/**
 * Landing page for Unpam Virtual.
 * Contains Helmet metadata (title, description, OpenGraph) and JSON-LD structured data.
 */
export function LandingPage() {
  const canonical = "https://unpam-virtual.example.com/"; // Ganti ke domain produksi Anda

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "name": "Unpam Virtual",
    "url": canonical,
    "logo": `${canonical}logo-unpam-192.png`,
    "applicationCategory": "EducationApplication",
    "operatingSystem": "Web",
    "description": "Kampus virtual 3D dengan AI agen akademik, realtime multiplayer, dan workflow proposal. Showcase karya mahasiswa Universitas Pamulang.",
    "author": {
      "@type": "Organization",
      "name": "Universitas Pamulang / Mahasiswa Prodi SI"
    }
  };

  return (
    <>
      <Helmet>
        <title>Unpam Virtual — Kampus Virtual 3D & AI Akademik</title>
        <meta name="description" content="Unpam Virtual menghadirkan kampus 3D interaktif, AI agen akademik, realtime multiplayer, dan workflow proposal. Showcase karya mahasiswa UNPAM." />
        <link rel="canonical" href={canonical} />
        <meta property="og:title" content="Unpam Virtual — Kampus Virtual 3D & AI Akademik" />
        <meta property="og:description" content="Eksplorasi kampus virtual 3D interaktif, AI agen akademik, realtime multiplayer, dan workflow proposal." />
        <meta property="og:image" content={`${canonical}og-image-1200x630.png`} />
        <meta property="og:url" content={canonical} />
        <meta name="twitter:card" content="summary_large_image" />
        <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
      </Helmet>

      <main className="landing-shell">
        <header className="landing-nav container">
          <div className="brand" aria-label="Brand Unpam Virtual">
            <img src="/logo-unpam-192.png" alt="Logo Universitas Pamulang" className="brand-logo large" width={60} height={60} />
            <div>
              <h1>Unpam Virtual</h1>
              <p className="muted">Campus experience by student creators</p>
            </div>
          </div>

          <nav className="landing-menu" aria-label="Navigasi utama">
            <a href="#fitur">Fitur</a>
            <a href="#kampus">Kampus 3D</a>
            <a href="#agent">AI Agent</a>
            <a href="#dukung">Dukung</a>
          </nav>

          <div className="landing-actions">
            <Link className="button-link secondary" to="/login">Masuk</Link>
            <Link className="button-link" to="/login">Coba Demo</Link>
          </div>
        </header>

        <section className="landing-hero container">
          <div className="landing-copy">
            <span className="landing-badge">Proyek inovasi kampus digital</span>
            <h2>Kampus virtual masa depan untuk mahasiswa, dosen, dan organisasi.</h2>
            <p>
              Unpam Virtual menghadirkan pengalaman digital kampus yang interaktif, berkelas, dan siap menjadi showcase karya mahasiswa berbasis teknologi, kreativitas, dan AI.
            </p>
            <div className="landing-cta">
              <Link className="button-link" to="/login">Lihat Demo</Link>
              <a className="button-link secondary" href="#fitur">Jelajahi Fitur</a>
            </div>
            <div className="landing-metrics">
              <div>
                <strong>3D</strong>
                <span>Kampus interaktif</span>
              </div>
              <div>
                <strong>AI</strong>
                <span>Agent akademik</span>
              </div>
              <div>
                <strong>Realtime</strong>
                <span>Multiplayer & chat</span>
              </div>
            </div>
          </div>

          <div className="hero-panel" aria-label="Preview produk">
            <div className="panel-top">
              <span className="status-pill online">Live preview</span>
              <span className="status-pill">Campus OS</span>
            </div>
            <div className="panel-card">
              <h3>Virtual Campus Overview</h3>
              <ul>
                <li>3D campus navigation</li>
                <li>AI akademik dan helpdesk</li>
                <li>Workflow proposal & approval</li>
                <li>Direktori HIMA & UKM</li>
              </ul>
            </div>
            <div className="panel-grid">
              <div>
                <span>Mahasiswa</span>
                <strong>2.1k+</strong>
              </div>
              <div>
                <span>Agent aktif</span>
                <strong>08</strong>
              </div>
              <div>
                <span>Realtime</span>
                <strong>10x/s</strong>
              </div>
              <div>
                <span>Workflow</span>
                <strong>24/7</strong>
              </div>
            </div>
          </div>
        </section>

        <section id="fitur" className="landing-section container">
          <div className="section-head">
            <span className="mini-label">Kenapa ini menarik</span>
            <h3>Solusi digital kampus yang bukan sekadar game, tapi produk nyata masa depan.</h3>
          </div>

          <div className="landing-grid">
            <article className="landing-card">
              <span className="card-icon">🏫</span>
              <h4>Kampus 3D interaktif</h4>
              <p>Eksplorasi lingkungan kampus virtual dengan avatar, minimap, dan komunikasi jarak dekat.</p>
            </article>

            <article className="landing-card">
              <span className="card-icon">🤖</span>
              <h4>AI Agent Akademik</h4>
              <p>Memberikan jawaban berbasis dokumen resmi dengan sumber dan referensi yang akurat.</p>
            </article>

            <article className="landing-card">
              <span className="card-icon">📋</span>
              <h4>Workflow proposal</h4>
              <p>Mahasiswa dapat menyiapkan proposal, sambil sistem membantu proses review hingga persetujuan.</p>
            </article>

            <article className="landing-card">
              <span className="card-icon">👥</span>
              <h4>Organisasi mahasiswa</h4>
              <p>Direktori HIMA dan UKM terstruktur untuk memperkuat ekosistem kegiatan kampus digital.</p>
            </article>
          </div>
        </section>

        <section id="dukung" className="landing-section support-block">
          <div className="container support-inner">
            <div>
              <span className="mini-label">Dukung inovasi</span>
              <h3>Bangun ekosistem digital kampus yang lebih cerdas dan lebih siap masa depan.</h3>
            </div>
            <div className="support-actions">
              <Link className="button-link" to="/login">Coba Demo</Link>
              <a className="button-link secondary" href="#fitur">Lihat Fitur</a>
            </div>
          </div>
        </section>

        <footer className="landing-footer container">
          <div className="brand small-brand">
            <img src="/logo-unpam-192.png" alt="Logo Universitas Pamulang" className="brand-logo" width={34} height={34} />
            <span>Unpam Virtual</span>
          </div>
          <p>Created for innovation, student creativity, and future campus experiences.</p>
        </footer>
      </main>
    </>
  );
}
