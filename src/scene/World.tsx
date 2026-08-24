import { useEffect, useMemo, useRef } from 'react'
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
import {
  CHAR_RADIUS,
  floorOfY,
  layoutBoundsFromLayout,
  moveWithCollision,
  separateFromOthers,
  wallsFromLayout,
  type ObstacleCollider,
} from '../game/collision'
import { CONFIG } from '../game/config'
import { inFaceRadius } from '../game/chaser'
import { playLatch } from '../game/audio'
import {
  agentYAt,
  openingOrientation,
  stairCollidersFromLayout,
  stairEndPos,
  type SpaceLayoutState,
} from '../game/spaceLayout'
import {
  beginHold,
  buildProximityContext,
  cancelHold,
  createHoldState,
  isHoldReady,
  resolveHold,
  shouldCancelHold,
  MAIN_DOOR_OPENING_ID,
  type ProximityFlags,
} from '../game/hideLatch'
import { t } from '../game/i18n'
import { useGameStore, HIT_FX_MS } from '../game/store'
import { stdMat } from './materials'
import {
  boxGeo,
  circleGeo,
  cylinderGeo,
  planeGeo,
  sphereGeo,
} from './geometries'
import { useInputStore } from '../game/inputStore'
import type { SkillId, SpaceStairs } from '../game/types'
import { CABINET_POSITIONS } from './Atmosphere'

const WALL_LAYER_NAME = 'fade-wall'
/** Vertical drop when hiding under furniture (with Y-scale 0.55). */
const HIDE_CROUCH_Y = 0.42
const LATCH_MIME_MS = 380
/** Half-width of a door gap carved out of a wall. */
const DOOR_GAP_HALF = 0.7

/** Split [start,end] into segments with door gaps removed. */
function splitSegments(
  start: number,
  end: number,
  gaps: number[],
  gapHalf: number,
): [number, number][] {
  const segs: [number, number][] = []
  let cur = start
  for (const g of [...gaps].sort((a, b) => a - b)) {
    if (g - gapHalf > cur) segs.push([cur, g - gapHalf])
    cur = Math.max(cur, g + gapHalf)
  }
  if (cur < end) segs.push([cur, end])
  return segs
}

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
  const raycaster = useMemo(() => new Raycaster(), [])
  const from = useMemo(() => new Vector3(), [])
  const to = useMemo(() => new Vector3(), [])
  const dir = useMemo(() => new Vector3(), [])
  const faded = useRef(new Set<MeshStandardMaterial>())
  const origOpacity = useRef(new WeakMap<MeshStandardMaterial, number>())
  const fadeWalls = useRef<Mesh[] | null>(null)
  const frameCount = useRef(0)

  useFrame(() => {
    const expired: MeshStandardMaterial[] = []
    for (const mat of faded.current) {
      const base = origOpacity.current.get(mat) ?? 0.3
      mat.opacity = Math.min(base, mat.opacity + 0.06)
      mat.depthWrite = mat.opacity > 0.25
      if (mat.opacity >= base) expired.push(mat)
    }
    for (const m of expired) faded.current.delete(m)

    // Occlusion is slow to change �?one raycast per 3 frames is plenty.
    frameCount.current += 1
    if (frameCount.current % 3 !== 0) return

    if (!fadeWalls.current) {
      fadeWalls.current = []
      scene.traverse((o) => {
        if (o.userData.fadeWall) fadeWalls.current!.push(o as Mesh)
      })
    }
    const walls = fadeWalls.current
    if (walls.length === 0) return

    const playerPos = useGameStore.getState().playerPos
    from.copy(camera.position)
    to.set(playerPos[0], playerPos[1] + 1.2, playerPos[2])
    dir.subVectors(to, from)
    const dist = dir.length()
    if (dist < 0.01) return
    dir.multiplyScalar(1 / dist)
    raycaster.set(from, dir)
    raycaster.far = dist - 0.15

    // Only probe pre-collected fadeWall meshes instead of the whole scene.
    const hits = raycaster.intersectObjects(walls, false)
    for (const hit of hits) {
      if (!hit.object.userData.fadeWall) continue
      const mesh = hit.object as Mesh
      const mat = mesh.material as MeshStandardMaterial
      if (!mat || Array.isArray(mat)) continue
      if (!origOpacity.current.has(mat)) {
        origOpacity.current.set(mat, mat.opacity)
      }
      mat.transparent = true
      mat.opacity = Math.min(mat.opacity, 0.05)
      mat.depthWrite = false
      faded.current.add(mat)
    }
  })

  return null
}

