import React from 'react';
import { StyleSheet, View, ViewStyle, Platform, StyleProp } from 'react-native';

interface NativeCardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  variant?: 'elevated' | 'glass' | 'flat';
  padding?: number;
}

export function NativeCard({ 
  children, 
  style, 
  variant = 'elevated',
  padding = 16 
}: NativeCardProps) {
  return (
    <View style={[
      styles.base,
      variant === 'elevated' && styles.elevated,
      variant === 'glass' && styles.glass,
      variant === 'flat' && styles.flat,
      { padding },
      style
    ]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: 20,
    backgroundColor: '#fff',
    overflow: 'hidden',
  },
  elevated: {
    ...Platform.select({
      ios: {
        shadowColor: '#1c1917',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  glass: {
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  flat: {
    borderWidth: 1,
    borderColor: '#e7e5e4',
  },
});
