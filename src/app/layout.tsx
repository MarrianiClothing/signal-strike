import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Signal Strike",
  description: "Revenue CRM",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
