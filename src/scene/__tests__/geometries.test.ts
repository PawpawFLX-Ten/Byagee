import { describe, expect, it } from 'vitest'
import { boxGeo, capsuleGeo, cylinderGeo, sphereGeo } from '../geometries'

describe('geometry cache', () => {
  it('returns the same instance for identical args', () => {
    expect(boxGeo(1, 2, 3)).toBe(boxGeo(1, 2, 3))
    expect(sphereGeo(0.34, 18, 18)).toBe(sphereGeo(0.34, 18, 18))
    expect(cylinderGeo(0.08, 0.1, 1.1, 8)).toBe(cylinderGeo(0.08, 0.1, 1.1, 8))
    expect(capsuleGeo(0.24, 0.35, 4, 8)).toBe(capsuleGeo(0.24, 0.35, 4, 8))
  })

  it('returns distinct instances for different args', () => {
    expect(boxGeo(1, 2, 3)).not.toBe(boxGeo(1, 2, 4))
    expect(sphereGeo(0.34, 18, 18)).not.toBe(sphereGeo(0.35, 18, 18))
  })

  it('sphere partial-sphere variants do not collide with full spheres', () => {
    const full = sphereGeo(0.15, 14, 10)
    const dome = sphereGeo(0.15, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2)
    expect(full).not.toBe(dome)
    expect(dome).toBe(sphereGeo(0.15, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2))
  })
})
