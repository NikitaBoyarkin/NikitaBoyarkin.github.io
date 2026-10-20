// English feed. The RU feed (src/pages/rss.xml.ts) covers `posts`; this one
// covers `posts-en`, whose count grows independently — two feeds, so neither
// declares a language the other's items don't match.
import rss from "@astrojs/rss";
import type { APIContext } from "astro";
import { getCollection } from "astro:content";

export async function GET(context: APIContext) {
  const posts = (await getCollection("posts-en", (p) => !p.data.draft)).sort(
    (a, b) => b.data.date.valueOf() - a.data.date.valueOf(),
  );

  return rss({
    title: "Nikita Boyarkin — Writing (EN)",
    description:
      "Articles on product analytics, A/B testing, and data science by Nikita Boyarkin.",
    // Channel link must point at the EN root, not the RU root — feed readers
    // otherwise aggregate EN items under the RU site URL.
    site: new URL("en/", context.site ?? "https://nikitaboyarkin.github.io"),
    items: posts.map((post) => ({
      title: post.data.title,
      description: post.data.excerpt,
      // Report the edit date when one exists — a revised post is new to a
      // subscriber, and the old code always showed the publication date.
      pubDate: post.data.updated ?? post.data.date,
      link: `/en/posts/${post.id.replace(/\.md$/, "")}/`,
      categories: [post.data.category, ...post.data.tags],
    })),
    // No <lastBuildDate>: it was the build clock, so every deploy claimed
    // freshness the content did not have. Item dates carry it instead.
    customData: `<language>en-us</language>`,
  });
}
