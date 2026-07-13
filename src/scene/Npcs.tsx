import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Billboard, Text } from '@react-three/drei'
import type { Mesh } from 'three'
import { useGameStore } from '../game/store'
import type { NpcState } from '../game/types'

const COLORS = ['#e07070', '#70a070', '#7070c0']

function NpcMesh({ npc, selected }: { npc: NpcState; selected: boolean }) {
  const mouth = useRef<Mesh>(null)
  const bodyColor = COLORS[npc.seatIndex % COLORS.length]

  useFrame(({ clock }) => {
    if (!mouth.current) return
    if (npc.status === 'smacking') {
      const open = 0.08 + Math.abs(Math.sin(clock.elapsedTime * 14)) * 0.14
      mouth.current.scale.set(1, open / 0.12, 1)
      mouth.current.visible = true
    } else if (npc.status === 'sealed' || npc.status === 'silenced') {
      mouth.current.scale.set(1, 0.04, 1)
      mouth.current.visible = true
    } else {
      mouth.current.scale.set(1, 0.06, 1)
    }
  })

  return (
    <group position={npc.position}>
      <mesh position={[0, 0.45, 0]} castShadow>
        <capsuleGeometry args={[0.26, 0.4, 4, 8]} />
        <meshStandardMaterial color={bodyColor} />
      </mesh>
      <mesh position={[0, 1.05, 0]} castShadow>
        <sphereGeometry args={[0.26, 12, 12]} />
        <meshStandardMaterial color="#f2d2b0" />
      </mesh>
      <mesh ref={mouth} position={[0, 0.98, 0.22]}>
        <boxGeometry args={[0.16, 0.12, 0.06]} />
        <meshStandardMaterial
          color={npc.status === 'smacking' ? '#8b1e1e' : '#4a3030'}
        />
      </mesh>
      {selected && (
        <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.45, 0.55, 24]} />
          <meshBasicMaterial color="#ffdd66" transparent opacity={0.85} />
        </mesh>
      )}
      {npc.status === 'smacking' && (
        <Billboard position={[0, 1.55, 0]}>
          <Text fontSize={0.28} color="#ff4444" anchorX="center" anchorY="middle">
            )))
          </Text>
        </Billboard>
      )}
      {(npc.status === 'sealed' || npc.status === 'silenced') && (
        <Billboard position={[0, 1.55, 0]}>
          <Text fontSize={0.22} color="#88cc88" anchorX="center" anchorY="middle">
            …
          </Text>
        </Billboard>
      )}
    </group>
  )
}

export function Npcs() {
  const npcs = useGameStore((s) => s.npcs)
  const targetId = useGameStore((s) => s.targetId)
  const list = useMemo(() => npcs, [npcs])

  return (
    <group>
      {list.map((npc) => (
        <NpcMesh key={npc.id} npc={npc} selected={npc.id === targetId} />
      ))}
    </group>
  )
}
