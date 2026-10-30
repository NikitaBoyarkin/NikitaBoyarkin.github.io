/**
 * `[[slug]]` / `[[slug|label]]` → link, as a Sätteri mdast plugin.
 *
 * Obsidian-style syntax so a note can be linked from the sentence that needs
 * it, not only from a `related:` list at the bottom. An unresolvable or
 * ambiguous target throws: a typo must break the build instead of rendering as
 * literal brackets nobody notices.
 *
 * Pure (filesystem in, plain objects out) — no Astro imports — so the resolver
 * is unit-testable without a build, mirroring `glossary-linker.ts`.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { GlossaryLinkerContext, GlossaryReplacement } from "./glossary-linker";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CONTENT = path.resolve(HERE, "..", "content");

export interface WikilinkTarget {
  kind: "project" | "post" | "glossary" | "part" | "library";
  slug: string;
  path: string;
}

export interface WikilinkRegistry {
  /** `${slug}` → every target carrying that slug (across kinds and locales). */
  bySlug: Map<string, WikilinkTarget[]>;
}

const DIRS: { kind: WikilinkTarget["kind"]; dir: string; segment: string; collection: string }[] = [
  { kind: "post", dir: "posts", segment: "posts", collection: "posts" },
  { kind: "post", dir: "posts-en", segment: "en/posts", collection: "posts-en" },
  { kind: "project", dir: "projects", segment: "projects", collection: "projects" },
  { kind: "project", dir: "projects-en", segment: "en/projects", collection: "projects-en" },
  { kind: "glossary", dir: "glossary", segment: "glossary", collection: "glossary" },
  { kind: "glossary", dir: "glossary-en", segment: "en/glossary", collection: "glossary-en" },
  { kind: "part", dir: "volta-parts", segment: "projects/volta", collection: "volta-parts" },
  {
    kind: "part",
    dir: "volta-parts-en",
    segment: "en/projects/volta",
    collection: "volta-parts-en",
  },
  { kind: "library", dir: "library", segment: "library", collection: "library" },
  { kind: "library", dir: "library-en", segment: "en/library", collection: "library-en" },
];

export function buildWikilinkRegistry(contentRoot: string = CONTENT): WikilinkRegistry {
  const bySlug = new Map<string, WikilinkTarget[]>();
  for (const { kind, dir, segment } of DIRS) {
    const full = path.join(contentRoot, dir);
    let files: string[];
    try {
      files = fs.readdirSync(full);
    } catch {
      continue;
    }
    for (const file of files) {
      if (!/\.mdx?$/.test(file) || file.startsWith("_")) continue;
      const slug = file.replace(/\.mdx?$/, "");
      const target: WikilinkTarget = { kind, slug, path: `/${segment}/${slug}/` };
      const bucket = bySlug.get(slug);
      if (bucket) bucket.push(target);
      else bySlug.set(slug, [target]);
    }
  }
  return { bySlug };
}

export interface WikilinkResolution {
  target: WikilinkTarget;
  error?: undefined;
}

export interface WikilinkFailure {
  target?: undefined;
  error: string;
}

const isEnPath = (file: string): boolean =>
  /\/(?:posts-en|projects-en|glossary-en|volta-parts-en|library-en)\//.test(
    file.split(path.sep).join("/"),
  );

/**
 * Locale-first, then RU. A slug that names two different kinds is rejected
 * rather than guessed — `[[funnel]]` must not silently pick a project over a
 * glossary term.
 */
export function resolveWikilink(
  registry: WikilinkRegistry,
  slug: string,
  opts: { enSource?: boolean } = {},
): WikilinkResolution | WikilinkFailure {
  const candidates = registry.bySlug.get(slug);
  if (!candidates || candidates.length === 0) {
    return { error: `[[${slug}]] — no note with this slug` };
  }
  const kinds = new Set(candidates.map((c) => c.kind));
  if (kinds.size > 1) {
    const found = [...kinds].join(", ");
    return { error: `[[${slug}]] is ambiguous: ${found}. Use an explicit path link instead.` };
  }
  const wantedPrefix = opts.enSource ? "/en/" : "/";
  return { target: candidates.find((c) => c.path.startsWith(wantedPrefix)) ?? candidates[0] };
}

const WIKILINK = /\[\[([^\]|]+?)(?:\|([^\]]+?))?\]\]/;

export interface WikilinkPlugin {
  name: string;
  text?(node: { type: string; value: string }, ctx: GlossaryLinkerContext): void;
}

export interface WikilinkPluginFactoryContext {
  readonly fileURL: URL | undefined;
}

export type WikilinkPluginFactory = (ctx: WikilinkPluginFactoryContext) => WikilinkPlugin | false;

export interface WikilinkOptions {
  registry?: WikilinkRegistry;
}

/** Wired into `astro.config.mjs` next to `katexMath` and `glossaryLinker`. */
export function wikilinks(options: WikilinkOptions = {}): WikilinkPluginFactory {
  return (ctx) => {
    const fileURL = ctx.fileURL;
    if (!fileURL) return false;

    let file: string;
    try {
      file = fileURLToPath(fileURL).split(path.sep).join("/");
    } catch {
      return false;
    }
    if (!file.includes("/src/content/")) return false;
    if (!file.endsWith(".md") && !file.endsWith(".mdx")) return false;

    const registry = options.registry ?? buildWikilinkRegistry();
    const enSource = isEnPath(file);

    return {
      name: "wikilinks",
      text(node, context) {
        const parentType = context.parent(node)?.type;
        if (parentType === "heading" || parentType === "link" || parentType === "code") return;

        const value = node.value;
        if (!value || !value.includes("[[")) return;

        const match = WIKILINK.exec(value);
        if (!match) return;

        const slug = match[1].trim();
        const label = (match[2] ?? match[1]).trim();
        const resolution = resolveWikilink(registry, slug, { enSource });
        if (resolution.error || !resolution.target) {
          throw new Error(`${file}: ${resolution.error ?? `[[${slug}]] — no target`}`);
        }
        const target = resolution.target;

        const start = match.index;
        const replacements: GlossaryReplacement[] = [];
        if (start > 0) replacements.push({ type: "text", value: value.slice(0, start) });
        replacements.push({
          type: "link",
          url: target.path,
          children: [{ type: "text", value: label }],
        });
        const tail = value.slice(start + match[0].length);
        if (tail) replacements.push({ type: "text", value: tail });

        context.replaceNode(node, replacements);
      },
    };
  };
}
