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

export async function applySiteHeader(language) {
  settingsPromise ||= loadPublicSettings().catch(() => ({}));
  const settings = await settingsPromise;
  const suffix = language === 'ar' ? 'ar' : 'en';
  const defaults = language === 'ar'
    ? { brand: 'موقع حساباتك', home: 'الرئيسية', accounts: 'الحسابات', social: 'خدمات السوشيال ميديا', subscriptions: 'الاشتراكات', support: 'الدعم الفني', notifications: 'الإشعارات', settings: 'الإعدادات', login: 'تسجيل الدخول', account: 'حسابي' }
    : { brand: '7sabatk', home: 'Home', accounts: 'Accounts', social: 'Social services', subscriptions: 'Subscriptions', support: 'Support', notifications: 'Notifications', settings: 'Settings', login: 'Sign in', account: 'My account' };
  const links = { home: 'index.html', accounts: 'accounts.html', social: 'social-services.html', subscriptions: 'subscriptions.html', support: 'support.html' };
  document.querySelectorAll('.brand span, .brand [data-brand-name]').forEach((brand) => {
    brand.textContent = settings[`header_brand_${suffix}`] || defaults.brand;
  });
  for (const [key, href] of Object.entries(links)) {
    const link = document.querySelector(`.nav-links a[href="${href}"]`);
    if (link) link.textContent = settings[`header_${key}_${suffix}`] || defaults[key];
  }
  const notificationLabel = settings[`header_notifications_${suffix}`] || defaults.notifications;
  const notificationButton = document.querySelector('#supportNotificationToggle');
  if (notificationButton) {
    const label = notificationButton.querySelector('span:not([aria-hidden])');
    if (label) label.textContent = notificationLabel;
    notificationButton.setAttribute('aria-label', notificationLabel);
  }
  const settingsLabel = settings[`header_settings_${suffix}`] || defaults.settings;
  const settingsButton = document.querySelector('#settingsOpen');
  if (settingsButton) { settingsButton.title = settingsLabel; settingsButton.setAttribute('aria-label', settingsLabel); }
  const loginButton = document.querySelector('#authOpen');
  if (loginButton) loginButton.textContent = settings[`header_login_${suffix}`] || defaults.login;
  const accountButton = document.querySelector('#accountOpen');
  if (accountButton) accountButton.setAttribute('aria-label', settings[`header_account_${suffix}`] || defaults.account);
}
