import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import ThemeRegistry from './ThemeRegistry';
import "./globals.css";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "NARIMATO",
  description: "A real-time, card-based web application for dynamic image/text management and ranking",
  authors: [{ name: "moldovancsaba" }],
  keywords: ["Next.js", "React", "MongoDB", "Card System", "Ranking"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${inter.variable} ${jetbrainsMono.variable} antialiased font-sans`}
      >
        <ThemeRegistry>
          {children}
        </ThemeRegistry>
      </body>
    </html>
  );
}
