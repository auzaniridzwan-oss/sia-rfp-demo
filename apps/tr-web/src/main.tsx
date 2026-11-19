import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { applyTheme, type BrandTokens } from '@sia/theme';
import tokens from './theme/tokens.json';
import { App } from './App';
import './index.css';

applyTheme(tokens as BrandTokens);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
