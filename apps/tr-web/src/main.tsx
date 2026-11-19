import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { applyTheme, type BrandTokens } from '@sia/theme';
import { BrazeProvider } from '@sia/react';
import { BrazeDebug } from '@sia/ui';
import tokens from './theme/tokens.json';
import { brand } from './brand.config';
import { App } from './App';
import './index.css';

applyTheme(tokens as BrandTokens);
const queryClient = new QueryClient();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrazeProvider config={{ entity: brand.entity, apiKey: brand.braze.sdkKey, baseUrl: brand.braze.sdkUrl }}>
        <App />
        <BrazeDebug />
      </BrazeProvider>
    </QueryClientProvider>
  </StrictMode>,
);