export function WallArt() {
  const lang = useGameStore((s) => s.lang)
  const pieces = [
    { pos: [-4.7, 1.6, -1.5] as [number, number, number], rotY: Math.PI / 2, char: t('wall_calm') },
    { pos: [-4.7, 1.6, 1.5] as [number, number, number], rotY: Math.PI / 2, char: t('wall_endure') },
    { pos: [4.7, 1.6, 0] as [number, number, number], rotY: -Math.PI / 2, char: t('wall_silence') },
  ]
  return (
    <group>
      {pieces.map((piece, i) => (
        <group key={i} position={piece.pos} rotation={[0, piece.rotY, 0]}>
          {/* Frame */}
          <mesh userData={{ fadeWall: true }} position={[0, 0, -0.02]} geometry={boxGeo(0.9, 1.2, 0.04)}>
            <meshStandardMaterial color="#3d2817" />
          </mesh>
          {/* Canvas backing */}
          <mesh
            position={[0, 0, 0.01]}
            material={stdMat('#efe6d8')}
            geometry={planeGeo(0.78, 1.08)}
          />
          {/* Calligraphy character(s) */}
          <Text
            position={[0, 0, 0.03]}
            fontSize={lang === 'zh'
              ? (piece.char.length > 1 ? 0.28 : 0.5)
              : Math.max(0.14, 0.3 - piece.char.length * 0.02)
            }
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

function RoomWalls({
  room,
  layout,
}: {
  room: { id: string; min: [number, number]; max: [number, number]; floor: number }
  layout: SpaceLayoutState
}) {
  const { min, max } = room
  const cx = (min[0] + max[0]) / 2
  const cz = (min[1] + max[1]) / 2
  const doors = layout.openings.filter(
    (o) => o.fromRoom === room.id || o.toRoom === room.id,
  )
  const northDoorX = doors
    .filter((o) => Math.abs(o.position[2] - min[1]) < 0.01)
    .map((o) => o.position[0])
  const southDoorX = doors
    .filter((o) => Math.abs(o.position[2] - max[1]) < 0.01)
    .map((o) => o.position[0])
  const westDoorZ = doors
    .filter((o) => Math.abs(o.position[0] - min[0]) < 0.01)
    .map((o) => o.position[2])
  const eastDoorZ = doors
    .filter((o) => Math.abs(o.position[0] - max[0]) < 0.01)
    .map((o) => o.position[2])

  const walls: {
    key: string
    position: [number, number, number]
    args: [number, number, number]
    color: string
    accentColor: string
  }[] = []
  for (const [s, e] of splitSegments(min[0], max[0], northDoorX, DOOR_GAP_HALF)) {
    const len = e - s
    walls.push({
      key: `n-${s}`,
      position: [s + len / 2 - cx, 1.2, min[1] - 0.14 - cz],
      args: [len + 0.3, 2.4, 0.18],
      color: '#9a8268',
      accentColor: '#6b5a45',
    })
  }
  for (const [s, e] of splitSegments(min[0], max[0], southDoorX, DOOR_GAP_HALF)) {
    const len = e - s
    walls.push({
      key: `s-${s}`,
      position: [s + len / 2 - cx, 1.2, max[1] + 0.14 - cz],
      args: [len + 0.3, 2.4, 0.18],
      color: '#9a8268',
      accentColor: '#6b5a45',
    })
  }
  for (const [s, e] of splitSegments(min[1], max[1], westDoorZ, DOOR_GAP_HALF)) {
    const len = e - s
    walls.push({
      key: `w-${s}`,
      position: [min[0] - 0.14 - cx, 1.2, s + len / 2 - cz],
      args: [0.18, 2.4, len + 0.3],
      color: '#8a7560',
      accentColor: '#5e4f3d',
    })
  }
  for (const [s, e] of splitSegments(min[1], max[1], eastDoorZ, DOOR_GAP_HALF)) {
    const len = e - s
    walls.push({
      key: `e-${s}`,
      position: [max[0] + 0.14 - cx, 1.2, s + len / 2 - cz],
      args: [0.18, 2.4, len + 0.3],
      color: '#8a7560',
      accentColor: '#5e4f3d',
    })
  }

  return (
    <group>
      {walls.map((wall) => (
        <Wall
          key={wall.key}
          position={wall.position}
          args={wall.args}
          color={wall.color}
          accentColor={wall.accentColor}
        />
      ))}
    </group>
  )
}

export function Room() {
  const layout = useGameStore((s) => s.layout)
  const hasUpstairs = layout.rooms.some((r) => r.floor > 0)
  return (
    <group>
      {layout.rooms.map((room) => {
        const w = room.max[0] - room.min[0]
        const d = room.max[1] - room.min[1]
        const cx = (room.min[0] + room.max[0]) / 2
        const cz = (room.min[1] + room.max[1]) / 2
        const y = room.floor * 1.5
        const floorColor = room.floor === 0 ? '#c4b8a8' : '#b8a898'
        return (
          <group key={room.id} position={[cx, y, cz]}>
            <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow material={stdMat(floorColor)}>
              <planeGeometry args={[w + 0.3, d + 0.3]} />
            </mesh>
            <RoomWalls room={room} layout={layout} />
            {room.id === 'r0' && <WallArt />}
            {room.floor === 0 && room.id === 'r0' && !hasUpstairs && (
              <mesh position={[0, 2.45, 0]}>
                <boxGeometry args={[w - 0.11, 0.08, d - 0.11]} />
                <meshStandardMaterial
                  color="#6e5a42"
                  transparent
                  opacity={0.22}
                  depthWrite={false}
                />
              </mesh>
            )}
            {room.floor > 0 && (
              <mesh position={[0, 0.05, 0]}>
                <boxGeometry args={[w, 0.1, d]} />
                <meshStandardMaterial
                  color="#a09080"
                  transparent
                  opacity={0.5}
                  depthWrite={false}
                />
              </mesh>
            )}
          </group>
        )
      })}
      {layout.obstacles
        .filter((obs) => !obs.id.startsWith('cabinet-'))
        .map((obs) => {
        const w = obs.max[0] - obs.min[0]
        const d = obs.max[1] - obs.min[1]
        const cx = (obs.min[0] + obs.max[0]) / 2
        const cz = (obs.min[1] + obs.max[1]) / 2
        return (
          <mesh
            key={obs.id}
            position={[cx, 0.75, cz]}
            castShadow
            material={stdMat('#6a5a4a')}
            geometry={boxGeo(w, 1.5, d)}
          />
        )
      })}
      {layout.stairs.map((st) => (
        <Stairs key={st.id} layout={layout} st={st} />
      ))}
    </group>
  )
}

const STAIR_STEPS = 8

/** Stepped staircase: rises from the foot (y=0) to the top (y=1.5). */
function Stairs({ layout, st }: { layout: SpaceLayoutState; st: SpaceStairs }) {
  const [topX, topZ] = stairEndPos(layout, st, 1)
  const dir =
    st.axis === 'x'
      ? Math.sign(topX - st.position[0]) || 1
      : Math.sign(topZ - st.position[2]) || 1
  const rise = 1.5 / STAIR_STEPS
  const depth = st.length / STAIR_STEPS
  const along = st.axis === 'x'
    ? ([depth, 0.2, st.width] as [number, number, number])
    : ([st.width, 0.2, depth] as [number, number, number])
  const steps = Array.from({ length: STAIR_STEPS }, (_, i) => {
    const x = st.axis === 'x' ? st.position[0] + dir * depth * (i + 0.5) : st.position[0]
    const z = st.axis === 'z' ? st.position[2] + dir * depth * (i + 0.5) : st.position[2]
    return { x, z, y: rise * (i + 0.5) }
  })
  return (
    <group>
      {steps.map((s, i) => (
        <mesh
          key={i}
          position={[s.x, s.y, s.z]}
          receiveShadow
          material={stdMat('#7a6a58')}
          geometry={boxGeo(along[0], along[1], along[2])}
        />
      ))}
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
  const tables = useGameStore((s) => s.runtimeTables)
  const foodSpots = useGameStore((s) => s.runtimeFoodSpots)
  const hitFx = useGameStore((s) => s.hitFx)
  const foodGroup = useRef<Group>(null)

  useFrame(() => {
    if (!foodGroup.current) return
    if (hitFx?.skillId === 'megaphone' && performance.now() < hitFx.until) {
      const t = 1 - (hitFx.until - performance.now()) / HIT_FX_MS.megaphone
      const shake = Math.sin(t * 55) * (1 - t) * 0.04
      foodGroup.current.position.set(shake, 0, shake * 0.6)
    } else {
      foodGroup.current.position.set(0, 0, 0)
    }
  })

  return (
    <group>
      {tables.map((t) => {
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
              <mesh
                position={[0, t.topY, 0]}
                castShadow
                receiveShadow
                material={stdMat('#5c3d2e')}
                geometry={cylinderGeo(t.half.x, t.half.x, 0.12, 24)}
              />
            )}
            {t.shape === 'rect' && (
              <mesh
                position={[0, t.topY, 0]}
                castShadow
                receiveShadow
                material={stdMat('#4a3728')}
                geometry={boxGeo(t.half.x * 2, 0.12, t.half.z * 2)}
              />
            )}
            {t.shape === 'oval' && (
              <mesh
                position={[0, t.topY, 0]}
                castShadow
                receiveShadow
                scale={[1, 1, t.half.z / t.half.x]}
                material={stdMat('#6a4530')}
                geometry={cylinderGeo(t.half.x, t.half.x, 0.12, 24)}
              />
            )}
            {legPositions.map((pos, i) => (
              <mesh
                key={i}
                position={pos}
                material={stdMat('#3d2817')}
                geometry={cylinderGeo(0.08, 0.1, t.topY, 8)}
              />
            ))}
          </group>
        )
      })}

      <group ref={foodGroup}>
      {foodSpots.map((food, i) => {
        const kind = i % 4
        return (
          <group key={food.id} position={food.plate}>
            <mesh
              rotation={[-Math.PI / 2, 0, 0]}
              position={[0, -0.02, 0]}
              material={stdMat('#efe6d8')}
              geometry={circleGeo(0.2, 16)}
            />
            {kind === 0 && (
              <>
                <mesh
                  position={[0, 0.07, 0]}
                  material={stdMat(FOOD_COLORS[i % FOOD_COLORS.length])}
                  geometry={sphereGeo(0.09, 10, 10)}
                />
                <mesh
                  position={[0.07, 0.05, 0.04]}
                  material={stdMat('#f0d090')}
                  geometry={sphereGeo(0.045, 8, 8)}
                />
              </>
            )}
            {kind === 1 && (
              <mesh
                position={[0, 0.05, 0]}
                rotation={[0.2, 0.4, 0]}
                material={stdMat(FOOD_COLORS[i % FOOD_COLORS.length])}
                geometry={boxGeo(0.16, 0.05, 0.1)}
              />
            )}
            {kind === 2 && (
              <>
                <mesh position={[-0.05, 0.04, 0]} material={stdMat('#6aaa5a')} geometry={sphereGeo(0.04, 8, 8)} />
                <mesh position={[0.05, 0.045, 0.02]} material={stdMat('#d4543c')} geometry={sphereGeo(0.045, 8, 8)} />
                <mesh position={[0, 0.04, -0.05]} material={stdMat('#e8b84a')} geometry={sphereGeo(0.035, 8, 8)} />
              </>
            )}
            {kind === 3 && (
              <mesh
                position={[0, 0.06, 0]}
                material={stdMat(FOOD_COLORS[i % FOOD_COLORS.length])}
                geometry={cylinderGeo(0.07, 0.08, 0.08, 10)}
              />
            )}
          </group>
        )
      })}
      </group>
    </group>
  )
}

/** Door panel swings this far (rad) from the closed position when unlatched. */
const DOOR_OPEN_YAW = 1.4

function DoorModel({
  position,
  rotY,
  lang,
  openingId,
  swingSign = 1,
}: {
  position: [number, number, number]
  rotY: number
  lang: string
  openingId?: string
  /** +1 swings the panel toward local +z, -1 toward local -z. */
  swingSign?: number
}) {
  const panel = useRef<Group>(null)

  useFrame((_, dt) => {
    if (!panel.current) return
    const now = performance.now()
    let latched = false
    if (openingId) {
      const o = useGameStore
        .getState()
        .layout.openings.find((x) => x.id === openingId)
      latched = o !== undefined && o.latchedUntil > now
    }
    const target = latched ? 0 : DOOR_OPEN_YAW * swingSign
    const k = 1 - Math.exp(-dt * 5)
    panel.current.rotation.y += (target - panel.current.rotation.y) * k
  })

  return (
    <group position={position} rotation={[0, rotY, 0]}>
      {/* Door sits flush against the wall: visuals offset 0.4 into the room. */}
      <group position={[0, 0, 0.4]}>
      {/* Door frame �?side pillars */}
      <mesh position={[-0.62, 1.1, -0.35]} castShadow material={stdMat('#8b6914')} geometry={boxGeo(0.08, 2.2, 0.14)} />
      <mesh position={[0.62, 1.1, -0.35]} castShadow material={stdMat('#8b6914')} geometry={boxGeo(0.08, 2.2, 0.14)} />
      {/* Top lintel */}
      <mesh position={[0, 2.18, -0.35]} castShadow material={stdMat('#8b6914')} geometry={boxGeo(1.32, 0.08, 0.14)} />
      {/* Hinged door panel: pivots on the left post; swings shut while the
          opening is latched and back open when the latch expires. */}
      <group
        ref={panel}
        position={[-0.58, 0, -0.38]}
        rotation={[0, DOOR_OPEN_YAW * swingSign, 0]}
      >
        <mesh position={[0.58, 1.1, 0]} castShadow material={stdMat('#a67c52')} geometry={boxGeo(1.16, 2.08, 0.08)} />
        {/* Door handle */}
        <mesh position={[1.02, 1.1, 0.03]}>
          <sphereGeometry args={[0.06, 8, 8]} />
          <meshStandardMaterial color="#d4a017" metalness={0.6} roughness={0.3} />
        </mesh>
      </group>
      {/* Couplet �?上联 (right side, +X): 天道酬勤 */}
      <group position={[0.82, 1.1, -0.35]}>
        <mesh>
          <planeGeometry args={[0.28, 1.8]} />
          <meshStandardMaterial color="#c0392b" roughness={0.7} />
        </mesh>
        <Text
          position={[0, 0, 0.01]}
          fontSize={lang === 'zh' ? 0.3 : 0.1}
          color="#ffd700"
          anchorX="center"
          anchorY="middle"
          lineHeight={1.3}
          maxWidth={0.26}
        >
          {t('couplet_right').replace(/ /g, '').split('').join('\n')}
        </Text>
      </group>

      {/* Couplet �?下联 (left side, -X): 地道的您 */}
      <group position={[-0.82, 1.1, -0.35]}>
        <mesh>
          <planeGeometry args={[0.28, 1.8]} />
          <meshStandardMaterial color="#c0392b" roughness={0.7} />
        </mesh>
        <Text
          position={[0, 0, 0.01]}
          fontSize={lang === 'zh' ? 0.3 : 0.1}
          color="#ffd700"
          anchorX="center"
          anchorY="middle"
          lineHeight={1.3}
          maxWidth={0.26}
        >
          {t('couplet_left').replace(/ /g, '').split('').join('\n')}
        </Text>
      </group>
      </group>
    </group>
  )
}

export function Door() {
  const lang = useGameStore((s) => s.lang)
  const layout = useGameStore((s) => s.layout)
  const p = CONFIG.door.position
  const floorOf = (id: string) =>
    layout.rooms.find((r) => r.id === id)?.floor ?? 0
  /** Swing sign: the panel opens toward the source room's interior. */
  const swingSignFor = (o: { fromRoom: string; position: [number, number, number] }): number => {
    const from = layout.rooms.find((r) => r.id === o.fromRoom)
    if (!from) return 1
    if (Math.abs(o.position[0] - from.max[0]) < 0.2) return -1 // east wall → room at -x
    if (Math.abs(o.position[0] - from.min[0]) < 0.2) return 1 // west wall → room at +x
    if (Math.abs(o.position[2] - from.min[1]) < 0.2) return 1 // north wall → room at +z
    return -1 // south wall → room at -z
  }
  return (
    <group>
      {/* Main north door (static entrance); its latch lives in the layout
          under MAIN_DOOR_OPENING_ID after the first latch. */}
      <DoorModel
        position={[p[0], 0, p[2]]}
        rotY={0}
        lang={lang}
        openingId={MAIN_DOOR_OPENING_ID}
        swingSign={1}
      />
      {/* Space-event doors: x-constant walls span z, so they rotate 90°.
          Cross-floor stairwell openings get no door model. */}
      {layout.openings
        .filter(
          (o) =>
            o.id !== MAIN_DOOR_OPENING_ID &&
            floorOf(o.fromRoom) === floorOf(o.toRoom),
        )
        .map((o) => (
          <DoorModel
            key={o.id}
            position={o.position}
            rotY={openingOrientation(layout, o) === 'eastwest' ? Math.PI / 2 : 0}
            lang={lang}
            openingId={o.id}
            swingSign={swingSignFor(o)}
          />
        ))}
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
      position={[0.02, 0.2, 0.22]}
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
  const paused = useGameStore((s) => s.paused)
  const skillAction = useGameStore((s) => s.skillAction)
  const hitFx = useGameStore((s) => s.hitFx)
  const shoutBannerUntil = useGameStore((s) => s.shoutBannerUntil)
  const playerHidden = useGameStore((s) => s.playerHidden)
  const setHideState = useGameStore((s) => s.setHideState)
  const applyLatch = useGameStore((s) => s.applyLatch)
  const layout = useGameStore((s) => s.layout)
  useGameStore((s) => s.lang) // re-render on language change
  const jumpUntil = useRef(0)
  const jumpCooldownUntil = useRef(0)
  const jumpBaseY = useRef(0)
  const latchMimeUntil = useRef(0)
  const wasSpace = useRef(false)
  const holdState = useRef(createHoldState())
  const contextAtHoldStart = useRef<ProximityFlags | null>(null)
  const touchMoveX = useInputStore((s) => s.moveX)
  const touchMoveY = useInputStore((s) => s.moveY)

  // Pause: cancel any in-flight hold so it cannot resolve instantly on resume.
  useEffect(() => {
    if (paused) {
      holdState.current = cancelHold(holdState.current)
      contextAtHoldStart.current = null
    }
  }, [paused])

  const layoutBounds = useMemo(() => layoutBoundsFromLayout(layout, 0), [layout])
  // Walls + stair wedges + fixed obstacles — merged once per layout instead
  // of spreading three arrays every frame during movement.
  const wallObstacles = useMemo(
    () => [
      ...layout.obstacles,
      ...wallsFromLayout(layout, CONFIG.door.position),
      ...stairCollidersFromLayout(layout),
    ],
    [layout],
  )

  useFrame((_, dt) => {
    if (!ref.current || !alive || !briefingDone || paused) return

    const { npcs, runtimeTables, layout: liveLayout } = useGameStore.getState()
    const acting = skillAction !== null
    const now = performance.now()
    const isSpace = keys.has('Space')
    const isAirborne = now < jumpUntil.current
    const grounded = !isAirborne
    const playerPos: [number, number, number] = [
      ref.current.position.x,
      ref.current.position.y,
      ref.current.position.z,
    ]
    const chaserFace = npcs.some(
      (n) => n.role === 'chaser' && inFaceRadius(n, playerPos),
    )
    const prox = buildProximityContext(
      playerPos,
      runtimeTables,
      liveLayout,
      CONFIG.door.position,
      grounded,
      chaserFace,
      CABINET_POSITIONS,
      paused,
    )

    if (!acting) {
      if (isSpace && !wasSpace.current) {
        holdState.current = beginHold(createHoldState(), now)
        contextAtHoldStart.current = {
          nearFurniture: prox.nearFurniture,
          nearDoor: prox.nearDoor,
        }
      }

      if (isSpace && holdState.current.holding && !holdState.current.resolved) {
        if (shouldCancelHold(prox, contextAtHoldStart.current)) {
          holdState.current = cancelHold(holdState.current)
          contextAtHoldStart.current = null
        } else if (isHoldReady(holdState.current, now)) {
          const resolved = resolveHold(holdState.current, prox, now)
          holdState.current = resolved.hold
          if (resolved.action === 'hide') {
            setHideState(true, now)
          } else if (resolved.action === 'latch' && prox.openingId) {
            if (applyLatch(prox.openingId, now)) {
              playLatch()
              latchMimeUntil.current = now + LATCH_MIME_MS
            }
          }
        }
      }

      if (!isSpace && wasSpace.current) {
        const released = resolveHold(holdState.current, prox, now, { released: true })
        holdState.current = cancelHold(released.hold)
        if (
          released.action === 'jump' &&
          !playerHidden &&
          now >= jumpCooldownUntil.current
        ) {
          jumpBaseY.current = ref.current.position.y
          jumpUntil.current = now + 650
          jumpCooldownUntil.current = now + 900
        }
        contextAtHoldStart.current = null
      }
    } else if (!isSpace && wasSpace.current) {
      holdState.current = cancelHold(holdState.current)
      contextAtHoldStart.current = null
    }
    wasSpace.current = isSpace

    // NPCs always collide �?jumping through a crowd is not allowed.
    const blockers = npcs.map((n) => ({
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

      // Touch joystick �?additive to keyboard, clamped to [-1, 1]
      forwardInput += touchMoveY
      strafeInput += touchMoveX
      forwardInput = Math.max(-1, Math.min(1, forwardInput))
      strafeInput = Math.max(-1, Math.min(1, strafeInput))

      const moveIntent = forwardInput !== 0 || strafeInput !== 0
      if (playerHidden) {
        if (moveIntent) {
          setHideState(false)
        }
      } else if (moveIntent) {
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
        const floor = floorOfY(ref.current.position.y)
        const [x, z] = moveWithCollision(
          ref.current.position.x,
          ref.current.position.z,
          mx * speed * dt,
          mz * speed * dt,
          runtimeTables,
          blockers,
          CHAR_RADIUS,
          wallObstacles as ObstacleCollider[],
          layoutBounds,
          floor,
          ref.current.position.y,
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
          runtimeTables,
          CHAR_RADIUS,
          wallObstacles as ObstacleCollider[],
          layoutBounds,
          floorOfY(ref.current.position.y),
          ref.current.position.y,
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
      const slapFromHit =
        hitFx?.skillId === 'slap' && now < hitFx.until
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
      } else if (slapFromHit) {
        const k = Math.max(0, Math.min(1, 1 - (hitFx.until - now) / 700))
        const eased = 0.5 - 0.5 * Math.cos(k * Math.PI)
        arm.current.rotation.y = -0.9 + eased * 1.8
        arm.current.rotation.x = -0.2
        arm.current.rotation.z = -0.35
      } else if (now < latchMimeUntil.current) {
        const k = 1 - (latchMimeUntil.current - now) / LATCH_MIME_MS
        const reach = Math.sin(k * Math.PI)
        arm.current.rotation.x = -0.85 * reach
        arm.current.position.z = 0.32 * reach
        arm.current.rotation.y = 0
        arm.current.rotation.z = -0.25
      } else {
        arm.current.rotation.x *= 0.8
        arm.current.rotation.y *= 0.8
        arm.current.rotation.z *= 0.8
        arm.current.position.z *= 0.8
      }
    }

    // Jump arc / hide crouch height / stair ramp height
    if (isAirborne) {
      const jumpProgress = 1 - (jumpUntil.current - now) / 650
      ref.current.position.y = jumpBaseY.current + Math.sin(jumpProgress * Math.PI) * 1.1
    } else if (playerHidden) {
      const groundY = agentYAt(
        liveLayout,
        ref.current.position.x,
        ref.current.position.z,
        ref.current.position.y,
      )
      ref.current.position.y = groundY + HIDE_CROUCH_Y
    } else {
      ref.current.position.y = agentYAt(
        liveLayout,
        ref.current.position.x,
        ref.current.position.z,
        ref.current.position.y,
      )
    }

    setPlayerPos(
      [
        ref.current.position.x,
        ref.current.position.y,
        ref.current.position.z,
      ],
      ref.current.rotation.y,
    )
  })

  const skillId: SkillId | null = skillAction?.skillId ?? null
  const showSlapArm =
    skillId === 'slap' ||
    (hitFx?.skillId === 'slap' && performance.now() < hitFx.until)
  const shouting = performance.now() < shoutBannerUntil

  return (
    <group
      ref={ref}
      position={[0, 0, 2.4]}
      scale={[1, playerHidden ? 0.55 : 1, 1]}
    >
      {/* Legs */}
      <mesh position={[-0.12, 0.22, 0]} castShadow>
        <capsuleGeometry args={[0.09, 0.28, 4, 8]} />
        <meshStandardMaterial color="#2e5580" />
      </mesh>
      <mesh position={[0.12, 0.22, 0]} castShadow>
        <capsuleGeometry args={[0.09, 0.28, 4, 8]} />
        <meshStandardMaterial color="#2e5580" />
      </mesh>
      <mesh position={[0, 0.5, 0]} castShadow>
        <capsuleGeometry args={[0.28, 0.45, 4, 8]} />
        <meshStandardMaterial color="#3a6ea5" />
      </mesh>
      <mesh position={[0, 1.28, 0]} castShadow>
        <sphereGeometry args={[0.3, 16, 16]} />
        <meshStandardMaterial color="#f0d5b8" />
      </mesh>
      {/* Idle left arm */}
      <mesh position={[-0.38, 0.88, 0.05]} rotation={[0.15, 0, 0.25]} castShadow>
        <capsuleGeometry args={[0.07, 0.32, 4, 8]} />
        <meshStandardMaterial color="#3a6ea5" />
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

      <group ref={arm} position={[0.32, 0.95, 0]}>
        <mesh position={[0, -0.12, 0]} rotation={[0.1, 0, -0.35]} castShadow>
          <capsuleGeometry args={[0.07, 0.34, 4, 8]} />
          <meshStandardMaterial color="#3a6ea5" />
        </mesh>
        {showSlapArm && <HandClapper swing={0.2} />}
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
            {t('shoutLine')}
          </Text>
        </Billboard>
      )}
    </group>
  )
}
