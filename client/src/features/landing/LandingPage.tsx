import { Link } from "react-router-dom";

export function LandingPage() {
  return (
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
          <Link className="button-link secondary" to="/login">
            Masuk
          </Link>
          <Link className="button-link" to="/login">
            Coba Demo
          </Link>
        </div>
      </header>

      <section className="landing-hero container">
        <div className="landing-copy">
          <span className="landing-badge">Proyek inovasi kampus digital</span>
          <h2>Kampus virtual masa depan untuk mahasiswa, dosen, dan organisasi.</h2>
          <p>
            Unpam Virtual menghadirkan pengalaman digital kampus yang interaktif, berkelas, dan
            siap menjadi showcase karya mahasiswa berbasis teknologi, kreativitas, dan AI.
          </p>
          <div className="landing-cta">
            <Link className="button-link" to="/login">
              Lihat Demo
            </Link>
            <a className="button-link secondary" href="#fitur">
              Jelajahi Fitur
            </a>
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

      <section id="kampus" className="landing-section alternate container">
        <div className="section-head narrow">
          <span className="mini-label">Value proposition</span>
          <h3>Brand produk yang menjual: inovasi, relevansi, dan potensi besar untuk pengembangan.</h3>
        </div>

        <div className="feature-split">
          <div className="feature-copy">
            <ul>
              <li>Realtime collaboration untuk campus ecosystem</li>
              <li>AI-assisted admin workflows yang lebih efisien</li>
              <li>Platform showcase karya mahasiswa yang siap dipresentasikan</li>
              <li>Desain modern dengan potensi pengembangan komunitas dan sponsor</li>
            </ul>
          </div>
          <div className="feature-box">
            <p className="feature-label">Project positioning</p>
            <h4>“Digital campus experience for the next generation.”</h4>
            <p>
              Inovasi ini memadukan teknologi 3D, AI, dan sistem akademik dalam satu ekosistem digital
              yang cocok untuk kampus modern dan showcase hasil karya mahasiswa.
            </p>
          </div>
        </div>
      </section>

      <section id="agent" className="landing-section container">
        <div className="section-head">
          <span className="mini-label">Potensi produk</span>
          <h3>Lebih dari sekadar project kelas: ini adalah bukti kemampuan mahasiswa dalam membangun solusi nyata.</h3>
        </div>

        <div className="landing-grid compact">
          <article className="landing-card quote-card">
            <h4>Game + Platform</h4>
            <p>Gabungan elemen interactive campus, real-time experience, dan AI agent membuat produk ini lebih kuat dan lebih menarik untuk dipromosikan.</p>
          </article>
          <article className="landing-card quote-card">
            <h4>Branding kampus</h4>
            <p>Produk ini bisa menjadi showcase keberhasilan akademik dan inovasi digital universitas dalam ruang publik maupun event teknologi.</p>
          </article>
          <article className="landing-card quote-card">
            <h4>Investor & sponsor</h4>
            <p>Memiliki konsep yang jelas, peluang pengembangan, dan representasi teknologi modern—ideal untuk dukungan lanjutan.</p>
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
            <Link className="button-link" to="/login">
              Coba Demo
            </Link>
            <a className="button-link secondary" href="#fitur">
              Lihat Fitur
            </a>
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
  );
}
