import { handleHealth } from '@sia/server';

export const GET = (request: Request) => handleHealth(request, { entity: 'SQ' });
