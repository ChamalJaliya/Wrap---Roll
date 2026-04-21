import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  type TextInputProps,
  View,
} from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StickyFooter, SurfaceCard, ui } from '@/components/mobile-ui';
import { mobileTheme } from '@/constants/mobileTheme';

const theme = mobileTheme.colors;

export function AuthTextField({
  label,
  icon,
  isLast,
  secureToggle,
  ...inputProps
}: {
  label: string;
  icon: React.ComponentProps<typeof FontAwesome>['name'];
  isLast?: boolean;
  secureToggle?: boolean;
} & TextInputProps) {
  const [hidden, setHidden] = useState(true);
  const secure = inputProps.secureTextEntry;
  const effectiveSecure = secure && secureToggle ? hidden : !!secure;

  return (
    <View style={[styles.fieldWrap, isLast && styles.fieldWrapLast]}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.inputShell}>
        <FontAwesome name={icon} size={16} color={theme.muted} style={styles.inputIcon} />
        <TextInput
          style={styles.input}
          placeholderTextColor={theme.muted}
          {...inputProps}
          secureTextEntry={effectiveSecure}
        />
        {secure && secureToggle ? (
          <Pressable
            onPress={() => setHidden((h) => !h)}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={hidden ? 'Show password' : 'Hide password'}
          >
            <FontAwesome name={hidden ? 'eye' : 'eye-slash'} size={16} color={theme.muted} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

function FeatureChip({ icon, text }: { icon: React.ComponentProps<typeof FontAwesome>['name']; text: string }) {
  return (
    <View style={styles.chip}>
      <FontAwesome name={icon} size={12} color="rgba(255,255,255,0.95)" />
      <Text style={styles.chipText}>{text}</Text>
    </View>
  );
}

/** Magic link vs password — matches web client `SegmentedControl` on auth pages. */
export function AuthModeSwitch({
  value,
  onChange,
  magicLabel,
  passwordLabel,
}: {
  value: 'magic' | 'password';
  onChange: (next: 'magic' | 'password') => void;
  magicLabel: string;
  passwordLabel: string;
}) {
  return (
    <View style={styles.modeRow} accessibilityRole="tablist">
      <Pressable
        accessibilityRole="tab"
        accessibilityState={{ selected: value === 'magic' }}
        onPress={() => onChange('magic')}
        style={({ pressed }) => [
          styles.modeHalf,
          value === 'magic' ? styles.modeHalfOn : styles.modeHalfOff,
          pressed && styles.modePressed,
        ]}
      >
        <Text style={[styles.modeText, value === 'magic' ? styles.modeTextOn : styles.modeTextOff]}>{magicLabel}</Text>
      </Pressable>
      <Pressable
        accessibilityRole="tab"
        accessibilityState={{ selected: value === 'password' }}
        onPress={() => onChange('password')}
        style={({ pressed }) => [
          styles.modeHalf,
          value === 'password' ? styles.modeHalfOn : styles.modeHalfOff,
          pressed && styles.modePressed,
        ]}
      >
        <Text style={[styles.modeText, value === 'password' ? styles.modeTextOn : styles.modeTextOff]}>
          {passwordLabel}
        </Text>
      </Pressable>
    </View>
  );
}

type AuthChromeProps = {
  eyebrow: string;
  headline: string;
  sub: string;
  onBack: () => void;
  children: React.ReactNode;
  footer: React.ReactNode;
};

export function AuthChrome({ eyebrow, headline, sub, onBack, children, footer }: AuthChromeProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.root}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: 28 }]}
          keyboardShouldPersistTaps="handled"
        >
          <LinearGradient
            colors={['#fb923c', '#ea580c', '#9a3412', '#1c1917']}
            locations={[0, 0.35, 0.72, 1]}
            start={{ x: 0.1, y: 0 }}
            end={{ x: 0.9, y: 1 }}
            style={[styles.heroGrad, { paddingTop: Math.max(insets.top, 12) + 4 }]}
          >
            <View style={styles.decorCircle} pointerEvents="none" />
            <View style={styles.decorCircleSmall} pointerEvents="none" />

            <Pressable
              onPress={onBack}
              style={[styles.backOrb, { marginTop: 4 }]}
              accessibilityRole="button"
              accessibilityLabel="Go back"
            >
              <FontAwesome name="chevron-left" size={17} color="#1f2937" />
            </Pressable>

            <Text style={styles.eyebrow}>{eyebrow}</Text>
            <Text style={styles.headline}>{headline}</Text>
            <Text style={styles.sub}>{sub}</Text>

            <View style={styles.chipRow}>
              <FeatureChip icon="bolt" text="Quick checkout" />
              <FeatureChip icon="heart" text="Saved favorites" />
              <FeatureChip icon="leaf" text="Fresh daily" />
            </View>
          </LinearGradient>

          <View style={[styles.cardOverlap, { marginTop: -76 }]}>
            <SurfaceCard style={styles.formCard}>{children}</SurfaceCard>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <StickyFooter>{footer}</StickyFooter>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: ui.bg },
  flex: { flex: 1 },
  scrollContent: { flexGrow: 1 },
  heroGrad: {
    paddingHorizontal: 22,
    paddingBottom: 96,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    overflow: 'hidden',
  },
  decorCircle: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(255,255,255,0.08)',
    top: -40,
    right: -60,
  },
  decorCircleSmall: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255,255,255,0.06)',
    bottom: 48,
    left: -24,
  },
  backOrb: {
    alignSelf: 'flex-start',
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.96)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
    marginBottom: 18,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '900',
    color: 'rgba(255,255,255,0.88)',
    letterSpacing: 1.4,
    marginBottom: 8,
  },
  headline: {
    fontSize: 28,
    fontWeight: '900',
    color: '#fff',
    letterSpacing: -0.5,
    lineHeight: 34,
  },
  sub: {
    marginTop: 10,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.88)',
    maxWidth: 320,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 18,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  chipText: {
    fontSize: 11,
    fontWeight: '800',
    color: 'rgba(255,255,255,0.95)',
  },
  cardOverlap: {
    paddingHorizontal: 18,
  },
  formCard: {
    padding: 18,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: theme.border,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  modeRow: {
    flexDirection: 'row',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.border,
    overflow: 'hidden',
    marginBottom: 16,
  },
  modeHalf: {
    flex: 1,
    paddingVertical: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeHalfOff: {
    backgroundColor: theme.surfaceMuted,
  },
  modeHalfOn: {
    backgroundColor: theme.primary,
  },
  modePressed: { opacity: 0.92 },
  modeText: { fontSize: 13, fontWeight: '800' },
  modeTextOn: { color: '#fff' },
  modeTextOff: { color: theme.subtext },
  fieldWrap: {
    marginBottom: 16,
  },
  fieldWrapLast: {
    marginBottom: 0,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: theme.subtext,
    marginBottom: 8,
    letterSpacing: 0.2,
  },
  inputShell: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 14,
    backgroundColor: theme.surfaceMuted,
    paddingHorizontal: 12,
    minHeight: 50,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: theme.text,
    paddingVertical: Platform.OS === 'ios' ? 12 : 10,
  },
});
