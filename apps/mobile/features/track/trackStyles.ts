import { Platform, StyleSheet } from 'react-native';
import { MOBILE_GRADIENT_HERO_OVERLAP } from '../../components/MobileGradientHero';
import { ui } from '../../components/mobile-ui';
import { mobileTheme } from '../../constants/mobileTheme';

const theme = mobileTheme;

const styles = StyleSheet.create({
  screenRoot: { flex: 1, width: '100%', backgroundColor: ui.bg },
  /** Same flex shell as cart: hero + overlapping scroll are siblings; minHeight:0 fixes flex shrink. */
  trackMain: {
    flex: 1,
    width: '100%',
    minHeight: 0,
    position: 'relative',
  },
  /**
   * Pull scroll under the hero’s rounded bottom (cart `listOverlap` / checkout `scrollUnderHero`).
   * zIndex + elevation keep the cream sheet and cards painting above the gradient overlap band.
   */
  scrollTrack: {
    flex: 1,
    marginTop: -MOBILE_GRADIENT_HERO_OVERLAP,
    zIndex: 1,
    ...Platform.select({
      android: { elevation: 4 },
      default: {},
    }),
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 8,
    gap: 12,
  },
  lookupCard: {
    borderRadius: 18,
    ...Platform.select({
      ios: {
        shadowColor: '#0f172a',
        shadowOpacity: 0.08,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 5 },
      },
      android: { elevation: 4 },
      default: {},
    }),
  },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.borderStrong,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 13,
    fontSize: 16,
    backgroundColor: '#f9fafb',
    marginBottom: 12,
  },
  error: {
    color: '#b91c1c',
    marginBottom: 12,
    backgroundColor: '#fef2f2',
    borderColor: '#fecaca',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontWeight: '600',
  },
  loadingWrap: { paddingVertical: 8 },
  statusCard: { borderRadius: 18, backgroundColor: '#fffaf5', borderColor: '#fed7aa' },
  deliveryCard: {
    borderRadius: 18,
    borderColor: '#fdba74',
    backgroundColor: '#fff7ed',
  },
  timelineCard: { borderRadius: 18 },
  timelineWrap: {
    marginTop: 4,
    position: 'relative',
    paddingLeft: 2,
  },
  timelineBase: {
    position: 'absolute',
    left: 14,
    top: 10,
    bottom: 20,
    width: 2,
    backgroundColor: '#e5e7eb',
  },
  timelineProgress: {
    position: 'absolute',
    left: 14,
    top: 10,
    width: 2,
    backgroundColor: theme.colors.primary,
  },
  timelineItem: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
    alignItems: 'flex-start',
  },
  timelineItemLast: {
    marginBottom: 8,
  },
  timelineDot: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#e5e7eb',
    borderWidth: 2,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  timelineDotPast: {
    backgroundColor: '#22c55e',
  },
  timelineDotActive: {
    backgroundColor: theme.colors.primary,
    shadowColor: theme.colors.primary,
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
  },
  timelineDotIcon: {
    color: '#fff',
  },
  timelineTextBlock: { flex: 1, paddingTop: 4 },
  timelineTitle: { color: ui.text, fontWeight: '800', fontSize: 15 },
  timelineDesc: { marginTop: 2, color: ui.subtext, fontSize: 12, lineHeight: 17 },
  refreshRow: {
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: theme.colors.borderSoft,
    paddingTop: 10,
    gap: 3,
  },
  refreshText: { color: ui.subtext, fontSize: 12 },
  metricsGrid: { gap: 8 },
  infoBox: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 9,
    backgroundColor: '#fff',
  },
  infoLabel: { fontSize: 12, color: ui.subtext, textTransform: 'uppercase', fontWeight: '700' },
  infoValue: { marginTop: 3, fontSize: 16, color: ui.text, fontWeight: '700' },
  actionsCard: { borderRadius: 18 },
  /** Between Live progress and Track another order */
  cashierHandoffSlot: {
    marginTop: 4,
  },
  secondaryBtn: {
    minHeight: 42,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#d6d3d1',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  secondaryBtnText: { fontSize: 14, fontWeight: '700', color: ui.text },
  copyHint: { marginTop: 8, fontSize: 12, fontWeight: '600', color: '#047857', textAlign: 'center' },
  /** Matches `app/order/success.tsx` cashier handoff panel */
  successHandoffCard: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fcd34d',
    backgroundColor: '#fffbeb',
  },
  successHandoffTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#92400e',
    letterSpacing: 0.5,
  },
  successHandoffBody: {
    marginTop: 6,
    fontSize: 13,
    color: '#44403c',
    lineHeight: 18,
  },
  qrFallbackHint: {
    marginTop: 8,
    fontSize: 11,
    color: '#78716c',
    textAlign: 'center',
    lineHeight: 16,
  },
  successQrWrap: {
    marginTop: 12,
    alignItems: 'center',
    alignSelf: 'center',
    minHeight: 176,
    minWidth: 176,
    justifyContent: 'center',
    padding: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fcd34d',
    backgroundColor: '#ffffff',
  },
  handoffActions: { marginTop: 12, gap: 8 },
});

export { styles };
