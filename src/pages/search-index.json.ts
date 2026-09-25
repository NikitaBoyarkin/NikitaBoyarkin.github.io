// Build-time search index. Astro emits this endpoint to /search-index.json in
// static output. The SearchBox island fetches it lazily on first focus and
// filters client-side — no backend, no runtime dependency.
import { getCollection } from "astro:content";
import { withBase } from "../lib/path";

interface Entry {
  type: "project" | "post";
  locale: "ru" | "en";
  title: string;
  desc: string;
  tags: string[];
  tools: string[];
  href: string;
  date: string | null;
  image: string | null;
}

const slugOf = (id: string) => id.replace(/\.md$/, "");

export async function GET() {
  const [ruProjects, enProjects, posts, enPosts] = await Promise.all([
    getCollection("projects", (p) => !p.data.draft),
    getCollection("projects-en", (p) => !p.data.draft),
    getCollection("posts", (p) => !p.data.draft),
    getCollection("posts-en", (p) => !p.data.draft),
  ]);

  const entries: Entry[] = [
    ...ruProjects.map<Entry>((p) => ({
      type: "project",
      locale: "ru",
      title: p.data.title,
      desc: p.data.description,
      tags: [],
      tools: p.data.tools ?? [],
      href: withBase(`projects/${slugOf(p.id)}/`),
      date: null,
      image: p.data.hero ? withBase(p.data.hero) : null,
    })),
    ...enProjects.map<Entry>((p) => ({
      type: "project",
      locale: "en",
      title: p.data.title,
      desc: p.data.description,
      tags: [],
      tools: p.data.tools ?? [],
      href: withBase(`en/projects/${slugOf(p.id)}/`),
      date: null,
      image: p.data.hero ? withBase(p.data.hero) : null,
    })),
    ...posts.map<Entry>((p) => ({
      type: "post",
      locale: "ru",
      title: p.data.title,
      desc: p.data.excerpt,
      tags: p.data.tags ?? [],
      tools: [],
      href: withBase(`posts/${slugOf(p.id)}/`),
      date: p.data.date.toISOString(),
      image: p.data.image ? withBase(p.data.image) : null,
    })),
    ...enPosts.map<Entry>((p) => ({
      type: "post",
      locale: "en",
      title: p.data.title,
      desc: p.data.excerpt,
      tags: p.data.tags ?? [],
      tools: [],
      href: withBase(`en/posts/${slugOf(p.id)}/`),
      date: p.data.date.toISOString(),
      image: p.data.image ? withBase(p.data.image) : null,
    })),
  ];

  return new Response(JSON.stringify(entries), {
    headers: { "content-type": "application/json" },
  });
}