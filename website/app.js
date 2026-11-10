(() => {
  const root = document.documentElement;
  const themeButton = document.getElementById("theme-toggle");
  const installButton = document.getElementById("install-app");
  const installHelp = document.getElementById("install-help");
  const updateButton = document.getElementById("update-app");
  let installPrompt = null;
  let refreshing = false;

  const storage = {
    get(key) {
      try { return window.localStorage.getItem(key); } catch { return null; }
    },
    set(key, value) {
      try { window.localStorage.setItem(key, value); return true; } catch { return false; }
    }
  };

  const savedTheme = storage.get("bbs-theme");
  if (savedTheme === "dark" || savedTheme === "light") root.dataset.theme = savedTheme;

  const updateThemeButton = () => {
    if (!themeButton) return;
    const dark = root.dataset.theme === "dark";
    themeButton.setAttribute("aria-pressed", String(dark));
    themeButton.textContent = dark ? "☀️ Light mode" : "🌙 Dark mode";
  };
  updateThemeButton();

  const readFavorites = () => {
    try {
      const value = JSON.parse(window.localStorage.getItem("bbs-favorites") || "[]");
      return new Set(Array.isArray(value) ? value.filter(item => typeof item === "string") : []);
    } catch {
      return new Set();
    }
  };
  const writeFavorites = favorites => {
    try {
      window.localStorage.setItem("bbs-favorites", JSON.stringify([...favorites]));
      return true;
    } catch {
      return false;
    }
  };
  const favorites = readFavorites();
  document.querySelectorAll("[data-favorite-book]").forEach(button => {
    const bookId = button.dataset.favoriteBook;
    if (!bookId) return;
    const render = () => {
      const saved = favorites.has(bookId);
      button.setAttribute("aria-pressed", String(saved));
      button.textContent = saved ? "♥ Saved to favorites" : "♡ Save to favorites";
    };
    render();
    button.addEventListener("click", () => {
      if (favorites.has(bookId)) favorites.delete(bookId);
      else favorites.add(bookId);
      const saved = writeFavorites(favorites);
      render();
      if (!saved) button.setAttribute("title", "Your browser did not allow favorites to be saved.");
    });
  });

  themeButton?.addEventListener("click", () => {
    const next = root.dataset.theme === "dark" ? "light" : "dark";
    root.dataset.theme = next;
    storage.set("bbs-theme", next);
    updateThemeButton();
  });

  const standalone = window.matchMedia?.("(display-mode: standalone)").matches || window.navigator.standalone === true;
  if (standalone && installButton) installButton.hidden = true;

  window.addEventListener("beforeinstallprompt", event => {
    event.preventDefault();
    installPrompt = event;
    if (installButton && !standalone) installButton.hidden = false;
  });

  installButton?.addEventListener("click", async () => {
    if (!installPrompt) return;
    const promptEvent = installPrompt;
    installPrompt = null;
    installButton.hidden = true;
    await promptEvent.prompt();
    const choice = await promptEvent.userChoice;
    if (installHelp) {
      installHelp.textContent = choice?.outcome === "accepted"
        ? "Thanks for installing Brandon Books & Stories."
        : "You can install Brandon Books & Stories later from your browser menu.";
    }
  });

  window.addEventListener("appinstalled", () => {
    if (installButton) installButton.hidden = true;
    if (installHelp) installHelp.textContent = "Brandon Books & Stories is installed on this device.";
  });

  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const isSafari = /safari/i.test(navigator.userAgent) && !/crios|fxios|edgios|opios/i.test(navigator.userAgent);
  if (isIOS && isSafari && !standalone && installHelp) {
    installHelp.textContent = "To install: tap Share in Safari, then choose Add to Home Screen.";
  }

  if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost")) {
    window.addEventListener("load", async () => {
      try {
        const registration = await navigator.serviceWorker.register("./sw.js");
        const showUpdate = () => {
          if (registration.waiting && navigator.serviceWorker.controller && updateButton) {
            updateButton.hidden = false;
          }
        };
        showUpdate();
        registration.addEventListener("updatefound", () => {
          const installing = registration.installing;
          if (!installing) return;
          installing.addEventListener("statechange", () => {
            if (installing.state === "installed") showUpdate();
          });
        });
        updateButton?.addEventListener("click", () => {
          if (!registration.waiting) return;
          updateButton.disabled = true;
          updateButton.textContent = "Updating…";
          registration.waiting.postMessage({ type: "SKIP_WAITING" });
        });
        navigator.serviceWorker.addEventListener("controllerchange", () => {
          if (refreshing) return;
          refreshing = true;
          window.location.reload();
        });
        registration.update().catch(() => {});
      } catch (error) {
        console.warn("App offline support could not be registered.", error);
      }
    });
  }
})();