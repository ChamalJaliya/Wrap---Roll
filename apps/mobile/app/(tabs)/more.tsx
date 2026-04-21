import React from 'react';
import { ScrollView, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

const links = [
  { label: 'Checkout', href: '/checkout' },
  { label: 'Profile', href: '/profile' },
  { label: 'Track by Order ID', href: '/order/track' },
  { label: 'Order Success Status', href: '/order/success' },
  { label: 'Sign In', href: '/auth/signin' },
  { label: 'Sign Up', href: '/auth/signup' },
  { label: 'About', href: '/about' },
  { label: 'Contact', href: '/contact' },
  { label: 'Privacy', href: '/privacy' },
  { label: 'Terms', href: '/terms' },
];

export default function MoreScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.h1}>More</Text>
        <Text style={styles.sub}>All client app screens are available here in mobile form.</Text>

        <View style={styles.list}>
          {links.map((link) => (
            <Pressable key={link.href} style={styles.row} onPress={() => router.push(link.href as never)}>
              <Text style={styles.rowText}>{link.label}</Text>
              <Text style={styles.rowArrow}>›</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f7f4' },
  content: { paddingHorizontal: 16, paddingBottom: 24 },
  h1: { fontSize: 30, fontWeight: '700', color: '#1c1917' },
  sub: { marginTop: 8, color: '#6b7280', marginBottom: 14 },
  list: {
    borderRadius: 14,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ece7e2',
    overflow: 'hidden',
  },
  row: {
    minHeight: 52,
    paddingHorizontal: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#f1efec',
  },
  rowText: { fontSize: 16, color: '#111827', fontWeight: '600' },
  rowArrow: { fontSize: 22, color: '#9ca3af' },
});
