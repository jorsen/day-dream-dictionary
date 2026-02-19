/**
 * Global language selector + i18n translation engine.
 *
 * Usage: <script src="language-selector.js"></script>  (before </body>)
 *
 * What it does:
 *   1. Floating globe button (bottom-right) for selecting UI language
 *   2. Loads /i18n/{lang}.json and translates every [data-i18n] element
 *   3. Saves preference to localStorage key 'preferredLanguage'
 *   4. Syncs with backend PATCH /account/preferences when logged in
 *
 * Exposes:
 *   window.t(key, fallback)       → translate a key
 *   window.getPreferredLanguage() → current language code
 *   window._lsSelect(code)        → change language
 *   window._lsToggle()            → toggle dropdown
 */
(function () {
  'use strict';

  const LS_KEY = 'preferredLanguage';

  const LANGUAGES = [
    { code: 'en', flag: '🇺🇸', label: 'English' },
    { code: 'es', flag: '🇪🇸', label: 'Español' },
    { code: 'fr', flag: '🇫🇷', label: 'Français' },
    { code: 'pt', flag: '🇧🇷', label: 'Português' },
    { code: 'de', flag: '🇩🇪', label: 'Deutsch' },
    { code: 'it', flag: '🇮🇹', label: 'Italiano' },
    { code: 'zh', flag: '🇨🇳', label: '中文 (简体)' },
    { code: 'ja', flag: '🇯🇵', label: '日本語' },
    { code: 'ko', flag: '🇰🇷', label: '한국어' },
    { code: 'ar', flag: '🇸🇦', label: 'العربية' },
    { code: 'tl', flag: '🇵🇭', label: 'Filipino' },
    { code: 'th', flag: '🇹🇭', label: 'ภาษาไทย' },
  ];

  /* ── i18n Engine ─────────────────────────────────────────── */

  const _cache  = {};
  let _strings  = {};

  async function _loadStrings(code) {
    if (_cache[code]) { _strings = _cache[code]; return; }
    try {
      const res = await fetch(`/i18n/${code}.json`);
      if (res.ok) {
        _cache[code] = await res.json();
        _strings = _cache[code];
      } else if (code !== 'en') {
        await _loadStrings('en');
      }
    } catch {
      if (code !== 'en') await _loadStrings('en');
    }
  }

  /** Translate a key. Falls back to `fallback`, then the key itself. */
  function t(key, fallback) {
    return _strings[key] || fallback || key;
  }

  function _applyTranslations() {
    // Text content
    document.querySelectorAll('[data-i18n]').forEach(el => {
      el.textContent = t(el.getAttribute('data-i18n'));
    });
    // Placeholder
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
      el.placeholder = t(el.getAttribute('data-i18n-placeholder'));
    });
    // title attribute
    document.querySelectorAll('[data-i18n-title]').forEach(el => {
      el.title = t(el.getAttribute('data-i18n-title'));
    });
    // aria-label
    document.querySelectorAll('[data-i18n-aria]').forEach(el => {
      el.setAttribute('aria-label', t(el.getAttribute('data-i18n-aria')));
    });
    // RTL + html lang
    const code = currentCode();
    document.documentElement.lang = code;
    document.documentElement.dir  = code === 'ar' ? 'rtl' : 'ltr';
    // Fire a custom event so page scripts can re-render translated content
    document.dispatchEvent(new CustomEvent('i18n:applied', { detail: { lang: code } }));
  }

  /* ── Helpers ─────────────────────────────────────────────── */

  function currentCode() {
    return localStorage.getItem(LS_KEY) || 'en';
  }

  function findLang(code) {
    return LANGUAGES.find(l => l.code === code) || LANGUAGES[0];
  }

  function getApiBase() {
    return window.API_CONFIG?.API_BASE_URL || null;
  }

  function getToken() {
    return localStorage.getItem('accessToken') || localStorage.getItem('authToken') || null;
  }

  /* ── Save language preference ─────────────────────────────── */

  function applyLang(code, skipBackend) {
    localStorage.setItem(LS_KEY, code);
    renderBtn(code);
    renderOptions(code);

    // Load translations then apply to DOM
    _loadStrings(code).then(_applyTranslations);

    if (!skipBackend) {
      const token   = getToken();
      const apiBase = getApiBase();
      if (token && apiBase) {
        fetch(`${apiBase}/account/preferences`, {
          method:  'PATCH',
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
          body:    JSON.stringify({ language: code }),
        }).catch(() => {});
      }
    }

    closeDropdown();
  }

  /* ── UI helpers ─────────────────────────────────────────── */

  function renderBtn(code) {
    const lang = findLang(code);
    const btn  = document.getElementById('_ls_btn');
    if (btn) {
      btn.title = lang.label;
      btn.querySelector('._ls_btn_flag').textContent = lang.flag;
    }
  }

  function renderOptions(activeCode) {
    document.querySelectorAll('._ls_option').forEach(btn => {
      btn.classList.toggle('_ls_active', btn.dataset.code === activeCode);
    });
  }

  function openDropdown() {
    const dd = document.getElementById('_ls_dropdown');
    if (dd) dd.classList.add('_ls_open');
  }

  function closeDropdown() {
    const dd = document.getElementById('_ls_dropdown');
    if (dd) dd.classList.remove('_ls_open');
  }

  function toggleDropdown() {
    const dd = document.getElementById('_ls_dropdown');
    if (!dd) return;
    if (dd.classList.contains('_ls_open')) closeDropdown();
    else openDropdown();
  }

  /* ── Inject CSS ─────────────────────────────────────────── */

  function injectStyles() {
    const style = document.createElement('style');
    style.id = '_ls_style';
    style.textContent = `
      /* Floating globe button */
      #_ls_btn {
        position: fixed;
        bottom: 20px;
        right: 20px;
        z-index: 99999;
        width: 44px;
        height: 44px;
        border-radius: 50%;
        background: rgba(10, 10, 20, 0.82);
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
        border: 1px solid rgba(255,255,255,0.14);
        box-shadow: 0 4px 20px rgba(0,0,0,0.35);
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: background 0.15s, transform 0.15s, box-shadow 0.15s;
        padding: 0;
        font-family: inherit;
      }
      #_ls_btn:hover {
        background: rgba(30, 30, 50, 0.92);
        transform: scale(1.08);
        box-shadow: 0 6px 24px rgba(0,0,0,0.45);
      }
      #_ls_btn ._ls_globe {
        font-size: 20px;
        line-height: 1;
        position: absolute;
        opacity: 0.55;
      }
      #_ls_btn ._ls_btn_flag {
        font-size: 14px;
        line-height: 1;
        position: relative;
        z-index: 1;
      }

      /* Dropdown */
      #_ls_dropdown {
        position: fixed;
        bottom: 72px;
        right: 16px;
        background: white;
        border-radius: 14px;
        box-shadow: 0 12px 40px rgba(0,0,0,0.25), 0 0 0 1px rgba(0,0,0,0.06);
        padding: 8px;
        display: none;
        grid-template-columns: 1fr 1fr;
        gap: 2px;
        z-index: 100000;
        min-width: 300px;
        animation: _ls_fadeUp 0.15s ease;
      }
      #_ls_dropdown._ls_open { display: grid; }

      @keyframes _ls_fadeUp {
        from { opacity: 0; transform: translateY(6px); }
        to   { opacity: 1; transform: translateY(0); }
      }

      ._ls_option {
        display: flex;
        align-items: center;
        gap: 9px;
        padding: 9px 12px;
        border-radius: 8px;
        cursor: pointer;
        font-size: 13px;
        font-weight: 500;
        color: #1a1a2e;
        border: none;
        background: none;
        width: 100%;
        text-align: left;
        transition: background 0.12s, color 0.12s;
        font-family: inherit;
        line-height: 1.4;
      }
      ._ls_option:hover { background: #f0effe; color: #6c63ff; }
      ._ls_option._ls_active {
        background: #f0effe;
        color: #6c63ff;
        font-weight: 700;
      }
      ._ls_option ._ls_flag { font-size: 18px; }

      ._ls_dropdown_header {
        grid-column: span 2;
        padding: 6px 12px 8px;
        font-size: 11px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.6px;
        color: #94a3b8;
        border-bottom: 1px solid #f1f5f9;
        margin-bottom: 4px;
      }
    `;
    document.head.appendChild(style);
  }

  /* ── Inject HTML ────────────────────────────────────────── */

  function injectHTML() {
    const optionsHTML = LANGUAGES.map(l =>
      `<button class="_ls_option" data-code="${l.code}" onclick="window._lsSelect('${l.code}')">` +
        `<span class="_ls_flag">${l.flag}</span>` +
        `<span>${l.label}</span>` +
      `</button>`
    ).join('');

    const btn = document.createElement('button');
    btn.id = '_ls_btn';
    btn.setAttribute('aria-label', 'Select language');
    btn.onclick = () => window._lsToggle();
    btn.innerHTML =
      `<span class="_ls_globe">🌐</span>` +
      `<span class="_ls_btn_flag"></span>`;

    const dropdown = document.createElement('div');
    dropdown.id = '_ls_dropdown';
    dropdown.innerHTML =
      `<div class="_ls_dropdown_header">Display Language</div>` +
      optionsHTML;

    document.body.appendChild(btn);
    document.body.appendChild(dropdown);

    // Close when clicking outside
    document.addEventListener('click', function (e) {
      if (!e.target.closest('#_ls_btn') && !e.target.closest('#_ls_dropdown')) {
        closeDropdown();
      }
    });
  }

  /* ── Sync from backend ──────────────────────────────────── */

  function syncFromBackend() {
    const token   = getToken();
    const apiBase = getApiBase();
    if (!token || !apiBase) return;

    fetch(`${apiBase}/account/me`, {
      headers: { 'Authorization': `Bearer ${token}` },
    })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        const lang = data?.user?.preferredLanguage;
        if (lang && lang !== currentCode()) {
          applyLang(lang, true /* skipBackend — already from backend */);
        }
      })
      .catch(() => {});
  }

  /* ── Public API ─────────────────────────────────────────── */

  window._lsSelect          = (code) => applyLang(code);
  window._lsToggle          = toggleDropdown;
  window.getPreferredLanguage = currentCode;
  window.t                  = t;   // expose translation function globally

  /* ── Bootstrap ──────────────────────────────────────────── */

  async function init() {
    injectStyles();
    injectHTML();
    const code = currentCode();
    renderBtn(code);
    renderOptions(code);
    // Load translations and apply immediately
    await _loadStrings(code);
    _applyTranslations();
    syncFromBackend();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
