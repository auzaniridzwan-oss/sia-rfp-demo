import { aircraftMatches, eligibleAncillaries, FARE_FAMILIES, fareFamily, farePrice, type CabinClass, type SavedBooking } from '@sia/core';
import { ANCILLARIES } from '@sia/data';
import { useBraze, usePageView, useSia, useTrack } from '@sia/react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { cityName, hhmm, longDate, sgd, useLoyalty, useSavedBookings } from '../lib';
import { syncBooking } from '../booking/api';
import { useSite } from '../site';

const NEXT_CABIN: Partial<Record<CabinClass, CabinClass>> = { economy: 'premium_economy', premium_economy: 'business' };

/** Manage Booking: check-in, post-booking add-ons and upgrades (mySQupgrade / ScootPlus bid). */
export function ManagePage() {
  usePageView('manage');
  const site = useSite();
  const { bookings } = useSavedBookings();
  const [pnr, setPnr] = useState<string | null>(bookings[0]?.pnr ?? null);
  const b = bookings.find((x) => x.pnr === pnr);

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="font-display text-4xl text-heading">Manage booking</h1>
      {bookings.length === 0 ? (
        <p className="mt-4 text-muted">
          No {site.name} bookings in this browser yet. <Link to="/" className="text-link underline">Book a flight</Link>.
        </p>
      ) : (
        <>
          <div className="mt-6 flex flex-wrap gap-2">
            {bookings.map((x) => (
              <button key={x.pnr} onClick={() => setPnr(x.pnr)} className={`rounded-button border px-4 py-2 text-sm ${x.pnr === pnr ? 'border-cta bg-cta text-cta-text' : 'border-border'}`}>
                {x.pnr} · {x.search.from}–{x.search.to}
              </button>
            ))}
          </div>
          {b && <BookingDetail key={b.pnr} booking={b} />}
        </>
      )}
    </div>
  );
}

