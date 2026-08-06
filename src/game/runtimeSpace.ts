import { CONFIG } from './config'
import type { FoodSpot, TableDef } from './types'

export type RuntimeSpaceState = {
  tables: TableDef[]
  seatPositions: [number, number, number][]
  foodSpots: FoodSpot[]
  maxNpcs: number
}

export function createRuntimeSpaceFromConfig(): RuntimeSpaceState {
  return {
    tables: CONFIG.tables.map((t) => ({ ...t, half: { ...t.half } })),
    seatPositions: CONFIG.seatPositions.map((s) => [...s] as [number, number, number]),
    foodSpots: CONFIG.foodSpots.map((f) => ({
      ...f,
      plate: [...f.plate] as [number, number, number],
      approach: [...f.approach] as [number, number, number],
    })),
    maxNpcs: CONFIG.door.maxNpcs,
  }
}

let runtime: RuntimeSpaceState = createRuntimeSpaceFromConfig()

export function getRuntimeSpace(): RuntimeSpaceState {
  return runtime
}

export function setRuntimeSpace(next: RuntimeSpaceState): void {
  runtime = next
}

export function resetRuntimeSpace(): void {
  runtime = createRuntimeSpaceFromConfig()
}
