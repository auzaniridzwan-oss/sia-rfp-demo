import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { applyTheme, type BrandTokens } from '@sia/theme';
import { BrazeProvider } from '@sia/react';
import { SiteProvider, siteRoutes } from '@sia/ui';
import tokens from './theme/tokens.json';
import { brand } from './brand.config';
import { site } from './site.config';
import './index.css';

applyTheme(tokens as BrandTokens);
const queryClient = new QueryClient();
const router = createBrowserRouter(siteRoutes);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrazeProvider config={{ entity: brand.entity, apiKey: brand.braze.sdkKey, baseUrl: brand.braze.sdkUrl }}>
        <SiteProvider config={site}>
          <RouterProvider router={router} />
        </SiteProvider>
      </BrazeProvider>
    </QueryClientProvider>
  </StrictMode>,
);
