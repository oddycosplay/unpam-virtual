import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import { DEFAULT_AGENT_APPEARANCE, type AgentAppearance, type AgentStatusView } from "@unpam/shared";
import { EDGES, NODES, STATUS_COLOR, STATUS_LABEL, route, targetNode, type NodeId } from "./layout";

const SPEED = 2.6; // satuan per detik
const HOVER_Y = 0.42;

/** Geser sedikit agar beberapa agent di titik yang sama tidak bertumpuk. */
function slotOffset(index: number): [number, number] {
  return [[0, 0], [0.75, 0.35], [-0.75, 0.35]][index % 3] as [number, number];
}

/** Badan robot sesuai tampilan dari admin. Agent nonaktif digambar lebih redup. */
export function RobotShell({ look, active, glow }: { look: AgentAppearance; active: boolean; glow: THREE.Color }) {
  const body = useMemo(() => {
    const c = new THREE.Color(look.body);
    return active ? c : c.lerp(new THREE.Color("#5b6670"), 0.6);
  }, [look.body, active]);
  return (
    <>
      {look.style === "kotak" ? (
        <>
          <mesh castShadow>
            <boxGeometry args={[0.6, 0.4, 0.72]} />
            <meshStandardMaterial color={body} metalness={0.35} roughness={0.3} />
          </mesh>
          <mesh position={[0, 0.3, 0]} castShadow>
            <boxGeometry args={[0.42, 0.26, 0.42]} />
            <meshStandardMaterial color={body} metalness={0.35} roughness={0.3} />
          </mesh>
          <mesh position={[0, 0.31, 0.215]}>
            <boxGeometry args={[0.34, 0.12, 0.02]} />
            <meshStandardMaterial color={look.visor} metalness={0.6} roughness={0.15} />
          </mesh>
        </>
      ) : (
        <>
          {/* Badan pod */}
          <mesh castShadow scale={[1, 0.62, 1.25]}>
            <sphereGeometry args={[0.36, 24, 16]} />
            <meshStandardMaterial color={body} metalness={0.35} roughness={0.25} />
          </mesh>
          {/* Kubah kaca */}
          <mesh position={[0, 0.13, -0.05]} scale={[0.8, 0.5, 0.9]}>
            <sphereGeometry args={[0.3, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <meshStandardMaterial color={look.visor} metalness={0.6} roughness={0.15} />
          </mesh>
        </>
      )}
      {look.style === "antena" && (
        <group position={[0, 0.26, -0.05]}>
          <mesh position={[0, 0.12, 0]}>
            <cylinderGeometry args={[0.012, 0.012, 0.24, 6]} />
            <meshStandardMaterial color="#9aa7b1" />
          </mesh>
          <mesh position={[0, 0.26, 0]}>
            <sphereGeometry args={[0.045, 12, 12]} />
            <meshBasicMaterial color={glow} toneMapped={false} />
          </mesh>
        </group>
      )}
    </>
  );
}

export function AgentBot({
  agent,
  index,
  reducedMotion,
  onSelect,
}: {
  agent: AgentStatusView;
  index: number;
  reducedMotion: boolean;
  onSelect?: () => void;
}) {
  const group = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const ring = useRef<THREE.MeshBasicMaterial>(null);
  const [hovered, setHovered] = useState(false);

  const target = targetNode(agent);
  const [ox, oz] = slotOffset(index);
  const nodeRef = useRef<NodeId>(target);
  const waypoints = useRef<THREE.Vector3[]>([]);

  // Rute baru setiap kali tujuan berubah. Posisi awal langsung di tujuan.
  useEffect(() => {
    const path = route(nodeRef.current, target).slice(1);
    waypoints.current = path.map((n) => new THREE.Vector3(NODES[n][0] + ox, HOVER_Y, NODES[n][1] + oz));
    nodeRef.current = target;
  }, [target, ox, oz]);

  // Hanya posisi awal; setelah itu posisi digerakkan useFrame (prop tidak boleh ikut berubah).
  const [initial] = useState<[number, number, number]>(() => [NODES[target][0] + ox, HOVER_Y, NODES[target][1] + oz]);
  const color = useMemo(() => new THREE.Color(STATUS_COLOR[agent.status]), [agent.status]);
  const glow = useMemo(() => color.clone().multiplyScalar(agent.active ? 2.4 : 0.6), [color, agent.active]);

  useFrame((state, dt) => {
    const g = group.current;
    if (!g) return;
    const next = waypoints.current[0];
    if (next) {
      const to = next.clone().sub(g.position);
      const dist = to.length();
      const step = Math.min(dist, SPEED * Math.min(dt, 0.05));
      if (dist < 0.02) {
        waypoints.current.shift();
      } else {
        g.position.addScaledVector(to.normalize(), step);
        const yaw = Math.atan2(to.x, to.z);
        g.rotation.y = THREE.MathUtils.lerp(g.rotation.y, yaw, 0.2);
      }
    }
    const t = state.clock.elapsedTime;
    if (body.current && !reducedMotion) body.current.position.y = Math.sin(t * 3 + index) * 0.05;
    if (ring.current) {
      const blink = agent.status === "error" ? (Math.sin(t * 8) > 0 ? 1 : 0.25) : agent.status === "running" ? 0.75 + Math.sin(t * 6) * 0.25 : 1;
      ring.current.color.copy(glow).multiplyScalar(reducedMotion ? 1 : blink);
    }
  });

  return (
    <group ref={group} position={initial}>
      <group
        ref={body}
        onClick={(e) => {
          e.stopPropagation();
          onSelect?.();
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(true);
          if (onSelect) document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          setHovered(false);
          document.body.style.cursor = "";
        }}
        scale={hovered ? 1.12 : 1}
      >
        <RobotShell look={agent.appearance ?? DEFAULT_AGENT_APPEARANCE[agent.id]} active={agent.active} glow={glow} />
        {/* Sabuk cahaya status */}
        <mesh rotation={[Math.PI / 2, 0, 0]} scale={[1, 1.25, 1]}>
          <torusGeometry args={[0.36, 0.025, 8, 40]} />
          <meshBasicMaterial ref={ring} color={glow} toneMapped={false} />
        </mesh>
        {/* Mata depan */}
        <mesh position={[0, 0.03, 0.43]}>
          <boxGeometry args={[0.22, 0.05, 0.02]} />
          <meshBasicMaterial color={glow} toneMapped={false} />
        </mesh>
      </group>
      {/* Bayangan cahaya di lantai */}
      <mesh position={[0, -HOVER_Y + 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.45, 24]} />
        <meshBasicMaterial color={color} transparent opacity={agent.active ? 0.22 : 0.08} depthWrite={false} toneMapped={false} />
      </mesh>
      <Html position={[0, 0.85, 0]} center className="agent-label" zIndexRange={[30, 0]}>
        <div className={agent.active ? "" : "inactive"}>
          <strong>
            <i style={{ background: STATUS_COLOR[agent.status] }} />
            {agent.name}
          </strong>
          <span>
            {STATUS_LABEL[agent.status]} · {agent.activity}
          </span>
        </div>
      </Html>
    </group>
  );
}

/** Paket data bercahaya yang mengalir dari hub ke ujung jalur. Jumlah mengikuti aktivitas. */
export function DataPulses({ count, reducedMotion }: { count: number; reducedMotion: boolean }) {
  const meshes = useRef<(THREE.Mesh | null)[]>([]);
  const lanes = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => {
        const [a, b] = EDGES[(i * 3) % EDGES.length]!;
        return { from: NODES[a], to: NODES[b], offset: i / count, speed: 0.18 + (i % 3) * 0.06 };
      }),
    [count],
  );

  useFrame((state) => {
    if (reducedMotion) return;
    const t = state.clock.elapsedTime;
    lanes.forEach((lane, i) => {
      const m = meshes.current[i];
      if (!m) return;
      const p = (t * lane.speed + lane.offset) % 1;
      m.position.set(
        lane.from[0] + (lane.to[0] - lane.from[0]) * p,
        0.08,
        lane.from[1] + (lane.to[1] - lane.from[1]) * p,
      );
      m.scale.setScalar(0.6 + Math.sin(p * Math.PI) * 0.6);
    });
  });

  return (
    <group>
      {lanes.map((lane, i) => (
        <mesh key={i} ref={(el) => void (meshes.current[i] = el)} position={[lane.from[0], 0.08, lane.from[1]]}>
          <sphereGeometry args={[0.08, 10, 10]} />
          <meshBasicMaterial color={new THREE.Color("#2ee6d6").multiplyScalar(3)} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}