function BookingDetail({ booking }: { booking: SavedBooking }) {
  const site = useSite();
  const { entity } = useSia();
  const braze = useBraze();
  const track = useTrack();
  const loyalty = useLoyalty();
  const { save } = useSavedBookings();
  const [b, setB] = useState(booking);
  const [message, setMessage] = useState<string | null>(null);
  const pax = b.passengers.length;

  const update = (next: SavedBooking, action: 'checkin' | 'upgrade' | null) => {
    setB(next);
    save(next);
    if (action) void syncBooking(braze, next, action);
  };

  const checkIn = () => {
    track('sia_checkin_completed', { pnr: b.pnr });
    update({ ...b, checkinStatus: 'completed' }, 'checkin');
    setMessage('You are checked in. Boarding passes will be sent before departure.');
  };

  // ---- upgrade offer
  const it = b.outbound.itinerary;
  let upgrade: { to: CabinClass; label: string; type: 'mysqupgrade' | 'scootplus_bid'; amount: number } | null = null;
  if (entity === 'SQ' && NEXT_CABIN[b.outbound.cabin]) {
    const to = NEXT_CABIN[b.outbound.cabin]!;
    const target = FARE_FAMILIES.SQ.find((f) => f.cabin === to)!;
    const diff = farePrice(it.basePriceSgd ?? 0, target) - b.outbound.priceSgd;
    upgrade = { to, label: `mySQupgrade to ${target.name.replace(' Standard', '')}`, type: 'mysqupgrade', amount: Math.max(50, Math.round(diff * 0.6)) * pax };
  } else if (entity === 'TR' && b.outbound.cabin === 'economy' && aircraftMatches(it, ['787'])) {
    const target = FARE_FAMILIES.TR.find((f) => f.cabin === 'scootplus')!;
    const diff = farePrice(it.basePriceSgd ?? 0, target) - b.outbound.priceSgd;
    upgrade = { to: 'scootplus', label: 'Bid for ScootPlus', type: 'scootplus_bid', amount: Math.max(40, Math.round(diff * 0.45)) * pax };
  }

  const requestUpgrade = () => {
    if (!upgrade) return;
    track('sia_upgrade_requested', { pnr: b.pnr, upgrade_type: upgrade.type, from_cabin: b.outbound.cabin, to_cabin: upgrade.to, amount: upgrade.amount });
    if (upgrade.type === 'mysqupgrade') {
      const fam = FARE_FAMILIES.SQ.find((f) => f.cabin === upgrade!.to)!;
      update({ ...b, outbound: { ...b.outbound, cabin: fam.cabin, fareFamily: fam.code }, totalSgd: b.totalSgd + upgrade.amount }, 'upgrade');
      setMessage(`Upgrade confirmed: you're now in ${fam.name.replace(' Standard', '')}.`);
    } else {
      setMessage(`Bid of ${sgd(upgrade.amount)} placed. We'll let you know 48 hours before departure.`);
    }
  };

  // ---- post-booking add-ons
  const addons = eligibleAncillaries(ANCILLARIES[entity], { stage: 'manage', cabin: b.outbound.cabin, itinerary: it, hasKrisflyer: loyalty.hasKrisflyer }).filter(
    (x) => x.eligible && !x.product.infoOnly && x.product.priceSgd !== null && !['seat', 'upgrade'].includes(x.product.category) && !b.ancillaries[x.product.code],
  );
  const addAncillary = (code: string, price: number) => {
    const p = addons.find((x) => x.product.code === code)!.product;
    track('sia_selected_ancillary', { product_code: code, category: p.category, timing: p.timing, price: price * pax, loyalty_discount_applied: false });
    update({ ...b, ancillaries: { ...b.ancillaries, [code]: { qty: pax, priceSgd: price } }, totalSgd: b.totalSgd + price * pax }, null);
    setMessage(`${p.name} added.`);
  };

  return (
    <div className="mt-6 space-y-6">
      {message && (
        <p role="status" className="rounded-input bg-accent-soft px-4 py-3 text-sm">
          {message}
        </p>
      )}
      <section className="rounded-card border border-border bg-surface p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-display text-2xl text-heading">
            {cityName(b.search.from)} → {cityName(b.search.to)}
          </h2>
          <span className="text-sm text-muted">
            {pax} passenger{pax > 1 ? 's' : ''} · {fareFamily(entity, b.outbound.fareFamily)?.name}
          </span>
        </div>
        {[b.outbound, b.inbound].filter(Boolean).map((f) => (
          <p key={f!.direction} className="mt-2 text-sm">
            <span className="label text-muted">{f!.direction === 'outbound' ? 'Depart ' : 'Return '}</span>
            {longDate(f!.itinerary.legs[0]!.from.time)} · {f!.itinerary.legs.map((l) => l.flightNumber).join(' + ')} · {hhmm(f!.itinerary.legs[0]!.from.time)} → {hhmm(f!.itinerary.legs.at(-1)!.to.time)}
          </p>
        ))}
        <div className="mt-5 flex flex-wrap gap-3">
          {b.checkinStatus === 'completed' ? (
            <span className="rounded-button bg-success/10 px-4 py-2 text-sm font-semibold text-success">Checked in</span>
          ) : (
            <button className="btn-primary" onClick={checkIn}>
              Check in
            </button>
          )}
        </div>
        <p className="mt-2 text-xs text-muted">Online check-in normally opens 48 hours before departure; it's always open in this demo.</p>
      </section>

      {upgrade && (
        <section className="rounded-card border border-border bg-surface p-6">
          <p className="label text-muted">Upgrade</p>
          <h2 className="font-display text-2xl text-heading">{upgrade.label}</h2>
          <p className="mt-1 text-sm text-muted">
            {upgrade.type === 'mysqupgrade' ? 'Instant cash upgrade, confirmed immediately.' : 'Place a bid for a ScootPlus seat on your 787 flight.'}
          </p>
          <button className="btn-primary mt-4" onClick={requestUpgrade}>
            {upgrade.type === 'mysqupgrade' ? `Upgrade for ${sgd(upgrade.amount)}` : `Bid ${sgd(upgrade.amount)}`}
          </button>
        </section>
      )}

      {addons.length > 0 && (
        <section className="rounded-card border border-border bg-surface p-6">
          <h2 className="font-display text-2xl text-heading">Add to your trip</h2>
          <ul className="mt-4 divide-y divide-border">
            {addons.map(({ product: p }) => (
              <li key={p.code} className="flex flex-wrap items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{p.name}</p>
                  <p className="text-sm text-muted">{p.description}</p>
                </div>
                <button className="btn-secondary px-4 py-2 text-sm" onClick={() => addAncillary(p.code, p.priceSgd ?? 0)}>
                  {p.priceSgd ? `Add · ${sgd(p.priceSgd)}` : 'Add · Free'}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
      {site.pricesNote && <p className="text-xs text-muted">{site.pricesNote}</p>}
    </div>
  );
}
