import React from 'react';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  type StyleProp,
  Text,
  type ViewStyle,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { mobileTheme } from '@/constants/mobileTheme';

export const ui = mobileTheme.colors;

export function AppScreen({
  children,
  scroll = false,
  contentContainerStyle,
}: {
  children: React.ReactNode;
  scroll?: boolean;
  contentContainerStyle?: StyleProp<ViewStyle>;
}) {
  if (!scroll) {
    return (
      <SafeAreaView style={styles.screen} edges={['top']}>
        {children}
      </SafeAreaView>
    );
  }
  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView contentContainerStyle={[styles.scroll, contentContainerStyle]}>
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

export function TopHeader({
  title,
  subtitle,
  left,
  right,
}: {
  title: string;
  subtitle?: string;
  left?: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <View style={styles.header}>
      {left ? <View style={styles.headerSide}>{left}</View> : null}
      <View style={styles.headerText}>
        <Text style={styles.headerTitle}>{title}</Text>
        {subtitle ? <Text style={styles.headerSubtitle}>{subtitle}</Text> : null}
      </View>
      {right ? <View style={styles.headerSide}>{right}</View> : null}
    </View>
  );
}

export function SurfaceCard({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function SectionTitle({
  title,
  right,
}: {
  title: string;
  right?: React.ReactNode;
}) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {right ?? null}
    </View>
  );
}

export function PrimaryButton({
  label,
  onPress,
  disabled,
  style,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      style={[styles.primaryButton, disabled && styles.disabled, style]}
      onPress={onPress}
      disabled={disabled}
    >
      <Text style={styles.primaryButtonText}>{label}</Text>
    </Pressable>
  );
}

export function SecondaryButton({
  label,
  onPress,
  style,
}: {
  label: string;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable style={[styles.secondaryButton, style]} onPress={onPress}>
      <Text style={styles.secondaryButtonText}>{label}</Text>
    </Pressable>
  );
}

export function SoftPill({
  label,
  active = false,
  onPress,
}: {
  label: string;
  active?: boolean;
  onPress?: () => void;
}) {
  const body = (
    <View style={[styles.pill, active && styles.pillActive]}>
      <Text style={[styles.pillText, active && styles.pillTextActive]}>{label}</Text>
    </View>
  );
  if (!onPress) return body;
  return <Pressable onPress={onPress}>{body}</Pressable>;
}

export function ModernPanel({
  title,
  subtitle,
  right,
  children,
  style,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.modernPanel, style]}>
      <View style={styles.modernPanelHeader}>
        <View style={styles.modernPanelText}>
          <Text style={styles.modernPanelTitle}>{title}</Text>
          {subtitle ? <Text style={styles.modernPanelSubtitle}>{subtitle}</Text> : null}
        </View>
        {right ? <View>{right}</View> : null}
      </View>
      <View style={styles.modernPanelBody}>{children}</View>
    </View>
  );
}

export function ListTile({
  icon,
  title,
  subtitle,
  right,
  onPress,
}: {
  icon?: React.ComponentProps<typeof FontAwesome>['name'];
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  onPress?: () => void;
}) {
  const body = (
    <View style={styles.tile}>
      {icon ? (
        <View style={styles.tileIconWrap}>
          <FontAwesome name={icon} size={14} color={ui.primaryDeep} />
        </View>
      ) : null}
      <View style={styles.tileText}>
        <Text style={styles.tileTitle}>{title}</Text>
        {subtitle ? <Text style={styles.tileSubtitle}>{subtitle}</Text> : null}
      </View>
      {right ? <View>{right}</View> : null}
    </View>
  );
  if (!onPress) return body;
  return <Pressable onPress={onPress}>{body}</Pressable>;
}

