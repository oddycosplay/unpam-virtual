import { useEffect, useRef, type MutableRefObject } from "react";
import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { Html, OrbitControls, OrthographicCamera } from "@react-three/drei";
import { Bloom, EffectComposer } from "@react-three/postprocessing";
import * as THREE from "three";
import { CAMPUS_BOUNDS, MOVE_SPEED, ROLE_INFO, type AgentStatusView, type DashboardSummary, type PlayerState, type Role } from "@unpam/shared";
import { AgentBot, DataPulses } from "./agents";
import { Rooms } from "./ControlRoomScene";
import { ZONES, moveWithCollision } from "./layout";
import { Floor, Hub, Person, Roads } from "./props";

/** Titik tujuan di lantai: x = sumbu x dunia, y = sumbu z dunia. */
export interface FloorTarget {
  x: number;
  y: number;
}

export interface SelfState {
  x: number;
  z: number;
  rot: number;
  moving: boolean;
}

const SEND_EVERY_MS = 100;
const KEYS: Record<string, [number, number]> = {
  KeyW: [0, 1],
  ArrowUp: [0, 1],
  KeyS: [0, -1],
  ArrowDown: [0, -1],
  KeyA: [-1, 0],
  ArrowLeft: [-1, 0],
  KeyD: [1, 0],
  ArrowRight: [1, 0],
};

/** Tinggi lantai: platform ruangan sedikit lebih tinggi dari jalan. */
export function floorY(x: number, z: number): number {
  return ZONES.some((zn) => Math.abs(x - zn.center[0]) <= zn.size[0] / 2 && Math.abs(z - zn.center[1]) <= zn.size[1] / 2) ? 0.16 : 0;
}

function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  return !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);
}

function Avatar({
  role,
  name,
  isSelf,
  bubble,
  groupRef,
  movingRef,
}: {
  role: Role;
  name: string;
  isSelf: boolean;
  bubble?: string;
  groupRef: MutableRefObject<THREE.Group | null>;
  movingRef: MutableRefObject<boolean>;
}) {
  const body = useRef<THREE.Group>(null);
  useFrame((state) => {
    if (body.current) body.current.position.y = movingRef.current ? Math.abs(Math.sin(state.clock.elapsedTime * 10)) * 0.07 : 0;
  });
  return (
    <group ref={groupRef}>
      <group ref={body}>
        <Person position={[0, 0, 0]} colors={ROLE_INFO[role].colors} />
      </group>
      {/* Cincin penanda di kaki */}
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.32, 0.4, 32]} />
        <meshBasicMaterial color={isSelf ? "#f5c400" : ROLE_INFO[role].colors[0]} transparent opacity={0.9} toneMapped={false} />
      </mesh>
      <Html position={[0, 1.65, 0]} center className="player-label" zIndexRange={[25, 0]}>
        <div>
          {bubble && <p className="chat-bubble">{bubble}</p>}
          <span className={isSelf ? "self" : ""}>{isSelf ? `${name} (Anda)` : name}</span>
        </div>
      </Html>
    </group>
  );
}

