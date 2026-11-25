import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Recover once if a lazy-loaded chunk fails after a new Vercel deployment
if (typeof window !== 'undefined') {
  window.addEventListener('vite:preloadError', () => {
    try {
      const key = 'fariousy_preload_reloaded';
      if (!sessionStorage.getItem(key)) {
        sessionStorage.setItem(key, '1');
        window.location.reload();
      }
    } catch {
      // ignore storage errors
    }
  });
}

// Actively unregister any legacy Service Workers & wipe stale Workbox caches on both Web (Vercel) and Capacitor Android APK
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .getRegistrations()
      .then(regs => Promise.all(regs.map(r => r.unregister())))
      .catch(() => {});
    if ('caches' in window) {
      caches
        .keys()
        .then(keys => Promise.all(keys.map(k => caches.delete(k))))
        .catch(() => {});
    }
  });
}

const rootEl = document.getElementById('root');
if (rootEl) {
  createRoot(rootEl).render(<App />);
  (window as any).__FARIOUSY_BOOTED__ = true;
}
