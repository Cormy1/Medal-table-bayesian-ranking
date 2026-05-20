/* ══════════════════════════════════════════════
   theme.js — Dark / light mode toggle
   Shared across all pages
   ══════════════════════════════════════════════ */
(function () {
  const root   = document.documentElement;
  const toggle = document.querySelector('[data-theme-toggle]');

  let theme = root.getAttribute('data-theme') ||
    (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  root.setAttribute('data-theme', theme);

  function setIcon(t) {
    if (!toggle) return;
    toggle.innerHTML = t === 'dark'
      ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>'
      : '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
    toggle.setAttribute('aria-label',
      'Switch to ' + (t === 'dark' ? 'light' : 'dark') + ' mode');
  }

  setIcon(theme);

  if (toggle) {
    toggle.addEventListener('click', () => {
      theme = theme === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-theme', theme);
      setIcon(theme);
      // Notify the dashboard map to swap tile layers
      if (window._map) window._map.fire('themechange');
    });
  }

  window.getTheme = () => theme;
})();