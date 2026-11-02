import { dishById, type Dish } from '../game/commercial/dishes'
import { boxGeo, cylinderGeo, sphereGeo } from './geometries'
import { stdMat } from './materials'

/** Low-poly dish. Shape comes from the catalog, so a new dish only needs data. */
export function DishMesh({ dish, scale = 1 }: { dish: Dish; scale?: number }) {
  return (
    <group scale={scale}>
      {dish.shape === 'bowl' && (
        <>
          <mesh position={[0, 0.04, 0]} material={stdMat(dish.accent)} geometry={cylinderGeo(0.11, 0.08, 0.07, 12)} />
          <mesh position={[0, 0.08, 0]} material={stdMat(dish.color)} geometry={sphereGeo(0.06, 10, 8)} />
        </>
      )}
      {dish.shape === 'plate' && (
        <>
          <mesh position={[0, 0.015, 0]} material={stdMat(dish.accent)} geometry={cylinderGeo(0.13, 0.13, 0.02, 14)} />
          <mesh position={[-0.03, 0.04, 0]} material={stdMat(dish.color)} geometry={sphereGeo(0.035, 8, 8)} />
          <mesh position={[0.035, 0.045, 0.02]} material={stdMat(dish.color)} geometry={sphereGeo(0.03, 8, 8)} />
        </>
      )}
      {dish.shape === 'cup' && (
        <>
          <mesh position={[0, 0.06, 0]} material={stdMat(dish.accent)} geometry={cylinderGeo(0.045, 0.05, 0.1, 10)} />
          <mesh position={[0, 0.11, 0]} material={stdMat(dish.color)} geometry={cylinderGeo(0.04, 0.04, 0.02, 10)} />
        </>
      )}
      {dish.shape === 'dumpling' && (
        <>
          <mesh position={[-0.05, 0.04, 0]} rotation={[0, 0, 0.4]} material={stdMat(dish.color)} geometry={sphereGeo(0.035, 8, 6)} />
          <mesh position={[0, 0.045, 0.02]} rotation={[0.2, 0, -0.2]} material={stdMat(dish.accent)} geometry={sphereGeo(0.038, 8, 6)} />
          <mesh position={[0.05, 0.04, -0.01]} material={stdMat(dish.color)} geometry={sphereGeo(0.032, 8, 6)} />
        </>
      )}
      {dish.shape === 'box' && (
        <>
          <mesh position={[0, 0.04, 0]} material={stdMat(dish.accent)} geometry={boxGeo(0.12, 0.05, 0.1)} />
          <mesh position={[0, 0.08, 0]} material={stdMat(dish.color)} geometry={sphereGeo(0.04, 8, 8)} />
        </>
      )}
    </group>
  )
}

export function DishMeshById({ id, scale = 1 }: { id: string; scale?: number }) {
  const dish = dishById(id)
  if (!dish) return null
  return <DishMesh dish={dish} scale={scale} />
}
