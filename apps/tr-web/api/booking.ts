import { handleBooking } from '@sia/server';

export const POST = (request: Request) => handleBooking(request, { entity: 'TR' });
