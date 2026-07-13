import { CONFIG } from './config'
import { t } from './i18n'

export function titleForTime(elapsedSec: number): string {
  let minTime = 0
  for (const row of CONFIG.titles) {
    if (elapsedSec >= row.minTime) minTime = row.minTime
  }
  return t(`title_${minTime}`)
}
