import { useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { ROLE_INFO, type AgentAppearance, type AvatarLook, type Role } from "@unpam/shared";
import { Person } from "./props";
import { RobotShell } from "./agents";

function Turntable({ children }: { children: React.ReactNode }) {
  const group = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (group.current) group.current.rotation.y += Math.min(dt, 0.1) * 0.6;
  });
  return <group ref={group}>{children}</group>;
}

function Stage({ children, label, focusY }: { children: React.ReactNode; label: string; focusY: number }) {
  return (
    <div className="appearance-preview">
      <Canvas
        dpr={[1, 2]}
        camera={{ position: [0, focusY + 0.55, 2.7], fov: 30 }}
        onCreated={({ camera }) => camera.lookAt(0, focusY, 0)}
        aria-label={label}
      >
        <color attach="background" args={["#0f1922"]} />
        <hemisphereLight args={["#e8f4ff", "#1a2530", 1.1]} />
        <directionalLight position={[2, 3, 2]} intensity={1.4} />
        <mesh position={[0, -0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.7, 40]} />
          <meshStandardMaterial color="#1b2a36" />
        </mesh>
        <Turntable>{children}</Turntable>
      </Canvas>
    </div>
  );
}

/** Pratinjau avatar pengguna yang berputar pelan. */
export function AvatarPreview({ look, role }: { look: AvatarLook; role: Role }) {
  return (
    <Stage label="Pratinjau avatar" focusY={0.72}>
      <group position={[0, -0.05, 0]} scale={1.05}>
        <Person position={[0, 0, 0]} colors={ROLE_INFO[role].colors} look={look} />
      </group>
    </Stage>
  );
}

const PREVIEW_GLOW = new THREE.Color("#2ee6d6").multiplyScalar(2);

/** Pratinjau robot agent. */
export function RobotPreview({ look }: { look: AgentAppearance }) {
  return (
    <Stage label="Pratinjau robot agent" focusY={0.6}>
      <group position={[0, 0.55, 0]} scale={1.3}>
        <RobotShell look={look} active glow={PREVIEW_GLOW} />
        <mesh rotation={[Math.PI / 2, 0, 0]} scale={[1, 1.25, 1]}>
          <torusGeometry args={[0.36, 0.025, 8, 40]} />
          <meshBasicMaterial color={PREVIEW_GLOW} toneMapped={false} />
        </mesh>
      </group>
    </Stage>
  );
}
