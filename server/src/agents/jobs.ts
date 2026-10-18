/** Pelacak pekerjaan agent yang berjalan di latar belakang dalam proses server. */
export class JobTracker {
  private readonly running = new Set<Promise<void>>();

  run(job: () => Promise<void>): void {
    const p = job()
      .catch((error) => console.error("[jobs] pekerjaan agent gagal tanpa ditangani:", error))
      .finally(() => this.running.delete(p));
    this.running.add(p);
  }

  /** Tunggu semua pekerjaan selesai (dipakai tes dan saat server berhenti). */
  async idle(): Promise<void> {
    while (this.running.size > 0) await Promise.all([...this.running]);
  }
}
