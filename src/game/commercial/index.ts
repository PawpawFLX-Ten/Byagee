import { getLang, setLang } from '../i18n'
import { applyCommercialQuery, applyDocumentChrome, parseCommercialQuery, setBrandLang, setCommercialEnabled } from './runtime'

const LANG_STORAGE_KEY = 'civicman.lang'

/**
 * Default the playable build to the dining demo.
 * `?mode=classic` keeps the original survival game.
 * Call once before the first React render.
 */
export function bootCommercial(search?: string): void {
  const query = parseCommercialQuery(search ?? (typeof window !== 'undefined' ? window.location.search : ''))
  if (query.mode === 'classic') {
    setCommercialEnabled(false)
    if (query.lang) setLang(query.lang)
    if (typeof document !== 'undefined') {
      document.body.classList.remove('commercial')
      document.title = 'Civic Man'
    }
    return
  }

  setCommercialEnabled(true)
  applyCommercialQuery(query)

  if (query.lang) {
    setLang(query.lang)
  } else if (!hasStoredLang()) {
    setLang('zh')
  }
  setBrandLang(getLang())
  applyDocumentChrome()
}

function hasStoredLang(): boolean {
  try {
    const stored = localStorage.getItem(LANG_STORAGE_KEY)
    return stored === 'zh' || stored === 'en' || stored === 'nl'
  } catch {
    return false
  }
}
