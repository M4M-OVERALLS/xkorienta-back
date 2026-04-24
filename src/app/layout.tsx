import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Xkorienta API",
  description: "Xkorienta API Server",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
