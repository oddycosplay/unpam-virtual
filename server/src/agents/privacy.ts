/**
 * Samarkan data pribadi sebelum teks dikirim ke provider AI (PRD §6).
 * NIM dan nomor telepon = deretan 8+ digit; email juga disamarkan.
 */
export function redactPersonalData(text: string): string {
  return text
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, "[email disamarkan]")
    .replace(/(?:\+?\d[\s-]?){8,}/g, (m) => (m.replace(/\D/g, "").length >= 8 ? "[nomor disamarkan] " : m));
}
