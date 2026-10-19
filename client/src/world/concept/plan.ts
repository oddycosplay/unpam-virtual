import { FACULTIES, PRODI_LIST, UKM_LIST, UNIVERSITY_UNITS, type Faculty, type Prodi } from "@unpam/shared";

// Denah konsep kampus multi-prodi. Satuan = meter dunia. x ke timur, z ke selatan; kamera melihat dari tenggara,
// jadi bangunan tinggi diletakkan di sisi utara (jauh) agar tidak menutupi modul ruangan.

export const SLOT_W = 7; // lebar modul satu prodi (ruang prodi + HIMA + orkestrator)
export const WING_D = 10; // kedalaman sayap fakultas
const GAP = 4;

export interface ProdiSlot {
  prodi: Prodi;
  /** Pusat modul di dunia. */
  x: number;
  z: number;
}

export interface FacultyWing {
  faculty: Faculty;
  row: "utara" | "selatan";
  x: number;
  z: number;
  width: number;
  slots: ProdiSlot[];
}

export interface UkmRoom {
  number: number;
  name: string;
  x: number;
  z: number;
}

export const ROW_Z = { utara: -26, selatan: 20 } as const;
const ROW_FACULTIES: Record<"utara" | "selatan", string[]> = {
  utara: ["feb", "fai", "fisip", "fkip"],
  selatan: ["sastra", "fasilkom", "ft", "fh"],
};

function buildRow(row: "utara" | "selatan", startX: number): { wings: FacultyWing[]; endX: number } {
  const wings: FacultyWing[] = [];
  let x = startX;
  for (const id of ROW_FACULTIES[row]) {
    const faculty = FACULTIES.find((f) => f.id === id)!;
    const prodi = PRODI_LIST.filter((p) => p.facultyId === id);
    const width = prodi.length * SLOT_W + 1;
    const cx = x + width / 2;
    wings.push({
      faculty,
      row,
      x: cx,
      z: ROW_Z[row],
      width,
      slots: prodi.map((p, i) => ({
        prodi: p,
        x: x + 0.5 + SLOT_W * (i + 0.5),
        z: ROW_Z[row],
      })),
    });
    x += width + GAP;
  }
  return { wings, endX: x - GAP };
}

function rowWidth(row: "utara" | "selatan"): number {
  return (
    ROW_FACULTIES[row].reduce((sum, id) => sum + PRODI_LIST.filter((p) => p.facultyId === id).length * SLOT_W + 1, 0) +
    GAP * (ROW_FACULTIES[row].length - 1)
  );
}

// Student Center: 18 ruang UKM dalam kisi 6 × 3, di ujung timur baris selatan.
export const UKM_COLS = 6;
export const UKM_ROOM = { w: 5, d: 3.6, gap: 0.6 } as const;
const UKM_W = UKM_COLS * (UKM_ROOM.w + UKM_ROOM.gap);

const northStart = -rowWidth("utara") / 2;
const southTotal = rowWidth("selatan") + GAP * 2 + UKM_W;
const southStart = -southTotal / 2;

const north = buildRow("utara", northStart);
const south = buildRow("selatan", southStart);

export const WINGS: FacultyWing[] = [...north.wings, ...south.wings];

export const STUDENT_CENTER = {
  x: south.endX + GAP * 2 + UKM_W / 2,
  z: ROW_Z.selatan,
  width: UKM_W + 1,
  depth: 3 * (UKM_ROOM.d + UKM_ROOM.gap) + 1,
};

export const UKM_ROOMS: UkmRoom[] = UKM_LIST.map((name, i) => {
  const col = i % UKM_COLS;
  const row = Math.floor(i / UKM_COLS);
  return {
    number: i + 1,
    name,
    x: STUDENT_CENTER.x - UKM_W / 2 + (UKM_ROOM.w + UKM_ROOM.gap) * (col + 0.5),
    z: STUDENT_CENTER.z - STUDENT_CENTER.depth / 2 + 0.5 + (UKM_ROOM.d + UKM_ROOM.gap) * (row + 0.5),
  };
});

// Plaza tengah: Rektorat di utara plaza, LKA di barat, LSP di timur.
export const UNITS = {
  rektorat: { ...UNIVERSITY_UNITS[0], x: 0, z: -7, width: 16, depth: 9 },
  lka: { ...UNIVERSITY_UNITS[1], x: -21, z: -3, width: 11, depth: 7 },
  lsp: { ...UNIVERSITY_UNITS[2], x: 21, z: -3, width: 11, depth: 7 },
} as const;

export const PLAZA = { x: 0, z: 4, radius: 4 } as const;

/** Jalan utama: dua avenue timur-barat dan satu poros utara-selatan. */
export const AVENUES = {
  northZ: ROW_Z.utara + WING_D / 2 + 3,
  southZ: ROW_Z.selatan - WING_D / 2 - 3,
  halfWidth: Math.max(rowWidth("utara"), southTotal) / 2 + 4,
};

export const BOUNDS = {
  minX: -AVENUES.halfWidth - 4,
  maxX: AVENUES.halfWidth + 4,
  minZ: ROW_Z.utara - WING_D / 2 - 6,
  maxZ: ROW_Z.selatan + Math.max(WING_D, STUDENT_CENTER.depth) / 2 + 6,
};

export type SelectionId = `fakultas:${string}` | "rektorat" | "lka" | "lsp" | "ukm";

/** Rentang layar (satuan dunia) dari tapak w × d pada kamera isometrik 45°: proyeksi diagonal ≈ (w + d) · cos 45°. */
export const isoSpan = (w: number, d: number) => (w + d) * 0.72;

/** Titik fokus kamera dan rentang yang perlu terlihat untuk tiap bangunan. */
export function focusOf(id: SelectionId): {
  x: number;
  z: number;
  span: number;
} {
  if (id === "ukm")
    return {
      x: STUDENT_CENTER.x,
      z: STUDENT_CENTER.z,
      span: isoSpan(STUDENT_CENTER.width + 4, STUDENT_CENTER.depth + 4),
    };
  if (id === "rektorat" || id === "lka" || id === "lsp") {
    const u = UNITS[id];
    return { x: u.x, z: u.z, span: isoSpan(u.width + 6, u.depth + 6) };
  }
  const wing = WINGS.find((w) => `fakultas:${w.faculty.id}` === id)!;
  // Baris utara punya fasad tinggi di belakang; geser fokus sedikit ke utara agar ikut terlihat.
  const dz = wing.row === "utara" ? -2 : 0;
  return {
    x: wing.x,
    z: wing.z + dz,
    span: isoSpan(Math.max(wing.width, 16) + 6, WING_D + 8),
  };
}
