import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { AppScreen, SectionTitle, SurfaceCard, TopHeader } from '@/components/mobile-ui';
import { HeaderAccountCartActions } from '@/components/HeaderAccountCartActions';
import { mobileTheme } from '@/constants/mobileTheme';

export default function TermsScreen() {
  return (
    <AppScreen scroll contentContainerStyle={styles.content}>
      <TopHeader
        title="Terms of Service"
        subtitle="Last updated: April 2026"
        right={<HeaderAccountCartActions />}
      />

      <Section title="Orders" body="Orders are confirmed after successful validation and availability checks." />
      <Section title="Payments" body="Payment method availability may vary by channel and fulfillment mode." />
      <Section title="Cancellations" body="Once preparation starts, modifications may be limited depending on kitchen status." />
    </AppScreen>
  );
}

function Section({ title, body }: { title: string; body: string }) {
  return (
    <SurfaceCard>
      <SectionTitle title={title} />
      <Text style={styles.p}>{body}</Text>
    </SurfaceCard>
  );
}

const theme = mobileTheme;

const styles = StyleSheet.create({
  content: { paddingBottom: theme.layout.contentBottom },
  p: { marginTop: 8, color: '#4b5563', lineHeight: 21 },
});
