import type { Metadata } from "next"
import "./styles/minimal.css"

export const metadata: Metadata = {
  title: 'Narimato',
  description: 'Card Management System'
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
