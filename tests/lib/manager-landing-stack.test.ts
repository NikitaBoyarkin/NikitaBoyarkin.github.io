import { describe, it, expect } from 'bun:test';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// `/manager/` has no stack mosaic.
//
// The defect this binds: all three role landings rendered `StackCard` in the
// hero, so `/manager/` — whose reader came for impact and decisions — met five
// category cards (Анализ / Визуализация / Эксперименты / Удержание / Инфра) and
// an "Все проекты →" exit between the pitch and the first case. The stack is the
// HR reader's screening signal and the colleague reader's toolchain, not a
// manager's question, so the mosaic is now role-gated.
//
// What fails when the claim stops being true:
//   - the condition drops back to an unconditional `<StackCard />`, and every
//     role sees the mosaic again
//   - the gate inverts (`role === 'manager'`), so HR and the colleague lose it
//     and the manager keeps it
//   - `StackCard`'s own link is deleted instead of the whole card being gated —
//     the HR landing would then render chips with no way to the catalogue
//
// The rendered pages are asserted by the build (`tests/built/role-landing.test.ts`).

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8');

describe('manager landing — no stack mosaic', () => {
  it('renders the stack card only outside the manager lane', () => {
    const landing = read('src/components/RoleLanding.astro');
    expect(landing).toContain("import StackCard from './StackCard.astro';");
    expect(landing).toMatch(/\{role !== 'manager' && <StackCard lang=\{lang\} \/>\}/);
    expect(landing).not.toMatch(/^\s*<StackCard lang=\{lang\} \/>\s*$/m);
  });

  it('keeps the catalogue exit on the lanes that still show the stack', () => {
    const card = read('src/components/StackCard.astro');
    expect(card).toMatch(/data-analytics="bento_stack"/);
    expect(card).toMatch(/\{isEn \? 'All projects →' : 'Все проекты →'\}/);
  });
});
