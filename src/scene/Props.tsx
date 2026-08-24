import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Billboard, Text } from '@react-three/drei'
import type { Group } from 'three'
import { useGameStore } from '../game/store'
import { stdMat } from './materials'
import { boxGeo, capsuleGeo, coneGeo, sphereGeo } from './geometries'
import { t } from '../game/i18n'
import type { PropState } from '../game/types'

function HealProp() {
  return (
    <group>
      {/* Red capsule body */}
      <mesh castShadow material={stdMat('#d44')} geometry={capsuleGeo(0.12, 0.2, 4, 8)} />
      {/* Green cross — vertical bar */}
      <mesh
        position={[0, 0.22, 0]}
        material={stdMat('#5ecf7a', { emissive: '#2a6a3a', emissiveIntensity: 0.3 })}
        geometry={boxGeo(0.06, 0.16, 0.06)}
      />
      {/* Green cross — horizontal bar */}
      <mesh
        position={[0, 0.22, 0]}
        material={stdMat('#5ecf7a', { emissive: '#2a6a3a', emissiveIntensity: 0.3 })}
        geometry={boxGeo(0.16, 0.06, 0.06)}
      />
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
  useGameStore((s) => s.lang) // re-render on language change
  return (
    <group>
      {/* Bell body — sphere bottom */}
      <mesh
        castShadow
        position={[0, -0.05, 0]}
        material={stdMat('#ffd700', { metalness: 0.4, roughness: 0.3 })}
        geometry={sphereGeo(0.13, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2)}
      />
      {/* Bell top — cone */}
      <mesh
        position={[0, 0.08, 0]}
        material={stdMat('#e6c200', { metalness: 0.4, roughness: 0.3 })}
        geometry={coneGeo(0.1, 0.1, 8)}
      />
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
