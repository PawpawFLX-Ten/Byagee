import { useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Billboard, Text } from '@react-three/drei'
import {
  DoubleSide,
  type Group,
  type Mesh,
  type MeshStandardMaterial,
  Raycaster,
  Vector3,
} from 'three'
import { moveWithCollision, separateFromOthers } from '../game/collision'
import { CONFIG } from '../game/config'
import { useGameStore } from '../game/store'
import { useInputStore } from '../game/inputStore'
import type { SkillId } from '../game/types'

const WALL_LAYER_NAME = 'fade-wall'

function Wall({
  position,
  args,
  color,
  accentColor,
}: {
  position: [number, number, number]
  args: [number, number, number]
  color: string
  accentColor: string
}) {
  return (
    <group position={position}>
      <mesh userData={{ fadeWall: true }} name={WALL_LAYER_NAME}>
        <boxGeometry args={args} />
        <meshStandardMaterial
          color={color}
          transparent
          opacity={0.3}
          depthWrite
          side={DoubleSide}
        />
      </mesh>
      {/* Decorative baseboard strip */}
      <mesh
        position={[0, -args[1] / 2 + 0.18, 0]}
        userData={{ fadeWall: true }}
      >
        <boxGeometry args={[args[0], 0.36, args[2] + 0.02]} />
        <meshStandardMaterial
          color={accentColor}
          transparent
          opacity={0.4}
          depthWrite
          side={DoubleSide}
        />
      </mesh>
    </group>
  )
}

export function WallOcclusionFader() {
  const { camera, scene } = useThree()
  const playerPos = useGameStore((s) => s.playerPos)
  const raycaster = useMemo(() => new Raycaster(), [])
  const from = useMemo(() => new Vector3(), [])
  const to = useMemo(() => new Vector3(), [])
  const dir = useMemo(() => new Vector3(), [])
  const faded = useRef(new Set<MeshStandardMaterial>())

  useFrame(() => {
    for (const mat of faded.current) {
      mat.opacity = Math.min(0.3, mat.opacity + 0.06)
      mat.depthWrite = mat.opacity > 0.25
      if (mat.opacity >= 0.3) faded.current.delete(mat)
    }

    from.copy(camera.position)
    to.set(playerPos[0], 1.2, playerPos[2])
    dir.subVectors(to, from)
    const dist = dir.length()
    if (dist < 0.01) return
    dir.multiplyScalar(1 / dist)
    raycaster.set(from, dir)
    raycaster.far = dist - 0.15

    const hits = raycaster.intersectObjects(scene.children, true)
    for (const hit of hits) {
      if (!hit.object.userData.fadeWall) continue
      const mesh = hit.object as Mesh
      const mat = mesh.material as MeshStandardMaterial
      if (!mat || Array.isArray(mat)) continue
      mat.transparent = true
      mat.opacity = Math.min(mat.opacity, 0.05)
      mat.depthWrite = false
      faded.current.add(mat)
    }
  })

  return null
}

const CALIGRAPHY_PIECES = [
  { pos: [-4.7, 1.6, -1.5] as [number, number, number], rotY: Math.PI / 2, char: '静', label: 'calm' },
  { pos: [-4.7, 1.6, 1.5] as [number, number, number], rotY: Math.PI / 2, char: '忍', label: 'endure' },
  { pos: [4.7, 1.6, 0] as [number, number, number], rotY: -Math.PI / 2, char: '食不言', label: 'silence' },
]

export function WallArt() {
  return (
    <group>
      {CALIGRAPHY_PIECES.map((piece, i) => (
        <group key={i} position={piece.pos} rotation={[0, piece.rotY, 0]}>
          {/* Frame */}
          <mesh userData={{ fadeWall: true }} position={[0, 0, -0.02]}>
            <boxGeometry args={[0.9, 1.2, 0.04]} />
            <meshStandardMaterial color="#3d2817" />
          </mesh>
          {/* Canvas backing */}
          <mesh position={[0, 0, 0.01]}>
            <planeGeometry args={[0.78, 1.08]} />
            <meshStandardMaterial color="#efe6d8" />
          </mesh>
          {/* Calligraphy character(s) */}
          <Text
            position={[0, 0, 0.03]}
            fontSize={piece.char.length > 1 ? 0.28 : 0.5}
            color="#1a1510"
            anchorX="center"
            anchorY="middle"
            maxWidth={0.7}
          >
            {piece.char}
          </Text>
        </group>
      ))}
    </group>
  )
}

