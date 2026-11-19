import { handleFlights } from '@sia/server';

export const GET = (request: Request) => handleFlights(request, { entity: 'TR' });
