/**
 * Two string transforms the build-time search index needs but Pagefind does not
 * offer: Cyrillic→Latin transliteration and a light Russian stemmer.
 *
 * Both exist so a query reaches text it does not literally contain —
 * "vozvratnost" finds «Возвратность», «выбросы» finds «выбросам». Neither is a
 * linguistic tool: they feed a ranking ladder where a stem or translit hit must
 * always score below a literal one, so overshooting a stem is a cosmetic miss,
 * never a false top result.
 *
 * ponytail: suffix list, not Snowball's RV/R2 regions — the index is a few
 * hundred entries and one stripped ending is enough to join the inflections
 * users actually type.
 */

const TRANSLIT: Record<string, string> = {
  а: "a",
  б: "b",
  в: "v",
  г: "g",
  д: "d",
  е: "e",
  ё: "e",
  ж: "zh",
  з: "z",
  и: "i",
  й: "y",
  к: "k",
  л: "l",
  м: "m",
  н: "n",
  о: "o",
  п: "p",
  р: "r",
  с: "s",
  т: "t",
  у: "u",
  ф: "f",
  х: "kh",
  ц: "ts",
  ч: "ch",
  ш: "sh",
  щ: "shch",
  ъ: "",
  ы: "y",
  ь: "",
  э: "e",
  ю: "yu",
  я: "ya",
};

/**
 * Cyrillic→Latin, lowercase. Latin letters, digits and punctuation are copied
 * unchanged, so a mixed string ("CRM: когорты") survives and a query already
 * typed in translit passes through as itself — which is what lets one call
 * normalise either side of the comparison.
 */
export function translitRu(s: string): string {
  let out = "";
  for (const ch of s.toLowerCase()) {
    const mapped = TRANSLIT[ch];
    out += mapped === undefined ? ch : mapped;
  }
  return out;
}

/**
 * Inflectional endings, longest first so the *longest* match wins. Adjectival
 * and participial forms are listed in full ("ный", "ских") because stripping
 * only the short tail would leave «когортн», which is not the stem of
 * «когорты». Nominal and verbal tails follow; the single-letter vowels are
 * what reduce «метрика»/«метрики» to «метрик».
 *
 * Notably absent: nothing here strips to fewer than four letters (guarded
 * below), and no ending is a bare consonant, so «анализ» and «когорт» stay put.
 * Three was too short: «могила» and «могут» both collapsed to «мог», «модели»
 * to «мод», so unrelated nouns scored as the same word.
 */
const ENDINGS = [
  "иями",
  "ями",
  "ами",
  "ыми",
  "ими",
  "иях",
  "иям",
  "ием",
  "ого",
  "его",
  "ому",
  "ему",
  "ую",
  "юю",
  "ая",
  "яя",
  "ое",
  "ее",
  "ые",
  "ие",
  "ый",
  "ий",
  "ой",
  "ей",
  "ых",
  "их",
  "ым",
  "им",
  "ом",
  "ем",
  "ный",
  "ная",
  "ное",
  "ные",
  "ных",
  "ным",
  "ными",
  "ного",
  "ному",
  "ский",
  "ская",
  "ское",
  "ские",
  "ских",
  "ским",
  "ться",
  "тся",
  "ать",
  "ять",
  "ить",
  "еть",
  "уть",
  "ала",
  "яла",
  "ила",
  "ела",
  "ыла",
  "али",
  "яли",
  "или",
  "ели",
  "ыли",
  "ает",
  "яет",
  "ают",
  "яют",
  "ует",
  "уют",
  "ов",
  "ев",
  "ам",
  "ям",
  "ах",
  "ях",
  "ия",
  "ии",
  "ию",
  "ишь",
  "ешь",
  "ите",
  "ете",
  "ал",
  "ял",
  "ил",
  "ел",
  "ыл",
  "ат",
  "ят",
  "ут",
  "ют",
  "ит",
  "ла",
  "ло",
  "ли",
  "а",
  "я",
  "ы",
  "и",
  "у",
  "ю",
  "е",
  "о",
].sort((a, b) => b.length - a.length);

const CYRILLIC = /[Ѐ-ӿ]/;

/**
 * Light Russian stemmer: strip at most one ending, and only if the stem keeps
 * at least four letters. Words under five characters and Latin words come back
 * lowercased and otherwise untouched — a three-letter Cyrillic word ("май") has
 * no inflection worth joining, and cutting Latin would mangle English titles.
 *
 * `ё` is folded first, matching `normalize()` in `search-rank.ts`; the fold is
 * length-preserving, so the length guards below still describe the input word.
 */
export function stemRu(word: string): string {
  const w = word.toLowerCase().replace(/ё/g, "е");
  if (w.length < 5 || !CYRILLIC.test(w)) return w;
  for (const ending of ENDINGS) {
    if (w.length - ending.length < 4) continue;
    if (w.endsWith(ending)) return w.slice(0, w.length - ending.length);
  }
  return w;
}
