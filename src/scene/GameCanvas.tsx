import { useEffect, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { Vector3 } from 'three'
import { useGameStore } from '../game/store'
import { Npcs } from './Npcs'
import { Player, Room, Table } from './World'

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
  } | null>(null)
  const playerPos = useGameStore((s) => s.playerPos)
  const desired = useRef(new Vector3(0, 1.1, 2.4))

  useFrame(() => {
    if (!controls.current) return
    desired.current.set(playerPos[0], 1.1, playerPos[2])
    controls.current.target.lerp(desired.current, 0.12)
    controls.current.update()
  })

  return (
    <OrbitControls
      ref={controls as never}
      enablePan={false}
      minPolarAngle={0.4}
      maxPolarAngle={1.35}
      minDistance={3}
      maxDistance={8}
      target={[0, 1.1, 2.4]}
    />
  )
}

export function GameCanvas() {
  const start = useGameStore((s) => s.start)

  useEffect(() => {
    start()
  }, [start])

  return (
    <Canvas
      shadows
      camera={{ position: [4, 3.5, 6], fov: 50, near: 0.1, far: 80 }}
      style={{ width: '100%', height: '100%' }}
    >
      <color attach="background" args={['#d9cfc0']} />
      <fog attach="fog" args={['#d9cfc0', 12, 28]} />
      <GameLoop />
      <CameraFollow />
      <Room />
      <Table />
      <Player />
      <Npcs />
    </Canvas>
  )
}
