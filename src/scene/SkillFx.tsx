import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import type { Group, Mesh } from 'three'
import { useGameStore } from '../game/store'
import type { SkillId } from '../game/types'

const FX_COLOR: Record<SkillId, string> = {
  slap: '#ffdd66',
  tape: '#c8c8c8',
  megaphone: '#ff6644',
  gag: '#9b6bff',
}

/** World-space burst that differs per skill. */
export function SkillFx() {
  const hitFx = useGameStore((s) => s.hitFx)
  const npcs = useGameStore((s) => s.npcs)
  const ring = useRef<Mesh>(null)
  const hand = useRef<Group>(null)

  const targets = useMemo(() => {
    if (!hitFx) return []
    return npcs.filter((n) => hitFx.npcIds.includes(n.id))
  }, [hitFx, npcs])

  useFrame(() => {
    if (!hitFx) {
      if (ring.current) ring.current.visible = false
      if (hand.current) hand.current.visible = false
      return
    }
    const life = 1 - (hitFx.until - performance.now()) / 700
    const t = Math.max(0, Math.min(1, life))

    if (hitFx.skillId === 'megaphone' && ring.current) {
      ring.current.visible = true
      ring.current.position.set(
        hitFx.playerPos[0],
        1.0,
        hitFx.playerPos[2],
      )
      const s = 0.4 + t * 5
      ring.current.scale.set(s, s, s)
      ;(ring.current.material as { opacity: number }).opacity = 0.55 * (1 - t)
    } else if (ring.current) {
      ring.current.visible = false
    }

    if (hitFx.skillId === 'slap' && hand.current && targets[0]) {
      hand.current.visible = true
      const p = targets[0].position
      hand.current.position.set(p[0], 1.35 + t * 0.2, p[2])
      hand.current.rotation.z = -0.6 + t * 1.4
      hand.current.scale.setScalar(1.2 - t * 0.4)
    } else if (hand.current) {
      hand.current.visible = false
    }
  })

  if (!hitFx) return null

  return (
    <group>
      <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]} visible={false}>
        <ringGeometry args={[0.85, 1.05, 32]} />
        <meshBasicMaterial
          color={FX_COLOR.megaphone}
          transparent
          opacity={0.5}
          depthWrite={false}
        />
      </mesh>

      <group ref={hand} visible={false}>
        <mesh>
          <boxGeometry args={[0.35, 0.12, 0.45]} />
          <meshBasicMaterial color={FX_COLOR.slap} />
        </mesh>
      </group>

      {targets.map((npc) => (
        <Burst
          key={`${hitFx.id}-${npc.id}`}
          position={npc.position}
          skillId={hitFx.skillId}
          until={hitFx.until}
        />
      ))}
    </group>
  )
}

function Burst({
  position,
  skillId,
  until,
}: {
  position: [number, number, number]
  skillId: SkillId
  until: number
}) {
  const ref = useRef<Group>(null)
  useFrame(() => {
    if (!ref.current) return
    const t = 1 - (until - performance.now()) / 500
    const k = Math.max(0, Math.min(1, t))
    ref.current.position.y = 1.2 + k * 0.5
    ref.current.scale.setScalar(0.7 + k * 0.8)
  })

  return (
    <group ref={ref} position={[position[0], 1.2, position[2]]}>
      <mesh>
        <sphereGeometry args={[0.12, 8, 8]} />
        <meshBasicMaterial
          color={FX_COLOR[skillId]}
          transparent
          opacity={0.85}
        />
      </mesh>
      {skillId === 'tape' && (
        <mesh position={[0, 0, 0.2]} rotation={[0.3, 0, 0.2]}>
          <boxGeometry args={[0.35, 0.06, 0.04]} />
          <meshBasicMaterial color="#dddddd" />
        </mesh>
      )}
      {skillId === 'gag' && (
        <mesh position={[0, -0.05, 0.15]}>
          <capsuleGeometry args={[0.06, 0.14, 4, 6]} />
          <meshBasicMaterial color="#9b6bff" />
        </mesh>
      )}
    </group>
  )
}
