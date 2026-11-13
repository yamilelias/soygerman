import type { Metadata, Viewport } from "next";
import { DM_Sans, Montserrat } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { RegisterPwa } from "@/components/register-pwa";
import { IosPullToRefresh } from "@/components/ios-pull-to-refresh";
import { Providers } from "./providers";
import "./globals.css";

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
});

const montserrat = Montserrat({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-montserrat",
});

export const metadata: Metadata = {
  title: "SoyGerman",
  description: "Agenda y envía mensajes de WhatsApp",
  applicationName: "SoyGerman",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "SoyGerman",
  },
  other: {
    "apple-mobile-web-app-capable": "yes",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/icon-192.png", sizes: "192x192" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#7A0505",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="es"
      className={`${dmSans.variable} ${montserrat.variable} dark h-full antialiased`}
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{if(localStorage.getItem('theme')==='light'){document.documentElement.classList.remove('dark')}}catch(e){}",
          }}
        />
      </head>
      <body className="min-h-full bg-background text-foreground">
        <svg aria-hidden="true" className="absolute h-0 w-0" focusable="false">
          <defs>
            <filter id="dark-logo-colors" colorInterpolationFilters="sRGB">
              <feColorMatrix
                type="matrix"
                values="-1.25653026 0.03695069 0.2395234 0 1.07417381
                        -2.17838202 1.03567101 0.23122822 0 1.03697298
                        -2.08069673 0.03407142 1.22085924 0 0.99047195
                        0 0 0 1 0"
              />
            </filter>
          </defs>
        </svg>
        <RegisterPwa />
        <IosPullToRefresh />
        <Providers>{children}</Providers>
        <Analytics />
      </body>
    </html>
  );
}
