(() => {
  const root = document.documentElement;
  const themeButton = document.getElementById("theme-toggle");
  const installButton = document.getElementById("install-app");
  const installHelp = document.getElementById("install-help");
  let installPrompt = null;

  const savedTheme = localStorage.getItem("bbs-theme");
  if (savedTheme === "dark" || savedTheme === "light") {
    root.dataset.theme = savedTheme;
  }

  const updateThemeButton = () => {
    if (!themeButton) return;
    const dark = root.dataset.theme === "dark";
    themeButton.setAttribute("aria-pressed", String(dark));
    themeButton.textContent = dark ? "☀️ Light mode" : "🌙 Dark mode";
  };
  updateThemeButton();

  themeButton?.addEventListener("click", () => {
    const next = root.dataset.theme === "dark" ? "light" : "dark";
    root.dataset.theme = next;
    localStorage.setItem("bbs-theme", next);
    updateThemeButton();
  });

  window.addEventListener("beforeinstallprompt", event => {
    event.preventDefault();
    installPrompt = event;
    if (installButton) installButton.hidden = false;
  });

  installButton?.addEventListener("click", async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    await installPrompt.userChoice;
    installPrompt = null;
    installButton.hidden = true;
  });

  window.addEventListener("appinstalled", () => {
    if (installButton) installButton.hidden = true;
    if (installHelp) installHelp.textContent = "Brandon Books & Stories is installed on this device.";
  });

  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  if (isIOS && installHelp) {
    installHelp.textContent = "On iPhone or iPad: open the Share menu in Safari, then choose Add to Home Screen.";
  }

  if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost")) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./sw.js").catch(error => {
        console.warn("App offline support could not be registered.", error);
      });
    });
  }
})();