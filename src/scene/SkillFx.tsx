import { useEffect, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import type { Group, Mesh } from 'three'
import { useGameStore, HIT_FX_MS } from '../game/store'
import { stdMat } from './materials'
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
  const levelUpAt = useGameStore((s) => s.levelUpAt)
  const ring = useRef<Mesh>(null)
  const levelRing = useRef<Mesh>(null)
  const hand = useRef<Group>(null)
  const cone = useRef<Mesh>(null)
  const projectile = useRef<Group>(null)

  // Burst spawn positions snap at hit-FX start; animation reads live data.
  const targets = hitFx
    ? useGameStore.getState().npcs.filter((n) => hitFx.npcIds.includes(n.id))
    : []

  useFrame(() => {
    if (hitFx) {
      const life = 1 - (hitFx.until - performance.now()) / HIT_FX_MS[hitFx.skillId]
      const t = Math.max(0, Math.min(1, life))
      // Live NPC positions — hit FX tracks movement instead of a frozen snapshot.
      const liveTargets = hitFx
        ? useGameStore
            .getState()
            .npcs.filter((n) => hitFx.npcIds.includes(n.id))
        : []

      if (
        (hitFx.skillId === 'megaphone' || hitFx.skillId === 'civility') &&
        ring.current
      ) {
        ring.current.visible = true
        ring.current.position.set(
          hitFx.playerPos[0],
          hitFx.playerPos[1] + 1.0,
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
          hitFx.playerPos[1] + 1.0,
          hitFx.playerPos[2],
        )
        const s = 0.5 + t * 4
        cone.current.scale.set(s, s, s)
        ;(cone.current.material as { opacity: number }).opacity = 0.6 * (1 - t)
      } else if (cone.current) {
        cone.current.visible = false
      }

      if (hitFx.skillId === 'slap' && hand.current && liveTargets[0]) {
        hand.current.visible = true
        const p = liveTargets[0].position
        hand.current.position.set(p[0], p[1] + 1.35 + t * 0.2, p[2])
        hand.current.rotation.z = -0.6 + t * 1.4
        hand.current.scale.setScalar(1.2 - t * 0.4)
      } else if (hand.current) {
        hand.current.visible = false
      }

      // Gag projectile: flies from player to target in an arc
      if (hitFx.skillId === 'gag' && projectile.current && liveTargets[0]) {
        projectile.current.visible = true
        const dur = HIT_FX_MS.gag
        const progress = Math.max(0, Math.min(1, 1 - (hitFx.until - performance.now()) / dur))
        const tgt = liveTargets[0].position
        const px = hitFx.playerPos[0] + (tgt[0] - hitFx.playerPos[0]) * progress
        const pz = hitFx.playerPos[2] + (tgt[2] - hitFx.playerPos[2]) * progress
        const py =
          hitFx.playerPos[1] +
          (tgt[1] - hitFx.playerPos[1]) * progress +
          Math.sin(progress * Math.PI) * 0.8
        projectile.current.position.set(px, py, pz)
        projectile.current.scale.setScalar(0.7 + progress * 0.5)
      } else if (projectile.current) {
        projectile.current.visible = false
      }
    } else {
      if (ring.current) ring.current.visible = false
      if (hand.current) hand.current.visible = false
      if (cone.current) cone.current.visible = false
      if (projectile.current) projectile.current.visible = false
    }

    // Level-up golden ring
    if (levelRing.current) {
      if (levelUpAt > 0) {
        const elapsed = performance.now() - levelUpAt
        if (elapsed < 1500 && elapsed >= 0) {
          const playerPos = useGameStore.getState().playerPos
          levelRing.current.visible = true
          levelRing.current.position.set(playerPos[0], playerPos[1] + 1.0, playerPos[2])
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

          <group ref={projectile} visible={false}>
            <mesh>
              <capsuleGeometry args={[0.08, 0.16, 4, 8]} />
              <meshBasicMaterial color="#9b6bff" />
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
    const t = 1 - (until - performance.now()) / HIT_FX_MS[skillId]
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

function PlungerItem({ id }: { id: string }) {
  const ref = useRef<Group>(null)
  useFrame(() => {
    const npc = useGameStore.getState().npcs.find((n) => n.id === id)
    if (ref.current && npc) {
      ref.current.position.set(npc.position[0], npc.position[1], npc.position[2])
    }
  })
  return (
    <group ref={ref}>
      {/* Plunger handle */}
      <mesh position={[0, 2.1, 0]} material={stdMat('#8b6914')}>
        <cylinderGeometry args={[0.04, 0.04, 0.6, 8]} />
      </mesh>
      {/* Plunger cup (rubber) */}
      <mesh position={[0, 1.75, 0]}>
        <cylinderGeometry args={[0.18, 0.12, 0.15, 12]} />
        <meshStandardMaterial color="#c44" />
      </mesh>
    </group>
  )
}

function Plungers() {
  const plungerUntil = useGameStore((s) => s.plungerUntil)
  const ids = useGameStore((s) => s.npcs.map((n) => n.id).join(','))
  const [, force] = useState(0)

  // Re-render once when the plunger window ends (state itself never changes).
  useEffect(() => {
    if (plungerUntil <= 0) return
    const id = window.setTimeout(
      () => force((x) => x + 1),
      Math.max(0, plungerUntil - performance.now()) + 50,
    )
    return () => window.clearTimeout(id)
  }, [plungerUntil])

  const now = performance.now()
  if (plungerUntil <= 0 || now > plungerUntil) return null
  const idList = ids.length ? ids.split(',') : []
  return (
    <group>
      {idList.map((id) => (
        <PlungerItem key={id} id={id} />
      ))}
    </group>
  )
}
