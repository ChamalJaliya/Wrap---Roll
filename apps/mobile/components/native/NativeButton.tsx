import React from 'react';
import { Pressable, StyleSheet, Text, ViewStyle, TextStyle, View, StyleProp } from 'react-native';
import * as Haptics from 'expo-haptics';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withSpring, 
  interpolate 
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';

interface NativeButtonProps {
  onPress?: () => void;
  title?: string;
  variant?: 'primary' | 'secondary' | 'ghost' | 'outline';
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  disabled?: boolean;
  children?: React.ReactNode;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function NativeButton({ 
  onPress, 
  title, 
  variant = 'primary', 
  style, 
  textStyle,
  disabled,
  children
}: NativeButtonProps) {
  const pressed = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { scale: withSpring(interpolate(pressed.value, [0, 1], [1, 0.96])) }
      ],
      opacity: withSpring(interpolate(pressed.value, [0, 1], [1, 0.9]))
    };
  });

  const handlePressIn = () => {
    pressed.value = 1;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handlePressOut = () => {
    pressed.value = 0;
  };

  const isPrimary = variant === 'primary';
  const isSecondary = variant === 'secondary';
  const isOutline = variant === 'outline';
  const isGhost = variant === 'ghost';

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled}
      style={[styles.base, style, animatedStyle]}
    >
      {children || (isPrimary ? (
        <LinearGradient
          colors={['#ea580c', '#c2410c']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradient}
        >
          <Text style={[styles.text, styles.textPrimary, textStyle]}>{title}</Text>
        </LinearGradient>
      ) : (
        <View style={[
          styles.inner, 
          isSecondary && styles.secondary,
          isOutline && styles.outline,
          isGhost && styles.ghost
        ]}>
          <Text style={[
            styles.text, 
            isSecondary && styles.textSecondary,
            isOutline && styles.textOutline,
            isGhost && styles.textGhost,
            textStyle
          ]}>{title}</Text>
        </View>
      ))}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: 14,
    overflow: 'hidden',
    minHeight: 52,
    justifyContent: 'center',
  },
  gradient: {
    flex: 1,
    paddingHorizontal: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  inner: {
    flex: 1,
    paddingHorizontal: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  secondary: {
    backgroundColor: '#1c1917',
  },
  outline: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: '#e7e5e4',
  },
  ghost: {
    backgroundColor: 'transparent',
  },
  text: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  textPrimary: {
    color: '#fff',
  },
  textSecondary: {
    color: '#fff',
  },
  textOutline: {
    color: '#1c1917',
  },
  textGhost: {
    color: '#ea580c',
  },
});
