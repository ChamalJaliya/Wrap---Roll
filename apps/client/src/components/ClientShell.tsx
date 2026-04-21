'use client';

import React, { useEffect } from 'react';
import { Navbar, Footer } from '@wrap-roll/shared-ui';
import { useClientStore } from '../store/useClientStore';
import { usePathname, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { getBrowserSupabase } from '@/lib/supabase-browser';
import { CustomerApiService } from '@/services/api';
import { routing } from '../i18n/routing';

export interface ClientShellProps {
  children: React.ReactNode;
  locale: string;
}

export function ClientShell({ children, locale }: ClientShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, setUser, signOut } = useClientStore();
  const tNav = useTranslations('Nav');
  const tIndex = useTranslations('Index');
  const tFooter = useTranslations('Footer');
  const isAuthRoute = pathname?.includes(`/${locale}/auth/`) || pathname?.includes('/auth/');
  const year = new Date().getFullYear();

  useEffect(() => {
    const supabase = getBrowserSupabase();
    if (!supabase) return;
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user?.email) {
        CustomerApiService.sync().catch(() => {
          /* non-blocking: profile/checkout will retry */
        });
      }
    });
    return () => subscription.unsubscribe();
  }, [setUser]);

  const handleSignIn = () => {
    router.push(`/${locale}/auth/signin`);
  };

  const handleProfileClick = () => {
    router.push(`/${locale}/profile`);
  };

  const handleSettingsClick = () => {
    router.push(`/${locale}/profile`);
  };

  const handleLanguageChange = (newLocale: string) => {
    const locales = routing.locales.join('|');
    const localePrefix = new RegExp(`^/(${locales})(?=/|$)`);
    const pathWithoutLocale = (pathname || '/').replace(localePrefix, '');
    const nextPath = `/${newLocale}${pathWithoutLocale || ''}`;
    const search = typeof window !== 'undefined' ? window.location.search : '';
    const hash = typeof window !== 'undefined' ? window.location.hash : '';
    router.push(`${nextPath}${search}${hash}`);
  };

  const handleSignOut = async () => {
    const supabase = getBrowserSupabase();
    if (supabase) await supabase.auth.signOut();
    await signOut();
    router.push(`/${locale}`);
  };

  if (isAuthRoute) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar
        logoText={tIndex('title')}
        logoHref={`/${locale}`}
        copy={{
          selectLanguage: tNav('selectLanguage'),
          account: tNav('account'),
          myProfile: tNav('myProfile'),
          settings: tNav('settings'),
          logOut: tNav('logOut'),
          signIn: tNav('signIn'),
          signInToRoll: tNav('signInToRoll'),
          accountProfile: tNav('accountProfile'),
          signOut: tNav('signOut'),
        }}
        links={[
          { label: tNav('home'), href: `/${locale}` },
          { label: tNav('menu'), href: `/${locale}/menu` },
          { label: tNav('trackOrder'), href: `/${locale}/order/track` },
          { label: tNav('about'), href: `/${locale}/about` },
          { label: tNav('contact'), href: `/${locale}/contact` },
        ]}
        isAuthenticated={!!user}
        userInitials={user?.email?.slice(0, 2).toUpperCase() || 'GU'}
        userName={user?.email?.split('@')[0] || tNav('guest')}
        currentLocale={locale}
        onSignIn={handleSignIn}
        onSignOut={handleSignOut}
        onProfileClick={handleProfileClick}
        onSettingsClick={handleSettingsClick}
        onLanguageChange={handleLanguageChange}
      />
      <main className="flex-1">{children}</main>
      <Footer
        locale={locale}
        labels={{
          tagline: tFooter('tagline'),
          contactTitle: tFooter('contactTitle'),
          addressLine1: tFooter('addressLine1'),
          addressLine2: tFooter('addressLine2'),
          quickLinksTitle: tFooter('quickLinksTitle'),
          fullMenu: tFooter('fullMenu'),
          trackOrder: tFooter('trackOrder'),
          catering: tFooter('catering'),
          locations: tFooter('locations'),
          giftCards: tFooter('giftCards'),
          careers: tFooter('careers'),
          newsletterTitle: tFooter('newsletterTitle'),
          newsletterDescription: tFooter('newsletterDescription'),
          emailPlaceholder: tFooter('emailPlaceholder'),
          subscribe: tFooter('subscribe'),
          copyright: tFooter('copyright', { year }),
          privacy: tFooter('privacy'),
          terms: tFooter('terms'),
          cookies: tFooter('cookies'),
          facebook: tFooter('facebook'),
          instagram: tFooter('instagram'),
          twitter: tFooter('twitter'),
          youtube: tFooter('youtube'),
        }}
      />
    </div>
  );
}
