import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "../components/ThemeProvider";
import Container from "../components/layout/Container";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
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
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ThemeProvider>
          <Container>
            {children}
          </Container>
        </ThemeProvider>
      </body>
    </html>
  );
}
