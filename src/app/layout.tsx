import type { Metadata, Viewport } from "next";
import { Cinzel, Montserrat } from "next/font/google";
import "./globals.css";

const cinzel = Cinzel({
  subsets: ["latin"],
  weight: ["400", "600", "700", "900"],
  variable: "--font-cinzel",
  display: "swap",
});

const montserrat = Montserrat({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  variable: "--font-montserrat",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Signal Strike",
  description: "Revenue CRM for sales teams. Track deals, manage your pipeline, and never miss a signal.",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/icons/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [
      { url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Signal Strike",
  },
  formatDetection: {
    telephone: false,
  },
  metadataBase: new URL("https://strike.hilltopave.com"),
  openGraph: {
    type: "website",
    url: "https://strike.hilltopave.com",
    siteName: "Signal Strike",
    title: "Signal Strike — Turn signal into revenue.",
    description: "Revenue CRM for sales teams. Track deals, manage your pipeline, and never miss a signal.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Signal Strike — Revenue CRM",
        type: "image/png",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Signal Strike — Turn signal into revenue.",
    description: "Revenue CRM for sales teams. Track deals, manage your pipeline, and never miss a signal.",
    images: ["/og-image.png"],
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: "#C9A84C",
};


export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${cinzel.variable} ${montserrat.variable}`}>
      <body style={{ fontFamily: "var(--font-montserrat, system-ui, sans-serif)", background: "#09090b", color: "#fafafa", margin: 0 }}>
        {children}
      </body>
    </html>
  );
}