export function Room() {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[10.3, 10.3]} />
        <meshStandardMaterial color="#c4b8a8" />
      </mesh>
      <Wall
        position={[0, 1.2, -4.94]}
        args={[10.3, 2.4, 0.18]}
        color="#9a8268"
        accentColor="#6b5a45"
      />
      <Wall
        position={[0, 1.2, 4.94]}
        args={[10.3, 2.4, 0.18]}
        color="#9a8268"
        accentColor="#6b5a45"
      />
      <Wall
        position={[-4.94, 1.2, 0]}
        args={[0.18, 2.4, 10.3]}
        color="#8a7560"
        accentColor="#5e4f3d"
      />
      <Wall
        position={[4.94, 1.2, 0]}
        args={[0.18, 2.4, 10.3]}
        color="#8a7560"
        accentColor="#5e4f3d"
      />
      <mesh position={[0, 2.45, 0]}>
        <boxGeometry args={[9.89, 0.08, 9.89]} />
        <meshStandardMaterial
          color="#6e5a42"
          transparent
          opacity={0.22}
          depthWrite={false}
        />
      </mesh>
      <WallArt />
      <ambientLight intensity={0.65} />
      <hemisphereLight args={['#fff2e0', '#8a7a68', 0.45]} />
      <directionalLight
        castShadow
        position={[4, 8, 3]}
        intensity={1.05}
        shadow-mapSize={[1024, 1024]}
      />
    </group>
  )
}

const FOOD_COLORS = [
  '#d4543c',
  '#e8b84a',
  '#6aaa5a',
  '#c47a3a',
  '#8b5a2b',
  '#f0a0a8',
  '#d4c45a',
  '#6a8aaa',
  '#c06040',
]

export function Tables() {
  return (
    <group>
      {CONFIG.tables.map((t) => {
        const legX = t.half.x * 0.85
        const legZ = t.half.z * 0.85
        const legPositions: [number, number, number][] = [
          [-legX, t.topY / 2, -legZ],
          [legX, t.topY / 2, -legZ],
          [-legX, t.topY / 2, legZ],
          [legX, t.topY / 2, legZ],
        ]
        return (
          <group key={t.id} position={t.position}>
            {t.shape === 'round' && (
              <mesh position={[0, t.topY, 0]} castShadow receiveShadow>
                <cylinderGeometry args={[t.half.x, t.half.x, 0.12, 24]} />
                <meshStandardMaterial color="#5c3d2e" />
              </mesh>
            )}
            {t.shape === 'rect' && (
              <mesh position={[0, t.topY, 0]} castShadow receiveShadow>
                <boxGeometry args={[t.half.x * 2, 0.12, t.half.z * 2]} />
                <meshStandardMaterial color="#4a3728" />
              </mesh>
            )}
            {t.shape === 'oval' && (
              <mesh
                position={[0, t.topY, 0]}
                castShadow
                receiveShadow
                scale={[1, 1, t.half.z / t.half.x]}
              >
                <cylinderGeometry args={[t.half.x, t.half.x, 0.12, 24]} />
                <meshStandardMaterial color="#6a4530" />
              </mesh>
            )}
            {legPositions.map((pos, i) => (
              <mesh key={i} position={pos} castShadow>
                <cylinderGeometry args={[0.08, 0.1, t.topY, 8]} />
                <meshStandardMaterial color="#3d2817" />
              </mesh>
            ))}
          </group>
        )
      })}

      {CONFIG.foodSpots.map((food, i) => {
        const kind = i % 4
        return (
          <group key={food.id} position={food.plate}>
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}>
              <circleGeometry args={[0.2, 16]} />
              <meshStandardMaterial color="#efe6d8" />
            </mesh>
            {kind === 0 && (
              <>
                <mesh position={[0, 0.07, 0]} castShadow>
                  <sphereGeometry args={[0.09, 10, 10]} />
                  <meshStandardMaterial color={FOOD_COLORS[i % FOOD_COLORS.length]} />
                </mesh>
                <mesh position={[0.07, 0.05, 0.04]}>
                  <sphereGeometry args={[0.045, 8, 8]} />
                  <meshStandardMaterial color="#f0d090" />
                </mesh>
              </>
            )}
            {kind === 1 && (
              <mesh position={[0, 0.05, 0]} castShadow rotation={[0.2, 0.4, 0]}>
                <boxGeometry args={[0.16, 0.05, 0.1]} />
                <meshStandardMaterial color={FOOD_COLORS[i % FOOD_COLORS.length]} />
              </mesh>
            )}
            {kind === 2 && (
              <>
                <mesh position={[-0.05, 0.04, 0]}>
                  <sphereGeometry args={[0.04, 8, 8]} />
                  <meshStandardMaterial color="#6aaa5a" />
                </mesh>
                <mesh position={[0.05, 0.045, 0.02]}>
                  <sphereGeometry args={[0.045, 8, 8]} />
                  <meshStandardMaterial color="#d4543c" />
                </mesh>
                <mesh position={[0, 0.04, -0.05]}>
                  <sphereGeometry args={[0.035, 8, 8]} />
                  <meshStandardMaterial color="#e8b84a" />
                </mesh>
              </>
            )}
            {kind === 3 && (
              <mesh position={[0, 0.06, 0]} castShadow>
                <cylinderGeometry args={[0.07, 0.08, 0.08, 10]} />
                <meshStandardMaterial color={FOOD_COLORS[i % FOOD_COLORS.length]} />
              </mesh>
            )}
          </group>
        )
      })}
    </group>
  )
}

