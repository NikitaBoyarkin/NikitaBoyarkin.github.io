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
      // A revised post is genuinely new to a subscriber: report the edit date
      // when the frontmatter carries one, the publication date otherwise.
      pubDate: post.data.updated ?? post.data.date,
      link: `${BASE}/posts/${post.id.replace(/\.md$/, "")}/`,
      categories: [post.data.category, ...post.data.tags],
    })),
    // No <lastBuildDate>: the build clock moved on every deploy, so the channel
    // claimed "changed today" even when no post had. Item dates carry freshness.
    customData: `<language>ru-ru</language>`,
  });
}
