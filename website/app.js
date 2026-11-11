(() => {
  if (!("serviceWorker" in navigator)) return;
  if (location.protocol !== "https:" && location.hostname !== "localhost") return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js", {scope:"/"})
      .catch(error => console.warn("Offline support could not be enabled.", error));
  });
})();
