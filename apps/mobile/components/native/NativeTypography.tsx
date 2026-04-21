import React from 'react';
import { Text, StyleSheet, TextStyle, Platform } from 'react-native';

interface NativeTextProps {
  children: React.ReactNode;
  variant?: 'h1' | 'h2' | 'h3' | 'body' | 'bodyBold' | 'caption' | 'label';
  color?: string;
  style?: TextStyle;
  numberOfLines?: number;
}

export function NativeTypography({ 
  children, 
  variant = 'body', 
  color = '#1c1917', 
  style,
  numberOfLines 
}: NativeTextProps) {
  return (
    <Text 
      style={[
        styles.base, 
        styles[variant], 
        { color }, 
        style
      ]}
      numberOfLines={numberOfLines}
    >
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  base: {
    fontFamily: Platform.select({ ios: 'System', android: 'sans-serif' }),
  },
  h1: {
    fontSize: 32,
    fontWeight: '800',
    lineHeight: 38,
    letterSpacing: -0.5,
  },
  h2: {
    fontSize: 24,
    fontWeight: '800',
    lineHeight: 30,
    letterSpacing: -0.3,
  },
  h3: {
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 26,
  },
  body: {
    fontSize: 16,
    lineHeight: 24,
    color: '#44403c',
  },
  bodyBold: {
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 24,
  },
  caption: {
    fontSize: 13,
    color: '#78716c',
    lineHeight: 18,
  },
  label: {
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    color: '#78716c',
  },
});
