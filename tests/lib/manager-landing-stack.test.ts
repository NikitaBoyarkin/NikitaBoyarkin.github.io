import { describe, it, expect } from 'bun:test';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// `/hire/`'s three bodies share one hero, and the stack mosaic sits in it on the
// HR lane only.
//
// The defect this binds: all three role landings rendered `StackCard` in the
// hero, so `/manager/` — whose reader came for impact and decisions — met five
// category cards (Анализ / Визуализация / Эксперименты / Удержание / Инфра) and
// an "Все проекты →" exit between the pitch and the first case. The stack is the
// HR reader's screening signal, not a manager's question, so the mosaic became
// role-gated. On 2026-11-16 the colleague lane dropped it too — that reader now
// gets section cards that lead to the stack on `/about`, so HR is the last lane
// that asks for it.
//
// What fails when the claim stops being true:
//   - the condition drops back to an unconditional `<StackCard />`, and every
//     role sees the mosaic again
//   - the gate widens or inverts (`role !== 'manager'`, `role === 'manager'`), so
//     a lane loses the mosaic or one that never asked for it regains it
//   - `StackCard`'s own link is deleted instead of the whole card being gated —
//     the HR landing would then render chips with no way to the catalogue
//
// The rendered pages are asserted by the build (`tests/built/role-landing.test.ts`).

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8');

describe('hiring lanes — stack mosaic only on HR', () => {
  it('renders the stack card only in the HR lane', () => {
    const landing = read('src/components/RoleLanding.astro');
    expect(landing).toContain("import StackCard from './StackCard.astro';");
    expect(landing).toMatch(/\{role === 'hr' && <StackCard lang=\{lang\} \/>\}/);
    expect(landing).not.toMatch(/^\s*<StackCard lang=\{lang\} \/>\s*$/m);
    expect(landing).not.toMatch(/role !== 'manager'/);
  });

  it('keeps the catalogue exit on the lane that still shows the stack', () => {
    const card = read('src/components/StackCard.astro');
    expect(card).toMatch(/data-analytics="bento_stack"/);
    expect(card).toMatch(/\{isEn \? 'All projects →' : 'Все проекты →'\}/);
  });
});
