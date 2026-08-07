import { useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import type { AmbientLight, DirectionalLight, Group, HemisphereLight, PointLight } from 'three'
import { Color, DoubleSide, Fog } from 'three'
import { inFaceRadius } from '../game/chaser'
import { detectDevice } from '../game/deviceDetect'
import { useGameStore } from '../game/store'

/** Wall cabinets — hide targets wired into hideLatch proximity. */
export const CABINET_POSITIONS: [number, number, number][] = [
  [-4.15, 0, 3.6],
  [4.15, 0, 3.6],
  [-4.15, 0, -2.8],
  [4.15, 0, -2.8],
]

const CEILING_LAMPS: [number, number, number][] = [
  [-2.5, 2.35, -1.5],
  [2.5, 2.35, -1.5],
  [0, 2.35, 2.2],
  [-1.5, 2.35, 1.0],
  [1.8, 2.35, 0.5],
]

const WALL_SCREENS: { pos: [number, number, number]; rotY: number }[] = [
  { pos: [-4.55, 1.1, 0.5], rotY: Math.PI / 2 },
  { pos: [4.55, 1.1, -0.8], rotY: -Math.PI / 2 },
]

function threatColor(threat: number, out: Color): Color {
  const t = Math.min(1, threat / 1.2)
  return out.setRGB(
    0.85 + t * 0.12,
    0.81 - t * 0.22,
    0.75 - t * 0.28,
  )
}

function Lamp({ position, phase, mobile }: { position: [number, number, number]; phase: number; mobile: boolean }) {
  const shade = useRef<Group>(null)
  const light = useRef<PointLight>(null)

  useFrame(({ clock }) => {
    const t = clock.elapsedTime + phase
    if (shade.current) {
      shade.current.rotation.z = Math.sin(t * 1.1) * 0.06
      shade.current.rotation.x = Math.sin(t * 0.7 + 1) * 0.03
    }
    if (light.current && !mobile) {
      light.current.intensity = 0.55 + Math.sin(t * 2.3) * 0.08
    }
  })

  return (
    <group position={position}>
      <mesh position={[0, -0.12, 0]}>
        <cylinderGeometry args={[0.02, 0.02, 0.35, 6]} />
        <meshStandardMaterial color="#4a4035" metalness={0.4} roughness={0.5} />
      </mesh>
      <group ref={shade} position={[0, -0.32, 0]}>
        <mesh>
          <coneGeometry args={[0.22, 0.18, 12, 1, true]} />
          <meshStandardMaterial
            color="#f5e6c8"
            emissive="#ffcc88"
            emissiveIntensity={0.15}
            side={DoubleSide}
          />
        </mesh>
      </group>
      {!mobile && (
        <pointLight
          ref={light}
          position={[0, -0.45, 0]}
          color="#ffddb0"
          intensity={0.6}
          distance={7}
          decay={2}
        />
      )}
    </group>
  )
}

function Cabinet({ position }: { position: [number, number, number] }) {
  const towardCenter = position[0] < 0 ? 1 : -1
  return (
    <group position={position} rotation={[0, towardCenter > 0 ? -Math.PI / 2 : Math.PI / 2, 0]}>
      <mesh position={[0, 0.9, 0]} castShadow>
        <boxGeometry args={[1.1, 1.8, 0.45]} />
        <meshStandardMaterial color="#5a4a3a" roughness={0.85} />
      </mesh>
      <mesh position={[0, 0.9, 0.24]}>
        <boxGeometry args={[1.0, 1.65, 0.04]} />
        <meshStandardMaterial color="#3a3028" />
      </mesh>
      <mesh position={[-0.35, 0.9, 0.26]}>
        <sphereGeometry args={[0.04, 8, 8]} />
        <meshStandardMaterial color="#c8a050" metalness={0.5} roughness={0.4} />
      </mesh>
      <mesh position={[0.35, 0.9, 0.26]}>
        <sphereGeometry args={[0.04, 8, 8]} />
        <meshStandardMaterial color="#c8a050" metalness={0.5} roughness={0.4} />
      </mesh>
    </group>
  )
}

function WallScreen({ pos, rotY }: { pos: [number, number, number]; rotY: number }) {
  return (
    <group position={pos} rotation={[0, rotY, 0]}>
      <mesh>
        <boxGeometry args={[0.9, 0.55, 0.06]} />
        <meshStandardMaterial color="#2a2820" />
      </mesh>
      <mesh position={[0, 0, 0.04]}>
        <planeGeometry args={[0.78, 0.42]} />
        <meshStandardMaterial color="#1a3040" emissive="#224455" emissiveIntensity={0.25} />
      </mesh>
    </group>
  )
}

export function Atmosphere() {
  const { scene } = useThree()
  const tables = useGameStore((s) => s.runtimeTables)
  const mobile = useMemo(() => detectDevice().isTouch, [])

  const ambientRef = useRef<AmbientLight>(null)
  const hemiRef = useRef<HemisphereLight>(null)
  const dirRef = useRef<DirectionalLight>(null)
  const fogColor = useMemo(() => new Color(), [])
  const keyColor = useMemo(() => new Color(), [])

  useFrame(() => {
    const { npcs, playerRoomId, playerPos, threat } = useGameStore.getState()
    const roomSmackers = npcs.filter(
      (n) => n.status === 'smacking' && n.roomId === playerRoomId,
    ).length
    const faceChase = npcs.some(
      (n) => n.role === 'chaser' && inFaceRadius(n, playerPos),
    )

    const murk = Math.min(
      9,
      roomSmackers * 1.4 + threat * 3.2 + (faceChase ? 2.8 : 0),
    )
    const fogNear = Math.max(5.5, 14 - murk * 0.85)
    const fogFar = Math.max(17, 32 - murk * 1.45)

    threatColor(threat, fogColor)
    if (!scene.fog) {
      scene.fog = new Fog(fogColor.getHex(), fogNear, fogFar)
    } else {
      const fog = scene.fog as Fog
      fog.color.copy(fogColor)
      fog.near = fogNear
      fog.far = fogFar
    }

    const amb = 0.42 - threat * 0.18
    if (ambientRef.current) ambientRef.current.intensity = amb

    if (hemiRef.current) {
      hemiRef.current.intensity = 0.32 - threat * 0.12
      hemiRef.current.color.setRGB(1, 0.95 - threat * 0.15, 0.88 - threat * 0.2)
      hemiRef.current.groundColor.setRGB(0.54 - threat * 0.08, 0.48 - threat * 0.1, 0.42 - threat * 0.08)
    }

    if (dirRef.current) {
      keyColor.setRGB(1, 0.92 - threat * 0.35, 0.82 - threat * 0.45)
      dirRef.current.color.copy(keyColor)
      dirRef.current.intensity = 0.55 - threat * 0.22
    }
  })

  const tableLights = mobile ? tables.slice(0, 2) : tables

  return (
    <group>
      <ambientLight ref={ambientRef} intensity={0.42} />
      <hemisphereLight
        ref={hemiRef}
        args={['#fff2e0', '#8a7a68', 0.32]}
      />
      <directionalLight
        ref={dirRef}
        castShadow={!mobile}
        position={[3, 7, 2]}
        intensity={0.55}
        shadow-mapSize={mobile ? [512, 512] : [1024, 1024]}
      />

      {CEILING_LAMPS.map((pos, i) => (
        <Lamp key={i} position={pos} phase={i * 1.7} mobile={mobile} />
      ))}

      {tableLights.map((t) => (
        <pointLight
          key={`tbl-${t.id}`}
          position={[t.position[0], t.topY + 0.6, t.position[2]]}
          color="#ffb878"
          intensity={mobile ? 0.35 : 0.5}
          distance={5}
          decay={2}
        />
      ))}

      {CABINET_POSITIONS.map((pos, i) => (
        <Cabinet key={i} position={pos} />
      ))}

      {WALL_SCREENS.map((s, i) => (
        <WallScreen key={i} pos={s.pos} rotY={s.rotY} />
      ))}
    </group>
  )
}
