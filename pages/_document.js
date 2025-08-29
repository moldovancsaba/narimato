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
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
