import { create } from 'zustand'

/**
 * Touch input store — parallel to the keyboard `keys` Set in World.tsx.
 * Desktop pipeline is untouched; Player.useFrame reads both sources.
 */
interface InputState {
  /** Normalized movement vector from virtual joystick, range [-1, 1] */
  moveX: number
  moveY: number
  /** Whether the touch joystick is currently active */
  touchActive: boolean
  setMove: (x: number, y: number) => void
  reset: () => void
}

export const useInputStore = create<InputState>((set) => ({
  moveX: 0,
  moveY: 0,
  touchActive: false,
  setMove: (x, y) => set({ moveX: x, moveY: y, touchActive: x !== 0 || y !== 0 }),
  reset: () => set({ moveX: 0, moveY: 0, touchActive: false }),
}))
