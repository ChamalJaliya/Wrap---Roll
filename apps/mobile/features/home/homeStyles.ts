import { Platform, StyleSheet } from 'react-native';
import { MOBILE_GRADIENT_HERO_OVERLAP } from '@/components/MobileGradientHero';
import { ui } from '../../components/mobile-ui';
import { mobileTheme } from '../../constants/mobileTheme';

const theme = mobileTheme;

export const styles = StyleSheet.create({
  screenRoot: { flex: 1, width: '100%', backgroundColor: ui.bg },
  scrollUnderHero: {
    flex: 1,
    marginTop: -MOBILE_GRADIENT_HERO_OVERLAP,
  },
  /** First block (about) sits under the hero curve — no extra top padding. */
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 0,
    gap: 20,
  },
  /** Full-bleed first block on /about (editorial layout manages inner padding). */
  scrollContentAbout: {
    paddingHorizontal: 0,
    paddingTop: 0,
    gap: 0,
  },
  bootBody: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 24 },
  sectionBlock: { gap: 8 },
  /** Eyebrow + `SectionTitle` stack (featured). */
  featuredSection: { gap: 6 },
  sectionEyebrow: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.2,
    color: theme.colors.primaryDeep,
  },
  /** CTAs live inside `MobileGradientHero` footer (on-gradient). */
  heroCtaRow: { flexDirection: 'row', gap: 10, alignItems: 'stretch' },
  heroCtaPrimary: {
    flex: 1,
    minHeight: 48,
    minWidth: 0,
    borderRadius: 12,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  heroCtaPrimaryText: { fontSize: 16, fontWeight: '800', color: theme.colors.primaryDeep },
  heroCtaOutline: {
    flex: 1,
    minHeight: 48,
    minWidth: 0,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.92)',
    backgroundColor: 'rgba(0,0,0,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  heroCtaOutlineText: { fontSize: 15, fontWeight: '800', color: '#fff' },
  /** Pulled up under the rounded hero — warm surface, no harsh white slab. */
  aboutSheet: {
    marginTop: 2,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: theme.colors.warningBorder,
    backgroundColor: theme.colors.surfaceHighlight,
    paddingVertical: 18,
    paddingHorizontal: 18,
    ...Platform.select({
      ios: {
        shadowColor: '#0f172a',
        shadowOpacity: 0.06,
        shadowRadius: 20,
        shadowOffset: { width: 0, height: 6 },
      },
      android: { elevation: 3 },
      default: {},
    }),
  },
  linkText: { color: theme.colors.primary, fontWeight: '800', fontSize: 14 },
  featuredRow: { gap: 14, paddingRight: 8, paddingVertical: 6, paddingLeft: 2 },
  featuredCard: {
    width: 176,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: theme.colors.warningBorder,
    backgroundColor: theme.colors.card,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#0f172a',
        shadowOpacity: 0.08,
        shadowRadius: 14,
        shadowOffset: { width: 0, height: 5 },
      },
      android: { elevation: 4 },
      default: {},
    }),
  },
  featuredImage: { width: '100%', height: 118 },
  featuredImagePlaceholder: { backgroundColor: '#e8e8e8' },
  featuredBody: { paddingHorizontal: 14, paddingTop: 12, paddingBottom: 14 },
  featuredName: { fontSize: 15, fontWeight: '900', color: ui.text, letterSpacing: -0.2, lineHeight: 20 },
  featuredMeta: {
    marginTop: 5,
    fontSize: 12,
    fontWeight: '700',
    color: ui.subtext,
    letterSpacing: 0.15,
  },
  featuredPrice: { marginTop: 10, fontSize: 17, fontWeight: '900', color: theme.colors.primaryDeep },
  loadingText: { color: ui.subtext, fontSize: 14, fontWeight: '600' },
  errorCard: { backgroundColor: theme.colors.warningBg, borderColor: theme.colors.warningBorder },
  errorText: { color: '#9a3412', fontSize: 13, fontWeight: '600' },
});
