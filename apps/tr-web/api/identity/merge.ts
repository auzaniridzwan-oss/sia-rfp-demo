import { handleMerge } from '@sia/server';

export const POST = (request: Request) => handleMerge(request, { entity: 'TR' });