export function TagChip({
  label,
  tone = 'neutral',
}: {
  label: string;
  tone?: 'neutral' | 'accent' | 'success';
}) {
  return (
    <View
      style={[
        styles.tag,
        tone === 'accent' && styles.tagAccent,
        tone === 'success' && styles.tagSuccess,
      ]}
    >
      <Text
        style={[
          styles.tagText,
          tone === 'accent' && styles.tagTextAccent,
          tone === 'success' && styles.tagTextSuccess,
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

export function StickyFooter({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.footer, style, { paddingBottom: 10 + insets.bottom }]}>{children}</View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: ui.bg,
  },
  scroll: {
    paddingHorizontal: mobileTheme.layout.screenX,
    paddingBottom: mobileTheme.layout.contentBottom,
    gap: mobileTheme.layout.sectionGap,
  },
  header: {
    paddingHorizontal: mobileTheme.layout.screenX,
    paddingTop: mobileTheme.layout.headerTop,
    paddingBottom: mobileTheme.layout.headerBottom,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerText: {
    flex: 1,
    paddingRight: 8,
  },
  headerSide: {
    minHeight: 34,
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 30,
    lineHeight: 34,
    fontWeight: '800',
    color: ui.text,
  },
  headerSubtitle: {
    marginTop: 4,
    fontSize: 14,
    color: ui.subtext,
  },
  card: {
    backgroundColor: ui.card,
    borderWidth: 1,
    borderColor: ui.border,
    borderRadius: 16,
    padding: 14,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: ui.text,
  },
  primaryButton: {
    minHeight: 46,
    borderRadius: 12,
    paddingHorizontal: 14,
    backgroundColor: ui.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryButtonText: {
    color: ui.primaryText,
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryButton: {
    minHeight: 46,
    borderRadius: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: ui.border,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: ui.text,
    fontSize: 15,
    fontWeight: '700',
  },
  disabled: {
    opacity: 0.75,
  },
  pill: {
    minHeight: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: ui.border,
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pillActive: {
    backgroundColor: ui.primary,
    borderColor: ui.primary,
  },
  pillText: {
    fontSize: 13,
    color: '#374151',
    fontWeight: '700',
  },
  pillTextActive: {
    color: '#fff',
  },
  modernPanel: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: ui.border,
    borderRadius: 18,
    overflow: 'hidden',
  },
  modernPanelHeader: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: ui.borderSoft,
    backgroundColor: '#fcfcfd',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modernPanelText: {
    flex: 1,
    paddingRight: 8,
  },
  modernPanelTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: ui.text,
  },
  modernPanelSubtitle: {
    marginTop: 2,
    color: ui.subtext,
    fontSize: 12,
    fontWeight: '600',
  },
  modernPanelBody: {
    padding: 12,
    gap: 8,
  },
  tile: {
    borderWidth: 1,
    borderColor: ui.border,
    borderRadius: 14,
    backgroundColor: '#fff',
    paddingHorizontal: 10,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  tileIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#fff7ed',
    borderWidth: 1,
    borderColor: '#fed7aa',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileText: {
    flex: 1,
  },
  tileTitle: {
    color: ui.text,
    fontWeight: '800',
    fontSize: 14,
  },
  tileSubtitle: {
    marginTop: 2,
    color: ui.subtext,
    fontSize: 12,
  },
  tag: {
    borderWidth: 1,
    borderColor: ui.borderStrong,
    borderRadius: 999,
    backgroundColor: '#fff',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  tagAccent: {
    borderColor: '#fdba74',
    backgroundColor: '#fff7ed',
  },
  tagSuccess: {
    borderColor: '#86efac',
    backgroundColor: '#f0fdf4',
  },
  tagText: {
    fontSize: 11,
    fontWeight: '800',
    color: ui.subtext,
    textTransform: 'uppercase',
  },
  tagTextAccent: {
    color: ui.primaryDeep,
  },
  tagTextSuccess: {
    color: '#166534',
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: ui.border,
    backgroundColor: '#fff',
    paddingHorizontal: mobileTheme.layout.screenX,
    paddingTop: 10,
  },
});
