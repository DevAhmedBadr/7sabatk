import { getPreferences, resolveLanguage } from './preferences.js';
import { loadPublicSettings } from './data.js';

let settingsPromise;

export async function getSiteLanguage() {
  settingsPromise ||= loadPublicSettings().catch(() => ({}));
  const settings = await settingsPromise;
  const configured = settings?.default_language;
  const language = resolveLanguage(configured === 'ar' || configured === 'en' ? configured : getPreferences().language);
  document.documentElement.lang = language;
  document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
  return language;
}
