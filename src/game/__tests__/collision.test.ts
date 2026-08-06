import { describe, expect, it } from 'vitest'
import { CHAR_RADIUS, resolveObstaclesCollision, resolveTablesCollision } from '../collision'

describe('resolveTablesCollision', () => {
  it('pushes a point out of the round table AABB/circle', () => {
    const tables = [
      { shape: 'round' as const, position: [-2.2, 0, -1.2] as [number, number, number], half: { x: 1, z: 1 } },
    ]
    const [x, z] = resolveTablesCollision(-2.2, -1.2, tables)
    expect(Math.hypot(x + 2.2, z + 1.2)).toBeGreaterThan(1)
  })

  it('leaves free space unchanged', () => {
    const tables = [
      { shape: 'rect' as const, position: [2.4, 0, -1] as [number, number, number], half: { x: 1.2, z: 0.7 } },
    ]
    const [x, z] = resolveTablesCollision(0, 0, tables)
    expect(x).toBe(0)
    expect(z).toBe(0)
  })
})

describe('resolveObstaclesCollision', () => {
  it('pushes a point out of a pillar AABB', () => {
    const obstacles = [{ min: [-1.5, 0.5] as [number, number], max: [-0.5, 1.5] as [number, number] }]
    const [x, z] = resolveObstaclesCollision(-1.0, 1.0, obstacles)
    expect(x !== -1.0 || z !== 1.0).toBe(true)
  })

  it('leaves free space outside obstacles unchanged', () => {
    const obstacles = [{ min: [-1.5, 0.5] as [number, number], max: [-0.5, 1.5] as [number, number] }]
    const [x, z] = resolveObstaclesCollision(3, 3, obstacles)
    expect(x).toBe(3)
    expect(z).toBe(3)
  })
})