export function Door() {
  const p = CONFIG.door.position
  return (
    <group position={[p[0], 0, p[2]]}>
      {/* Door frame — side pillars */}
      <mesh position={[-0.62, 1.1, -0.35]} castShadow>
        <boxGeometry args={[0.08, 2.2, 0.14]} />
        <meshStandardMaterial color="#8b6914" />
      </mesh>
      <mesh position={[0.62, 1.1, -0.35]} castShadow>
        <boxGeometry args={[0.08, 2.2, 0.14]} />
        <meshStandardMaterial color="#8b6914" />
      </mesh>
      {/* Top lintel */}
      <mesh position={[0, 2.18, -0.35]} castShadow>
        <boxGeometry args={[1.32, 0.08, 0.14]} />
        <meshStandardMaterial color="#8b6914" />
      </mesh>
      {/* Door panel */}
      <mesh position={[0, 1.1, -0.38]} castShadow>
        <boxGeometry args={[1.16, 2.08, 0.08]} />
        <meshStandardMaterial color="#a67c52" />
      </mesh>
      {/* Door handle */}
      <mesh position={[0.38, 1.1, -0.33]}>
        <sphereGeometry args={[0.06, 8, 8]} />
        <meshStandardMaterial color="#d4a017" metalness={0.6} roughness={0.3} />
      </mesh>
      {/* Couplet — 上联 (right side, +X): 天道酬勤 */}
      <group position={[0.82, 1.1, -0.35]}>
        <mesh>
          <planeGeometry args={[0.28, 1.8]} />
          <meshStandardMaterial color="#c0392b" roughness={0.7} />
        </mesh>
        <Text
          position={[0, 0, 0.01]}
          fontSize={0.3}
          color="#ffd700"
          anchorX="center"
          anchorY="middle"
          lineHeight={1.3}
        >
          {'天道酬勤'.split('').join('\n')}
        </Text>
      </group>

      {/* Couplet — 下联 (left side, -X): 地道的您 */}
      <group position={[-0.82, 1.1, -0.35]}>
        <mesh>
          <planeGeometry args={[0.28, 1.8]} />
          <meshStandardMaterial color="#c0392b" roughness={0.7} />
        </mesh>
        <Text
          position={[0, 0, 0.01]}
          fontSize={0.3}
          color="#ffd700"
          anchorX="center"
          anchorY="middle"
          lineHeight={1.3}
        >
          {'地道的您'.split('').join('\n')}
        </Text>
      </group>
    </group>
  )
}

const keys = new Set<string>()
if (typeof window !== 'undefined') {
  window.addEventListener('keydown', (e) => keys.add(e.code))
  window.addEventListener('keyup', (e) => keys.delete(e.code))
}

const _forward = new Vector3()
const _right = new Vector3()
const _up = new Vector3(0, 1, 0)

function HandClapper({ swing }: { swing: number }) {
  return (
    <group
      position={[0.35, 1.05, 0.25]}
      rotation={[0.2, 0, -0.4 + swing]}
    >
      <mesh position={[0, 0.25, 0]}>
        <boxGeometry args={[0.08, 0.55, 0.04]} />
        <meshStandardMaterial color="#4ecf6a" />
      </mesh>
      {/* Three hand layers */}
      {[0.02, 0, -0.02].map((z, i) => (
        <mesh key={i} position={[0, 0.58, z]} rotation={[0, 0, 0]}>
          <boxGeometry args={[0.28, 0.32, 0.03]} />
          <meshStandardMaterial color={i === 1 ? '#ff6eb0' : '#ff8ec8'} />
        </mesh>
      ))}
      <mesh position={[0, 0.55, 0.05]}>
        <circleGeometry args={[0.06, 10]} />
        <meshBasicMaterial color="#ffe566" />
      </mesh>
    </group>
  )
}

