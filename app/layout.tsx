import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Attention Lab",
  description: "An adaptive AI tutor for learning transformer attention."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
