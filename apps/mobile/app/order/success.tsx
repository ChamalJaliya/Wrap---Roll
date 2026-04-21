import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import { CashierHandoffQr } from '@/components/CashierHandoffQr';
import { OrderService } from '@/services/api';
import { formatApiError } from '@/lib/api-error';
import { buildCashierResolveOrderUrl } from '@wrap-roll/contracts';

const CASHIER_ORIGIN =
  (typeof process !== 'undefined' && process.env.EXPO_PUBLIC_CASHIER_APP_URL?.trim()) ||
  'http://localhost:3002';

export default function OrderSuccessScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string; phone?: string }>();

  const [loading, setLoading] = useState(false);
  /** Track poll failures — do not hide cashier QR (same as web: QR is from order id, not track API). */
  const [trackError, setTrackError] = useState('');
  const [status, setStatus] = useState('PLACED');
  const [paymentStatus, setPaymentStatus] = useState('PENDING');
  /** Empty until track API returns — avoids wrong handoff UI before we know fulfillment. */
  const [fulfillmentType, setFulfillmentType] = useState('');
  const [total, setTotal] = useState<number | null>(null);
  const [copyHint, setCopyHint] = useState<string | null>(null);

  const orderId = String(params.id || '').trim();
  const phone = String(params.phone || '').trim();

  const staffHandoffUrl = useMemo(
    () => (orderId ? buildCashierResolveOrderUrl(CASHIER_ORIGIN, orderId) : ''),
    [orderId],
  );

  /** Always show staff QR when we have an order id (checkout just succeeded — same UX as web). */
  const showCounterHandoffQr = Boolean(orderId && staffHandoffUrl);

  useEffect(() => {
    if (!orderId || !phone) return;
    let active = true;

    const poll = async () => {
      setLoading(true);
      try {
        const data = await OrderService.trackOrder(orderId, phone);
        if (!active) return;
        setStatus(String(data.status || '').toUpperCase());
        setPaymentStatus(String(data.paymentStatus || '').toUpperCase());
        setFulfillmentType(String(data.fulfillmentType || '').toUpperCase());
        setTotal(Number(data.total) || null);
        setTrackError('');
      } catch (e) {
        if (!active) return;
        setTrackError(formatApiError(e));
      } finally {
        if (active) setLoading(false);
      }
    };

    void poll();
    const timer = setInterval(() => void poll(), 10000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [orderId, phone]);

  const copyText = async (label: string, text: string) => {
    try {
      await Clipboard.setStringAsync(text);
      setCopyHint(`${label} copied`);
      setTimeout(() => setCopyHint(null), 2500);
    } catch {
      setCopyHint('Could not copy');
      setTimeout(() => setCopyHint(null), 2500);
    }
  };

  const shareStaffLink = async () => {
    if (!staffHandoffUrl) return;
    try {
      await Share.share({
        message: `My order — show staff: ${staffHandoffUrl}`,
        title: 'Wrap & Roll order',
      });
    } catch {
      // user dismissed
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Thank you!</Text>
        <Text style={styles.sub}>Your order has been placed successfully.</Text>
        <Text style={styles.handoffLine}>
          Tell staff your name, phone, or order reference below — or show this screen.
        </Text>

        {!orderId ? (
          <Text style={styles.error}>Missing order ID. Open this screen after checkout or tracking.</Text>
        ) : (
          <View style={styles.card}>
            <Text style={styles.orderId}>Order #{orderId.slice(0, 8)}</Text>
            {loading ? <ActivityIndicator style={{ marginVertical: 8 }} /> : null}
            {trackError ? (
              <Text style={styles.trackWarn}>
                Status could not be refreshed: {trackError}
              </Text>
            ) : null}

            <Row label="Status" value={status} />
            <Row label="Payment" value={paymentStatus} />
            <Row label="Fulfillment" value={fulfillmentType || (loading ? '…' : '—')} />
            <Row label="Total" value={total != null ? `LKR ${total.toFixed(0)}` : '—'} />

            {showCounterHandoffQr ? (
              <View style={styles.handoffCard}>
                <Text style={styles.handoffTitle}>Cashier lookup</Text>
                <Text style={styles.handoffBody}>
                  Staff can scan this in the POS to open your order (dine-in, pickup, or delivery).
                </Text>
                <View style={styles.qrWrap}>
                  <CashierHandoffQr value={staffHandoffUrl} size={176} />
                </View>
                <Text style={styles.qrFallbackHint}>If the code doesn’t appear, use Copy staff link.</Text>
                <View style={styles.handoffActions}>
                  <Pressable
                    style={styles.secondaryBtn}
                    onPress={() => void copyText('Counter link', staffHandoffUrl)}
                  >
                    <Text style={styles.secondaryBtnText}>Copy staff link</Text>
                  </Pressable>
                  <Pressable
                    style={styles.secondaryBtn}
                    onPress={() => void copyText('Order ID', orderId)}
                  >
                    <Text style={styles.secondaryBtnText}>Copy full order ID</Text>
                  </Pressable>
                  <Pressable style={styles.secondaryBtn} onPress={() => void shareStaffLink()}>
                    <Text style={styles.secondaryBtnText}>Share</Text>
                  </Pressable>
                </View>
                {copyHint ? <Text style={styles.copyHint}>{copyHint}</Text> : null}
              </View>
            ) : null}
          </View>
        )}

        <Pressable style={styles.btn} onPress={() => router.push('/(tabs)')}>
          <Text style={styles.btnText}>Back to menu</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f7f4' },
  content: { paddingHorizontal: 16, paddingBottom: 24 },
  title: { fontSize: 30, fontWeight: '700', color: '#1c1917' },
  sub: { marginTop: 8, marginBottom: 8, color: '#6b7280' },
  handoffLine: { marginBottom: 12, color: '#57534e', fontSize: 14, lineHeight: 20 },
  card: { backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: '#ece7e2', padding: 14 },
  orderId: { fontSize: 18, fontWeight: '700', color: '#111827', marginBottom: 8 },
  row: { marginTop: 8 },
  rowLabel: { fontSize: 12, textTransform: 'uppercase', color: '#6b7280', fontWeight: '700' },
  rowValue: { fontSize: 16, color: '#111827', marginTop: 2 },
  error: { color: '#b91c1c', marginBottom: 8 },
  trackWarn: { color: '#92400e', marginBottom: 8, fontSize: 13, lineHeight: 18 },
  handoffCard: {
    marginTop: 16,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fcd34d',
    backgroundColor: '#fffbeb',
  },
  handoffTitle: { fontSize: 11, fontWeight: '800', color: '#92400e', letterSpacing: 0.5 },
  handoffBody: { marginTop: 6, fontSize: 13, color: '#44403c', lineHeight: 18 },
  qrWrap: { marginTop: 12, alignItems: 'center' },
  handoffActions: { marginTop: 12, gap: 8 },
  secondaryBtn: {
    minHeight: 42,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#d6d3d1',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  secondaryBtnText: { fontSize: 14, fontWeight: '700', color: '#1c1917' },
  copyHint: { marginTop: 8, fontSize: 12, fontWeight: '600', color: '#047857', textAlign: 'center' },
  qrFallbackHint: {
    marginTop: 8,
    fontSize: 11,
    color: '#78716c',
    textAlign: 'center',
    lineHeight: 16,
  },
  btn: { marginTop: 12, minHeight: 46, backgroundColor: '#ea580c', borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
