import rss from "@astrojs/rss";
import type { APIContext } from "astro";
import { getCollection } from "astro:content";

const BASE = "";

export async function GET(context: APIContext) {
  const posts = (await getCollection("posts", (p) => !p.data.draft)).sort(
    (a, b) => b.data.date.valueOf() - a.data.date.valueOf(),
  );

  return rss({
    title: "Nikita Boyarkin — Заметки",
    description:
      "Статьи по продуктовой аналитике, A/B-тестам и Data Science — Никита Бояркин.",
    site: context.site ?? "https://nikitaboyarkin.github.io",
    items: posts.map((post) => ({
      title: post.data.title,
      description: post.data.excerpt,
      pubDate: post.data.date,
      link: `${BASE}/posts/${post.id.replace(/\.md$/, "")}/`,
      categories: [post.data.category, ...post.data.tags],
    })),
    customData: `<language>ru-ru</language><lastBuildDate>${new Date().toUTCString()}</lastBuildDate>`,
  });
}
