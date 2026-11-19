import { useBanner } from '@sia/react';
import { useEffect, useState } from 'react';
import { useSite } from '../site';

/**
 * Home hero. A Braze Banner (placement `{entity}_home_hero`) takes over the slot when one
 * is live for this user; until then the static carousel shows.
 */
export function HeroCarousel({ onPick }: { onPick?: (destination: string) => void }) {
  const site = useSite();
  const { ref, hasBanner } = useBanner(site.hero.bannerPlacement);
  const slides = site.hero.slides;
  const [i, setI] = useState(0);

  useEffect(() => {
    if (hasBanner || slides.length < 2) return;
    const t = setInterval(() => setI((n) => (n + 1) % slides.length), 7000);
    return () => clearInterval(t);
  }, [hasBanner, slides.length]);

  const slide = slides[i];
  return (
    <section className="relative isolate overflow-hidden bg-heading text-white" aria-roledescription="carousel">
      <div ref={ref} className={hasBanner ? 'min-h-[360px] w-full' : 'hidden'} data-braze-placement={site.hero.bannerPlacement} />
      {!hasBanner && slide && (
        <div className="relative min-h-[360px] sm:min-h-[420px]">
          {slides.map((s, n) =>
            s.image ? (
              <img
                key={s.title}
                src={s.image}
                alt=""
                className={`absolute inset-0 -z-10 h-full w-full object-cover transition-opacity duration-700 ${n === i ? 'opacity-100' : 'opacity-0'}`}
              />
            ) : null,
          )}
          <div className="absolute inset-0 -z-10 bg-gradient-to-r from-black/70 via-black/40 to-transparent" />
          <div className="mx-auto max-w-6xl px-4 pb-28 pt-14 sm:pt-20">
            <p className="label text-accent">{site.name}</p>
            <h1 className="mt-2 max-w-xl font-display text-4xl leading-tight sm:text-5xl">{slide.title}</h1>
            <p className="mt-3 max-w-lg text-lg opacity-90">{slide.subtitle}</p>
            {slide.destination && onPick && (
              <button className="btn-primary mt-6" onClick={() => onPick(slide.destination!)}>
                Find flights
              </button>
            )}
          </div>
          {slides.length > 1 && (
            <div className="absolute bottom-24 left-1/2 flex -translate-x-1/2 gap-2">
              {slides.map((s, n) => (
                <button
                  key={s.title}
                  aria-label={`Slide ${n + 1}`}
                  aria-current={n === i}
                  onClick={() => setI(n)}
                  className={`h-2 rounded-full transition-all ${n === i ? 'w-6 bg-accent' : 'w-2 bg-white/60'}`}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
