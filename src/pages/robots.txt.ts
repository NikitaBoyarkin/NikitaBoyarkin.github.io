import type { APIRoute } from "astro";
import { withBase } from "../lib/path";

// AI-crawler polish: most bots are covered by `User-agent: *`, but several
// AI crawlers (GPTBot, PerplexityBot, ClaudeBot, …) look for their own
// section, and generic crawler-blocking robots templates sometimes block them.
// We explicitly allow every known AI/research crawler so the portfolio stays
// citable by LLMs and AI search (llms.txt is linked below too).
const AI_CRAWLERS = [
  "GPTBot",
  "ChatGPT-User",
  "OAI-SearchBot",
  "ClaudeBot",
  "Claude-User",
  "anthropic-ai",
  "PerplexityBot",
  "Google-Extended",
  "Googlebot",
  "Bingbot",
  "Bytespider",
  "cohere-ai",
  "CCBot",
  "Applebot",
];

export const GET: APIRoute = ({ site }) => {
  const siteUrl = site?.toString() ?? "https://nikitaboyarkin.github.io/";
  const sitemap = new URL(withBase("sitemap-index.xml"), siteUrl).toString();
  const lines: string[] = ["# Portfolio — crawl freely."];
  // Crawler parsers only start a new group at a blank line: without one, every
  // `User-agent` line above collapses into a single group with duplicated
  // rules. One blank line per group keeps the file meaning what it reads like.
  for (const bot of AI_CRAWLERS) {
    lines.push(`User-agent: ${bot}`, "Allow: /", "");
  }
  lines.push("User-agent: *", "Allow: /", "");
  lines.push(`Sitemap: ${sitemap}`, "");
  return new Response(lines.join("\n"), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
};
