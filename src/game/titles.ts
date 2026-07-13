import { CONFIG } from './config'

export function titleForTime(elapsedSec: number): string {
  let title = CONFIG.titles[0].title
  for (const row of CONFIG.titles) {
    if (elapsedSec >= row.minTime) title = row.title
  }
  return title
}
