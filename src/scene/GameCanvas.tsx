import { useEffect, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { Vector3 } from 'three'
import { useGameStore } from '../game/store'
import { AudioDirector } from './AudioDirector'
import { Npcs } from './Npcs'
import { SkillFx } from './SkillFx'
import { Player, Room, Table, WallOcclusionFader } from './World'

function GameLoop() {
  const tick = useGameStore((s) => s.tick)
  useFrame((_, dt) => {
    tick(Math.min(dt, 0.05), performance.now())
  })
  return null
}

function CameraFollow() {
  const controls = useRef<{
    target: Vector3
    update: () => void
    setAzimuthalAngle?: (a: number) => void
    getAzimuthalAngle?: () => number
  } | null>(null)
  const { camera } = useThree()
  const playerPos = useGameStore((s) => s.playerPos)
  const npcs = useGameStore((s) => s.npcs)
  const targetId = useGameStore((s) => s.targetId)
  const desired = useRef(new Vector3(0, 1.1, 2.4))
  const camOffset = useRef(new Vector3())

  useFrame(() => {
    if (!controls.current) return
    desired.current.set(playerPos[0], 1.1, playerPos[2])
    controls.current.target.lerp(desired.current, 0.12)

    // Soft yaw assist: gently rotate orbit toward highest-priority smacker
    const focus =
      npcs.find((n) => n.id === targetId && n.status === 'smacking') ??
      npcs.find((n) => n.status === 'smacking')
    if (focus && controls.current.getAzimuthalAngle && controls.current.setAzimuthalAngle) {
      camOffset.current.set(
        camera.position.x - playerPos[0],
        0,
        camera.position.z - playerPos[2],
      )
      const toNpc = new Vector3(
        focus.position[0] - playerPos[0],
        0,
        focus.position[2] - playerPos[2],
      )
      if (toNpc.lengthSq() > 0.01 && camOffset.current.lengthSq() > 0.01) {
        const desiredAz = Math.atan2(-toNpc.x, -toNpc.z)
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
  })

  return (
    <OrbitControls
      ref={controls as never}
      enablePan={false}
      minPolarAngle={0.55}
      maxPolarAngle={1.25}
      minDistance={3.5}
      maxDistance={9}
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
      camera={{ position: [5, 4.2, 6.5], fov: 48, near: 0.1, far: 80 }}
      style={{ width: '100%', height: '100%' }}
    >
      <color attach="background" args={['#d9cfc0']} />
      <fog attach="fog" args={['#d9cfc0', 14, 32]} />
      <GameLoop />
      <AudioDirector />
      <CameraFollow />
      <WallOcclusionFader />
      <Room />
      <Table />
      <Player />
      <Npcs />
      <SkillFx />
    </Canvas>
  )
}
