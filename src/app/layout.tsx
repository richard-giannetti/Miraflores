import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Casa — Hotel Management",
  description: "Property management for Casa Miraflores.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
