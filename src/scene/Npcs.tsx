import { memo, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useShallow } from 'zustand/react/shallow'
import { Billboard, Text } from '@react-three/drei'
import { Select } from '@react-three/postprocessing'
import type { Group, Mesh } from 'three'
import { useGameStore } from '../game/store'
import { t } from '../game/i18n'
import { CONFIG } from '../game/config'
import { smackDamageDelayFor } from '../game/threat'
import type { NpcArchetype, NpcState, SkillId } from '../game/types'

const COLORS = ['#e07070', '#70a070', '#7070c0', '#c08050', '#80a0c0']
const CHASER_COLOR = '#e04030'
const HEAD_Y = 1.28
/** Distance LOD: hide fine face parts beyond this (camera-to-NPC meters). */
const FACE_DETAIL_DIST = 13
/** Hide hats / belly / belt beyond this — far silhouettes stay cheap. */
const HAT_DETAIL_DIST = 20
const HIT_COLOR: Record<SkillId, string> = {
  slap: '#ffdd66',
  tape: '#e8e8e8',
  megaphone: '#ff6644',
  gag: '#9b6bff',
  poop: '#8b5e3c',
  civility: '#44ccff',
}

/** Silhouette headwear + stout belly — geometry only, sits in the head group. */
function DinerSilhouette({
  archetype,
  color,
}: {
  archetype: NpcArchetype
  color: string
}) {
  switch (archetype) {
    case 'tophat':
      return (
        <group>
          <mesh position={[0, 0.42, 0]} castShadow>
            <cylinderGeometry args={[0.2, 0.22, 0.03, 16]} />
            <meshStandardMaterial color="#1a1a1a" />
          </mesh>
          <mesh position={[0, 0.535, 0]} castShadow>
            <cylinderGeometry args={[0.11, 0.115, 0.22, 14]} />
            <meshStandardMaterial color="#1a1a1a" />
          </mesh>
        </group>
      )
    case 'bowler':
      return (
        <group>
          <mesh position={[0, 0.42, 0]} castShadow>
            <cylinderGeometry args={[0.2, 0.22, 0.03, 16]} />
            <meshStandardMaterial color="#4a3322" />
          </mesh>
          <mesh position={[0, 0.45, 0]} castShadow>
            <sphereGeometry args={[0.15, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <meshStandardMaterial color="#4a3322" />
          </mesh>
        </group>
      )
    case 'chef':
      return (
        <group>
          <mesh position={[0, 0.45, 0]} castShadow>
            <cylinderGeometry args={[0.13, 0.15, 0.1, 14]} />
            <meshStandardMaterial color="#f5f5f0" />
          </mesh>
          <mesh position={[0, 0.55, 0]} castShadow>
            <cylinderGeometry args={[0.1, 0.12, 0.1, 14]} />
            <meshStandardMaterial color="#f5f5f0" />
          </mesh>
        </group>
      )
    case 'cap':
      return (
        <group>
          <mesh position={[0, 0.43, 0]} castShadow>
            <sphereGeometry args={[0.15, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <meshStandardMaterial color={color} />
          </mesh>
          <mesh position={[0, 0.43, 0.17]} castShadow>
            <boxGeometry args={[0.2, 0.02, 0.14]} />
            <meshStandardMaterial color={color} />
          </mesh>
        </group>
      )
    case 'bun':
      return (
        <mesh position={[0, 0.18, -0.2]} castShadow>
          <sphereGeometry args={[0.08, 10, 10]} />
          <meshStandardMaterial color="#2a2118" />
        </mesh>
      )
    default:
      return null
  }
}

/** Snapshot selectors used only for JSX that must be correct at render time. */
function renderKeyFor(state: {
  npcs: NpcState[]
  targetId: string | null
}, id: string): string {
  const n = state.npcs.find((x) => x.id === id)
  if (!n) return ''
  return [
    n.role,
    n.status,
    n.sealProp ?? 'none',
    state.targetId === id,
    Math.round(n.mouthHp),
    n.raging,
    n.exiting,
  ].join('|')
}

function NpcMeshImpl({
  id,
  hit,
  hitSkill,
}: {
  id: string
  hit: boolean
  hitSkill: SkillId | null
}) {
  const { camera } = useThree()
  const root = useRef<Group>(null)
  const head = useRef<Group>(null)
  const jaw = useRef<Group>(null)
  const faceDetail = useRef<Group>(null)
  const hatDetail = useRef<Group>(null)
  const bodyDetail = useRef<Group>(null)
  const upperLip = useRef<Mesh>(null)
  const lowerLip = useRef<Mesh>(null)
  const tongue = useRef<Mesh>(null)
  const foodBit = useRef<Mesh>(null)
  const cheekL = useRef<Mesh>(null)
  const cheekR = useRef<Mesh>(null)
  const flash = useRef<Mesh>(null)
  const wave = useRef<Group>(null)
  const windup = useRef<Group>(null)
  const windupFill = useRef<Mesh>(null)
  const pulseRing = useRef<Group>(null)

  // Static per-NPC config captured at render; per-frame data read live below.
  const npc = useGameStore.getState().npcs.find((n) => n.id === id)!
  // Re-render only when display-relevant state changes, never per-frame.
  useGameStore((s) => renderKeyFor(s, id))

  const isChaser = npc.role === 'chaser'
  const variance = isChaser ? 1 : 0.94 + (npc.seatIndex % 5) * 0.035
  const bodyColor = isChaser ? CHASER_COLOR : COLORS[npc.seatIndex % COLORS.length]
  const buildScale = npc.build === 'slim' ? 0.85 : npc.build === 'stout' ? 1.15 : 1
  const torsoWidth =
    (isChaser ? 0.28 : 0.24 + (npc.seatIndex % 3) * 0.02) * buildScale
  const phase = useMemo(
    () => (isChaser ? npc.id.length * 1.3 : npc.seatIndex * 1.7),
    [npc.id, npc.seatIndex, isChaser],
  )
  useGameStore((s) => s.lang) // re-render on language change

  useFrame(({ clock }) => {
    const live = useGameStore.getState().npcs.find((n) => n.id === id)
    if (!live) return
    const t = clock.elapsedTime + phase
    const smacking = live.status === 'smacking'
    const now = performance.now()

    // Distance LOD: fine face/hat detail only pays off nearby.
    if (faceDetail.current) {
      const dist = Math.hypot(
        camera.position.x - live.position[0],
        camera.position.y - live.position[1],
        camera.position.z - live.position[2],
      )
      faceDetail.current.visible = dist < FACE_DETAIL_DIST
      if (hatDetail.current) hatDetail.current.visible = dist < HAT_DETAIL_DIST
      if (bodyDetail.current) bodyDetail.current.visible = dist < HAT_DETAIL_DIST
    }

    if (root.current) {
      root.current.position.set(live.position[0], live.position[1], live.position[2])
      root.current.rotation.y = live.facing
      if (isChaser && live.status === 'walking') {
        root.current.position.y = live.position[1] + Math.abs(Math.sin(t * 14)) * 0.09
        root.current.rotation.x = Math.sin(t * 7) * 0.04
      } else {
        root.current.rotation.x *= 0.9
      }
    }

    if (flash.current) {
      flash.current.visible = hit
      if (hit) {
        const pulse = 0.35 + Math.abs(Math.sin(clock.elapsedTime * 40)) * 0.4
        const mat = flash.current.material as unknown as {
          opacity: number
          color: { set: (c: string) => void }
        }
        mat.opacity = pulse
        if (hitSkill) mat.color.set(HIT_COLOR[hitSkill])
        flash.current.scale.setScalar(1.2 + pulse * 0.35)
      }
    }

    if (head.current) {
      let wobble = 0
      if (now < live.wobbleUntil) {
        wobble = Math.sin(t * 40) * 0.35
      }
      if (smacking) {
        head.current.rotation.z = Math.sin(t * 9) * 0.12 + wobble
        head.current.rotation.x = Math.sin(t * 7) * 0.1
        head.current.position.y = HEAD_Y + Math.abs(Math.sin(t * 11)) * 0.05
      } else {
        head.current.rotation.z = wobble
        head.current.rotation.x *= 0.85
        head.current.position.y = HEAD_Y
      }
    }

    // Exaggerated half-face chew
    if (jaw.current && upperLip.current && lowerLip.current) {
      if (smacking) {
        const chew = (Math.sin(t * 10) + 1) * 0.5
        const grind = Math.sin(t * 16) * 0.18
        // Jaw opens nearly half the face
        jaw.current.rotation.x = 0.25 + chew * 1.05
        jaw.current.rotation.y = grind
        jaw.current.position.set(0, -0.08 - chew * 0.08, 0.06)
        upperLip.current.position.y = 0.02 + chew * 0.04
        lowerLip.current.position.y = -0.1 - chew * 0.16
        lowerLip.current.scale.set(1 + chew * 0.15, 1, 1)
      } else if (live.status === 'sealed' || live.status === 'silenced') {
        jaw.current.rotation.x = 0.05
        jaw.current.rotation.y = 0
        jaw.current.position.set(0, -0.06, 0.05)
        upperLip.current.position.y = 0.02
        lowerLip.current.position.y = -0.08
      } else {
        const nibble = Math.sin(t * 2) * 0.04
        jaw.current.rotation.x = 0.12 + nibble
        jaw.current.rotation.y = 0
        jaw.current.position.set(0, -0.06, 0.05)
        upperLip.current.position.y = 0.02
        lowerLip.current.position.y = -0.09
      }
    }

    if (tongue.current) {
      tongue.current.visible = smacking
      if (smacking) {
        tongue.current.position.set(
          Math.sin(t * 13) * 0.07,
          -0.12,
          0.1 + Math.abs(Math.sin(t * 10)) * 0.08,
        )
        tongue.current.scale.setScalar(1 + Math.abs(Math.sin(t * 8)) * 0.45)
      }
    }

    if (foodBit.current) {
      foodBit.current.visible = smacking
      if (smacking) {
        foodBit.current.position.set(
          Math.sin(t * 12) * 0.05,
          -0.06 + Math.sin(t * 10) * 0.03,
          0.12 + Math.abs(Math.cos(t * 10)) * 0.06,
        )
        foodBit.current.rotation.z = t * 5
      }
    }

    const cheekScale = smacking ? 1.15 + Math.abs(Math.sin(t * 10)) * 0.55 : 1
    if (cheekL.current) cheekL.current.scale.set(cheekScale, cheekScale, 1)
    if (cheekR.current) cheekR.current.scale.set(cheekScale, cheekScale, 1)

    if (wave.current) {
      wave.current.visible = smacking
      if (smacking) wave.current.scale.setScalar(1 + Math.abs(Math.sin(t * 7)) * 0.3)
    }

    // Threat windup bar: fills while a smacker builds toward the damage window.
    if (windup.current && windupFill.current) {
      let show = false
      let fill = 0
      if (smacking) {
        const elapsedSec = useGameStore.getState().elapsedSec
        const delayMs = smackDamageDelayFor(elapsedSec) * 1000
        const p = (now - live.smackingSince) / delayMs
        if (p > 0 && p < 1) {
          show = true
          fill = p
        }
      }
      windup.current.visible = show
      if (show) {
        windupFill.current.scale.x = fill
        windupFill.current.position.x = -0.25 + fill * 0.25
        const mat = windupFill.current.material as unknown as {
          color: { setHSL: (h: number, s: number, l: number) => void }
        }
        mat.color.setHSL(0.08 - fill * 0.08, 1, 0.5)
      }
    }

    // Boss rage-pulse charge ring: grows while the burst charges.
    if (pulseRing.current) {
      const charging = live.role === 'boss' && live.pulseChargeUntil > now
      pulseRing.current.visible = charging
      if (charging) {
        const p = 1 - (live.pulseChargeUntil - now) / CONFIG.boss.pulseChargeMs
        pulseRing.current.scale.setScalar(0.4 + p * 1.5)
        const mat = pulseRing.current.children[0] as unknown as {
          material?: { opacity: number }
        }
        const ring = mat?.material
        if (ring) ring.opacity = 0.5 + p * 0.5
      }
    }
  })

  const faceLocked = npc.status === 'sealed' || npc.status === 'silenced'
  const quietLabel =
    isChaser && npc.status === 'walking'
      ? t('npc_chaser')
      : npc.sealProp === 'tape'
      ? t('npc_sealedTape')
      : npc.sealProp === 'gag'
        ? t('npc_sealedGag')
        : faceLocked
          ? t('npc_silenced')
          : npc.status === 'walking'
            ? t('npc_walking')
            : null

  return (
    <Select enabled={npc.id === useGameStore.getState().targetId}>
    <group ref={root} position={npc.position} rotation={[0, npc.facing, 0]} scale={npc.scale * variance}>
      <mesh position={[0, isChaser ? 0.48 : 0.42, 0]} castShadow>
        <capsuleGeometry args={[torsoWidth, isChaser ? 0.42 : 0.35, 4, 8]} />
        <meshStandardMaterial color={bodyColor} />
      </mesh>
      <group ref={bodyDetail}>
        {npc.build === 'stout' && (
          <mesh position={[0, 0.26, 0.2]} castShadow>
            <sphereGeometry args={[0.13, 12, 12]} />
            <meshStandardMaterial color={bodyColor} />
          </mesh>
        )}
        {isChaser && (
          <mesh position={[0, 0.15, -0.12]} rotation={[0.25, 0, 0]}>
            <boxGeometry args={[0.32, 0.08, 0.14]} />
            <meshStandardMaterial color="#c03020" />
          </mesh>
        )}
      </group>

      <group ref={head} position={[0, HEAD_Y, 0]}>
        {/* Cranium — lower half cut by mouth plane visually */}
        <mesh castShadow position={[0, 0.06, 0]}>
          <sphereGeometry args={[0.34, 18, 18]} />
          <meshStandardMaterial color="#f2d2b0" />
        </mesh>

        <group ref={faceDetail}>
        <mesh position={[-0.12, 0.1, 0.28]}>
          <sphereGeometry args={[0.055, 8, 8]} />
          <meshStandardMaterial color="#1a1a1a" />
        </mesh>
        <mesh position={[0.12, 0.1, 0.28]}>
          <sphereGeometry args={[0.055, 8, 8]} />
          <meshStandardMaterial color="#1a1a1a" />
        </mesh>

        <mesh ref={cheekL} position={[-0.28, -0.02, 0.1]}>
          <sphereGeometry args={[0.11, 8, 8]} />
          <meshStandardMaterial color="#e8b89a" />
        </mesh>
        <mesh ref={cheekR} position={[0.28, -0.02, 0.1]}>
          <sphereGeometry args={[0.11, 8, 8]} />
          <meshStandardMaterial color="#e8b89a" />
        </mesh>

        {/* Deep oral cavity — half-face scale */}
        <mesh position={[0, -0.08, 0.22]} rotation={[0.25, 0, 0]}>
          <boxGeometry args={[0.32, 0.28, 0.16]} />
          <meshStandardMaterial color="#3a0808" />
        </mesh>
        <mesh position={[0, -0.02, 0.18]}>
          <boxGeometry args={[0.28, 0.04, 0.06]} />
          <meshStandardMaterial color="#f5efe4" />
        </mesh>

        <mesh ref={tongue} position={[0, -0.12, 0.1]} visible={false}>
          <boxGeometry args={[0.12, 0.05, 0.16]} />
          <meshStandardMaterial color="#c45a6a" />
        </mesh>
        <mesh ref={foodBit} position={[0, -0.05, 0.12]} visible={false}>
          <sphereGeometry args={[0.06, 8, 8]} />
          <meshStandardMaterial color="#d4a017" />
        </mesh>

        {/* Upper lip */}
        <mesh ref={upperLip} position={[0, 0.02, 0.34]}>
          <boxGeometry args={[0.3, 0.06, 0.07]} />
          <meshStandardMaterial color="#c46a6a" />
        </mesh>

        {/* Jaw + lower lip */}
        <group ref={jaw} position={[0, -0.06, 0.05]}>
          <mesh position={[0, -0.14, 0.14]} castShadow>
            <boxGeometry args={[0.3, 0.16, 0.22]} />
            <meshStandardMaterial color="#e6c4a4" />
          </mesh>
          <mesh ref={lowerLip} position={[0, -0.08, 0.28]}>
            <boxGeometry args={[0.28, 0.07, 0.07]} />
            <meshStandardMaterial color="#b85a5a" />
          </mesh>
          <mesh position={[0, -0.05, 0.22]}>
            <boxGeometry args={[0.24, 0.04, 0.04]} />
            <meshStandardMaterial color={faceLocked ? '#888' : '#f7f2e8'} />
          </mesh>

          {npc.sealProp === 'tape' && (
            <mesh position={[0, -0.02, 0.32]} rotation={[0.1, 0, 0]}>
              <boxGeometry args={[0.36, 0.1, 0.05]} />
              <meshStandardMaterial color="#d0d0d0" metalness={0.35} roughness={0.45} />
            </mesh>
          )}
          {npc.sealProp === 'gag' && (
            <mesh position={[0, -0.06, 0.36]} rotation={[0.5, 0, 0]}>
              <capsuleGeometry args={[0.07, 0.16, 4, 6]} />
              <meshStandardMaterial color="#7a4fd1" />
            </mesh>
          )}
        </group>
        </group>

        <group ref={hatDetail}>
          <DinerSilhouette archetype={npc.archetype} color={bodyColor} />
        </group>
      </group>

      {npc.id === useGameStore.getState().targetId && (
        <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.45, 0.55, 24]} />
          <meshBasicMaterial color="#ffdd66" transparent opacity={0.85} />
        </mesh>
      )}

      <mesh ref={flash} position={[0, 1.1, 0]} visible={false}>
        <sphereGeometry args={[0.65, 12, 12]} />
        <meshBasicMaterial color="#fff" transparent opacity={0.4} depthWrite={false} />
      </mesh>

      {/* Threat windup indicator — fills while smack damage is charging */}
      <group ref={windup} position={[0, 1.95, 0]} visible={false}>
        <Billboard>
          <mesh position={[0, 0, 0.01]}>
            <planeGeometry args={[0.55, 0.07]} />
            <meshBasicMaterial color="#200000" transparent opacity={0.55} />
          </mesh>
          <mesh ref={windupFill} position={[-0.25, 0, 0.02]}>
            <planeGeometry args={[0.5, 0.035]} />
            <meshBasicMaterial color="#ff6644" />
          </mesh>
        </Billboard>
      </group>

      <group ref={wave} position={[0, 1.85, 0]} visible={false}>
        <Billboard>
          <Text
            fontSize={0.22}
            color="#ff3333"
            anchorX="center"
            anchorY="middle"
            outlineWidth={0.012}
            outlineColor="#400000"
          >
             {t('npc_smacking')}
          </Text>
        </Billboard>
      </group>

      {/* Boss rage-pulse charge ring */}
      <group ref={pulseRing} position={[0, 1.7, 0]} visible={false}>
        <Billboard>
          <mesh>
            <ringGeometry args={[0.3, 0.42, 20]} />
            <meshBasicMaterial color="#ffd24a" transparent opacity={0.9} depthWrite={false} />
          </mesh>
        </Billboard>
      </group>

      {quietLabel && (
        <Billboard position={[0, 1.85, 0]}>
          <Text fontSize={0.2} color="#88cc88" anchorX="center" anchorY="middle">
            {quietLabel}
          </Text>
        </Billboard>
      )}

      {isChaser && npc.status === 'walking' && (
        <Billboard position={[0, 2.05, 0]}>
          <mesh>
            <ringGeometry args={[0.22, 0.3, 16]} />
            <meshBasicMaterial color="#ff5533" transparent opacity={0.9} />
          </mesh>
        </Billboard>
      )}

      {npc.role === 'boss' && npc.bossModules.a && (
        <Billboard position={[0, 2.2, 0]}>
          <mesh position={[0, 0, 0]}>
            <planeGeometry args={[1.2, 0.12]} />
            <meshBasicMaterial color="#222" />
          </mesh>
          <mesh position={[-(1.2 - 1.2 * (npc.mouthHp / Math.max(1, npc.mouthHpMax))) / 2, 0, 0.01]}>
            <planeGeometry args={[1.2 * (npc.mouthHp / Math.max(1, npc.mouthHpMax)), 0.1]} />
            <meshBasicMaterial color={npc.raging ? '#cc4444' : '#d4a017'} />
          </mesh>
        </Billboard>
      )}
    </group>
    </Select>
  )
}

/** Never re-render from parent — this component reads its own live state. */
const NpcMesh = memo(NpcMeshImpl)

export function Npcs() {
  // useShallow: the id list only changes on spawn/despawn, so the parent
  // does not re-render every tick (npcs array is rebuilt each tick).
  const ids = useGameStore(
    useShallow((s) => s.npcs.map((n) => n.id)),
  )
  const hitFx = useGameStore((s) => s.hitFx)
  const hitSet = useMemo(() => new Set(hitFx?.npcIds ?? []), [hitFx])

  return (
    <group>
      {ids.map((id) => (
        <NpcMesh
          key={id}
          id={id}
          hit={hitSet.has(id)}
          hitSkill={hitSet.has(id) ? (hitFx?.skillId ?? null) : null}
        />
      ))}
    </group>
  )
}
