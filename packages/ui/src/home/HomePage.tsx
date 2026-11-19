import { usePageView } from '@sia/react';
import { useRef, useState } from 'react';
import { HeroCarousel } from './HeroCarousel';
import { PromoCards } from './PromoCards';
import { SearchWidget } from './SearchWidget';

export function HomePage() {
  usePageView('home');
  const [preset, setPreset] = useState<string>();
  const widget = useRef<HTMLDivElement>(null);
  const pick = (code: string) => {
    setPreset(code);
    widget.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };
  return (
    <>
      <HeroCarousel onPick={pick} />
      <div ref={widget} className="relative z-10 mx-auto -mt-20 max-w-6xl px-4">
        <SearchWidget presetDestination={preset} />
      </div>
      <PromoCards onPick={pick} />
    </>
  );
}
