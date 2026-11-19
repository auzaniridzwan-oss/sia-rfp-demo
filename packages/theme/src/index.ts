/** Semantic brand tokens. Values come from the brand-asset Drive folder (see docs/BUILD_PLAN.md §2a). */
export interface BrandTokens {
  brand: string;
  entity: 'SQ' | 'TR';
  source: string;
  color: {
    pageBg: string;
    surface: string;
    surfaceAlt: string;
    heading: string;
    text: string;
    textMuted: string;
    link: string;
    border: string;
    accent: string;
    accentSoft: string;
    ctaBg: string;
    ctaBgHover: string;
    ctaText: string;
    ctaSecondary: string;
    ctaSecondaryHover: string;
    success: string;
    warning: string;
    error: string;
  };
  font: { display: string; body: string };
  radius: { input: string; card: string; button: string; pill: string };
  label: { uppercase: boolean; tracking: string };
  /** Brand-only raw palettes (e.g. SQ cabin-class and KrisFlyer colours). */
  palette?: Record<string, Record<string, string | string[]>>;
}

const kebab = (s: string) => s.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);

/** Map tokens to the CSS variables the Tailwind preset reads. */
export function cssVariables(tokens: BrandTokens): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const [k, v] of Object.entries(tokens.color)) vars[`--color-${kebab(k)}`] = v;
  vars['--font-display'] = tokens.font.display;
  vars['--font-body'] = tokens.font.body;
  for (const [k, v] of Object.entries(tokens.radius)) vars[`--radius-${k}`] = v;
  vars['--label-tracking'] = tokens.label.tracking;
  vars['--label-transform'] = tokens.label.uppercase ? 'uppercase' : 'none';
  return vars;
}

/** Apply a brand's tokens to :root. Call once in main.tsx before rendering. */
export function applyTheme(tokens: BrandTokens, root: HTMLElement = document.documentElement): void {
  for (const [k, v] of Object.entries(cssVariables(tokens))) root.style.setProperty(k, v);
  root.dataset.entity = tokens.entity;
}
