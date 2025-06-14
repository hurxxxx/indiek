import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { I18nProvider } from "@/components/i18n-provider";
import { Providers } from "@/components/providers";
import { Navigation } from "@/components/navigation";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Indiek - Korean Indie Artists Platform",
  description: "Discover and explore Korean independent music and artists",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <I18nProvider>
          <Providers>
            <div className="min-h-screen bg-gray-50">
              <Navigation />
              <main>{children}</main>
            </div>
          </Providers>
        </I18nProvider>
      </body>
    </html>
  );
}
