import { useMemo } from 'react';
import type { PublicBusinessSettings } from '@wrap-roll/contracts';
import { formatBusinessHoursLine } from '@/lib/format-business-hours';
import { t } from '@/lib/mobile-i18n';
import type { MobileLanguage } from '@/lib/mobile-language';

export function usePublicContactFields(
  language: MobileLanguage,
  settings: PublicBusinessSettings | null,
) {
  return useMemo(() => {
    const displayAddress = (() => {
      const line = [settings?.addressLine1, settings?.addressLine2].filter(Boolean).join(', ').trim();
      return line || t(language, 'contactAddressFallback');
    })();

    const displayHours = (() => {
      if (
        settings != null &&
        Number.isFinite(settings.openingTimeMinutes) &&
        Number.isFinite(settings.closingTimeMinutes)
      ) {
        return formatBusinessHoursLine(settings.openingTimeMinutes, settings.closingTimeMinutes);
      }
      return t(language, 'contactHoursFallback');
    })();

    const displayPhone = (settings?.contactPhone || '').trim() || t(language, 'contactPhoneFallback');
    const displayEmail = (settings?.contactEmail || '').trim() || t(language, 'contactEmailFallback');

    return { displayAddress, displayHours, displayPhone, displayEmail };
  }, [language, settings]);
}
