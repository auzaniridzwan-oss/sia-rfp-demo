import { FlightSearchResponse, type FlightSearchQuery } from '../schemas/flights';

/**
 * Browser client for the site's own /api/flights proxy. The SerpAPI key never reaches the
 * browser; the proxy picks the airline from the site it is deployed with.
 */
export async function searchFlights(query: FlightSearchQuery, signal?: AbortSignal): Promise<FlightSearchResponse> {
  const params = new URLSearchParams(query);
  const res = await fetch(`/api/flights?${params}`, { signal });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const msg = (body as { error?: string } | null)?.error ?? `HTTP ${res.status}`;
    throw new Error(`Flight search failed: ${msg}`);
  }
  return FlightSearchResponse.parse(body);
}