/** Avatar milik pemain ini: dikendalikan keyboard/klik, kamera mengikuti. */
function SelfPlayer({
  role,
  name,
  selfRef,
  targetRef,
  bubble,
  onMove,
}: {
  role: Role;
  name: string;
  selfRef: MutableRefObject<SelfState>;
  targetRef: MutableRefObject<FloorTarget | null>;
  bubble?: string;
  onMove: (s: SelfState) => void;
}) {
  const group = useRef<THREE.Group | null>(null);
  const moving = useRef(false);
  const pressed = useRef(new Set<string>());
  const lastSent = useRef(0);
  const { camera, controls } = useThree() as unknown as { camera: THREE.Camera; controls: { target: THREE.Vector3 } | null };

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (isTyping(e.target) || !KEYS[e.code]) return;
      e.preventDefault();
      pressed.current.add(e.code);
      targetRef.current = null; // keyboard membatalkan tujuan klik
    };
    const up = (e: KeyboardEvent) => pressed.current.delete(e.code);
    const blur = () => pressed.current.clear();
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
    };
  }, [targetRef]);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const s = selfRef.current;
    let dx = 0;
    let dz = 0;

    if (pressed.current.size > 0) {
      // Arah relatif kamera: "maju" = menjauh dari kamera di bidang lantai.
      const forward = new THREE.Vector3();
      camera.getWorldDirection(forward);
      forward.y = 0;
      forward.normalize();
      const right = new THREE.Vector3(-forward.z, 0, forward.x);
      let f = 0;
      let r = 0;
      for (const code of pressed.current) {
        const k = KEYS[code];
        if (k) {
          r += k[0];
          f += k[1];
        }
      }
      const dir = forward.multiplyScalar(f).add(right.multiplyScalar(r));
      if (dir.lengthSq() > 0) {
        dir.normalize().multiplyScalar(MOVE_SPEED * dt);
        dx = dir.x;
        dz = dir.z;
      }
    } else if (targetRef.current) {
      const tx = targetRef.current.x - s.x;
      const tz = targetRef.current.y - s.z;
      const dist = Math.hypot(tx, tz);
      if (dist < 0.08) targetRef.current = null;
      else {
        const step = Math.min(dist, MOVE_SPEED * dt);
        dx = (tx / dist) * step;
        dz = (tz / dist) * step;
      }
    }

    const wasMoving = s.moving;
    if (dx !== 0 || dz !== 0) {
      const [nx, nz] = moveWithCollision(s.x, s.z, dx, dz, CAMPUS_BOUNDS);
      const actuallyMoved = Math.abs(nx - s.x) + Math.abs(nz - s.z) > 1e-4;
      if (!actuallyMoved) targetRef.current = null; // terhalang
      s.rot = Math.atan2(dx, dz);
      s.moving = actuallyMoved;
      // Kamera ikut bergeser sejauh pemain bergerak.
      const ddx = nx - s.x;
      const ddz = nz - s.z;
      s.x = nx;
      s.z = nz;
      camera.position.x += ddx;
      camera.position.z += ddz;
      if (controls) {
        controls.target.x += ddx;
        controls.target.z += ddz;
      }
    } else {
      s.moving = false;
    }
    moving.current = s.moving;

    if (group.current) {
      group.current.position.set(s.x, floorY(s.x, s.z), s.z);
      group.current.rotation.y = s.rot;
    }

    const now = performance.now();
    if ((s.moving && now - lastSent.current > SEND_EVERY_MS) || wasMoving !== s.moving) {
      lastSent.current = now;
      onMove({ ...s });
    }
  });

  return <Avatar role={role} name={name} isSelf bubble={bubble} groupRef={group} movingRef={moving} />;
}

/** Pemain lain: posisi dari snapshot server, digerakkan halus ke posisi terbaru. */
function RemotePlayer({ id, playersRef, bubble }: { id: string; playersRef: MutableRefObject<Map<string, PlayerState>>; bubble?: string }) {
  const group = useRef<THREE.Group | null>(null);
  const moving = useRef(false);
  const initial = playersRef.current.get(id);

  useFrame((_, dt) => {
    const p = playersRef.current.get(id);
    const g = group.current;
    if (!p || !g) return;
    const k = 1 - Math.exp(-Math.min(dt, 0.1) * 12);
    g.position.x += (p.x - g.position.x) * k;
    g.position.z += (p.z - g.position.z) * k;
    g.position.y = floorY(g.position.x, g.position.z);
    g.rotation.y = p.rot;
    moving.current = p.moving;
  });

  if (!initial) return null;
  return <Avatar role={initial.role} name={initial.name} isSelf={false} bubble={bubble} groupRef={group} movingRef={moving} />;
}

/** Klik di lantai untuk berjalan ke titik itu (bukan saat memutar kamera). */
function ClickFloor({ targetRef }: { targetRef: MutableRefObject<FloorTarget | null> }) {
  const onClick = (e: ThreeEvent<MouseEvent>) => {
    if (e.delta > 6) return; // geseran = memutar kamera
    e.stopPropagation();
    targetRef.current = new THREE.Vector2(e.point.x, e.point.z);
  };
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.17, 0]} onClick={onClick}>
      <planeGeometry args={[24, 22]} />
      <meshBasicMaterial transparent opacity={0} depthWrite={false} />
    </mesh>
  );
}

function TargetMarker({ targetRef }: { targetRef: MutableRefObject<FloorTarget | null> }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    const m = ref.current;
    if (!m) return;
    const t = targetRef.current;
    m.visible = !!t;
    if (t) {
      m.position.set(t.x, floorY(t.x, t.y) + 0.03, t.y);
      m.scale.setScalar(1 + Math.sin(state.clock.elapsedTime * 6) * 0.12);
    }
  });
  return (
    <mesh ref={ref} rotation={[-Math.PI / 2, 0, 0]} visible={false}>
      <ringGeometry args={[0.18, 0.28, 24]} />
      <meshBasicMaterial color={new THREE.Color("#f5c400").multiplyScalar(2)} toneMapped={false} />
    </mesh>
  );
}

