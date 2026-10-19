import { OrganizationDirectory } from "./OrganizationDirectory";

export function OrganizationsPage() {
  return (
    <section className="stack">
      <header className="page-head">
        <div>
          <h1>Organisasi Mahasiswa</h1>
          <p className="muted">Himpunan Mahasiswa (HIMA) dan Unit Kegiatan Mahasiswa (UKM) Universitas Pamulang.</p>
        </div>
      </header>
      <div className="card">
        <OrganizationDirectory />
      </div>
    </section>
  );
}
