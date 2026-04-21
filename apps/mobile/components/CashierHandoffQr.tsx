import React, { useState } from 'react';
import { Image, View, StyleSheet } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

type Props = {
  /** Full cashier resolve URL (with ?resolveOrder=…) */
  value: string;
  /** Pixel size for both PNG and SVG fallback */
  size?: number;
};

function pngQrUri(data: string, size: number): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(data)}`;
}

/**
 * iOS Simulator often renders `react-native-qrcode-svg` as an empty view. Load a PNG over HTTPS first,
 * then fall back to SVG if the image request fails (offline, blocked host, etc.).
 */
export function CashierHandoffQr({ value, size = 200 }: Props) {
  const [useSvg, setUseSvg] = useState(false);

  if (useSvg) {
    return (
      <View style={[styles.svgWrap, { width: size, height: size }]} collapsable={false}>
        <QRCode value={value} size={size} color="#0f172a" backgroundColor="#ffffff" />
      </View>
    );
  }

  return (
    <Image
      accessibilityLabel="QR code for cashier to open this order"
      accessible
      source={{ uri: pngQrUri(value, size) }}
      style={[styles.png, { width: size, height: size }]}
      resizeMode="contain"
      onError={() => setUseSvg(true)}
    />
  );
}

const styles = StyleSheet.create({
  png: {
    backgroundColor: '#ffffff',
    alignSelf: 'center',
  },
  svgWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    backgroundColor: '#ffffff',
  },
});
