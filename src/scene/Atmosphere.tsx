import { useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import type { AmbientLight, DirectionalLight, HemisphereLight, PointLight } from 'three'
import { Color, Fog } from 'three'
import { inFaceRadius } from '../game/chaser'
import { detectDevice } from '../game/deviceDetect'
import { stdMat } from './materials'
import { boxGeo, planeGeo, sphereGeo } from './geometries'
import { useGameStore } from '../game/store'

/** Wall cabinets — hide targets wired into hideLatch proximity. */
export const CABINET_POSITIONS: [number, number, number][] = [
  [3.6, 0, -4.75],
  [-3.6, 0, 4.75],
  [-4.75, 0, -3.6],
  [4.75, 0, 3.6],
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

function Cabinet({ position }: { position: [number, number, number] }) {
  const towardX = position[0] < 0 ? 1 : -1
  const towardZ = position[2] < 0 ? 1 : -1
  // Face the room center: north/south cabinets face ±Z, east/west face ±X.
  const rotY =
    Math.abs(position[0]) > Math.abs(position[2])
      ? (towardX > 0 ? -Math.PI / 2 : Math.PI / 2)
      : (towardZ > 0 ? Math.PI : 0)
  return (
    <group position={position} rotation={[0, rotY, 0]}>
      <mesh
        position={[0, 0.9, 0]}
        castShadow
        material={stdMat('#5a4a3a', { roughness: 0.85 })}
        geometry={boxGeo(1.0, 1.8, 0.5)}
      />
      <mesh position={[0, 0.9, 0.27]} material={stdMat('#3a3028')} geometry={boxGeo(0.9, 1.65, 0.04)} />
      <mesh
        position={[-0.32, 0.9, 0.29]}
        material={stdMat('#c8a050', { metalness: 0.5, roughness: 0.4 })}
        geometry={sphereGeo(0.04, 8, 8)}
      />
      <mesh
        position={[0.32, 0.9, 0.29]}
        material={stdMat('#c8a050', { metalness: 0.5, roughness: 0.4 })}
        geometry={sphereGeo(0.04, 8, 8)}
      />
    </group>
  )
}

function WallScreen({ pos, rotY }: { pos: [number, number, number]; rotY: number }) {
  return (
    <group position={pos} rotation={[0, rotY, 0]}>
      <mesh material={stdMat('#2a2820')} geometry={boxGeo(0.9, 0.55, 0.06)} />
      <mesh
        position={[0, 0, 0.04]}
        material={stdMat('#1a3040', { emissive: '#224455', emissiveIntensity: 0.25 })}
        geometry={planeGeo(0.78, 0.42)}
      />
    </group>
  )
}

export function Atmosphere() {
  const { scene } = useThree()
  const mobile = useMemo(() => detectDevice().isTouch, [])

  const ambientRef = useRef<AmbientLight>(null)
  const hemiRef = useRef<HemisphereLight>(null)
  const dirRef = useRef<DirectionalLight>(null)
  const warmRef = useRef<PointLight>(null)
  const fogColor = useMemo(() => new Color(), [])
  const keyColor = useMemo(() => new Color(), [])
  useFrame(() => {
    const { npcs, playerRoomId, playerPos, threat, spaceEventAt } =
      useGameStore.getState()
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

    // Space event golden bloom: warm overhead light pulses for ~1.2s.
    if (warmRef.current) {
      const now = performance.now()
      let pulse = 0
      if (spaceEventAt && now - spaceEventAt < 1200) {
        const t = (now - spaceEventAt) / 1200
        pulse = Math.sin(t * Math.PI) * 0.85 * (1 - t)
      }
      warmRef.current.intensity = (mobile ? 0.4 : 0.65) + pulse
    }
  })

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
        shadow-mapSize={mobile ? [512, 512] : [2048, 2048]}
        shadow-camera-left={-16}
        shadow-camera-right={16}
        shadow-camera-top={16}
        shadow-camera-bottom={-16}
        shadow-camera-near={0.5}
        shadow-camera-far={30}
      />
      {/* Single warm overhead light replaces per-table/lamp point lights. */}
      <pointLight
        ref={warmRef}
        position={[0, 3, 0]}
        color="#ffd9a8"
        intensity={mobile ? 0.4 : 0.65}
        distance={14}
        decay={2}
      />

      {CABINET_POSITIONS.map((pos, i) => (
        <Cabinet key={i} position={pos} />
      ))}

      {WALL_SCREENS.map((s, i) => (
        <WallScreen key={i} pos={s.pos} rotY={s.rotY} />
      ))}
    </group>
  )
}
