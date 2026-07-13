import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import type { Group } from 'three'
import { useGameStore } from '../game/store'

export function Room() {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[10, 10]} />
        <meshStandardMaterial color="#c4b8a8" />
      </mesh>
      <mesh position={[0, 1.5, -4.8]}>
        <boxGeometry args={[10, 3, 0.2]} />
        <meshStandardMaterial color="#8b7355" />
      </mesh>
      <mesh position={[0, 1.5, 4.8]}>
        <boxGeometry args={[10, 3, 0.2]} />
        <meshStandardMaterial color="#8b7355" />
      </mesh>
      <mesh position={[-4.8, 1.5, 0]}>
        <boxGeometry args={[0.2, 3, 10]} />
        <meshStandardMaterial color="#7a6548" />
      </mesh>
      <mesh position={[4.8, 1.5, 0]}>
        <boxGeometry args={[0.2, 3, 10]} />
        <meshStandardMaterial color="#7a6548" />
      </mesh>
      <mesh position={[0, 3.1, 0]}>
        <boxGeometry args={[10, 0.15, 10]} />
        <meshStandardMaterial color="#6e5a42" />
      </mesh>
      <ambientLight intensity={0.55} />
      <directionalLight
        castShadow
        position={[4, 8, 3]}
        intensity={1.1}
        shadow-mapSize={[1024, 1024]}
      />
    </group>
  )
}

export function Table() {
  return (
    <group position={[0, 0, 0]}>
      <mesh position={[0, 0.75, 0]} castShadow receiveShadow>
        <boxGeometry args={[3.2, 0.12, 2.2]} />
        <meshStandardMaterial color="#5c3d2e" />
      </mesh>
      {(
        [
          [-1.3, 0.375, -0.9],
          [1.3, 0.375, -0.9],
          [-1.3, 0.375, 0.9],
          [1.3, 0.375, 0.9],
        ] as const
      ).map((pos, i) => (
        <mesh key={i} position={pos} castShadow>
          <cylinderGeometry args={[0.08, 0.1, 0.75, 8]} />
          <meshStandardMaterial color="#3d2817" />
        </mesh>
      ))}
    </group>
  )
}

const keys = new Set<string>()

if (typeof window !== 'undefined') {
  window.addEventListener('keydown', (e) => keys.add(e.code))
  window.addEventListener('keyup', (e) => keys.delete(e.code))
}

export function Player() {
  const ref = useRef<Group>(null)
  const setPlayerPos = useGameStore((s) => s.setPlayerPos)
  const alive = useGameStore((s) => s.alive)

  useFrame((_, dt) => {
    if (!ref.current || !alive) return
    let x = 0
    let z = 0
    if (keys.has('KeyW') || keys.has('ArrowUp')) z -= 1
    if (keys.has('KeyS') || keys.has('ArrowDown')) z += 1
    if (keys.has('KeyA') || keys.has('ArrowLeft')) x -= 1
    if (keys.has('KeyD') || keys.has('ArrowRight')) x += 1
    if (x !== 0 || z !== 0) {
      const len = Math.hypot(x, z)
      x /= len
      z /= len
      const speed = 4.5
      ref.current.position.x += x * speed * dt
      ref.current.position.z += z * speed * dt
      ref.current.position.x = Math.max(-4, Math.min(4, ref.current.position.x))
      ref.current.position.z = Math.max(-4, Math.min(4, ref.current.position.z))
      const yaw = Math.atan2(x, z)
      ref.current.rotation.y = yaw
    }
    setPlayerPos([
      ref.current.position.x,
      ref.current.position.y,
      ref.current.position.z,
    ])
  })

  return (
    <group ref={ref} position={[0, 0, 2.4]}>
      <mesh position={[0, 0.55, 0]} castShadow>
        <capsuleGeometry args={[0.28, 0.55, 4, 8]} />
        <meshStandardMaterial color="#3a6ea5" />
      </mesh>
      <mesh position={[0, 1.25, 0]} castShadow>
        <sphereGeometry args={[0.28, 12, 12]} />
        <meshStandardMaterial color="#f0d5b8" />
      </mesh>
    </group>
  )
}
