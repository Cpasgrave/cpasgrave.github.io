(() => {
  'use strict';

  const link = document.querySelector('.games-return');
  if (!link) return;

  link.addEventListener('click', event => {
    if (event.defaultPrevented || event.button !== 0 ||
        event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

    // Back restores the catalogue's scroll position when it is the preceding entry.
    // In a fresh tab or with a different predecessor, the link opens the game's card.
    const navigation = window.navigation;
    if (!navigation?.canGoBack) return;
    const previous = navigation.entries()[navigation.currentEntry.index - 1]?.url;
    if (!previous) return;

    const from = new URL(previous);
    const catalogue = new URL(link.href);
    if (from.origin !== catalogue.origin ||
        (from.pathname !== catalogue.pathname && from.pathname !== new URL('./', catalogue).pathname)) return;

    event.preventDefault();
    window.history.back();
  });
})();
