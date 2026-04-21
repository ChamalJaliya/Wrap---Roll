import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';

type BrandLoaderProps = {
  title?: string;
  subtitle?: string;
  compact?: boolean;
};

export function BrandLoader({
  title = 'Wrap & Roll',
  subtitle = 'Preparing your experience...',
  compact = false,
}: BrandLoaderProps) {
  const pulse = useRef(new Animated.Value(0)).current;
  const dot = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
          easing: Easing.inOut(Easing.quad),
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 900,
          useNativeDriver: true,
          easing: Easing.inOut(Easing.quad),
        }),
      ]),
    );

    const dotLoop = Animated.loop(
      Animated.timing(dot, {
        toValue: 1,
        duration: 1200,
        useNativeDriver: true,
        easing: Easing.linear,
      }),
    );

    pulseLoop.start();
    dotLoop.start();
    return () => {
      pulseLoop.stop();
      dotLoop.stop();
    };
  }, [dot, pulse]);

  const pulseScale = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.05],
  });
  const pulseOpacity = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.85, 1],
  });

  const dotOffset = dot.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 12],
  });

  return (
    <View style={[styles.container, compact && styles.compactContainer]}>
      <Animated.View style={[styles.badge, { transform: [{ scale: pulseScale }], opacity: pulseOpacity }]}>
        <Text style={styles.badgeText}>WR</Text>
      </Animated.View>

      <Text style={[styles.title, compact && styles.compactTitle]}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>

      <View style={styles.dots}>
        <Animated.View style={[styles.dot, { transform: [{ translateX: dotOffset }] }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  compactContainer: {
    gap: 6,
  },
  badge: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: '#ea580c',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 5 },
  },
  badgeText: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  title: {
    marginTop: 6,
    fontSize: 28,
    fontWeight: '900',
    color: '#111827',
  },
  compactTitle: {
    fontSize: 22,
  },
  subtitle: {
    fontSize: 14,
    color: '#6b7280',
  },
  dots: {
    width: 40,
    height: 8,
    borderRadius: 999,
    backgroundColor: '#e5e7eb',
    marginTop: 6,
    justifyContent: 'center',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: '#ea580c',
  },
});
