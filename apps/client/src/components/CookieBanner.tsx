'use client';

import React, { useEffect, useState } from 'react';
import { Button } from '@wrap-roll/shared-ui';
import { useLocale, useTranslations } from 'next-intl';

export function CookieBanner() {
  const [show, setShow] = useState(false);
  const locale = useLocale();
  const t = useTranslations('Cookie');

  useEffect(() => {
    const hasConsented = localStorage.getItem('wrap_cookie_consent');
    if (!hasConsented) {
      setShow(true);
    }
  }, []);

  if (!show) return null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        background: 'rgba(0,0,0,0.9)',
        color: 'white',
        padding: '1rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        zIndex: 50,
        backdropFilter: 'blur(10px)',
        borderTop: '1px solid rgba(255,255,255,0.1)',
      }}
    >
      <div>
        <p style={{ margin: 0, fontSize: '0.875rem' }}>
          {t.rich('message', {
            privacy: (chunks) => (
              <a
                href={`/${locale}/privacy`}
                style={{ textDecoration: 'underline', color: '#ff6b35' }}
              >
                {chunks}
              </a>
            ),
          })}
        </p>
      </div>
      <div>
        <Button
          size="sm"
          onClick={() => {
            localStorage.setItem('wrap_cookie_consent', 'true');
            setShow(false);
          }}
        >
          {t('accept')}
        </Button>
      </div>
    </div>
  );
}
