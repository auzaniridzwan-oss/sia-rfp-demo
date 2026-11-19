/**
 * Writes braze/schema.json from the typed catalog in @sia/core, so the event and attribute
 * dictionary can be reviewed (and pasted into Braze descriptions) without reading code.
 * `--check` fails if the committed file is out of date (run in CI).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import type { ZodTypeAny } from 'zod';
import { EVENT_CATALOG } from '../packages/core/src/braze/events';
import { ALIAS_LABELS, REST_ATTRIBUTES, SDK_ATTRIBUTES } from '../packages/core/src/braze/attributes';

function typeName(t: ZodTypeAny): string {
  const d = t._def as { typeName: string; innerType?: ZodTypeAny; values?: string[]; value?: unknown };
  switch (d.typeName) {
    case 'ZodOptional':
      return `${typeName(d.innerType!)}?`;
    case 'ZodEnum':
      return d.values!.map((v) => JSON.stringify(v)).join(' | ');
    case 'ZodLiteral':
      return JSON.stringify(d.value);
    case 'ZodDate':
      return 'time';
    default:
      return d.typeName.replace('Zod', '').toLowerCase();
  }
}

const events = Object.fromEntries(
  Object.entries(EVENT_CATALOG).map(([name, def]) => [
    name,
    {
      source: def.source,
      description: def.description,
      properties: { entity: '"SQ" | "TR" | "KRISPLUS"', ...Object.fromEntries(Object.entries(def.props.shape).map(([k, v]) => [k, typeName(v as ZodTypeAny)])) },
    },
  ]),
);

const out = `${JSON.stringify({ generatedBy: 'scripts/export-schema.ts', events, attributes: { sdk: SDK_ATTRIBUTES, rest: REST_ATTRIBUTES }, aliasLabels: ALIAS_LABELS }, null, 2)}\n`;
const file = 'braze/schema.json';
if (process.argv.includes('--check')) {
  const current = (() => { try { return readFileSync(file, 'utf8'); } catch { return ''; } })();
  if (current !== out) {
    console.error(`${file} is out of date. Run: pnpm schema:export`);
    process.exit(1);
  }
  console.log(`${file} is up to date`);
} else {
  writeFileSync(file, out);
  console.log(`Wrote ${file} (${Object.keys(events).length} events)`);
}
