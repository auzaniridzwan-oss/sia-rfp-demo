import { handleBrazeProfile } from '@sia/server';

export const GET = (request: Request) => handleBrazeProfile(request, { entity: 'TR' });
