import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { Edges, Html, OrbitControls, OrthographicCamera } from "@react-three/drei";
import { Bloom, EffectComposer } from "@react-three/postprocessing";
import * as THREE from "three";
import { ROLE_INFO } from "@unpam/shared";
import { CafeTable, Chair, Desk, Person, Plant, Tree } from "../props";
import {
  AVENUES,
  BOUNDS,
  PLAZA,
  SLOT_W,
  STUDENT_CENTER,
  UKM_ROOM,
  UKM_ROOMS,
  UNITS,
  WINGS,
  WING_D,
  focusOf,
  isoSpan,
  type FacultyWing,
  type ProdiSlot,
  type SelectionId,
} from "./plan";

const GLOW = "#2ee6d6";
const GLASS = "#1f4fa3";
const FRAME = "#e9eef4";
const HIMA_RED = "#c8102e";
const UKM_COLORS = ["#f5c400", "#58a6ff", "#5ee08a", "#ff8c42", "#b48cff", "#2ee6d6"];

const glow = (color: string, k = 2) => <meshBasicMaterial color={new THREE.Color(color).multiplyScalar(k)} toneMapped={false} />;

/** Interaksi umum: klik untuk memilih, kursor tangan saat diarahkan. */
function clickable(onSelect: () => void) {
  return {
    onClick: (e: ThreeEvent<MouseEvent>) => {
      if (e.delta > 6) return; // geseran = memutar/menggeser kamera
      e.stopPropagation();
      onSelect();
    },
    onPointerOver: (e: ThreeEvent<PointerEvent>) => {
      e.stopPropagation();
      document.body.style.cursor = "pointer";
    },
    onPointerOut: () => {
      document.body.style.cursor = "";
    },
  };
}

function Label({
  position,
  children,
  tone = "default",
  visible = true,
}: {
  position: [number, number, number];
  children: ReactNode;
  tone?: "default" | "room" | "unit";
  visible?: boolean;
}) {
  if (!visible) return null;
  return (
    <Html position={position} center className={`concept-label ${tone}`} zIndexRange={[20, 0]}>
      <span>{children}</span>
    </Html>
  );
}

/** Gedung kaca biru dengan rangka putih, terinspirasi gedung kampus UNPAM. Fasad depan menghadap +z. */
function GlassBuilding({ x, z, w, d, h }: { x: number; z: number; w: number; d: number; h: number }) {
  const floors = Math.max(2, Math.round(h / 1.6));
  const fins = Math.floor(w / 1.6);
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, h / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial color={GLASS} metalness={0.55} roughness={0.18} emissive="#0b2350" emissiveIntensity={0.35} />
      </mesh>
      {/* Pita lantai putih */}
      {Array.from({ length: floors + 1 }, (_, i) => (
        <mesh key={`f${i}`} position={[0, (h / floors) * i, d / 2 + 0.03]}>
          <boxGeometry args={[w + 0.1, 0.16, 0.08]} />
          <meshStandardMaterial color={FRAME} roughness={0.5} />
        </mesh>
      ))}
      {/* Sirip vertikal putih */}
      {Array.from({ length: fins + 1 }, (_, i) => (
        <mesh key={`v${i}`} position={[-w / 2 + (w / fins) * i, h / 2, d / 2 + 0.05]}>
          <boxGeometry args={[0.12, h, 0.12]} />
          <meshStandardMaterial color={FRAME} roughness={0.5} />
        </mesh>
      ))}
      {/* Atap */}
      <mesh position={[0, h + 0.1, 0]} castShadow>
        <boxGeometry args={[w + 0.3, 0.2, d + 0.3]} />
        <meshStandardMaterial color={FRAME} roughness={0.6} />
      </mesh>
    </group>
  );
}

function LowGlass({ position, size, rotationY = 0 }: { position: [number, number, number]; size: [number, number]; rotationY?: number }) {
  return (
    <mesh position={position} rotation={[0, rotationY, 0]}>
      <boxGeometry args={[size[0], size[1], 0.04]} />
      <meshStandardMaterial color="#9fe9e3" transparent opacity={0.1} depthWrite={false} />
      <Edges color={new THREE.Color(GLOW).multiplyScalar(0.8)} />
    </mesh>
  );
}

