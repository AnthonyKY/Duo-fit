import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App.tsx';
import { I18nProvider } from './app/i18n.tsx';

const el = document.getElementById('root');
if (el) createRoot(el).render(<StrictMode><I18nProvider><App /></I18nProvider></StrictMode>);
