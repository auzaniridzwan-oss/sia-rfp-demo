import type { SiteConfig } from '@sia/ui';
import tokens from './theme/tokens.json';
import { brand } from './brand.config';

const cabin = tokens.palette.cabinClass;

export const site: SiteConfig = {
  entity: brand.entity,
  name: brand.name,
  logo: brand.logo,
  loyaltyName: 'KrisFlyer',
  nav: [
    { label: 'Book', to: '/' },
    { label: 'Manage booking', to: '/manage' },
    { label: 'Preferences', to: '/preferences' },
  ],
  hero: {
    bannerPlacement: 'sq_home_hero',
    slides: [
      { title: 'Discover Perth', subtitle: 'Fly nonstop to Western Australia, up to four times a day.', image: '/images/dest-per.jpg', destination: 'PER' },
      { title: 'Tokyo, in every season', subtitle: 'Nonstop to Narita with award-winning service on board.', image: '/images/dest-nrt.jpg', destination: 'NRT' },
      { title: 'A great way to fly', subtitle: 'Bangkok is just a short hop away, with seven flights a day.', destination: 'BKK' },
    ],
  },
  promo: {
    placement: 'home_row',
    heading: 'Featured for you',
    fallback: [
      { id: 'per', title: 'Perth from SGD 309', body: 'Sun, wine country and the Indian Ocean, under five hours away.', image: '/images/dest-per.jpg', cta: 'Search Perth', destination: 'PER' },
      { id: 'nrt', title: 'Winter in Tokyo', body: 'Lights, onsen and ramen season. Fly nonstop to Narita.', image: '/images/dest-nrt.jpg', cta: 'Search Tokyo', destination: 'NRT' },
      { id: 'bkk', title: 'A long weekend in Bangkok', body: 'Seven nonstop flights a day, and KrisFlyer Elite members choose Forward Zone seats for free.', cta: 'Search Bangkok', destination: 'BKK' },
    ],
  },
  cabins: [
    { value: 'economy', label: 'Economy' },
    { value: 'premium_economy', label: 'Premium Economy' },
    { value: 'business', label: 'Business' },
  ],
  cabinColors: { economy: cabin.economy[3], premium_economy: cabin.premiumEconomy[2], business: cabin.business[2] },
  destinationImages: { PER: '/images/dest-per.jpg', NRT: '/images/dest-nrt.jpg' },
  pricesNote: 'Fares are live Google Flights prices for the cheapest Economy ticket; other fare families, seats and add-ons are priced for this demo.',
  footer: {
    columns: [
      { title: 'About', links: ['Our story', 'Newsroom', 'Sustainability'] },
      { title: 'Group partners', links: ['Scoot', 'Kris+', 'KrisShop', 'Pelago'] },
      { title: 'Where we fly', links: ['Perth', 'Tokyo', 'Bangkok'] },
      { title: 'Support', links: ['Help centre', 'Baggage', 'Contact us'] },
    ],
    legal: 'Demo site for a Braze presentation. Not operated by or affiliated with Singapore Airlines.',
  },
};
