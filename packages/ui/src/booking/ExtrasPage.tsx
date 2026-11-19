import { distanceBand, eligibleAncillaries, quoteBaggage, type AncillaryProduct } from '@sia/core';
import { ANCILLARIES } from '@sia/data';
import { useBooking, usePageView, useTrackOnMount, useSia, useTrack } from '@sia/react';
import { useNavigate } from 'react-router-dom';
import { hoursUntil, sgd, useLoyalty } from '../lib';
import { useSite } from '../site';
import { BookingLayout, StepActions } from './BookingLayout';

/** Seats have their own step; upgrades are Manage Booking only. */
const HIDDEN_HERE = new Set(['seat', 'upgrade']);
const BAG_OPTIONS = [0, 5, 10, 20, 30];

export function ExtrasPage() {
  usePageView('extras');
  const site = useSite();
  const { entity } = useSia();
  const track = useTrack();
  const navigate = useNavigate();
  const loyalty = useLoyalty();
  const s = useBooking((x) => x);

  useTrackOnMount('sia_booking_step_viewed', s.search ? { step: 'ancillaries', destination_code: s.search.to } : null);

  if (!s.search || !s.outbound) return <BookingLayout requires="passengers">{null}</BookingLayout>;
  const pax = s.passengers.length || s.search.paxCount;
  const band = distanceBand(s.search.from, s.search.to);
  const items = eligibleAncillaries(ANCILLARIES[entity], { stage: 'booking', cabin: s.outbound.cabin, itinerary: s.outbound.itinerary, hasKrisflyer: loyalty.hasKrisflyer }).filter(
    (x) => !HIDDEN_HERE.has(x.product.category),
  );

  const toggle = (p: AncillaryProduct, on: boolean, unitPrice: number, qty = pax) => {
    s.setAncillary(p.code, on ? qty : 0, unitPrice);
    if (on) track('sia_selected_ancillary', { product_code: p.code, category: p.category, timing: p.timing, price: unitPrice * qty, loyalty_discount_applied: false });
  };

  const bagQuote = (kg: number) => quoteBaggage({ entity, kg, band, hoursToDeparture: hoursUntil(s.search!), tier: loyalty.tier });

  return (
    <BookingLayout requires="passengers">
      <h1 className="font-display text-3xl text-heading">Add extras</h1>
      {entity === 'SQ' && loyalty.tier && (
        <p className="mt-2 rounded-input bg-surface-alt px-3 py-2 text-sm">
          {site.loyaltyName} <strong>{loyalty.tier}</strong> pricing applied from your profile.
        </p>
      )}
      <div className="mt-6 grid gap-4">
        {items.map(({ product: p, eligible, reason }) => {
          if (!eligible) {
            return p.infoOnly || p.requiresKrisflyer ? (
              <div key={p.code} className="rounded-card border border-dashed border-border p-4 text-sm text-muted">
                <span className="font-semibold">{p.name}</span> — {reason}
              </div>
            ) : null;
          }
          if (p.category === 'baggage') {
            const chosen = s.baggageKg;
            return (
              <div key={p.code} className="rounded-card border border-border bg-surface p-5">
                <h2 className="font-semibold text-heading">{p.name}</h2>
                <p className="text-sm text-muted">{p.description}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {BAG_OPTIONS.map((kg) => {
                    const q = bagQuote(kg);
                    return (
                      <button
                        key={kg}
                        onClick={() => {
                          s.setBaggage(kg, q.priceSgd);
                          if (kg > 0) track('sia_selected_ancillary', { product_code: p.code, category: 'baggage', timing: p.timing, price: q.priceSgd, loyalty_discount_applied: Boolean(loyalty.tier) });
                        }}
                        className={`rounded-button border px-3 py-2 text-sm ${chosen === kg ? 'border-cta bg-cta text-cta-text' : 'border-border'}`}
                      >
                        {kg === 0 ? 'None' : `+${kg}kg · ${sgd(q.priceSgd)}`}
                        {kg > 0 && q.priceSgd < q.listPriceSgd && <span className="ml-1 text-xs line-through opacity-60">{sgd(q.listPriceSgd)}</span>}
                      </button>
                    );
                  })}
                </div>
                {chosen > 0 && <p className="mt-2 text-xs text-muted">{bagQuote(chosen).reason}</p>}
              </div>
            );
          }
          if (p.infoOnly) {
            return (
              <div key={p.code} className="rounded-card border border-border bg-surface-alt p-4 text-sm">
                <span className="font-semibold text-heading">{p.name}</span> — {p.description}
              </div>
            );
          }
          const price = p.priceSgd ?? 0;
          const on = Boolean(s.ancillaries[p.code]);
          return (
            <label key={p.code} className={`flex cursor-pointer items-start gap-4 rounded-card border bg-surface p-5 ${on ? 'border-cta' : 'border-border'}`}>
              <input type="checkbox" className="mt-1 h-5 w-5 accent-[var(--color-cta-bg)]" checked={on} onChange={(e) => toggle(p, e.target.checked, price)} />
              <span className="flex-1">
                <span className="block font-semibold text-heading">{p.name}</span>
                <span className="block text-sm text-muted">{p.description}</span>
                {p.timing === 'booking_only' && <span className="label mt-1 block text-[10px] text-warning">Only available now</span>}
              </span>
              <span className="text-right font-semibold">{price === 0 ? 'Free' : `${sgd(price)}${pax > 1 ? ' pp' : ''}`}</span>
            </label>
          );
        })}
      </div>
      <StepActions back={() => navigate('/booking/passengers')} next={() => navigate('/booking/seats')} nextLabel="Continue to seats" />
    </BookingLayout>
  );
}
