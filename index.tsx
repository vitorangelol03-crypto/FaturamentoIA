import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// PWA: Detectar e mostrar prompt de instalação
let deferredPrompt: any = null;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  console.log('💡 PWA pode ser instalado!');
  // Aqui você poderia disparar um estado global para mostrar um botão "Instalar" na UI
});

window.addEventListener('appinstalled', () => {
  console.log('✅ PWA instalado com sucesso!');
  deferredPrompt = null;
});

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);