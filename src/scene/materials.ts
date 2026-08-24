import { MeshStandardMaterial } from 'three'

/**
 * Shared material singletons.
 *
 * Every `<meshStandardMaterial color="x" />` JSX element creates its own
 * material instance — identical colors across dozens of meshes waste GPU
 * program switches and memory. These singletons are passed as props
 * (`material={stdMat('#3d2817')}`), which R3F applies as a plain property:
 * the reconciler never owns them, so it never disposes them when a consumer
 * unmounts (verified against @react-three/fiber v9 removeChild — only
 * reconciler-created objects go through disposeOnIdle).
 *
 * Params intentionally mirror JSX defaults so visuals are pixel-identical.
 */
const cache = new Map<string, MeshStandardMaterial>()

export interface StdMatParams {
  metalness?: number
  roughness?: number
  emissive?: string
  emissiveIntensity?: number
}

export function stdMat(color: string, params?: StdMatParams): MeshStandardMaterial {
  const key = params
    ? `${color}|m${params.metalness ?? ''}|r${params.roughness ?? ''}|e${params.emissive ?? ''}|i${params.emissiveIntensity ?? ''}`
    : color
  let mat = cache.get(key)
  if (!mat) {
    mat = new MeshStandardMaterial({ color, ...params })
    cache.set(key, mat)
  }
  return mat
}
