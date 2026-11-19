import type { SiteConfig } from '@sia/ui';
import { brand } from './brand.config';

export const site: SiteConfig = {
  entity: brand.entity,
  name: brand.name,
  logo: brand.logo,
  loyaltyName: 'KrisFlyer',
  nav: [
    { label: 'Book', to: '/' },
    { label: 'Manage booking', to: '/manage' },
  ],
  hero: {
    bannerPlacement: 'tr_home_hero',
    slides: [
      { title: 'Tokyo: lights, ramen, repeat', subtitle: 'Get outta here to Narita from Changi, every day.', image: '/images/dest-nrt.jpg', destination: 'NRT' },
      { title: 'Perth? Sun’s out, Scoot’s out', subtitle: 'Nonstop to Western Australia on the 787.', destination: 'PER' },
      { title: 'Bangkok for the weekend', subtitle: 'Six flights a day. Pack light, go often.', destination: 'BKK' },
    ],
  },
  promo: {
    placement: 'home_row',
    heading: 'Deals worth packing for',
    fallback: [
      { id: 'nrt', title: 'Tokyo from SGD 317', body: 'Fly Scoot to Narita and spend the savings on sushi.', image: '/images/dest-nrt.jpg', cta: 'Search Tokyo', destination: 'NRT' },
      { id: 'per', title: 'Perth from SGD 179', body: 'Beaches, wineries and quokkas, five hours away.', cta: 'Search Perth', destination: 'PER' },
      { id: 'bkk', title: 'Bangkok from SGD 147', body: 'Street food, rooftop bars and six flights a day.', cta: 'Search Bangkok', destination: 'BKK' },
    ],
  },
  cabins: [
    { value: 'economy', label: 'Economy' },
    { value: 'scootplus', label: 'ScootPlus' },
  ],
  destinationImages: { NRT: '/images/dest-nrt.jpg' },
  pricesNote:
    'Fares are live Google Flights prices for the cheapest Economy ticket. Scoot does not publish add-on prices, so ScootPlus, bundles and add-ons use illustrative demo prices (see the Scoot Fees Chart for real fees).',
  footer: {
    columns: [
      { title: 'About Scoot', links: ['Who we are', 'Newsroom', 'Careers'] },
      { title: 'Group partners', links: ['Singapore Airlines', 'Kris+', 'KrisShop', 'Pelago'] },
      { title: 'Where we fly', links: ['Perth', 'Tokyo', 'Bangkok'] },
      { title: 'Help', links: ['FAQs', 'Baggage', 'Contact us'] },
    ],
    legal: 'Demo site for a Braze presentation. Not operated by or affiliated with Scoot.',
  },
};