function OrchestratorHub({ position, active }: { position: [number, number, number]; active: boolean }) {
  const ring = useRef<THREE.Mesh>(null);
  useFrame((_, dt) => {
    if (ring.current) ring.current.rotation.z += dt * (active ? 1.6 : 0.5);
  });
  return (
    <group position={position}>
      <mesh position={[0, 0.12, 0]} castShadow>
        <cylinderGeometry args={[0.55, 0.65, 0.24, 24]} />
        <meshStandardMaterial color="#1c2833" metalness={0.5} roughness={0.35} />
      </mesh>
      <mesh ref={ring} position={[0, 0.26, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.32, 0.48, 6, 1, 0, Math.PI * 1.5]} />
        {glow(GLOW, active ? 2.6 : 1.6)}
      </mesh>
      <mesh position={[0, 0.85, 0]}>
        <octahedronGeometry args={[0.18, 0]} />
        {glow(GLOW, 2.2)}
      </mesh>
    </group>
  );
}

/** Satu modul prodi: ruang prodi (belakang), hub orkestrator (tengah), ruang HIMA (depan). */
function ProdiModule({ slot, selected, onSelectProdi }: { slot: ProdiSlot; selected: boolean; onSelectProdi?: () => void }) {
  const { x, z } = slot;
  const w = SLOT_W - 0.8;
  const roomZ = z - 2.3;
  const himaZ = z + 2.6;
  return (
    <group {...(onSelectProdi ? clickable(onSelectProdi) : {})}>
      {/* Ruang prodi */}
      <mesh position={[x, 0.2, roomZ]} receiveShadow>
        <boxGeometry args={[w, 0.08, 4.2]} />
        <meshStandardMaterial color="#1c2a3c" roughness={0.6} />
      </mesh>
      <mesh position={[x, 0.245, roomZ + 2.1]}>
        <boxGeometry args={[w, 0.01, 0.06]} />
        {glow("#58a6ff", 1.6)}
      </mesh>
      <LowGlass position={[x, 0.65, roomZ - 2.1]} size={[w, 0.9]} />
      <LowGlass position={[x - w / 2, 0.65, roomZ]} size={[4.2, 0.9]} rotationY={Math.PI / 2} />
      <Desk position={[x - 1.4, 0.24, roomZ - 0.8]} screens={1} />
      <Chair position={[x - 1.4, 0.24, roomZ - 0.15]} />
      <Person position={[x - 1.4, 0.24, roomZ - 0.2]} rotationY={Math.PI} colors={ROLE_INFO.kaprodi.colors} seated />
      <Desk position={[x + 1.5, 0.24, roomZ - 0.8]} screens={2} />
      <Person position={[x + 1.5, 0.24, roomZ + 0.6]} rotationY={Math.PI} colors={ROLE_INFO.dosen.colors} />

      {/* Orkestrator prodi + jalur ke kedua ruang */}
      <OrchestratorHub position={[x, 0.2, z + 0.35]} active={selected} />
      {[roomZ + 1.1, himaZ - 0.9].map((tz) => (
        <mesh key={tz} position={[x, 0.23, (z + 0.35 + tz) / 2]}>
          <boxGeometry args={[0.06, 0.02, Math.abs(tz - (z + 0.35))]} />
          {glow(GLOW, 1.4)}
        </mesh>
      ))}

      {/* Ruang HIMA */}
      <mesh position={[x, 0.2, himaZ]} receiveShadow>
        <boxGeometry args={[w, 0.08, 2.8]} />
        <meshStandardMaterial color="#2a1c24" roughness={0.6} />
      </mesh>
      <mesh position={[x, 0.245, himaZ + 1.4]}>
        <boxGeometry args={[w, 0.01, 0.06]} />
        {glow(HIMA_RED, 1.8)}
      </mesh>
      <CafeTable position={[x - 0.8, 0.24, himaZ]} />
      <Person position={[x + 0.4, 0.24, himaZ + 0.1]} rotationY={-Math.PI / 2} colors={ROLE_INFO.hima.colors} />
      <Person position={[x - 2.0, 0.24, himaZ - 0.1]} rotationY={Math.PI / 2} colors={ROLE_INFO.mahasiswa.colors} />
      <group position={[x + 2.4, 0.24, himaZ - 0.6]}>
        <mesh position={[0, 0.7, 0]}>
          <cylinderGeometry args={[0.025, 0.025, 1.4, 6]} />
          <meshStandardMaterial color="#c9d3dc" />
        </mesh>
        <mesh position={[0.2, 1.22, 0]}>
          <planeGeometry args={[0.38, 0.24]} />
          <meshStandardMaterial color={HIMA_RED} side={THREE.DoubleSide} />
        </mesh>
      </group>

      <Label position={[x, 2.3, roomZ - 1.2]} tone="room" visible={selected}>
        {slot.prodi.name}
      </Label>
      <Label position={[x, 1.6, himaZ + 0.6]} tone="room" visible={selected}>
        HIMA
      </Label>
    </group>
  );
}

