import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Edges, Html } from "@react-three/drei";
import * as THREE from "three";
import { COLORS, EDGES, NODES, type Vec2, type Zone } from "./layout";

const glowMaterial = (color: string, intensity = 2.2) => (
  <meshBasicMaterial color={new THREE.Color(color).multiplyScalar(intensity)} toneMapped={false} />
);

export function Floor() {
  return (
    <group>
      <mesh position={[0, -0.26, 0]} receiveShadow>
        <boxGeometry args={[24, 0.5, 22]} />
        <meshStandardMaterial color={COLORS.floor} roughness={0.85} />
      </mesh>
      {/* Garis sirkuit tipis di lantai */}
      <gridHelper args={[24, 24, COLORS.platformEdge, COLORS.floorTile]} position={[0, 0.002, 0]} />
      <mesh position={[0, -0.26, 0]}>
        <boxGeometry args={[24.02, 0.5, 22.02]} />
        <meshBasicMaterial color={COLORS.glowSoft} wireframe transparent opacity={0.0} />
        <Edges color={COLORS.glowSoft} />
      </mesh>
    </group>
  );
}

/** Jalur bercahaya mengikuti graf jalan. */
export function Roads() {
  const segments = useMemo(
    () =>
      EDGES.map(([a, b]) => {
        const [x1, z1] = NODES[a];
        const [x2, z2] = NODES[b];
        const length = Math.hypot(x2 - x1, z2 - z1);
        const angle = Math.atan2(x2 - x1, z2 - z1);
        return { key: `${a}-${b}`, mid: [(x1 + x2) / 2, (z1 + z2) / 2] as Vec2, length, angle };
      }),
    [],
  );
  return (
    <group>
      {segments.map((s) => (
        <group key={s.key} position={[s.mid[0], 0.01, s.mid[1]]} rotation={[0, s.angle, 0]}>
          <mesh receiveShadow>
            <boxGeometry args={[0.9, 0.02, s.length + 0.9]} />
            <meshStandardMaterial color="#16212b" roughness={0.6} />
          </mesh>
          {[-0.42, 0.42].map((x) => (
            <mesh key={x} position={[x, 0.02, 0]}>
              <boxGeometry args={[0.04, 0.02, s.length + 0.9]} />
              {glowMaterial(COLORS.glow, 1.6)}
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}

function Hexagon({ position, speed }: { position: [number, number, number]; speed: number }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((_, dt) => {
    if (ref.current) ref.current.rotation.z += dt * speed;
  });
  return (
    <mesh ref={ref} position={position}>
      <circleGeometry args={[0.32, 6]} />
      <meshBasicMaterial color={new THREE.Color(COLORS.glow).multiplyScalar(1.4)} transparent opacity={0.55} side={THREE.DoubleSide} toneMapped={false} />
    </mesh>
  );
}

/** Hub Orkestrator di tengah: alas bundar, cincin berputar, hologram heksagon. */
export function Hub({ busy, reducedMotion }: { busy: boolean; reducedMotion: boolean }) {
  const ring = useRef<THREE.Mesh>(null);
  const beam = useRef<THREE.Mesh>(null);
  useFrame((state, dt) => {
    if (reducedMotion) return;
    if (ring.current) ring.current.rotation.z += dt * (busy ? 1.6 : 0.4);
    if (beam.current) {
      const m = beam.current.material as THREE.MeshBasicMaterial;
      m.opacity = 0.12 + Math.sin(state.clock.elapsedTime * 2) * 0.05 + (busy ? 0.1 : 0);
    }
  });
  return (
    <group>
      <mesh position={[0, 0.12, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[1.5, 1.7, 0.24, 48]} />
        <meshStandardMaterial color={COLORS.platform} metalness={0.4} roughness={0.4} />
      </mesh>
      <mesh position={[0, 0.25, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[1.25, 1.36, 64]} />
        {glowMaterial(COLORS.glow, 2.6)}
      </mesh>
      <mesh ref={ring} position={[0, 0.27, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.7, 0.95, 6, 1, 0, Math.PI * 1.5]} />
        <meshBasicMaterial color={new THREE.Color(COLORS.glow).multiplyScalar(1.8)} transparent opacity={0.7} toneMapped={false} />
      </mesh>
      <mesh position={[0, 0.42, 0]} castShadow>
        <cylinderGeometry args={[0.45, 0.55, 0.3, 24]} />
        <meshStandardMaterial color="#26343f" metalness={0.6} roughness={0.3} />
      </mesh>
      <mesh ref={beam} position={[0, 1.4, 0]}>
        <cylinderGeometry args={[0.35, 0.5, 1.7, 24, 1, true]} />
        <meshBasicMaterial color={COLORS.glow} transparent opacity={0.15} side={THREE.DoubleSide} depthWrite={false} toneMapped={false} />
      </mesh>
      <group position={[0, 2.1, 0]} rotation={[0, Math.PI / 4, 0]}>
        <Hexagon position={[-0.7, 0, 0]} speed={reducedMotion ? 0 : 0.5} />
        <Hexagon position={[0, 0.25, 0]} speed={reducedMotion ? 0 : -0.4} />
        <Hexagon position={[0.7, 0, 0]} speed={reducedMotion ? 0 : 0.6} />
      </group>
    </group>
  );
}

export function ZonePlatform({ zone }: { zone: Zone }) {
  const [w, d] = zone.size;
  return (
    <group position={[zone.center[0], 0, zone.center[1]]}>
      <mesh position={[0, 0.08, 0]} receiveShadow>
        <boxGeometry args={[w, 0.16, d]} />
        <meshStandardMaterial color={COLORS.platform} roughness={0.7} />
      </mesh>
      <mesh position={[0, 0.165, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[w - 0.1, d - 0.1]} />
        <meshStandardMaterial color="#1c2833" roughness={0.5} metalness={0.1} />
      </mesh>
      {/* List bercahaya di tepi platform */}
      <mesh position={[0, 0.17, 0]}>
        <boxGeometry args={[w, 0.005, d]} />
        <meshBasicMaterial transparent opacity={0} />
        <Edges color={new THREE.Color(zone.accent).multiplyScalar(1.6)} />
      </mesh>
      <Html position={[0, 2.7, 0]} center className="zone-label" zIndexRange={[10, 0]}>
        <span style={{ borderColor: zone.accent }}>{zone.name}</span>
      </Html>
    </group>
  );
}

/** Dinding kaca tipis dengan bingkai bercahaya. */
export function GlassWall({ position, size, rotationY = 0 }: { position: [number, number, number]; size: [number, number]; rotationY?: number }) {
  return (
    <mesh position={position} rotation={[0, rotationY, 0]}>
      <boxGeometry args={[size[0], size[1], 0.04]} />
      <meshStandardMaterial color="#9fe9e3" transparent opacity={0.08} roughness={0.05} metalness={0.2} depthWrite={false} />
      <Edges color={new THREE.Color(COLORS.glow).multiplyScalar(0.9)} />
    </mesh>
  );
}

export function SolidWall({ position, size, rotationY = 0 }: { position: [number, number, number]; size: [number, number, number]; rotationY?: number }) {
  return (
    <mesh position={position} rotation={[0, rotationY, 0]} castShadow receiveShadow>
      <boxGeometry args={size} />
      <meshStandardMaterial color={COLORS.wall} roughness={0.9} />
    </mesh>
  );
}

/** Meja kerja dengan monitor yang menyala. Arah depan meja = +z lokal. */
export function Desk({ position, rotationY = 0, screens = 1 }: { position: [number, number, number]; rotationY?: number; screens?: number }) {
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <mesh position={[0, 0.55, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.5, 0.08, 0.7]} />
        <meshStandardMaterial color={COLORS.desk} roughness={0.4} />
      </mesh>
      <mesh position={[0, 0.3, -0.2]} castShadow>
        <boxGeometry args={[1.4, 0.5, 0.06]} />
        <meshStandardMaterial color={COLORS.deskDark} />
      </mesh>
      <mesh position={[0, 0.59, 0.36]}>
        <boxGeometry args={[1.5, 0.02, 0.02]} />
        {glowMaterial(COLORS.glow, 1.5)}
      </mesh>
      {Array.from({ length: screens }, (_, i) => {
        const x = screens === 1 ? 0 : (i - (screens - 1) / 2) * 0.62;
        return (
          <group key={i} position={[x, 0.86, -0.18]}>
            <mesh castShadow>
              <boxGeometry args={[0.56, 0.36, 0.03]} />
              <meshStandardMaterial color="#0f171e" />
            </mesh>
            <mesh position={[0, 0, 0.017]}>
              <planeGeometry args={[0.5, 0.3]} />
              {glowMaterial(COLORS.glow, 0.9)}
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

export function Chair({ position, rotationY = 0 }: { position: [number, number, number]; rotationY?: number }) {
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <mesh position={[0, 0.38, 0]} castShadow>
        <boxGeometry args={[0.45, 0.08, 0.45]} />
        <meshStandardMaterial color="#1f2a33" />
      </mesh>
      <mesh position={[0, 0.65, 0.2]} castShadow>
        <boxGeometry args={[0.45, 0.5, 0.07]} />
        <meshStandardMaterial color="#1f2a33" />
      </mesh>
      <mesh position={[0, 0.18, 0]}>
        <cylinderGeometry args={[0.04, 0.04, 0.36]} />
        <meshStandardMaterial color="#56636e" metalness={0.6} />
      </mesh>
    </group>
  );
}

/** Orang sederhana. colors = warna peran (PRD §3): badan, aksen, aksen kedua. */
export function Person({
  position,
  rotationY = 0,
  colors,
  seated = false,
  label,
}: {
  position: [number, number, number];
  rotationY?: number;
  colors: string[];
  seated?: boolean;
  label?: string;
}) {
  const body = colors[0] ?? COLORS.siBlue;
  const accent = colors[1] ?? body;
  const accent2 = colors[2];
  const legY = seated ? 0.42 : 0.3;
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      {!seated && (
        <>
          <mesh position={[-0.09, 0.22, 0]} castShadow>
            <boxGeometry args={[0.12, 0.44, 0.14]} />
            <meshStandardMaterial color="#1d2530" />
          </mesh>
          <mesh position={[0.09, 0.22, 0]} castShadow>
            <boxGeometry args={[0.12, 0.44, 0.14]} />
            <meshStandardMaterial color="#1d2530" />
          </mesh>
        </>
      )}
      <mesh position={[0, legY + 0.38, 0]} castShadow>
        <capsuleGeometry args={[0.17, 0.36, 6, 12]} />
        <meshStandardMaterial color={body} roughness={0.6} />
      </mesh>
      {/* Kerah/aksen warna peran */}
      <mesh position={[0, legY + 0.62, 0.02]}>
        <cylinderGeometry args={[0.13, 0.17, 0.08, 12]} />
        <meshStandardMaterial color={accent} />
      </mesh>
      {accent2 && (
        <mesh position={[0, legY + 0.46, 0.165]}>
          <boxGeometry args={[0.06, 0.26, 0.02]} />
          <meshStandardMaterial color={accent2} emissive={accent2} emissiveIntensity={0.3} />
        </mesh>
      )}
      <mesh position={[0, legY + 0.84, 0]} castShadow>
        <sphereGeometry args={[0.14, 16, 16]} />
        <meshStandardMaterial color={COLORS.skin} roughness={0.7} />
      </mesh>
      <mesh position={[0, legY + 0.92, -0.02]}>
        <sphereGeometry args={[0.145, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color={COLORS.hair} />
      </mesh>
      {label && (
        <Html position={[0, legY + 1.25, 0]} center className="person-label" zIndexRange={[20, 0]}>
          <span>{label}</span>
        </Html>
      )}
    </group>
  );
}

export function Plant({ position, scale = 1 }: { position: [number, number, number]; scale?: number }) {
  return (
    <group position={position} scale={scale}>
      <mesh position={[0, 0.2, 0]} castShadow>
        <cylinderGeometry args={[0.18, 0.14, 0.4, 12]} />
        <meshStandardMaterial color="#2a3742" />
      </mesh>
      <mesh position={[0, 0.65, 0]} castShadow>
        <coneGeometry args={[0.3, 0.7, 8]} />
        <meshStandardMaterial color="#2f8f6b" roughness={0.8} />
      </mesh>
    </group>
  );
}

export function Tree({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.5, 0]} castShadow>
        <cylinderGeometry args={[0.1, 0.14, 1, 8]} />
        <meshStandardMaterial color="#5b4334" />
      </mesh>
      <mesh position={[0, 1.25, 0]} castShadow>
        <icosahedronGeometry args={[0.55, 0]} />
        <meshStandardMaterial color="#3a9e6f" flatShading roughness={0.8} />
      </mesh>
    </group>
  );
}

export function Bookshelf({ position, rotationY = 0 }: { position: [number, number, number]; rotationY?: number }) {
  const books = useMemo(
    () =>
      Array.from({ length: 3 }, (_, row) =>
        Array.from({ length: 6 }, (_, i) => ({
          key: `${row}-${i}`,
          x: -0.55 + i * 0.22,
          y: 0.35 + row * 0.45,
          h: 0.26 + ((i * 7 + row * 3) % 5) * 0.025,
          color: ["#1e5bb8", "#f5c400", "#2ee6d6", "#c8102e", "#e6edf2"][(i + row) % 5]!,
        })),
      ).flat(),
    [],
  );
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <mesh position={[0, 0.75, -0.12]} castShadow>
        <boxGeometry args={[1.5, 1.5, 0.08]} />
        <meshStandardMaterial color="#22303b" />
      </mesh>
      {[0.2, 0.65, 1.1, 1.5].map((y) => (
        <mesh key={y} position={[0, y, 0]}>
          <boxGeometry args={[1.5, 0.04, 0.32]} />
          <meshStandardMaterial color="#2c3c48" />
        </mesh>
      ))}
      {books.map((b) => (
        <mesh key={b.key} position={[b.x, b.y - 0.13 + b.h / 2, 0]} castShadow>
          <boxGeometry args={[0.16, b.h, 0.24]} />
          <meshStandardMaterial color={b.color} roughness={0.7} />
        </mesh>
      ))}
    </group>
  );
}

export function CafeTable({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.5, 0]} castShadow>
        <cylinderGeometry args={[0.45, 0.45, 0.05, 20]} />
        <meshStandardMaterial color={COLORS.desk} />
      </mesh>
      <mesh position={[0, 0.25, 0]}>
        <cylinderGeometry args={[0.05, 0.08, 0.5, 8]} />
        <meshStandardMaterial color="#56636e" metalness={0.5} />
      </mesh>
      {[0, Math.PI].map((r) => (
        <mesh key={r} position={[Math.sin(r) * 0.7, 0.25, Math.cos(r) * 0.7]} castShadow>
          <cylinderGeometry args={[0.18, 0.18, 0.06, 12]} />
          <meshStandardMaterial color="#2f8f6b" />
        </mesh>
      ))}
    </group>
  );
}

/** Gapura kampus di Gerbang & Lobby, dengan papan nama bercahaya. */
export function LobbyGate({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      {[-1.9, 1.9].map((x) => (
        <mesh key={x} position={[x, 1.1, 0]} castShadow>
          <boxGeometry args={[0.35, 2.2, 0.35]} />
          <meshStandardMaterial color={COLORS.siBlue} roughness={0.5} />
        </mesh>
      ))}
      <mesh position={[0, 2.35, 0]} castShadow>
        <boxGeometry args={[4.3, 0.4, 0.4]} />
        <meshStandardMaterial color={COLORS.siBlue} roughness={0.5} />
      </mesh>
      <mesh position={[0, 2.35, 0.21]}>
        <boxGeometry args={[3.6, 0.12, 0.02]} />
        {glowMaterial(COLORS.siYellow, 1.6)}
      </mesh>
    </group>
  );
}

/** Gerbang persetujuan di depan Ruang Kaprodi. */
export function ApprovalGate({ position, waiting }: { position: [number, number, number]; waiting: number }) {
  return (
    <group position={position}>
      {[-0.75, 0.75].map((z) => (
        <mesh key={z} position={[0, 0.8, z]} castShadow>
          <boxGeometry args={[0.18, 1.6, 0.18]} />
          <meshStandardMaterial color="#26343f" metalness={0.5} roughness={0.4} />
        </mesh>
      ))}
      {[-0.75, 0.75].map((z) => (
        <mesh key={`g${z}`} position={[0.1, 0.8, z]}>
          <boxGeometry args={[0.02, 1.3, 0.06]} />
          {glowMaterial(waiting > 0 ? COLORS.siYellow : COLORS.glow, waiting > 0 ? 2 : 1.2)}
        </mesh>
      ))}
      <mesh position={[0, 1.65, 0]} castShadow>
        <boxGeometry args={[0.2, 0.12, 1.7]} />
        <meshStandardMaterial color="#26343f" />
      </mesh>
    </group>
  );
}
