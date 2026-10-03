import { Html, Head, Main, NextScript } from "next/document";

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        <meta charSet="utf-8" />
        <meta name="description" content="PledgeBond — a liquidity rail for hackathon winners. Get paid in hours against a confirmed win, not 90 days." />
        <meta property="og:type" content="website" />
        <meta property="og:title" content="PledgeBond — Post-Win Layer for Hackathon Builders" />
        <meta property="og:description" content="You won. Now get paid — and keep building. Public payout speeds, verified wins, and underwriting packets for ecosystems and angels." />
        <meta property="og:site_name" content="PledgeBond" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="PledgeBond — Post-Win Layer for Hackathon Builders" />
        <meta name="twitter:description" content="You won. Now get paid — and keep building. Public payout speeds, verified wins, and underwriting packets for ecosystems and angels." />
        <link rel="icon" href="/favicon.ico" />
        
        {/* Google Fonts: Plus Jakarta Sans for display, Inter for body */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebApplication",
              name: "PledgeBond",
              description: "Post-win layer for hackathon builders: public payout truth, verified wins, and Underwriter packets that unlock credit.",
              url: "https://pledgebond.vercel.app",
              applicationCategory: "FinanceApplication",
              operatingSystem: "Web",
              offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
              featureList: [
                "Hackathon payout speed leaderboards",
                "Winner verification and claim flow",
                "Underwriter packets via AI agents",
                "Bridge loans against verified wins",
              ],
            }),
          }}
        />
      </Head>
      <body className="antialiased">
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
