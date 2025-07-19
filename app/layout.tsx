import { Providers } from './providers';
import { MainNav } from './components/navigation/MainNav';
import './globals.css';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <MainNav />
          <main>{children}</main>
        </Providers>
      </body>
    </html>
  );
}
