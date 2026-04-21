import React, { useState } from 'react';
import { Alert, Linking, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { PrimaryButton, SectionTitle, SurfaceCard, ui } from '@/components/mobile-ui';
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

export function ContactSection({ language, address, hoursLine, phone, email }: Props) {
  const [name, setName] = useState('');
  const [emailField, setEmailField] = useState('');
  const [message, setMessage] = useState('');

  const submit = () => {
    Alert.alert(t(language, 'contactAlertTitle'), t(language, 'contactAlertBody'));
    setName('');
    setEmailField('');
    setMessage('');
  };

  const openTel = () => {
    const raw = phone.replace(/\s+/g, '');
    void Linking.openURL(`tel:${raw}`);
  };

  const openMail = () => {
    void Linking.openURL(`mailto:${email}`);
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.eyebrow}>{t(language, 'contactSectionEyebrow')}</Text>
      <Text style={styles.lead}>{t(language, 'contactLead')}</Text>

      <SurfaceCard style={styles.infoCard}>
        <InfoRow
          icon="map-marker"
          title={t(language, 'contactVisitTitle')}
          body={address}
        />
        <InfoRow icon="clock-o" title={t(language, 'contactHoursTitle')} body={hoursLine} />
        <InfoRow
          icon="phone"
          title={t(language, 'contactPhoneTitle')}
          body={
            <View>
              <Pressable onPress={openTel}>
                <Text style={styles.linkText}>{phone}</Text>
              </Pressable>
              <Text style={styles.note}>{t(language, 'contactPhoneNote')}</Text>
            </View>
          }
        />
        <InfoRow
          icon="envelope-o"
          title={t(language, 'contactEmailTitle')}
          body={
            <Pressable onPress={openMail}>
              <Text style={styles.linkText}>{email}</Text>
            </Pressable>
          }
        />

        <View style={styles.socialBlock}>
          <Text style={styles.socialTitle}>{t(language, 'contactSocialTitle')}</Text>
          <View style={styles.socialRow}>
            <Pressable
              style={styles.socialBtn}
              onPress={() => void Linking.openURL('https://instagram.com')}
            >
              <FontAwesome name="instagram" size={22} color={theme.primaryDeep} />
            </Pressable>
            <Pressable
              style={styles.socialBtn}
              onPress={() => void Linking.openURL('https://facebook.com')}
            >
              <FontAwesome name="facebook-official" size={22} color={theme.primaryDeep} />
            </Pressable>
            <Pressable
              style={styles.socialBtn}
              onPress={() => void Linking.openURL('https://twitter.com')}
            >
              <FontAwesome name="twitter" size={22} color={theme.primaryDeep} />
            </Pressable>
          </View>
        </View>
      </SurfaceCard>

      <SurfaceCard style={styles.formCard}>
        <SectionTitle title={t(language, 'contactFormTitle')} />
        <Text style={styles.label}>{t(language, 'contactYourName')}</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder={t(language, 'contactNamePlaceholder')}
        />
        <Text style={styles.label}>{t(language, 'contactEmailFieldLabel')}</Text>
        <TextInput
          style={styles.input}
          value={emailField}
          onChangeText={setEmailField}
          placeholder={t(language, 'contactEmailFieldPlaceholder')}
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <Text style={styles.label}>{t(language, 'contactMessageLabel')}</Text>
        <TextInput
          style={[styles.input, styles.message]}
          value={message}
          onChangeText={setMessage}
          placeholder={t(language, 'contactMessagePlaceholder')}
          multiline
        />
        <PrimaryButton label={t(language, 'contactSend')} onPress={submit} style={styles.cta} />
      </SurfaceCard>
    </View>
  );
}

function InfoRow({
  icon,
  title,
  body,
}: {
  icon: React.ComponentProps<typeof FontAwesome>['name'];
  title: string;
  body: React.ReactNode;
}) {
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoIcon}>
        <FontAwesome name={icon} size={16} color={theme.primaryDeep} />
      </View>
      <View style={styles.infoText}>
        <Text style={styles.infoTitle}>{title}</Text>
        {typeof body === 'string' ? <Text style={styles.infoBody}>{body}</Text> : body}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  eyebrow: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.2,
    color: theme.primaryDeep,
  },
  lead: {
    fontSize: 15,
    lineHeight: 22,
    color: ui.subtext,
    fontWeight: '600',
  },
  infoCard: {
    gap: 16,
    paddingVertical: 14,
    ...Platform.select({
      ios: {
        shadowColor: '#0f172a',
        shadowOpacity: 0.07,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 4 },
      },
      android: { elevation: 3 },
      default: {},
    }),
  },
  infoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  infoIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoText: { flex: 1, minWidth: 0 },
  infoTitle: { fontSize: 12, fontWeight: '800', color: ui.subtext, textTransform: 'uppercase' },
  infoBody: { marginTop: 4, fontSize: 15, lineHeight: 22, color: ui.text, fontWeight: '600' },
  linkText: { marginTop: 4, fontSize: 15, fontWeight: '800', color: theme.primaryDeep },
  note: { marginTop: 4, fontSize: 12, color: ui.subtext, fontWeight: '600' },
  socialBlock: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.border,
    paddingTop: 14,
  },
  socialTitle: { fontSize: 12, fontWeight: '800', color: ui.subtext, letterSpacing: 0.6 },
  socialRow: { flexDirection: 'row', gap: 16, marginTop: 10 },
  socialBtn: { padding: 4 },
  formCard: {
    gap: 0,
    paddingBottom: 4,
    ...Platform.select({
      ios: {
        shadowColor: '#0f172a',
        shadowOpacity: 0.07,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 4 },
      },
      android: { elevation: 3 },
      default: {},
    }),
  },
  label: {
    fontSize: 12,
    fontWeight: '800',
    color: ui.subtext,
    textTransform: 'uppercase',
    marginTop: 10,
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: ui.border,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: '#fff',
    fontSize: 15,
  },
  message: { minHeight: 110, textAlignVertical: 'top' },
  cta: { marginTop: 14 },
});
