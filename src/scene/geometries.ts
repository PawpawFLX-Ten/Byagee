import {
  BoxGeometry,
  CapsuleGeometry,
  CircleGeometry,
  ConeGeometry,
  CylinderGeometry,
  PlaneGeometry,
  RingGeometry,
  SphereGeometry,
  type BufferGeometry,
} from 'three'

/**
 * Shared geometry singletons, mirroring materials.ts.
 *
 * Repeated fixed-size meshes (NPC body parts, food, door frames, cabinets)
 * each owned their own GPU buffer; these factories hand out one instance
 * per unique args tuple instead. Passed as props (`geometry={boxGeo(...)}`)
 * they are plain property assignments R3F never disposes (same verified
 * removeChild semantics as shared materials).
 *
 * Args are copied verbatim into cache keys, so rendering is pixel-identical
 * to inline `<xGeometry args={...} />`.
 */
const cache = new Map<string, BufferGeometry>()

function cached<T extends BufferGeometry>(key: string, make: () => T): T {
  let geo = cache.get(key)
  if (!geo) {
    geo = make()
    cache.set(key, geo)
  }
  return geo as T
}

export function boxGeo(w: number, h: number, d: number): BoxGeometry {
  return cached(`b:${w}:${h}:${d}`, () => new BoxGeometry(w, h, d))
}

export function sphereGeo(
  radius: number,
  widthSegs = 16,
  heightSegs = 12,
  phiStart?: number,
  phiLength?: number,
  thetaStart?: number,
  thetaLength?: number,
): SphereGeometry {
  const key = `s:${radius}:${widthSegs}:${heightSegs}:${phiStart}:${phiLength}:${thetaStart}:${thetaLength}`
  return cached(key, () =>
    new SphereGeometry(radius, widthSegs, heightSegs, phiStart ?? 0, phiLength ?? Math.PI * 2, thetaStart ?? 0, thetaLength ?? Math.PI),
  )
}

export function cylinderGeo(
  radiusTop: number,
  radiusBottom: number,
  height: number,
  segs = 16,
): CylinderGeometry {
  return cached(`c:${radiusTop}:${radiusBottom}:${height}:${segs}`, () =>
    new CylinderGeometry(radiusTop, radiusBottom, height, segs),
  )
}

export function capsuleGeo(radius: number, length: number, capSegs = 4, radSegs = 8): CapsuleGeometry {
  return cached(`k:${radius}:${length}:${capSegs}:${radSegs}`, () =>
    new CapsuleGeometry(radius, length, capSegs, radSegs),
  )
}

export function planeGeo(w: number, h: number): PlaneGeometry {
  return cached(`p:${w}:${h}`, () => new PlaneGeometry(w, h))
}

export function ringGeo(inner: number, outer: number, segs = 24): RingGeometry {
  return cached(`r:${inner}:${outer}:${segs}`, () => new RingGeometry(inner, outer, segs))
}

export function circleGeo(radius: number, segs = 16): CircleGeometry {
  return cached(`o:${radius}:${segs}`, () => new CircleGeometry(radius, segs))
}

export function coneGeo(radius: number, height: number, segs = 16): ConeGeometry {
  return cached(`n:${radius}:${height}:${segs}`, () => new ConeGeometry(radius, height, segs))
}
