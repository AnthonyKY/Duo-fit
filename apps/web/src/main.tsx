import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App.tsx';
import { I18nProvider } from './app/i18n.tsx';
import './features/notifications/push.ts'; // keeps this device's notifications in step with the account

const el = document.getElementById('root');
if (el) createRoot(el).render(<StrictMode><I18nProvider><App /></I18nProvider></StrictMode>);
// the service worker only shows notifications (no offline copy, no request interception)
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => { /* not available: no notifications */ });
