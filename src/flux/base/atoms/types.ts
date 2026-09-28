import { type ViewStyle } from 'react-native';

/**
 * @deprecated design.md mandates hairline-only depth — "Don't add drop
 * shadows." The `shadow_*` atoms now resolve to hairlines. Kept exported so
 * existing `ShadowStyle` annotations keep compiling.
 */
export type ShadowStyle = Pick<
  ViewStyle,
  'shadowColor' | 'shadowOpacity' | 'shadowRadius' | 'elevation' | 'shadowOffset' | 'boxShadow'
>;

/**
 * design.md uses hairline-only depth: depth is communicated by a 1px border
 * plus the white-on-cream surface contrast, never by a drop shadow.
 */
export type HairlineStyle = Pick<ViewStyle, 'borderColor' | 'borderWidth'>;
