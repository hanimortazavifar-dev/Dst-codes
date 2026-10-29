// Links from the previous hash-routed version (/#/corporate-governance) map to clean URLs.
// Imported first in main.tsx: the router reads the address as soon as App.tsx is evaluated.
if (location.hash.startsWith("#/")) {
  history.replaceState(null, "", import.meta.env.BASE_URL.replace(/\/$/, "") + location.hash.slice(1));
}
