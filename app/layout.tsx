import type { Metadata, Viewport } from "next";
import { Inter, Fira_Code } from "next/font/google";
import "./globals.css";
import ChunkErrorProvider from './components/ChunkErrorProvider';
import GlobalNavigation from './components/GlobalNavigation';
import OrganizationNavigation from './components/OrganizationNavigation';
import { OrganizationProvider } from './components/OrganizationProvider';
import NavigationController from './components/NavigationController';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
});

const firaCode = Fira_Code({
  weight: '600',
  subsets: ['latin'],
  variable: '--font-fira-code',
});

export const metadata: Metadata = {
  title: 'Narimato - Personal Card Ranking System',
  description: 'An anonymous, session-based card ranking application',
  manifest: '/manifest.json',
  icons: {
    icon: '/favicon.ico',
    apple: '/apple-touch-icon.png'
  }
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#0a0a0a'
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-theme="dark">
      <body
        className={`${inter.variable} ${firaCode.variable} antialiased`}
        style={{
          backgroundColor: 'var(--background)',
          color: 'var(--text-primary)',
          paddingBottom: '80px'
        }}
      >
        {/* Organization-wide background layer for animated backgrounds */}
        <div className="background-content"></div>
        
        <OrganizationProvider>
          <ChunkErrorProvider>
            {children}
          </ChunkErrorProvider>
          <NavigationController />
        </OrganizationProvider>
      </body>
    </html>
  );
}
