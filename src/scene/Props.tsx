import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Billboard, Text } from '@react-three/drei'
import type { Group } from 'three'
import { useGameStore } from '../game/store'
import { t } from '../game/i18n'
import type { PropState } from '../game/types'

function HealProp() {
  return (
    <group>
      {/* Red capsule body */}
      <mesh castShadow>
        <capsuleGeometry args={[0.12, 0.2, 4, 8]} />
        <meshStandardMaterial color="#d44" />
      </mesh>
      {/* Green cross — vertical bar */}
      <mesh position={[0, 0.22, 0]}>
        <boxGeometry args={[0.06, 0.16, 0.06]} />
        <meshStandardMaterial color="#5ecf7a" emissive="#2a6a3a" emissiveIntensity={0.3} />
      </mesh>
      {/* Green cross — horizontal bar */}
      <mesh position={[0, 0.22, 0]}>
        <boxGeometry args={[0.16, 0.06, 0.06]} />
        <meshStandardMaterial color="#5ecf7a" emissive="#2a6a3a" emissiveIntensity={0.3} />
      </mesh>
      {/* Glow ring */}
      <Billboard position={[0, -0.3, 0]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.3, 0.4, 24]} />
          <meshBasicMaterial color="#5ecf7a" transparent opacity={0.35} />
        </mesh>
      </Billboard>
    </group>
  )
}

function SilenceProp() {
  const lang = useGameStore((s) => s.lang)
  return (
    <group>
      {/* Bell body — sphere bottom */}
      <mesh castShadow position={[0, -0.05, 0]}>
        <sphereGeometry args={[0.13, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#ffd700" metalness={0.4} roughness={0.3} />
      </mesh>
      {/* Bell top — cone */}
      <mesh position={[0, 0.08, 0]}>
        <coneGeometry args={[0.1, 0.1, 8]} />
        <meshStandardMaterial color="#e6c200" metalness={0.4} roughness={0.3} />
      </mesh>
      {/* "静" text above */}
      <Text position={[0, 0.35, 0]} fontSize={0.18} color="#6ec0ff" anchorX="center" anchorY="middle">
         {t('silenceChar')}
      </Text>
      {/* Glow ring */}
      <Billboard position={[0, -0.3, 0]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.3, 0.4, 24]} />
          <meshBasicMaterial color="#6ec0ff" transparent opacity={0.35} />
        </mesh>
      </Billboard>
    </group>
  )
}

function PropItem({ prop }: { prop: PropState }) {
  const ref = useRef<Group>(null)

  useFrame((_, dt) => {
    if (!ref.current) return
    const now = performance.now()
    // Floating animation
    ref.current.position.y = prop.position[1] + Math.sin(now * 0.002) * 0.1
    // Slow rotation
    ref.current.rotation.y += dt * 0.8

    // Fade-out animation
    if (prop.fadingSince !== null) {
      const elapsed = now - prop.fadingSince
      const fadeProgress = Math.min(1, elapsed / 300)
      const scale = 1 - fadeProgress
      ref.current.scale.setScalar(scale)
    } else {
      ref.current.scale.setScalar(1)
    }
  })

  return (
    <group ref={ref} position={prop.position}>
      {prop.type === 'heal' && <HealProp />}
      {prop.type === 'silence' && <SilenceProp />}
    </group>
  )
}

export function Props() {
  const props = useGameStore((s) => s.props)
  return (
    <group>
      {props.map((p) => (
        <PropItem key={p.id} prop={p} />
      ))}
    </group>
  )
}
