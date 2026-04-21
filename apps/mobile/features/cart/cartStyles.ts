import { StyleSheet } from 'react-native';
import { ui } from '../../components/mobile-ui';
import { mobileTheme } from '../../constants/mobileTheme';

const theme = mobileTheme;

const styles = StyleSheet.create({
  emptyWrap: { flex: 1, paddingHorizontal: 16, paddingTop: 8 },
  emptyCard: { alignItems: 'center', paddingVertical: 24 },
  emptyEmoji: { fontSize: 28 },
  emptyTitle: { marginTop: 8, fontSize: 20, fontWeight: '800', color: ui.text },
  emptyText: { marginTop: 8, color: ui.subtext, textAlign: 'center', lineHeight: 20 },
  emptyBtn: { width: '100%', marginTop: 14 },

  list: { paddingHorizontal: 16, gap: 10 },
  card: { marginBottom: 0, padding: 12 },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' },
  itemMain: { flexDirection: 'row', gap: 10, flex: 1 },
  thumb: { width: 64, height: 64, borderRadius: 12, backgroundColor: '#f3f4f6' },
  thumbPlaceholder: { alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#e5e7eb' },
  rowTitleWrap: { flex: 1 },
  name: { fontSize: 17, fontWeight: '800', color: ui.text },
  unitPrice: { marginTop: 4, color: theme.colors.subtext, fontSize: 12, fontWeight: '600' },
  rightActions: { alignItems: 'flex-end', gap: 6 },
  deleteBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#fecaca',
    backgroundColor: theme.colors.dangerSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  linePrice: { fontSize: 17, fontWeight: '800', color: theme.colors.primaryDeep },

  modsWrap: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: theme.colors.borderSoft,
    backgroundColor: theme.colors.surfaceMuted,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  modsLabel: { color: theme.colors.subtext, fontSize: 11, textTransform: 'uppercase', fontWeight: '700' },
  modRow: { marginTop: 3, color: '#374151', fontSize: 13, lineHeight: 18 },

  qtyRow: { marginTop: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  qtyLabel: { color: ui.subtext, fontWeight: '700', fontSize: 13, textTransform: 'uppercase' },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surfaceMuted,
    borderWidth: 1,
    borderColor: ui.border,
    borderRadius: 12,
    paddingHorizontal: 6,
    paddingVertical: 4,
    gap: 6,
  },
  stepperBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: ui.border,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepperBtnText: { fontSize: 20, color: ui.text, lineHeight: 22, fontWeight: '700' },
  qtyVal: { minWidth: 22, textAlign: 'center', fontSize: 17, fontWeight: '800', color: ui.text },

  summaryCard: { padding: 12, borderColor: theme.colors.warningBorder, backgroundColor: theme.colors.surfaceHighlight },
  summaryHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  summaryLabel: { color: ui.subtext, fontSize: 14, fontWeight: '700' },
  summaryValue: { color: theme.colors.primaryDeep, fontSize: 26, fontWeight: '900' },
  checkoutBtn: { width: '100%', marginTop: 10 },
  clearBtn: { alignSelf: 'center', marginTop: 8, paddingVertical: 3 },
  clearText: { color: ui.danger, fontWeight: '700' },
});

export { styles };