function FacultyWingView({
  wing,
  selected,
  onSelect,
  onSelectProdi,
}: {
  wing: FacultyWing;
  selected: boolean;
  onSelect: () => void;
  onSelectProdi: (n: number) => void;
}) {
  const { faculty, x, z, width } = wing;
  const signZ = wing.row === "utara" ? z + WING_D / 2 + 0.9 : z + WING_D / 2 + 0.9;
  return (
    <group>
      <group {...clickable(onSelect)}>
        <mesh position={[x, 0.08, z]} receiveShadow>
          <boxGeometry args={[width, 0.16, WING_D]} />
          <meshStandardMaterial color={selected ? "#1d2b38" : "#17222c"} roughness={0.7} />
        </mesh>
        <mesh position={[x, 0.17, z]}>
          <boxGeometry args={[width, 0.005, WING_D]} />
          <meshBasicMaterial transparent opacity={0} />
          <Edges color={new THREE.Color(faculty.accent).multiplyScalar(selected ? 2.4 : 1.2)} />
        </mesh>
        {/* Fasad gedung fakultas di sisi utara (jauh dari kamera) untuk baris utara */}
        {wing.row === "utara" && <GlassBuilding x={x} z={z - WING_D / 2 - 2} w={width} d={3.2} h={7} />}
        {wing.row === "selatan" && (
          <mesh position={[x - width / 2 + 0.4, 1.4, signZ - 0.4]} castShadow>
            <boxGeometry args={[0.5, 2.8, 0.5]} />
            <meshStandardMaterial color={faculty.accent} roughness={0.5} />
          </mesh>
        )}
      </group>
      {wing.slots.map((slot) => (
        <ProdiModule
          key={slot.prodi.number}
          slot={slot}
          selected={selected}
          onSelectProdi={selected ? () => onSelectProdi(slot.prodi.number) : onSelect}
        />
      ))}
      <Label position={[x, wing.row === "utara" ? 8.2 : 3.2, wing.row === "utara" ? z - WING_D / 2 - 2 : signZ]} tone="unit">
        <b>{faculty.short}</b>
        <em> · {faculty.name}</em>
      </Label>
    </group>
  );
}

