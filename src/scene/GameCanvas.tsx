import { useEffect, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { Vector3 } from 'three'
import { useGameStore } from '../game/store'
import { Selection } from '@react-three/postprocessing'
import { AudioDirector } from './AudioDirector'
import { Atmosphere } from './Atmosphere'
import { Npcs } from './Npcs'
import { PostProcessing } from './PostProcessing'
import { Props } from './Props'
import { SkillFx } from './SkillFx'
import { Player, Room, Tables, Door, WallOcclusionFader } from './World'

function GameLoop() {
  const tick = useGameStore((s) => s.tick)
  useFrame((_, dt) => {
    tick(Math.min(dt, 0.05), performance.now())
  })
  return null
}

const _camDesired = new Vector3(0, 1.1, 2.4)
const _camOffset = new Vector3()
const _camToNpc = new Vector3()

function CameraFollow() {
  const controls = useRef<{
    target: Vector3
    update: () => void
    setAzimuthalAngle?: (a: number) => void
    getAzimuthalAngle?: () => number
  } | null>(null)
  const { camera } = useThree()

  useFrame(() => {
    if (!controls.current) return
    const { playerPos, npcs, targetId } = useGameStore.getState()
    _camDesired.set(playerPos[0], playerPos[1] + 1.1, playerPos[2])
    controls.current.target.lerp(_camDesired, 0.12)

    // Soft yaw assist: gently rotate orbit toward highest-priority smacker
    const focus =
      npcs.find((n) => n.id === targetId && n.status === 'smacking') ??
      npcs.find((n) => n.status === 'smacking')
    if (focus && controls.current.getAzimuthalAngle && controls.current.setAzimuthalAngle) {
      _camOffset.set(
        camera.position.x - playerPos[0],
        0,
        camera.position.z - playerPos[2],
      )
      _camToNpc.set(
        focus.position[0] - playerPos[0],
        0,
        focus.position[2] - playerPos[2],
      )
      if (_camToNpc.lengthSq() > 0.01 && _camOffset.lengthSq() > 0.01) {
        const desiredAz = Math.atan2(-_camToNpc.x, -_camToNpc.z)
        const cur = controls.current.getAzimuthalAngle()
        let diff = desiredAz - cur
        while (diff > Math.PI) diff -= Math.PI * 2
        while (diff < -Math.PI) diff += Math.PI * 2
        // Keep NPC roughly in frame without stealing player orbit control
        if (Math.abs(diff) > 0.55) {
          controls.current.setAzimuthalAngle(cur + diff * 0.03)
        }
      }
    }

    controls.current.update()

    // Free orbit: walls fade via WallOcclusionFader instead of clamping the
    // camera inside the player room.

    // Boss rage-pulse impact shake — decays over ~500ms.
    const now = performance.now()
    for (const n of npcs) {
      if (n.role === 'boss' && n.pulseFiredAt > 0 && now - n.pulseFiredAt < 500) {
        const k = 0.5 - (now - n.pulseFiredAt) / 1000
        camera.position.x += (Math.random() - 0.5) * k * 0.2
        camera.position.y += (Math.random() - 0.5) * k * 0.14
        break
      }
    }
  })

  return (
    <OrbitControls
      ref={controls as never}
      enablePan={false}
      minPolarAngle={0.55}
      maxPolarAngle={1.25}
      minDistance={3.5}
      maxDistance={6.5}
      target={[0, 1.1, 2.4]}
    />
  )
}

export function GameCanvas() {
  const start = useGameStore((s) => s.start)

  useEffect(() => {
    // Preview NPCs behind the briefing — never wipe an active mission.
    const { briefingDone, npcs } = useGameStore.getState()
    if (!briefingDone && npcs.length === 0) start()
  }, [start])

  return (
    <Canvas
      shadows
      dpr={[1, 1.5]}
      camera={{ position: [5, 4.2, 6.5], fov: 48, near: 0.1, far: 80 }}
      style={{ width: '100%', height: '100%' }}
    >
      <color attach="background" args={['#d9cfc0']} />
      <Selection>
        <PostProcessing />
        <GameLoop />
        <AudioDirector />
        <Atmosphere />
        <CameraFollow />
        <WallOcclusionFader />
        <Room />
        <Door />
        <Tables />
        <Player />
        <Npcs />
        <Props />
        <SkillFx />
      </Selection>
    </Canvas>
  )
}
