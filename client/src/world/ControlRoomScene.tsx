import { useEffect } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls, OrthographicCamera } from "@react-three/drei";
import { Bloom, EffectComposer } from "@react-three/postprocessing";
import { ROLE_INFO, type DashboardSummary, type Role } from "@unpam/shared";
import { AgentBot, DataPulses } from "./agents";
import { HoloScreen } from "./HoloScreen";
import { COLORS, ZONES } from "./layout";
import {
  ApprovalGate,
  Bookshelf,
  CafeTable,
  Chair,
  Desk,
  Floor,
  GlassWall,
  Hub,
  Person,
  Plant,
  Roads,
  SolidWall,
  Tree,
  ZonePlatform,
} from "./props";

const ROLE_COLORS = (role: Role) => ROLE_INFO[role].colors;

/** Zoom kamera ortografis menyesuaikan ukuran kanvas agar seluruh ruangan terlihat. */
function AutoZoom() {
  const { size, camera } = useThree();
  useEffect(() => {
    camera.zoom = Math.max(10, Math.min(size.width / 31, size.height / 20));
    camera.updateProjectionMatrix();
  }, [size.width, size.height, camera]);
  return null;
}

function Rooms({ summary, viewerRole }: { summary: DashboardSummary; viewerRole: Role }) {
  const { stats } = summary;
  const akademik = summary.agents.find((a) => a.id === "akademik");
  const latencySec = stats.avgLatencyMs === null ? null : stats.avgLatencyMs / 1000;

  return (
    <group>
      {ZONES.map((z) => (
        <ZonePlatform key={z.id} zone={z} />
      ))}

      {/* Ruang Akademik & Dosen (utara) */}
      <SolidWall position={[0, 1.2, -9.3]} size={[8, 2.4, 0.2]} />
      <GlassWall position={[-4, 0.95, -7.2]} size={[4, 1.6]} rotationY={Math.PI / 2} />
      <GlassWall position={[4, 0.95, -7.2]} size={[4, 1.6]} rotationY={Math.PI / 2} />
      <Desk position={[-2.4, 0.16, -7.6]} screens={2} />
      <Chair position={[-2.4, 0.16, -6.9]} />
      <Person position={[-2.4, 0.16, -6.95]} rotationY={Math.PI} colors={ROLE_COLORS("dosen")} seated />
      <Desk position={[2.4, 0.16, -7.6]} screens={2} />
      <Chair position={[2.4, 0.16, -6.9]} />
      <Person position={[2.4, 0.16, -6.95]} rotationY={Math.PI} colors={ROLE_COLORS("dosen")} seated />
      <Desk position={[0, 0.16, -6.2]} screens={1} />
      <Plant position={[-3.5, 0.16, -8.8]} />
      <HoloScreen
        position={[0, 1.6, -9.15]}
        size={[3.2, 1.25]}
        content={{
          kind: "text",
          title: "Agent Akademik",
          lines: [akademik ? `${akademik.activity}` : "Memuat…", `Dokumen akademik terindeks · ${stats.chunks} potongan`],
        }}
      />

      {/* Perpustakaan (timur laut) */}
      <Bookshelf position={[6.2, 0.16, -8.9]} />
      <Bookshelf position={[8.2, 0.16, -8.9]} />
      <HoloScreen
        position={[7.2, 2.05, -8.6]}
        size={[2.6, 0.9]}
        content={{
          kind: "stats",
          title: "Basis pengetahuan",
          items: [
            { label: "dokumen", value: String(stats.documents) },
            { label: "potongan", value: String(stats.chunks) },
          ],
        }}
      />

      {/* Sekretariat HIMA (timur). Dinding hanya di sisi jauh dari kamera agar isi ruangan terlihat. */}
      <SolidWall position={[7.6, 1.2, -3.3]} size={[4.4, 2.4, 0.2]} />
      <GlassWall position={[9.8, 0.55, 0]} size={[6.4, 0.8]} rotationY={Math.PI / 2} />
      <Desk position={[7.9, 0.16, -1.9]} screens={2} />
      <Chair position={[7.9, 0.16, -1.2]} />
      <Person position={[7.9, 0.16, -1.25]} rotationY={Math.PI} colors={ROLE_COLORS("hima")} seated />
      <CafeTable position={[7.9, 0.16, 1.4]} />
      <Person position={[8.8, 0.16, 1.4]} rotationY={-Math.PI / 2} colors={ROLE_COLORS("hima")} />
      <HoloScreen
        position={[7.6, 1.75, -3.15]}
        size={[3, 1.1]}
        content={{ kind: "text", title: "Agent HIMA", lines: ["Proposal kegiatan", "Aktif mulai tahap 3"] }}
      />

      {/* Ruang Kaprodi (barat) */}
      <SolidWall position={[-9.9, 1.2, 0]} size={[0.2, 2.4, 6.4]} />
      <GlassWall position={[-7.6, 0.55, 3.2]} size={[4.4, 0.8]} />
      <Desk position={[-8.1, 0.16, 0]} rotationY={Math.PI / 2} screens={1} />
      <Chair position={[-7.4, 0.16, 0]} rotationY={Math.PI / 2} />
      <Person position={[-7.4, 0.16, 0]} rotationY={-Math.PI / 2} colors={ROLE_COLORS("kaprodi")} seated />
      <ApprovalGate position={[-5.6, 0.16, 0]} waiting={0} />
      <Plant position={[-9.4, 0.16, -2.7]} />
      <HoloScreen
        position={[-9.75, 1.6, -0.2]}
        rotation={[0, Math.PI / 2, 0]}
        size={[2.8, 1.1]}
        content={{
          kind: "stats",
          title: "Persetujuan",
          items: [
            { label: "menunggu", value: "0", tone: "ok" },
            { label: "hari ini", value: "0" },
          ],
        }}
      />

      {/* Kantin & Taman (barat daya) */}
      <Tree position={[-8.8, 0.16, 8.3]} />
      <Tree position={[-6.2, 0.16, 8.5]} />
      <CafeTable position={[-7.6, 0.16, 6.4]} />
      <CafeTable position={[-5.9, 0.16, 7.2]} />
      <Person position={[-8.3, 0.16, 6.4]} rotationY={Math.PI / 2} colors={ROLE_COLORS("mahasiswa")} />

      {/* Meja komando di depan-tengah, menghadap kamera seperti referensi */}
      <group position={[5.9, 0, 5.9]} rotation={[0, Math.PI / 4, 0]}>
        <Desk position={[0, 0, 0]} rotationY={Math.PI} screens={0} />
        <Desk position={[-1.55, 0, -0.35]} rotationY={Math.PI - 0.45} screens={0} />
        <Desk position={[1.55, 0, -0.35]} rotationY={Math.PI + 0.45} screens={0} />
        <HoloScreen
          position={[-2.15, 1.65, -0.75]}
          rotation={[0, 0.45, 0]}
          size={[2, 1.2]}
          content={{ kind: "bars", title: "Jawaban / jam", values: summary.answersPerHour, caption: "12 jam terakhir" }}
        />
        <HoloScreen
          position={[0, 1.75, -0.45]}
          size={[2.2, 1.2]}
          content={{
            kind: "stats",
            title: "Hari ini",
            items: [
              { label: "pertanyaan", value: String(stats.questionsToday) },
              { label: "dijawab", value: String(stats.answersToday), tone: "ok" },
              { label: "error", value: String(stats.errorsToday), tone: stats.errorsToday > 0 ? "bad" : undefined },
            ],
          }}
        />
        <HoloScreen
          position={[2.15, 1.65, -0.75]}
          rotation={[0, -0.45, 0]}
          size={[2, 1.2]}
          content={{ kind: "gauge", title: "Waktu jawab", value: latencySec, max: 10, unit: " dtk", caption: "target < 10 dtk" }}
        />
        <Person position={[-0.7, 0, 0.75]} rotationY={Math.PI} colors={ROLE_COLORS(viewerRole)} label="Anda" />
        <Person position={[0.9, 0, 0.8]} rotationY={Math.PI + 0.3} colors={ROLE_COLORS("dosen")} />
      </group>
    </group>
  );
}

