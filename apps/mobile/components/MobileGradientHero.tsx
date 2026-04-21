import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { LinearGradient } from 'expo-linear-gradient';
import { HeaderAccountCartActions } from '@/components/HeaderAccountCartActions';
import { mobileTheme } from '@/constants/mobileTheme';

const theme = mobileTheme.colors;

/** Pull scroll content up under the hero’s rounded bottom (match cart / checkout / track). */
export const MOBILE_GRADIENT_HERO_OVERLAP = 56;

export type MobileGradientHeroStat = {
  label: string;
  value: string;
  icon: React.ComponentProps<typeof FontAwesome>['name'];
};

type Props = {
  insetsTop: number;
  eyebrow: string;
  title: string;
  hint?: string;
  stats: MobileGradientHeroStat[];
  headerRight?: React.ReactNode | null;
  /** Renders inside the gradient below the stat row (e.g. home CTAs). */
  footer?: React.ReactNode;
};

export function MobileGradientHero({
  insetsTop,
  eyebrow,
  title,
  hint,
  stats,
  headerRight,
  footer,
}: Props) {
  const right = headerRight === undefined ? <HeaderAccountCartActions variant="hero" /> : headerRight;

  return (
    <View style={styles.heroBleed}>
      <LinearGradient
        colors={['#fb923c', '#ea580c', '#7c2d12', '#1c1917']}
        locations={[0, 0.4, 0.78, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[
          styles.heroGrad,
          footer
            ? styles.heroGradWithFooter
            : stats.length === 0
              ? styles.heroGradCompact
              : null,
        ]}
      >
        <View style={styles.heroDecor} pointerEvents="none" />
        <View style={styles.heroInner}>
          <View style={[styles.heroTopRow, { paddingTop: insetsTop + 2 }]}>
            <View style={styles.heroEyebrowWrap}>
              <Text style={styles.heroEyebrow} numberOfLines={1} ellipsizeMode="tail">
                {eyebrow}
              </Text>
            </View>
            {right ? right : null}
          </View>
          <Text style={styles.heroName} numberOfLines={2}>
            {title}
          </Text>
          {hint ? <Text style={styles.heroHint}>{hint}</Text> : null}
          {stats.length > 0 ? (
            <View style={styles.statRow}>
              {stats.slice(0, 3).map((s, index) => (
                <View key={`${s.label}-${index}`} style={styles.statTile}>
                  <View style={styles.statOrb}>
                    <FontAwesome name={s.icon} size={13} color={theme.primaryText} />
                  </View>
                  <View style={styles.statTextCol}>
                    <Text style={styles.statLabel} numberOfLines={1}>
                      {s.label}
                    </Text>
                    <Text
                      style={s.value.includes('LKR') ? styles.statMoney : styles.statValue}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.55}
                    >
                      {s.value}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          ) : null}
          {footer ? <View style={styles.heroFooter}>{footer}</View> : null}
        </View>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  heroBleed: {
    width: '100%',
    alignSelf: 'stretch',
  },
  heroGrad: {
    width: '100%',
    paddingBottom: 88,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    overflow: 'hidden',
  },
  heroGradWithFooter: {
    paddingBottom: 100,
  },
  /** Tighter bottom curve when there are no stat tiles (e.g. About page). */
  heroGradCompact: {
    paddingBottom: 72,
  },
  heroFooter: {
    marginTop: 16,
  },
  heroInner: {
    width: '100%',
    paddingHorizontal: 16,
  },
  heroDecor: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(255,255,255,0.07)',
    top: -50,
    right: -40,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
    gap: 10,
    marginBottom: 10,
    paddingRight: 0,
  },
  /** Lets the eyebrow shrink beside header actions (same idea as cart hero). */
  heroEyebrowWrap: {
    flex: 1,
    minWidth: 0,
    paddingRight: 2,
  },
  heroEyebrow: {
    fontSize: 11,
    fontWeight: '900',
    color: 'rgba(255,255,255,0.92)',
    letterSpacing: 1.3,
  },
  heroName: { fontSize: 26, fontWeight: '900', color: '#fff', lineHeight: 30, letterSpacing: -0.3 },
  heroHint: {
    marginTop: 10,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.88)',
    maxWidth: 360,
  },
  statRow: { flexDirection: 'row', gap: 10, marginTop: 18 },
  statTile: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(0,0,0,0.22)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  statOrb: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: theme.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.85)',
  },
  statTextCol: { flex: 1, minWidth: 0, justifyContent: 'center' },
  statLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.72)',
    letterSpacing: 0.35,
  },
  statValue: { fontSize: 15, fontWeight: '800', color: '#fff', marginTop: 2 },
  statMoney: {
    fontSize: 11,
    fontWeight: '800',
    color: '#fff',
    marginTop: 2,
  },
});
