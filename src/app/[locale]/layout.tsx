import { Inter } from 'next/font/google';
import { Providers } from '@/components/providers';
import { Navigation } from '@/components/navigation';
import '../globals.css';

const inter = Inter({ subsets: ['latin'] });

export default async function LocaleLayout({
  children,
  params
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  return (
    <html lang={locale}>
      <body className={inter.className}>
        <Providers>
          <div className="min-h-screen bg-gray-50">
            <Navigation locale={locale} />
            <main>{children}</main>
          </div>
        </Providers>
      </body>
    </html>
  );
}
