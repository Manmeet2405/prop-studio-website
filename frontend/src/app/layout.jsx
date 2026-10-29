import "./globals.css";
import "./App.css";
import { Toaster } from "@/components/ui/sonner";
import { Providers } from "@/components/Providers";
import { STUDIO_CONFIG } from "@/config/detailsConfig";

export const metadata = {
  title: `${STUDIO_CONFIG.name} | ${STUDIO_CONFIG.subtitle}`,
  description: STUDIO_CONFIG.tagline,
  icons: {
    icon: "/images/frangipani-flower.svg",
    apple: "/images/frangipani-flower.svg",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body>
        <Providers>
          {children}
          <Toaster position="bottom-right" />
        </Providers>
      </body>
    </html>
  );
}
