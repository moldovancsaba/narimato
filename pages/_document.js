import { Html, Head, Main, NextScript } from 'next/document';

export default function Document() {
  return (
    <Html>
      <Head>
        {/* FUNCTIONAL: Imports universal button design system CSS */}
        {/* STRATEGIC: Ensures consistent button styling across all pages */}
        <link rel="stylesheet" href="/styles/buttons.css" />
        
        {/* FUNCTIONAL: Imports universal card design system CSS */}
        {/* STRATEGIC: Ensures consistent card styling across all pages */}
        <link rel="stylesheet" href="/styles/cards.css" />
        
        {/* FUNCTIONAL: Imports game-specific styling for Swipe & Vote interfaces */}
        {/* STRATEGIC: Provides dynamic responsive game layouts with keyboard support */}
        <link rel="stylesheet" href="/styles/game.css" />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
