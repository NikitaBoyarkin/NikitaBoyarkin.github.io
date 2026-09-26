/* demo-theme.js — theme bootstrap for the standalone demo pages.
 *
 * Loaded BLOCKING in <head>, before the stylesheet, so `data-theme` is set
 * before the first paint. There is no first-frame flash even on a cold load
 * with the theme already stored.
 *
 * The three themes and the localStorage key are the site's, not a demo
 * invention: Base.astro stores `'theme'` as `'dark' | 'light' | 'cyberpunk'`
 * through a single `applyTheme()` funnel. The demos are same-origin iframes
 * (and same-origin standalone pages), so this file mirrors that contract
 * rather than inventing a parallel one.
 *
 * How the demos stay in sync with the site's toggle:
 *   • Embedded in an article — the parent page writes localStorage['theme'],
 *     which fires a `storage` event in this browsing context. That is the whole
 *     mechanism; no postMessage infrastructure is needed in src/.
 *   • Standalone in another tab — the same `storage` event, same path.
 *   • Nothing stored yet (the user has never touched the toggle) — the parent
 *     page and this frame both follow the OS independently via matchMedia, so
 *     they agree without talking to each other. The guard mirrors Base.astro:
 *     an OS change is only honoured while no theme has been persisted.
 *   • The `message` listener is for a future parent-side broadcast. It is
 *     origin-guarded and currently unused; it exists so that adding a broadcast
 *     later needs no change to any demo.
 */
(function () {
  'use strict';

  var THEMES = ['dark', 'light', 'cyberpunk'];
  var KEY = 'theme';

  var html = document.documentElement;
  var themeColorMeta = document.querySelector('meta[name="theme-color"]');
  var THEME_COLORS = { dark: '#0f2a2b', light: '#f4efca', cyberpunk: '#0a0a12' };

  function stored() {
    try {
      var value = localStorage.getItem(KEY);
      return THEMES.indexOf(value) !== -1 ? value : null;
    } catch (e) {
      // localStorage can be unavailable (private mode, blocked storage).
      return null;
    }
  }

  function osTheme() {
    try {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    } catch (e) {
      return 'dark';
    }
  }

  var current = stored() || osTheme();

  function apply(theme, notify) {
    if (THEMES.indexOf(theme) === -1) return;
    var changed = theme !== current;
    current = theme;
    html.setAttribute('data-theme', theme);
    if (themeColorMeta) {
      themeColorMeta.setAttribute('content', THEME_COLORS[theme] || THEME_COLORS.dark);
    }
    // Canvas-rendered demos (bayesian) cannot recolour through CSS, so they
    // repaint on this event. DOM demos colour through `.dv-*` / data-attribute
    // rules and need no listener at all.
    if (notify && changed) {
      document.dispatchEvent(new CustomEvent('demo:themechange', { detail: { theme: theme } }));
    }
  }

  apply(current, false);

  // Another tab (or the parent article) changed the theme.
  window.addEventListener('storage', function (event) {
    if (event.key !== KEY) return;
    apply(event.newValue || osTheme(), true);
  });

  // Follow the OS only while nothing has been persisted — the same guard
  // Base.astro uses, so parent and demo cannot disagree about which wins.
  try {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function (event) {
      if (stored()) return;
      apply(event.matches ? 'dark' : 'light', true);
    });
  } catch (e) {
    // Older engines without addEventListener on MediaQueryList: the initial
    // read above already picked the right theme, only live OS changes are lost.
  }

  // Reserved for a future broadcast from the parent page. Origin-guarded: only
  // this origin may drive the theme, so an embedding third-party page cannot.
  window.addEventListener('message', function (event) {
    if (event.origin !== window.location.origin) return;
    var data = event.data;
    if (!data || data.type !== 'demo:theme') return;
    apply(data.theme, true);
  });

  /* Read the resolved values of the dataviz tokens, for the demos that paint
   * into a canvas and cannot lean on CSS.
   *
   * getComputedStyle().getPropertyValue() returns the SPECIFIED TEXT of a custom
   * property, not a resolved colour — and it does not resolve a nested var()
   * either. So `--dv-cat-1: #4ecdc4` comes back as the usable string '#4ecdc4',
   * while a token holding `var(--x)` would come back unparsable. That is the
   * contract the --dv-* block in demo.css documents and its test enforces.
   *
   *   var C = demoTokens(['--dv-good', '--dv-bad']);
   *   ctx.strokeStyle = C['--dv-good'];
   */
  window.demoTokens = function (names) {
    var computed = getComputedStyle(html);
    var out = {};
    for (var i = 0; i < names.length; i++) {
      out[names[i]] = computed.getPropertyValue(names[i]).trim();
    }
    return out;
  };

  /* True when the theme changed *after* load, so a canvas demo can skip the
   * first draw twice. */
  window.demoTheme = function () {
    return current;
  };
})();
