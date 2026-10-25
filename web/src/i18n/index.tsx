import {
  createContext, useCallback, useContext, useMemo, useState,
  type ReactNode,
} from 'react'
import { de, type TranslationKey } from './de'
import { en } from './en'

export type Language = 'de' | 'en'

const STORAGE_KEY = 'wichtel.language'

const dictionaries: Record<Language, Record<TranslationKey, string>> = { de, en }

function detectLanguage(): Language {
  try {
    const stored = sessionStorage.getItem(STORAGE_KEY)
    if (stored === 'de' || stored === 'en') return stored
  } catch {
    // sessionStorage unavailable (private mode etc.) — fall through to detection
  }
  return navigator.language.toLowerCase().startsWith('de') ? 'de' : 'en'
}

interface LanguageContextValue {
  lang: Language
  setLang: (lang: Language) => void
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string
  locale: string
}

const LanguageContext = createContext<LanguageContextValue | null>(null)

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Language>(detectLanguage)

  const setLang = useCallback((next: Language) => {
    setLangState(next)
    try {
      sessionStorage.setItem(STORAGE_KEY, next)
    } catch {
      // best effort — language applies for this session anyway
    }
  }, [])

  const t = useCallback(
    (key: TranslationKey, vars?: Record<string, string | number>) => {
      let text = dictionaries[lang][key] ?? key
      if (vars) {
        for (const [name, value] of Object.entries(vars)) {
          text = text.split(`{${name}}`).join(String(value))
        }
      }
      return text
    },
    [lang],
  )

  const value = useMemo<LanguageContextValue>(
    () => ({ lang, setLang, t, locale: lang === 'de' ? 'de-DE' : 'en-US' }),
    [lang, setLang, t],
  )

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

export function useT() {
  const ctx = useContext(LanguageContext)
  if (!ctx) throw new Error('useT must be used inside <LanguageProvider>')
  return ctx
}
