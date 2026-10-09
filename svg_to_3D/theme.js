// Apply the saved theme before first paint, including when storage is unavailable.
try {
  document.documentElement.dataset.theme =
    localStorage.getItem('svg-scenes-theme') ||
    (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
} catch (_) {
  // The default light theme remains usable when storage is unavailable.
}
