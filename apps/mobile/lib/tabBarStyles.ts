import type { ViewStyle } from 'react-native';

/** Matches `app/(tabs)/_layout.tsx` — keep in sync when changing the floating tab bar container. */
export const TAB_BAR_VISIBLE_STYLE: ViewStyle = {
  position: 'absolute',
  left: 0,
  right: 0,
  bottom: 0,
  width: '100%',
  backgroundColor: 'transparent',
  borderTopWidth: 0,
  elevation: 0,
  shadowOpacity: 0,
};

export const TAB_BAR_HIDDEN_STYLE: ViewStyle = {
  display: 'none',
  height: 0,
  overflow: 'hidden',
};
