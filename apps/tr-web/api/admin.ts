import { handleAdmin } from '@sia/server';

export const POST = (request: Request) => handleAdmin(request, { entity: 'TR' });
