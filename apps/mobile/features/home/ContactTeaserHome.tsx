import React from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useRouter } from 'expo-router';
import { mobileTheme } from '@/constants/mobileTheme';
import { t } from '@/lib/mobile-i18n';
import type { MobileLanguage } from '@/lib/mobile-language';

const theme = mobileTheme.colors;

type Props = {
  language: MobileLanguage;
  address: string;
  hoursLine: string;
  phone: string;
  email: string;
};

export function ContactTeaserHome({ language, address, hoursLine, phone, email }: Props) {
  const router = useRouter();

  const openTel = () => {
    const raw = phone.replace(/\s+/g, '');
    void Linking.openURL(`tel:${raw}`);
  };

  const openMail = () => {
    void Linking.openURL(`mailto:${email}`);
  };

  const openMaps = () => {
    const q = encodeURIComponent(address);
    void Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${q}`);
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>{t(language, 'contactHomeEyebrow')}</Text>
        <Text style={styles.title}>{t(language, 'contactHomeTitle')}</Text>
      </View>

      <View style={styles.card}>
        <MapsRow
          icon="map-marker"
          label={t(language, 'contactVisitTitle')}
          value={address}
          mapsHint={t(language, 'contactOpenMaps')}
          onPress={openMaps}
        />
        <View style={styles.divider} />
        <StaticRow icon="clock-o" label={t(language, 'contactHoursTitle')} value={hoursLine} />
        <View style={styles.divider} />
        <Row icon="phone" label={t(language, 'contactPhoneTitle')} value={phone} onPress={openTel} />
        <View style={styles.divider} />
        <Row
          icon="envelope-o"
          label={t(language, 'contactEmailTitle')}
          value={email}
          onPress={openMail}
        />
      </View>

      <Pressable
        style={styles.primaryCta}
        onPress={() => router.push('/contact')}
        accessibilityRole="button"
        accessibilityLabel={t(language, 'contactMessageUs')}
      >
        <Text style={styles.primaryCtaText}>{t(language, 'contactMessageUs')}</Text>
        <FontAwesome name="angle-right" size={18} color="#fff" />
      </Pressable>
    </View>
  );
}

function Row({
  icon,
  label,
  value,
  onPress,
}: {
  icon: React.ComponentProps<typeof FontAwesome>['name'];
  label: string;
  value: string;
  onPress: () => void;
}) {
  return (
    <Pressable style={({ pressed }) => [styles.row, pressed && styles.rowPressed]} onPress={onPress}>
      <View style={styles.rowIcon}>
        <FontAwesome name={icon} size={17} color={theme.primaryDeep} />
      </View>
      <View style={styles.rowBody}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowValue} numberOfLines={2}>
          {value}
        </Text>
      </View>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

function MapsRow({
  icon,
  label,
  value,
  mapsHint,
  onPress,
}: {
  icon: React.ComponentProps<typeof FontAwesome>['name'];
  label: string;
  value: string;
  mapsHint: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${label}. ${mapsHint}`}
    >
      <View style={styles.rowIcon}>
        <FontAwesome name={icon} size={17} color={theme.primaryDeep} />
      </View>
      <View style={styles.rowBody}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowValue} numberOfLines={4}>
          {value}
        </Text>
      </View>
      <View style={styles.mapsRight}>
        <Text style={styles.mapsHint}>{mapsHint}</Text>
        <Text style={styles.mapsChevron}>›</Text>
      </View>
    </Pressable>
  );
}

function StaticRow({
  icon,
  label,
  value,
}: {
  icon: React.ComponentProps<typeof FontAwesome>['name'];
  label: string;
  value: string;
}) {
  return (
    <View style={[styles.row, styles.rowMultiline]}>
      <View style={[styles.rowIcon, styles.rowIconTop]}>
        <FontAwesome name={icon} size={17} color={theme.primaryDeep} />
      </View>
      <View style={styles.rowBody}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowValue} numberOfLines={4}>
          {value}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 14 },
  header: { gap: 6 },
  eyebrow: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.25,
    color: theme.primaryDeep,
  },
  title: {
    fontSize: 22,
    fontWeight: '900',
    color: theme.text,
    letterSpacing: -0.35,
    lineHeight: 28,
  },
  card: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: theme.warningBorder,
    backgroundColor: theme.surfaceHighlight,
    overflow: 'hidden',
  },
  rowMultiline: { alignItems: 'flex-start' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 56,
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 12,
  },
  rowPressed: { backgroundColor: 'rgba(234, 88, 12, 0.06)' },
  rowIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: theme.card,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.border,
  },
  rowIconTop: { marginTop: 2 },
  rowBody: { flex: 1, minWidth: 0 },
  rowLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: theme.subtext,
    letterSpacing: 0.35,
  },
  rowValue: {
    marginTop: 4,
    fontSize: 15,
    fontWeight: '700',
    color: theme.text,
    lineHeight: 21,
  },
  mapsRight: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  mapsHint: {
    fontSize: 12,
    fontWeight: '800',
    color: theme.primary,
  },
  mapsChevron: { fontSize: 20, color: theme.primary, fontWeight: '300' },
  chevron: { fontSize: 22, color: theme.muted, fontWeight: '300' },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: theme.border,
    marginLeft: 68,
  },
  primaryCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    minHeight: 52,
    borderRadius: 14,
    backgroundColor: theme.primary,
    paddingHorizontal: 16,
  },
  primaryCtaText: { fontSize: 16, fontWeight: '800', color: theme.primaryText },
});
