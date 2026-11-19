/**
 * Shared Tailwind preset. Every utility points at a semantic CSS variable, so the
 * same component markup renders as SQ or Scoot depending on which tokens.json the
 * app injects at startup (see applyTheme in ./src/index.ts).
 * @type {import('tailwindcss').Config}
 */
export default {
  content: [],
  theme: {
    extend: {
      colors: {
        page: 'var(--color-page-bg)',
        surface: 'var(--color-surface)',
        'surface-alt': 'var(--color-surface-alt)',
        heading: 'var(--color-heading)',
        body: 'var(--color-text)',
        muted: 'var(--color-text-muted)',
        link: 'var(--color-link)',
        border: 'var(--color-border)',
        accent: 'var(--color-accent)',
        'accent-soft': 'var(--color-accent-soft)',
        cta: {
          DEFAULT: 'var(--color-cta-bg)',
          hover: 'var(--color-cta-bg-hover)',
          text: 'var(--color-cta-text)',
        },
        'cta-secondary': {
          DEFAULT: 'var(--color-cta-secondary)',
          hover: 'var(--color-cta-secondary-hover)',
        },
        success: 'var(--color-success)',
        warning: 'var(--color-warning)',
        error: 'var(--color-error)',
      },
      fontFamily: {
        display: 'var(--font-display)',
        body: 'var(--font-body)',
      },
      borderRadius: {
        input: 'var(--radius-input)',
        card: 'var(--radius-card)',
        button: 'var(--radius-button)',
        pill: 'var(--radius-pill)',
      },
      letterSpacing: {
        label: 'var(--label-tracking)',
      },
    },
  },
};
