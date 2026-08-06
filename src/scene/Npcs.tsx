import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Billboard, Text } from '@react-three/drei'
import type { Group, Mesh } from 'three'
import { useGameStore } from '../game/store'
import { t } from '../game/i18n'
import type { NpcState, SkillId } from '../game/types'

const COLORS = ['#e07070', '#70a070', '#7070c0', '#c08050', '#80a0c0']
const CHASER_COLOR = '#e04030'
const HEAD_Y = 1.28
const HIT_COLOR: Record<SkillId, string> = {
  slap: '#ffdd66',
  tape: '#e8e8e8',
  megaphone: '#ff6644',
  gag: '#9b6bff',
  poop: '#8b5e3c',
  civility: '#44ccff',
}

function NpcMesh({
  npc,
  selected,
  hit,
  hitSkill,
}: {
  npc: NpcState
  selected: boolean
  hit: boolean
  hitSkill: SkillId | null
}) {
  const root = useRef<Group>(null)
  const head = useRef<Group>(null)
  const jaw = useRef<Group>(null)
  const upperLip = useRef<Mesh>(null)
  const lowerLip = useRef<Mesh>(null)
  const tongue = useRef<Mesh>(null)
  const foodBit = useRef<Mesh>(null)
  const cheekL = useRef<Mesh>(null)
  const cheekR = useRef<Mesh>(null)
  const flash = useRef<Mesh>(null)
  const wave = useRef<Group>(null)
  const isChaser = npc.role === 'chaser'
  const variance = isChaser ? 1 : 0.94 + (npc.seatIndex % 5) * 0.035
  const bodyColor = isChaser ? CHASER_COLOR : COLORS[npc.seatIndex % COLORS.length]
  const torsoWidth = isChaser ? 0.28 : 0.24 + (npc.seatIndex % 3) * 0.02
  const phase = useMemo(() => (isChaser ? npc.id.length * 1.3 : npc.seatIndex * 1.7), [npc.id, npc.seatIndex, isChaser])
  useGameStore((s) => s.lang) // re-render on language change

  useFrame(({ clock }) => {
    const t = clock.elapsedTime + phase
    const smacking = npc.status === 'smacking'
    const now = performance.now()

    if (root.current) {
      root.current.position.set(npc.position[0], 0, npc.position[2])
      root.current.rotation.y = npc.facing
      if (isChaser && npc.status === 'walking') {
        root.current.position.y = Math.abs(Math.sin(t * 14)) * 0.09
        root.current.rotation.x = Math.sin(t * 7) * 0.04
      } else {
        root.current.position.y = 0
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
      if (now < npc.wobbleUntil) {
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
      } else if (npc.status === 'sealed' || npc.status === 'silenced') {
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
    <group ref={root} position={npc.position} rotation={[0, npc.facing, 0]} scale={npc.scale * variance}>
      <mesh position={[0, isChaser ? 0.48 : 0.42, 0]} castShadow>
        <capsuleGeometry args={[torsoWidth, isChaser ? 0.42 : 0.35, 4, 8]} />
        <meshStandardMaterial color={bodyColor} />
      </mesh>
      {isChaser && (
        <mesh position={[0, 0.15, -0.12]} rotation={[0.25, 0, 0]}>
          <boxGeometry args={[0.32, 0.08, 0.14]} />
          <meshStandardMaterial color="#c03020" />
        </mesh>
      )}

      <group ref={head} position={[0, HEAD_Y, 0]}>
        {/* Cranium — lower half cut by mouth plane visually */}
        <mesh castShadow position={[0, 0.06, 0]}>
          <sphereGeometry args={[0.34, 18, 18]} />
          <meshStandardMaterial color="#f2d2b0" />
        </mesh>

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

      {selected && (
        <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.45, 0.55, 24]} />
          <meshBasicMaterial color="#ffdd66" transparent opacity={0.85} />
        </mesh>
      )}

      <mesh ref={flash} position={[0, 1.1, 0]} visible={false}>
        <sphereGeometry args={[0.65, 12, 12]} />
        <meshBasicMaterial color="#fff" transparent opacity={0.4} depthWrite={false} />
      </mesh>

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
  )
}

export function Npcs() {
  const npcs = useGameStore((s) => s.npcs)
  const targetId = useGameStore((s) => s.targetId)
  const hitFx = useGameStore((s) => s.hitFx)
  const hitSet = useMemo(() => new Set(hitFx?.npcIds ?? []), [hitFx])

  return (
    <group>
      {npcs.map((npc) => (
        <NpcMesh
          key={npc.id}
          npc={npc}
          selected={npc.id === targetId}
          hit={hitSet.has(npc.id)}
          hitSkill={hitSet.has(npc.id) ? (hitFx?.skillId ?? null) : null}
        />
      ))}
    </group>
  )
}
