import { useContentCards } from '@sia/react';
import { useEffect } from 'react';
import { useSite, type PromoCard } from '../site';

interface CardView extends PromoCard {
  fromBraze: boolean;
  url?: string;
}

/**
 * One row of promotional cards. Braze Content Cards tagged with this site's entity and the
 * `home_row` placement replace the static fallback cards as soon as any arrive.
 */
export function PromoCards({ onPick }: { onPick: (destination: string) => void }) {
  const site = useSite();
  const { cards, logImpressions, logClick } = useContentCards(site.promo.placement);

  const brazeCards: CardView[] = cards.slice(0, 3).map((c) => {
    const x = (c.extras ?? {}) as Record<string, string>;
    const anyCard = c as unknown as { title?: string; description?: string; imageUrl?: string; linkText?: string; url?: string };
    return {
      id: c.id ?? anyCard.title ?? 'card',
      title: anyCard.title ?? '',
      body: anyCard.description ?? '',
      image: anyCard.imageUrl,
      cta: anyCard.linkText || 'Find out more',
      destination: x.destination,
      url: anyCard.url,
      fromBraze: true,
    };
  });
  const view: CardView[] = brazeCards.length ? brazeCards : site.promo.fallback.map((f) => ({ ...f, fromBraze: false }));

  useEffect(() => {
    if (cards.length) logImpressions(cards.slice(0, 3));
  }, [cards, logImpressions]);

  return (
    <section className="mx-auto max-w-6xl px-4 pt-14">
      <h2 className="font-display text-3xl text-heading">{site.promo.heading}</h2>
      <div className="mt-6 grid gap-6 md:grid-cols-3">
        {view.map((card, n) => (
          <article key={card.id} className="flex flex-col overflow-hidden rounded-card border border-border bg-surface shadow-sm">
            {card.image ? (
              <img src={card.image} alt="" className="h-44 w-full object-cover" loading="lazy" />
            ) : (
              <div className="h-44 w-full bg-gradient-to-br from-heading via-cta-secondary to-accent" />
            )}
            <div className="flex flex-1 flex-col p-5">
              {card.fromBraze && <span className="label mb-1 text-[10px] text-muted">For you</span>}
              <h3 className="font-display text-xl text-heading">{card.title}</h3>
              <p className="mt-2 flex-1 text-sm text-muted">{card.body}</p>
              <button
                className="mt-4 self-start font-semibold text-link hover:underline"
                onClick={() => {
                  if (card.fromBraze && cards[n]) logClick(cards[n]);
                  if (card.destination) onPick(card.destination);
                  else if (card.url) window.location.assign(card.url);
                }}
              >
                {card.cta} →
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
