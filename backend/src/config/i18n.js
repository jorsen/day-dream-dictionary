const i18next = require('i18next');
const i18nextMiddleware = require('i18next-http-middleware');
const Backend = require('i18next-fs-backend');
const path = require('path');

// Initialize i18next
i18next
  .use(Backend)
  .use(i18nextMiddleware.LanguageDetector)
  .init({
    backend: {
      loadPath: path.join(__dirname, '../locales/{{lng}}/{{ns}}.json'),
      addPath: path.join(__dirname, '../locales/{{lng}}/{{ns}}.missing.json')
    },
    fallbackLng: 'en',
    preload: ['en', 'es'],
    ns: ['common', 'dreams', 'auth', 'payments', 'errors'],
    defaultNS: 'common',
    detection: {
      order: ['header', 'querystring', 'cookie'],
      caches: ['cookie'],
      lookupHeader: 'accept-language',
      lookupQuerystring: 'lng',
      lookupCookie: 'i18next',
      ignoreCase: true,
      cookieSecure: process.env.NODE_ENV === 'production'
    },
    saveMissing: process.env.NODE_ENV === 'development',
    interpolation: {
      escapeValue: false
    },
    debug: process.env.NODE_ENV === 'development'
  });

// Export middleware
module.exports = {
  i18nMiddleware: i18nextMiddleware.handle(i18next),
  i18next
};