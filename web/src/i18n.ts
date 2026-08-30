import { i18n } from "@lingui/core"
import type { LocaleCode } from "./preferences"

export async function activateLocale(locale: LocaleCode): Promise<void> {
  const { messages } = await import(`./locales/${locale}/messages.mjs`)
  i18n.load(locale, messages)
  i18n.activate(locale)
  document.documentElement.lang = locale
}

export { i18n }
