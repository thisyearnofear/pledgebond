/**
 * Dynamic sitemap.xml — lists all static + ecosystem pages.
 * Project and hackathon detail pages are added as they're crawled.
 */

const BASE_URL = "https://pledgebond.vercel.app";

const STATIC_ROUTES = [
  { path: "/", priority: "1.0", changefreq: "daily" },
  { path: "/explore", priority: "0.9", changefreq: "daily" },
  { path: "/leaderboard", priority: "0.9", changefreq: "hourly" },
  { path: "/leaderboard?tab=proof-builders", priority: "0.8", changefreq: "hourly" },
  { path: "/leaderboard?tab=projects", priority: "0.8", changefreq: "hourly" },
  { path: "/leaderboard?tab=builders", priority: "0.7", changefreq: "daily" },
  { path: "/leaderboard?tab=lenders", priority: "0.7", changefreq: "daily" },
  { path: "/build", priority: "0.8", changefreq: "weekly" },
  { path: "/back", priority: "0.8", changefreq: "daily" },
  { path: "/analyze", priority: "0.6", changefreq: "weekly" },
  { path: "/scout", priority: "0.6", changefreq: "weekly" },
  { path: "/compare", priority: "0.5", changefreq: "weekly" },
  { path: "/login", priority: "0.4", changefreq: "monthly" },
];

const ECOSYSTEMS = ["celo", "arc", "base", "linea", "arbitrum", "ethereum", "optimism", "solana"];

export default async function handler(_req, res) {
  const urls = [
    ...STATIC_ROUTES,
    ...ECOSYSTEMS.map((eco) => ({
      path: `/explore?ecosystem=${eco}`,
      priority: "0.7",
      changefreq: "daily",
    })),
  ];

  const lastmod = new Date().toISOString().split("T")[0];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (u) => `  <url>
    <loc>${BASE_URL}${u.path}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`,
  )
  .join("\n")}
</urlset>`;

  res.setHeader("Content-Type", "application/xml");
  res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate=86400");
  res.status(200).send(xml);
}