function UnitView({
  id,
  selected,
  onSelect,
  height,
  person,
}: {
  id: "rektorat" | "lka" | "lsp";
  selected: boolean;
  onSelect: () => void;
  height: number;
  person: string[];
}) {
  const u = UNITS[id];
  const roomCount = u.rooms.length;
  const roomW = (u.width - 1) / roomCount;
  return (
    <group {...clickable(onSelect)}>
      <mesh position={[u.x, 0.08, u.z]} receiveShadow>
        <boxGeometry args={[u.width, 0.16, u.depth]} />
        <meshStandardMaterial color={selected ? "#1d2b38" : "#17222c"} roughness={0.7} />
      </mesh>
      <mesh position={[u.x, 0.17, u.z]}>
        <boxGeometry args={[u.width, 0.005, u.depth]} />
        <meshBasicMaterial transparent opacity={0} />
        <Edges color={new THREE.Color("#f5c400").multiplyScalar(selected ? 2.4 : 1.2)} />
      </mesh>
      <GlassBuilding x={u.x} z={u.z - u.depth / 2 + 1.4} w={u.width - 0.6} d={2.6} h={height} />
      {u.rooms.map((room, i) => {
        const rx = u.x - u.width / 2 + 0.5 + roomW * (i + 0.5);
        const rz = u.z + 1.2;
        return (
          <group key={room}>
            <mesh position={[rx, 0.2, rz]} receiveShadow>
              <boxGeometry args={[roomW - 0.5, 0.08, u.depth - 3.4]} />
              <meshStandardMaterial color="#1f2a36" roughness={0.6} />
            </mesh>
            <Desk position={[rx, 0.24, rz - 0.6]} screens={1} />
            <Person position={[rx, 0.24, rz + 0.1]} rotationY={Math.PI} colors={person} seated={i === 0} />
            <Label position={[rx, 1.9, rz]} tone="room" visible={selected}>
              {room}
            </Label>
          </group>
        );
      })}
      <Plant position={[u.x - u.width / 2 + 0.6, 0.16, u.z + u.depth / 2 - 0.6]} />
      <Plant position={[u.x + u.width / 2 - 0.6, 0.16, u.z + u.depth / 2 - 0.6]} />
      <Label position={id === "rektorat" ? [u.x, height + 1.2, u.z - u.depth / 2 + 1.4] : [u.x, 1.4, u.z + u.depth / 2 + 0.6]} tone="unit">
        <b>{u.name}</b>
        {"fullName" in u && <em> · {u.fullName}</em>}
      </Label>
    </group>
  );
}

function StudentCenterView({ selected, onSelect }: { selected: boolean; onSelect: () => void }) {
  const sc = STUDENT_CENTER;
  return (
    <group {...clickable(onSelect)}>
      <mesh position={[sc.x, 0.08, sc.z]} receiveShadow>
        <boxGeometry args={[sc.width, 0.16, sc.depth]} />
        <meshStandardMaterial color={selected ? "#1d2b38" : "#17222c"} roughness={0.7} />
      </mesh>
      <mesh position={[sc.x, 0.17, sc.z]}>
        <boxGeometry args={[sc.width, 0.005, sc.depth]} />
        <meshBasicMaterial transparent opacity={0} />
        <Edges color={new THREE.Color("#ff8c42").multiplyScalar(selected ? 2.4 : 1.2)} />
      </mesh>
      {UKM_ROOMS.map((r, i) => {
        const color = UKM_COLORS[i % UKM_COLORS.length]!;
        return (
          <group key={r.number}>
            <mesh position={[r.x, 0.2, r.z]} receiveShadow>
              <boxGeometry args={[UKM_ROOM.w, 0.08, UKM_ROOM.d]} />
              <meshStandardMaterial color="#1e2833" roughness={0.6} />
            </mesh>
            <mesh position={[r.x, 0.245, r.z + UKM_ROOM.d / 2]}>
              <boxGeometry args={[UKM_ROOM.w, 0.01, 0.06]} />
              {glow(color, 1.8)}
            </mesh>
            <LowGlass position={[r.x, 0.55, r.z - UKM_ROOM.d / 2]} size={[UKM_ROOM.w, 0.7]} />
            <CafeTable position={[r.x - 0.9, 0.24, r.z]} />
            <Person position={[r.x + 1.0, 0.24, r.z + 0.2]} rotationY={-Math.PI / 2} colors={ROLE_INFO.mahasiswa.colors} />
            <mesh position={[r.x + 1.9, 0.75, r.z - 1.2]}>
              <boxGeometry args={[0.5, 0.5, 0.05]} />
              {glow(color, 1.2)}
            </mesh>
            <Label position={[r.x, 1.5, r.z]} tone="room" visible={selected}>
              {r.name.replace(/^UKM /, "")}
            </Label>
          </group>
        );
      })}
      <Label position={[sc.x, 3.0, sc.z - sc.depth / 2]} tone="unit">
        <b>Student Center</b>
        <em> · 18 UKM</em>
      </Label>
    </group>
  );
}

