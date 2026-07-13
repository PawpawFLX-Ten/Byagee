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
  poop: '#6b4a2b',
  civility: '#ffd700',
}

/** World-space burst that differs per skill. */
export function SkillFx() {
  const hitFx = useGameStore((s) => s.hitFx)
  const npcs = useGameStore((s) => s.npcs)
  const levelUpAt = useGameStore((s) => s.levelUpAt)
  const playerPos = useGameStore((s) => s.playerPos)
  const ring = useRef<Mesh>(null)
  const levelRing = useRef<Mesh>(null)
  const hand = useRef<Group>(null)
  const cone = useRef<Mesh>(null)

  const targets = useMemo(() => {
    if (!hitFx) return []
    return npcs.filter((n) => hitFx.npcIds.includes(n.id))
  }, [hitFx, npcs])

  useFrame(() => {
    if (hitFx) {
      const life = 1 - (hitFx.until - performance.now()) / 700
      const t = Math.max(0, Math.min(1, life))

      if (
        (hitFx.skillId === 'megaphone' || hitFx.skillId === 'civility') &&
        ring.current
      ) {
        ring.current.visible = true
        ring.current.position.set(
          hitFx.playerPos[0],
          1.0,
          hitFx.playerPos[2],
        )
        const isCivility = hitFx.skillId === 'civility'
        const s = 0.4 + t * (isCivility ? 8 : 5)
        ring.current.scale.set(s, s, s)
        ;(ring.current.material as unknown as { opacity: number; color: { set: (c: string) => void } }).opacity =
          0.55 * (1 - t)
        ;(ring.current.material as unknown as { color: { set: (c: string) => void } }).color.set(
          isCivility ? '#ffd700' : '#ff6644',
        )
      } else if (ring.current) {
        ring.current.visible = false
      }

      if (hitFx.skillId === 'poop' && cone.current) {
        cone.current.visible = true
        cone.current.position.set(
          hitFx.playerPos[0],
          1.0,
          hitFx.playerPos[2],
        )
        const s = 0.5 + t * 4
        cone.current.scale.set(s, s, s)
        ;(cone.current.material as { opacity: number }).opacity = 0.6 * (1 - t)
      } else if (cone.current) {
        cone.current.visible = false
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
    } else {
      if (ring.current) ring.current.visible = false
      if (hand.current) hand.current.visible = false
      if (cone.current) cone.current.visible = false
    }

    // Level-up golden ring
    if (levelRing.current) {
      if (levelUpAt > 0) {
        const elapsed = performance.now() - levelUpAt
        if (elapsed < 1500 && elapsed >= 0) {
          levelRing.current.visible = true
          levelRing.current.position.set(playerPos[0], 1.0, playerPos[2])
          const t = elapsed / 1500
          const s = 0.5 + t * 6
          levelRing.current.scale.set(s, s, s)
          const mat = levelRing.current.material as unknown as { opacity: number; color: { set: (c: string) => void } }
          mat.opacity = 0.8 * (1 - t)
          mat.color.set('#ffd700')
        } else {
          levelRing.current.visible = false
        }
      } else if (levelRing.current.visible) {
        levelRing.current.visible = false
      }
    }
  })

  return (
    <group>
      <mesh ref={levelRing} rotation={[-Math.PI / 2, 0, 0]} visible={false}>
        <ringGeometry args={[0.6, 0.9, 32]} />
        <meshBasicMaterial color="#ffd700" transparent opacity={0.8} depthWrite={false} />
      </mesh>

      {hitFx && (
        <>
          <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]} visible={false}>
            <ringGeometry args={[0.85, 1.05, 32]} />
            <meshBasicMaterial
              color={FX_COLOR.megaphone}
              transparent
              opacity={0.5}
              depthWrite={false}
            />
          </mesh>

          <mesh ref={cone} rotation={[-Math.PI / 2, 0, 0]} visible={false}>
            <coneGeometry args={[1, 2, 16, 1, true]} />
            <meshBasicMaterial
              color={FX_COLOR.poop}
              transparent
              opacity={0.5}
              depthWrite={false}
              side={2}
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

          <Plungers />
        </>
      )}
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

function Plungers() {
  const npcs = useGameStore((s) => s.npcs)
  const plungerUntil = useGameStore((s) => s.plungerUntil)
  if (plungerUntil <= 0) return null
  const now = performance.now()
  if (now > plungerUntil) return null
  return (
    <group>
      {npcs.map((npc) => (
        <group key={npc.id} position={[npc.position[0], 0, npc.position[2]]}>
          {/* Plunger handle */}
          <mesh position={[0, 2.1, 0]}>
            <cylinderGeometry args={[0.04, 0.04, 0.6, 8]} />
            <meshStandardMaterial color="#8b6914" />
          </mesh>
          {/* Plunger cup (rubber) */}
          <mesh position={[0, 1.75, 0]}>
            <cylinderGeometry args={[0.18, 0.12, 0.15, 12]} />
            <meshStandardMaterial color="#c44" />
          </mesh>
        </group>
      ))}
    </group>
  )
}
