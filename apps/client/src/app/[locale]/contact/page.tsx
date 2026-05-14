'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { Button, IconTextRow, Input, Label, Textarea, Card, CardContent, CardHeader, CardTitle } from '@wrap-roll/shared-ui';
import { cn } from '@/lib/utils';
import { surfaceInputClass, surfaceTextareaClass } from '@/lib/client-field-styles';
import {
  clientAccountStackClass,
  clientContentWideClass,
  clientElevatedCardClass,
  clientElevatedCardHeaderClass,
  clientFormLabelClass,
  clientHeroGradientOrbClass,
  clientHeroGradientOrbSecondaryClass,
  clientHeroGradientShellClass,
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
    <div className={cn(clientPageShellClass, 'overflow-hidden')}>
      <div className={clientContentWideClass}>
        <div className={clientAccountStackClass}>
          <header className={clientHeroGradientShellClass}>
            <div className={clientHeroGradientOrbClass} aria-hidden />
            <div className={clientHeroGradientOrbSecondaryClass} aria-hidden />
            <div className="relative">
              <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-orange-300/90">{t('heroEyebrow')}</p>
              <h1 className="mt-2 font-display text-3xl font-black tracking-tight sm:text-4xl">{t('title')}</h1>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/75 sm:text-base">{t('lead')}</p>
            </div>
          </header>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:gap-8">
            <Card className={clientElevatedCardClass}>
              <CardHeader className={clientElevatedCardHeaderClass}>
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-orange-600">{t('visitKicker')}</p>
                <CardTitle className={cn(clientSectionTitleClass, 'mt-1 text-xl text-neutral-900 sm:text-2xl')}>
                  {t('visitTitle')}
                </CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">{t('visitCardLead')}</p>
              </CardHeader>
              <CardContent className="space-y-6 px-6 py-6 sm:px-8 sm:py-8">
                <IconTextRow icon={MapPin} title={t('visitTitle')}>
                  <p className="text-sm text-neutral-700">{t('address')}</p>
                </IconTextRow>

                <IconTextRow icon={Clock} title={t('hoursTitle')}>
                  <p className="text-sm text-neutral-700">{t('hours')}</p>
                </IconTextRow>

                <IconTextRow icon={Phone} title={t('phoneTitle')}>
                  <p className="text-sm text-neutral-700">
                    {t('phoneLine1')}
                    <br />
                    <span className="text-xs text-muted-foreground">{t('phoneLine2')}</span>
                  </p>
                </IconTextRow>

                <IconTextRow icon={Mail} title={t('emailTitle')}>
                  <p className="text-sm text-neutral-700">{t('email')}</p>
                </IconTextRow>

                <div className="border-t border-neutral-100 pt-6">
                  <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    {t('socialTitle')}
                  </p>
                  <div className="flex gap-4 text-2xl">
                    <span className="cursor-pointer rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 transition-colors hover:border-orange-200 hover:bg-orange-50">
                      📸
                    </span>
                    <span className="cursor-pointer rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 transition-colors hover:border-orange-200 hover:bg-orange-50">
                      📘
                    </span>
                    <span className="cursor-pointer rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 transition-colors hover:border-orange-200 hover:bg-orange-50">
                      🐦
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className={clientElevatedCardClass}>
              <CardHeader className={clientElevatedCardHeaderClass}>
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-orange-600">{t('messageKicker')}</p>
                <CardTitle className={cn(clientSectionTitleClass, 'mt-1 text-xl text-neutral-900 sm:text-2xl')}>
                  {t('formTitle')}
                </CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">{t('formCardLead')}</p>
              </CardHeader>
              <CardContent className="px-6 py-6 sm:px-8 sm:py-8">
                <form onSubmit={handleSubmit} className="flex flex-col gap-5">
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
                    className={cn(clientPrimaryCtaClass, 'mt-1 gap-2 rounded-full')}
                  >
                    {t('send')} <Send className="size-[1.125rem]" aria-hidden />
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