/** Hitung FPS tiap detik dan laporkan lewat callback (tanpa memicu render React). */
function FpsMeter({ onFps }: { onFps: (fps: number) => void }) {
  const frames = useRef(0);
  const since = useRef(performance.now());
  useFrame(() => {
    frames.current++;
    const now = performance.now();
    if (now - since.current >= 1000) {
      onFps(Math.round((frames.current * 1000) / (now - since.current)));
      frames.current = 0;
      since.current = now;
    }
  });
  return null;
}

/** Zoom awal agar sekitar 14 m terlihat, menyesuaikan ukuran layar. */
function InitialZoom() {
  const { size, camera } = useThree();
  useEffect(() => {
    camera.zoom = Math.max(28, Math.min(70, Math.min(size.width, size.height * 1.4) / 14));
    camera.updateProjectionMatrix();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camera]);
  return null;
}

export function CampusScene({
  summary,
  agents,
  self,
  playersRef,
  playerIds,
  selfId,
  selfRef,
  targetRef,
  bubbles,
  reducedMotion,
  onMove,
  onSelectAgent,
  onFps,
}: {
  summary: DashboardSummary;
  agents: AgentStatusView[];
  self: { role: Role; name: string };
  playersRef: MutableRefObject<Map<string, PlayerState>>;
  playerIds: string[];
  selfId: string | null;
  selfRef: MutableRefObject<SelfState>;
  targetRef: MutableRefObject<FloorTarget | null>;
  bubbles: Record<string, string>;
  reducedMotion: boolean;
  onMove: (s: SelfState) => void;
  onSelectAgent: (id: string) => void;
  onFps?: (fps: number) => void;
}) {
  const start = selfRef.current;
  const shownAgents = agents.length ? agents : summary.agents;
  const busy = shownAgents.some((a) => a.status === "running" || a.status === "planning");

  return (
    <Canvas shadows dpr={[1, 1.75]} gl={{ antialias: true }} aria-label="Kampus 3D Unpam Virtual">
      <color attach="background" args={["#0a1016"]} />
      <OrthographicCamera makeDefault position={[start.x + 12, 13, start.z + 12]} near={-50} far={200} zoom={40} />
      <InitialZoom />
      {onFps && <FpsMeter onFps={onFps} />}
      <OrbitControls
        makeDefault
        target={[start.x, 0, start.z]}
        enablePan={false}
        enableDamping
        minPolarAngle={0.45}
        maxPolarAngle={1.2}
        minZoom={18}
        maxZoom={110}
      />

      <hemisphereLight args={["#bfe9ff", "#0b1218", 0.6]} />
      <ambientLight intensity={0.18} />
      <directionalLight
        position={[8, 14, 6]}
        intensity={1.3}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-14}
        shadow-camera-right={14}
        shadow-camera-top={14}
        shadow-camera-bottom={-14}
      />
      <pointLight position={[0, 2.5, 0]} color="#2ee6d6" intensity={6} distance={9} />

      <Floor />
      <Roads />
      <Hub busy={busy} reducedMotion={reducedMotion} />
      <Rooms summary={summary} />
      <DataPulses count={4} reducedMotion={reducedMotion} />
      <ClickFloor targetRef={targetRef} />
      <TargetMarker targetRef={targetRef} />

      {shownAgents.map((agent, i) => (
        <AgentBot key={agent.id} agent={agent} index={i} reducedMotion={reducedMotion} onSelect={() => onSelectAgent(agent.id)} />
      ))}

      <SelfPlayer role={self.role} name={self.name} selfRef={selfRef} targetRef={targetRef} bubble={selfId ? bubbles[selfId] : undefined} onMove={onMove} />
      {playerIds
        .filter((id) => id !== selfId)
        .map((id) => (
          <RemotePlayer key={id} id={id} playersRef={playersRef} bubble={bubbles[id]} />
        ))}

      <EffectComposer multisampling={4}>
        <Bloom mipmapBlur luminanceThreshold={1} intensity={0.75} radius={0.7} />
      </EffectComposer>
    </Canvas>
  );
}