export function Player() {
  const ref = useRef<Group>(null)
  const arm = useRef<Group>(null)
  const { camera } = useThree()
  const setPlayerPos = useGameStore((s) => s.setPlayerPos)
  const alive = useGameStore((s) => s.alive)
  const briefingDone = useGameStore((s) => s.briefingDone)
  const skillAction = useGameStore((s) => s.skillAction)
  const shoutBannerUntil = useGameStore((s) => s.shoutBannerUntil)
  const npcs = useGameStore((s) => s.npcs)
  const jumpUntil = useRef(0)
  const jumpCooldownUntil = useRef(0)
  const wasSpace = useRef(false)
  const touchMoveX = useInputStore((s) => s.moveX)
  const touchMoveY = useInputStore((s) => s.moveY)

  useFrame((_, dt) => {
    if (!ref.current || !alive || !briefingDone) return

    const acting = skillAction !== null
    const now = performance.now()
    const isSpace = keys.has('Space')
    if (isSpace && !wasSpace.current && !acting) {
      if (now >= jumpCooldownUntil.current) {
        jumpUntil.current = now + 500
        jumpCooldownUntil.current = now + 800
      }
    }
    wasSpace.current = isSpace
    const isAirborne = now < jumpUntil.current
    const blockers = isAirborne
      ? []
      : npcs.map((n) => ({
          x: n.position[0],
          z: n.position[2],
        }))
    if (!acting) {
      let forwardInput = 0
      let strafeInput = 0
      if (keys.has('KeyW') || keys.has('ArrowUp')) forwardInput += 1
      if (keys.has('KeyS') || keys.has('ArrowDown')) forwardInput -= 1
      if (keys.has('KeyD') || keys.has('ArrowRight')) strafeInput += 1
      if (keys.has('KeyA') || keys.has('ArrowLeft')) strafeInput -= 1

      // Touch joystick — additive to keyboard, clamped to [-1, 1]
      forwardInput += touchMoveY
      strafeInput += touchMoveX
      forwardInput = Math.max(-1, Math.min(1, forwardInput))
      strafeInput = Math.max(-1, Math.min(1, strafeInput))

      if (forwardInput !== 0 || strafeInput !== 0) {
        camera.getWorldDirection(_forward)
        _forward.y = 0
        if (_forward.lengthSq() < 1e-6) _forward.set(0, 0, -1)
        else _forward.normalize()
        _right.crossVectors(_forward, _up).normalize()

        let mx = _forward.x * forwardInput + _right.x * strafeInput
        let mz = _forward.z * forwardInput + _right.z * strafeInput
        const len = Math.hypot(mx, mz)
        mx /= len
        mz /= len
        const speed = CONFIG.playerSpeed
        const [x, z] = moveWithCollision(
          ref.current.position.x,
          ref.current.position.z,
          mx * speed * dt,
          mz * speed * dt,
          CONFIG.tables,
          blockers,
        )
        ref.current.position.x = x
        ref.current.position.z = z
        ref.current.rotation.y = Math.atan2(mx, mz)
      } else if (!isAirborne) {
        // Idle: still resolve overlap if NPCs walk into the player
        const [x, z] = separateFromOthers(
          ref.current.position.x,
          ref.current.position.z,
          blockers,
          CONFIG.tables,
        )
        ref.current.position.x = x
        ref.current.position.z = z
      }
    } else if (skillAction) {
      if (skillAction.skillId !== 'megaphone') {
        ref.current.rotation.y = skillAction.faceYaw
      }
    }

    // Arm / prop animation
    if (arm.current) {
      const now = performance.now()
      if (skillAction) {
        const skill = CONFIG.skills[skillAction.skillId]
        const t =
          1 - (skillAction.until - now) / (skill.windup * 1000)
        const k = Math.max(0, Math.min(1, t))
        if (skillAction.skillId === 'slap') {
          // 横向扇脸: arm sweeps from right to left (yaw swing)
          const eased = 0.5 - 0.5 * Math.cos(k * Math.PI)
          arm.current.rotation.y = -0.8 + eased * 1.6
          arm.current.rotation.x = -0.15
          arm.current.rotation.z = -0.3
        } else if (skillAction.skillId === 'tape') {
          arm.current.rotation.x = -0.6 * k
          arm.current.position.z = 0.15 * k
        } else if (skillAction.skillId === 'gag') {
          arm.current.rotation.x = -0.9 * k
          arm.current.position.z = 0.25 * k
        } else if (skillAction.skillId === 'poop') {
          // 泼屎: wind back then throw forward
          arm.current.rotation.x = -0.3 - Math.sin(k * Math.PI) * 1.8
          arm.current.rotation.z = -0.2
          arm.current.rotation.y = 0
        } else if (skillAction.skillId === 'civility') {
          // 素质: both arms raised up
          arm.current.rotation.x = -2.2 * k
          arm.current.rotation.z = -0.2
          arm.current.rotation.y = 0
        } else {
          arm.current.rotation.x = -0.3
        }
      } else {
        arm.current.rotation.x *= 0.8
        arm.current.rotation.y *= 0.8
        arm.current.rotation.z *= 0.8
        arm.current.position.z *= 0.8
      }
    }

    // Jump arc animation
    if (isAirborne) {
      const jumpProgress = 1 - (jumpUntil.current - now) / 500
      ref.current.position.y = Math.sin(jumpProgress * Math.PI) * 0.8
    } else if (ref.current.position.y !== 0) {
      ref.current.position.y = 0
    }

    setPlayerPos([
      ref.current.position.x,
      ref.current.position.y,
      ref.current.position.z,
    ])
  })

  const skillId: SkillId | null = skillAction?.skillId ?? null
  const shouting = performance.now() < shoutBannerUntil

  return (
    <group ref={ref} position={[0, 0, 2.4]}>
      <mesh position={[0, 0.5, 0]} castShadow>
        <capsuleGeometry args={[0.28, 0.45, 4, 8]} />
        <meshStandardMaterial color="#3a6ea5" />
      </mesh>
      <mesh position={[0, 1.28, 0]} castShadow>
        <sphereGeometry args={[0.3, 16, 16]} />
        <meshStandardMaterial color="#f0d5b8" />
      </mesh>
      <mesh position={[-0.1, 1.32, 0.24]}>
        <sphereGeometry args={[0.045, 8, 8]} />
        <meshStandardMaterial color="#1a1a1a" />
      </mesh>
      <mesh position={[0.1, 1.32, 0.24]}>
        <sphereGeometry args={[0.045, 8, 8]} />
        <meshStandardMaterial color="#1a1a1a" />
      </mesh>

      {/* Open mouth while shouting */}
      {shouting && (
        <mesh position={[0, 1.18, 0.28]}>
          <boxGeometry args={[0.14, 0.12, 0.08]} />
          <meshStandardMaterial color="#4a1010" />
        </mesh>
      )}

      <group ref={arm}>
        {skillId === 'slap' && <HandClapper swing={0.2} />}
        {skillId === 'tape' && (
          <mesh position={[0.4, 1.1, 0.3]} rotation={[0.5, 0, 0.4]}>
            <boxGeometry args={[0.28, 0.08, 0.08]} />
            <meshStandardMaterial color="#d8d8d8" />
          </mesh>
        )}
        {skillId === 'gag' && (
          <mesh position={[0.35, 1.15, 0.35]} rotation={[0.8, 0.2, 0]}>
            <capsuleGeometry args={[0.06, 0.22, 4, 8]} />
            <meshStandardMaterial color="#9b6bff" />
          </mesh>
        )}
        {skillId === 'poop' && (
          <mesh position={[0.35, 1.1, 0.35]} rotation={[0.5, 0, 0.4]}>
            <sphereGeometry args={[0.12, 8, 8]} />
            <meshStandardMaterial color="#6b4a2b" />
          </mesh>
        )}
        {skillId === 'civility' && (
          <group position={[0, 0, 0]}>
            <mesh position={[0.4, 1.3, 0.2]} rotation={[0, 0, -0.3]}>
              <capsuleGeometry args={[0.06, 0.35, 4, 8]} />
              <meshStandardMaterial color="#ffd700" />
            </mesh>
            <mesh position={[-0.4, 1.3, 0.2]} rotation={[0, 0, 0.3]}>
              <capsuleGeometry args={[0.06, 0.35, 4, 8]} />
              <meshStandardMaterial color="#ffd700" />
            </mesh>
          </group>
        )}
      </group>

      {shouting && (
        <Billboard position={[0, 2.1, 0]}>
          <Text
            fontSize={0.22}
            color="#ff5533"
            anchorX="center"
            anchorY="middle"
            outlineWidth={0.015}
            outlineColor="#200000"
            maxWidth={3}
          >
            {CONFIG.shoutLine}
          </Text>
        </Billboard>
      )}
    </group>
  )
}
