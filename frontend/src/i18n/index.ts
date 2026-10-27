import i18next, { type i18n as I18nInstance } from 'i18next';
import { de } from './de';

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'translation';
    resources: { translation: typeof de };
  }
}

export function createI18n(resources: object = de, language = 'de'): I18nInstance {
  const instance = i18next.createInstance();
  void instance.init({
    lng: language,
    fallbackLng: false,
    resources: { [language]: { translation: resources } },
    defaultNS: 'translation',
    interpolation: { escapeValue: false },
    initAsync: false,
  });
  return instance;
}

export const i18n = createI18n();
