import '../globals.css';
import Script from 'next/script';
import { hasLocale, NextIntlClientProvider } from 'next-intl';
import { getMessages, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { CookieBanner } from '../../components/CookieBanner';
import { Providers } from '../../components/Providers';
import { ClientShell } from '../../components/ClientShell';
import { routing } from '../../i18n/routing';
import { Metadata } from 'next';
import { DOMAIN_ACCENT_CLASS } from '@wrap-roll/shared-ui';

export const metadata: Metadata = {
  title: 'Welcome to Wrap & Roll',
  description: 'Gourmet Wraps & Rolls',
};

type Props = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

export default async function RootLayout({ children, params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }
  setRequestLocale(locale);
  const messages = await getMessages();

  return (
    <html lang={locale} suppressHydrationWarning>
      <body className={DOMAIN_ACCENT_CLASS.client} suppressHydrationWarning>
        <NextIntlClientProvider locale={locale} messages={messages}>
          <Providers>
            <ClientShell locale={locale}>{children}</ClientShell>
          </Providers>
          <CookieBanner />
        </NextIntlClientProvider>
        <Script
          src="https://www.payhere.lk/lib/payhere.js"
          strategy="afterInteractive"
        />
      </body>
    </html>
  );
}
