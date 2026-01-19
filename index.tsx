
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const rootElement = document.getElementById('root');

if (rootElement) {
  try {
    const root = ReactDOM.createRoot(rootElement);
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
  } catch (error) {
    console.error("Erreur critique au montage:", error);
    rootElement.innerHTML = `
      <div style="padding: 20px; color: red; font-family: sans-serif; text-align: center;">
        <h2>Erreur de chargement</h2>
        <p>L'application n'a pas pu démarrer. Veuillez rafraîchir la page.</p>
      </div>
    `;
  }
}

// Service Worker (optionnel pour le debug)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(err => console.log('SW supporté mais non chargé localement'));
  });
}
