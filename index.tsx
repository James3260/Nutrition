
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// Débugger visuel : Si une erreur survient au chargement, on l'affiche
window.onerror = function(message, source, lineno, colno, error) {
  const root = document.getElementById('root');
  if (root) {
    root.innerHTML = `
      <div style="padding: 20px; color: #b91c1c; background: #fef2f2; border: 2px solid #fee2e2; border-radius: 12px; margin: 20px; font-family: monospace;">
        <h1 style="font-size: 18px; font-weight: bold;">Erreur de chargement</h1>
        <p style="font-size: 14px;">${message}</p>
        <pre style="font-size: 10px; opacity: 0.7;">${error?.stack || ''}</pre>
        <button onclick="window.location.reload()" style="margin-top: 10px; padding: 8px 16px; background: #b91c1c; color: white; border: none; border-radius: 6px; cursor: pointer;">Réessayer</button>
      </div>
    `;
  }
  return false;
};

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Impossible de trouver l'élément root");
}

try {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );

  // Register Service Worker
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch(err => console.error('SW error:', err));
    });
  }
} catch (error: any) {
  rootElement.innerHTML = `<div style="color: red; padding: 20px;">Erreur de rendu: ${error.message}</div>`;
}
