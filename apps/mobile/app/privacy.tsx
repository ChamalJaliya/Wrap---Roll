import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { AppScreen, SectionTitle, SurfaceCard, TopHeader } from '@/components/mobile-ui';
import { HeaderAccountCartActions } from '@/components/HeaderAccountCartActions';
import { mobileTheme } from '@/constants/mobileTheme';

export default function PrivacyScreen() {
  return (
    <AppScreen scroll contentContainerStyle={styles.content}>
      <TopHeader
        title="Privacy Policy"
        subtitle="Last updated: April 2026"
        right={<HeaderAccountCartActions />}
      />

      <Section
        title="What we collect"
        body="We collect contact details needed to fulfill orders and provide support."
      />
      <Section
        title="How we use data"
        body="Data is used for order processing, account support, fraud prevention, and service improvements."
      />
      <Section
        title="Data sharing"
        body="We only share with essential service providers required to operate payments, delivery, and infrastructure."
      />
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
