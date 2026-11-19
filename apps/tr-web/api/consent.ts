import { handleConsent } from '@sia/server';

export const POST = (request: Request) => handleConsent(request, { entity: 'TR' });