export function ControlRoomScene({
  summary,
  viewerRole,
  reducedMotion,
  onSelectAgent,
}: {
  summary: DashboardSummary;
  viewerRole: Role;
  reducedMotion: boolean;
  onSelectAgent: (id: string) => void;
}) {
  const busy = summary.agents.some((a) => a.status === "running" || a.status === "planning");
  const recent = summary.answersPerHour.slice(-2).reduce((a, b) => a + b, 0);
  const pulses = Math.min(10, 3 + recent);

  return (
    <Canvas shadows dpr={[1, 1.75]} gl={{ antialias: true }} aria-label="Peta 3D ruang kendali Unpam Virtual">
      <color attach="background" args={["#0a1016"]} />
      <OrthographicCamera makeDefault position={[14, 13, 14]} near={-50} far={200} zoom={32} />
      <AutoZoom />
      <OrbitControls
        makeDefault
        target={[0, 0, 0]}
        enablePan={false}
        enableDamping
        minPolarAngle={0.45}
        maxPolarAngle={1.15}
        minZoom={8}
        maxZoom={90}
      />

      <hemisphereLight args={["#bfe9ff", "#0b1218", 0.55]} />
      <ambientLight intensity={0.15} />
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
      <pointLight position={[0, 2.5, 0]} color={COLORS.glow} intensity={6} distance={9} />

      <Floor />
      <Roads />
      <Hub busy={busy} reducedMotion={reducedMotion} />
      <Rooms summary={summary} viewerRole={viewerRole} />
      <DataPulses count={pulses} reducedMotion={reducedMotion} />
      {summary.agents.map((agent, i) => (
        <AgentBot
          key={agent.id}
          agent={agent}
          index={i}
          reducedMotion={reducedMotion}
          onSelect={agent.id === "akademik" ? () => onSelectAgent(agent.id) : undefined}
        />
      ))}

      <EffectComposer multisampling={4}>
        <Bloom mipmapBlur luminanceThreshold={1} intensity={0.85} radius={0.7} />
      </EffectComposer>
    </Canvas>
  );
}
