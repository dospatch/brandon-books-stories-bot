(() => {
  const count = document.getElementById("favorite-count");
  const clear = document.getElementById("clear-favorites");
  const status = document.getElementById("favorites-status");

  const readFavorites = () => {
    try {
      const value = JSON.parse(window.localStorage.getItem("bbs-favorites") || "[]");
      return Array.isArray(value) ? value.filter(item => typeof item === "string") : [];
    } catch {
      return [];
    }
  };

  const renderCount = () => {
    const total = readFavorites().length;
    if (count) count.textContent = total === 1 ? "1 saved book" : total + " saved books";
  };

  renderCount();

  clear?.addEventListener("click", () => {
    const current = readFavorites();
    if (!current.length) {
      if (status) status.textContent = "There are no saved favorites to clear.";
      return;
    }
    if (!window.confirm("Clear all Brandon Books & Stories favorites saved on this device?")) return;
    try {
      window.localStorage.removeItem("bbs-favorites");
      if (status) status.textContent = "Your favorites were cleared from this device.";
    } catch {
      if (status) status.textContent = "This browser did not allow favorites to be cleared.";
    }
    renderCount();
  });
})();