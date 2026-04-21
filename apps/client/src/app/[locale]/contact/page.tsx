'use client';

import React from 'react';
import { Button, IconTextRow, Input, Label, PageHeroHeader, Textarea } from '@wrap-roll/shared-ui';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { surfaceInputClass, surfaceTextareaClass } from '@/lib/client-field-styles';
import {
  clientFormLabelClass,
  clientGlassPanelClass,
  clientGlassPanelFlatClass,
  clientContentWideClass,
  clientPageShellClass,
  clientPrimaryCtaClass,
  clientSectionTitleClass,
} from '@/lib/client-page-shell';
import { Mail, Phone, MapPin, Clock, Send } from 'lucide-react';

export default function ContactPage() {
  const t = useTranslations('Contact');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    alert(t('sentAlert'));
  };

  return (
    <div className={cn(clientPageShellClass)}>
      <div className={clientContentWideClass}>
        <PageHeroHeader title={t('title')} subtitle={t('lead')} />

        <div className="grid grid-cols-1 gap-8 md:grid-cols-[repeat(auto-fit,minmax(300px,1fr))]">
        <section className={cn(clientGlassPanelClass, 'flex flex-col gap-8')}>
          <IconTextRow icon={MapPin} title={t('visitTitle')}>
            <p>{t('address')}</p>
          </IconTextRow>

          <IconTextRow icon={Clock} title={t('hoursTitle')}>
            <p>{t('hours')}</p>
          </IconTextRow>

          <IconTextRow icon={Phone} title={t('phoneTitle')}>
            <p>
              {t('phoneLine1')}
              <br />
              <span className="text-xs opacity-70">{t('phoneLine2')}</span>
            </p>
          </IconTextRow>

          <IconTextRow icon={Mail} title={t('emailTitle')}>
            <p>{t('email')}</p>
          </IconTextRow>

          <hr className="border-0 border-t border-black/5" />

          <div className="px-4">
            <h4 className="mb-4 text-sm uppercase tracking-wide text-neutral-400">
              {t('socialTitle')}
            </h4>
            <div className="flex gap-6 text-2xl">
              <span className="cursor-pointer">📸</span>
              <span className="cursor-pointer">📘</span>
              <span className="cursor-pointer">🐦</span>
            </div>
          </div>
        </section>

        <section className={clientGlassPanelFlatClass}>
          <div className="flex flex-col gap-4">
            <h2 className={clientSectionTitleClass}>{t('formTitle')}</h2>
            <form onSubmit={handleSubmit} className="flex flex-col gap-6">
              <div className="grid gap-2">
                <Label htmlFor="contact-name" className={clientFormLabelClass}>
                  {t('yourName')}
                </Label>
                <Input
                  id="contact-name"
                  placeholder={t('namePlaceholder')}
                  required
                  className={surfaceInputClass}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="contact-email" className={clientFormLabelClass}>
                  {t('emailLabel')}
                </Label>
                <Input
                  id="contact-email"
                  type="email"
                  placeholder={t('emailPlaceholder')}
                  required
                  className={surfaceInputClass}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="contact-message" className={clientFormLabelClass}>
                  {t('messageLabel')}
                </Label>
                <Textarea
                  id="contact-message"
                  placeholder={t('messagePlaceholder')}
                  required
                  rows={5}
                  className={surfaceTextareaClass}
                />
              </div>
              <Button
                type="submit"
                variant="default"
                size="lg"
                className={cn(clientPrimaryCtaClass, 'mt-1 gap-2')}
              >
                {t('send')} <Send className="size-[1.125rem]" aria-hidden />
              </Button>
            </form>
          </div>
        </section>
      </div>
      </div>
    </div>
  );
}
