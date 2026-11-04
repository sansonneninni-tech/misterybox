// Avvio: nella versione online carica prima l'API simulata nel browser.
if (window.location.hostname.endsWith('netlify.app') || new URLSearchParams(location.search).has('demo') || window.ATELIER_FORCE_DEMO) {
  const { demoApi } = await import('./demo/api.js');
  window.ATELIER_DEMO_API = await demoApi();
}
await import('./app.js');