function PlazaLogo() {
  const logo = useMemo(() => {
    const t = new THREE.TextureLoader().load("/logo-unpam.png");
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    return t;
  }, []);
  useEffect(() => () => logo.dispose(), [logo]);
  return (
    <group position={[PLAZA.x, 0, PLAZA.z]}>
      <mesh position={[0, 0.1, 0]} receiveShadow>
        <cylinderGeometry args={[PLAZA.radius + 0.6, PLAZA.radius + 0.8, 0.2, 64]} />
        <meshStandardMaterial color="#1a2633" roughness={0.6} />
      </mesh>
      <mesh position={[0, 0.215, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[PLAZA.radius + 0.25, PLAZA.radius + 0.45, 96]} />
        {glow("#f5c400", 1.8)}
      </mesh>
      <mesh position={[0, 0.22, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[PLAZA.radius, 96]} />
        <meshBasicMaterial map={logo} transparent toneMapped={false} />
      </mesh>
    </group>
  );
}

function Ground() {
  const w = BOUNDS.maxX - BOUNDS.minX;
  const d = BOUNDS.maxZ - BOUNDS.minZ;
  const cx = (BOUNDS.maxX + BOUNDS.minX) / 2;
  const cz = (BOUNDS.maxZ + BOUNDS.minZ) / 2;
  const roads: [number, number, number, number][] = [
    [0, AVENUES.northZ, AVENUES.halfWidth * 2, 2.2],
    [0, AVENUES.southZ, AVENUES.halfWidth * 2, 2.2],
    [0, (AVENUES.northZ + AVENUES.southZ) / 2, 2.2, AVENUES.southZ - AVENUES.northZ],
  ];
  return (
    <group>
      <mesh position={[cx, -0.3, cz]} receiveShadow>
        <boxGeometry args={[w, 0.6, d]} />
        <meshStandardMaterial color="#0d141b" roughness={0.9} />
      </mesh>
      <gridHelper args={[Math.max(w, d), Math.round(Math.max(w, d) / 2), "#1a2833", "#121c25"]} position={[cx, 0.002, cz]} />
      {roads.map(([x, z, rw, rd]) => (
        <group key={`${x}-${z}`}>
          <mesh position={[x, 0.01, z]} receiveShadow>
            <boxGeometry args={[rw, 0.02, rd]} />
            <meshStandardMaterial color="#16212b" roughness={0.6} />
          </mesh>
          {rw > rd
            ? [-rd / 2, rd / 2].map((o) => (
                <mesh key={o} position={[x, 0.03, z + o]}>
                  <boxGeometry args={[rw, 0.02, 0.06]} />
                  {glow(GLOW, 1.3)}
                </mesh>
              ))
            : [-rw / 2, rw / 2].map((o) => (
                <mesh key={o} position={[x + o, 0.03, z]}>
                  <boxGeometry args={[0.06, 0.02, rd]} />
                  {glow(GLOW, 1.3)}
                </mesh>
              ))}
        </group>
      ))}
      {/* Pepohonan di tepi */}
      {[-1, 1].flatMap((side) =>
        Array.from({ length: 6 }, (_, i) => (
          <Tree key={`${side}-${i}`} position={[side * (AVENUES.halfWidth + 2), 0, BOUNDS.minZ + 8 + i * ((d - 16) / 5)]} />
        )),
      )}
    </group>
  );
}

/** Animasi kamera ke bangunan terpilih (atau gambaran umum) tanpa mengubah sudut putar pengguna. */
function CameraRig({ focus, shiftPx }: { focus: { x: number; z: number; span: number }; shiftPx: number }) {
  const { camera, controls, size } = useThree() as unknown as {
    camera: THREE.OrthographicCamera;
    controls: { target: THREE.Vector3; update: () => void } | null;
    size: { width: number; height: number };
  };
  const goal = useRef(focus);
  const animating = useRef(true);
  useEffect(() => {
    goal.current = focus;
    animating.current = true;
  }, [focus]);
  useFrame((_, dt) => {
    if (!controls || !animating.current) return;
    const k = 1 - Math.exp(-Math.min(dt, 0.1) * 4);
    // Di desktop panel HUD menutupi kedua sisi, jadi bangunan harus muat di bagian tengah layar.
    const desktop = size.width >= 820;
    const wantZoom = Math.min((size.width * (desktop ? 0.6 : 0.96)) / goal.current.span, (size.height * 0.9) / goal.current.span);
    // Geser isi ke kanan layar (arah kanan layar = (1, 0, -1)/√2 di dunia) agar tidak tertutup panel kiri.
    const shift = desktop ? shiftPx / wantZoom / Math.SQRT2 : 0;
    const g = { x: goal.current.x - shift, z: goal.current.z + shift };
    const dx = (g.x - controls.target.x) * k;
    const dz = (g.z - controls.target.z) * k;
    controls.target.x += dx;
    controls.target.z += dz;
    camera.position.x += dx;
    camera.position.z += dz;
    camera.zoom += (wantZoom - camera.zoom) * k;
    camera.updateProjectionMatrix();
    controls.update();
    if (Math.abs(g.x - controls.target.x) < 0.05 && Math.abs(g.z - controls.target.z) < 0.05 && Math.abs(wantZoom - camera.zoom) < 0.05) {
      animating.current = false;
    }
  });
  return null;
}

export const OVERVIEW = {
  x: (BOUNDS.minX + BOUNDS.maxX) / 2,
  z: (BOUNDS.minZ + BOUNDS.maxZ) / 2,
  span: isoSpan(BOUNDS.maxX - BOUNDS.minX, BOUNDS.maxZ - BOUNDS.minZ) * 0.92,
};

export function ConceptScene({
  selected,
  onSelect,
  onSelectProdi,
}: {
  selected: SelectionId | null;
  onSelect: (id: SelectionId | null) => void;
  onSelectProdi: (n: number) => void;
}) {
  const focus = useMemo(() => (selected ? focusOf(selected) : OVERVIEW), [selected]);
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);

  return (
    <Canvas
      shadows
      dpr={[1, 1.5]}
      gl={{ antialias: true }}
      aria-label="Konsep 3D kampus multi-prodi Universitas Pamulang"
      onPointerMissed={(e) => e.type === "click" && onSelect(null)}
    >
      <color attach="background" args={["#0a1016"]} />
      <OrthographicCamera makeDefault position={[OVERVIEW.x + 60, 55, OVERVIEW.z + 60]} near={-200} far={500} zoom={8} />
      <OrbitControls
        makeDefault
        target={[OVERVIEW.x, 0, OVERVIEW.z]}
        enableDamping
        screenSpacePanning={false}
        minPolarAngle={0.35}
        maxPolarAngle={1.2}
        minZoom={4}
        maxZoom={80}
      />
      {ready && <CameraRig focus={focus} shiftPx={selected ? 0 : 170} />}

      <hemisphereLight args={["#cfe8ff", "#0b1218", 0.7]} />
      <ambientLight intensity={0.2} />
      <directionalLight
        position={[40, 70, 30]}
        intensity={1.4}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-80}
        shadow-camera-right={80}
        shadow-camera-top={60}
        shadow-camera-bottom={-60}
      />

      {/* Html pertama di Canvas ini selalu tampil kosong (isinya tidak ter-render), jadi pasang satu Html
          kosong lebih dulu agar label gedung pertama (FEB) tidak hilang. */}
      <Html />
        <Ground />
        <PlazaLogo />
        {WINGS.map((wing) => {
          const id = `fakultas:${wing.faculty.id}` as SelectionId;
          return (
            <FacultyWingView
              key={wing.faculty.id}
              wing={wing}
              selected={selected === id}
              onSelect={() => onSelect(id)}
              onSelectProdi={onSelectProdi}
            />
          );
        })}
        <UnitView
          id="rektorat"
          height={11}
          selected={selected === "rektorat"}
          onSelect={() => onSelect("rektorat")}
          person={["#14213d", "#f5c400", "#ffffff"]}
        />
        <UnitView id="lka" height={5} selected={selected === "lka"} onSelect={() => onSelect("lka")} person={ROLE_INFO.dosen.colors} />
        <UnitView id="lsp" height={5} selected={selected === "lsp"} onSelect={() => onSelect("lsp")} person={ROLE_INFO.dosen.colors} />
        <StudentCenterView selected={selected === "ukm"} onSelect={() => onSelect("ukm")} />

      <EffectComposer multisampling={4}>
        <Bloom mipmapBlur luminanceThreshold={1} intensity={0.7} radius={0.6} />
      </EffectComposer>
    </Canvas>
  );
}
