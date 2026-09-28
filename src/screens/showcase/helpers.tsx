import {
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

import { atoms, type TextStyleProp, type ViewStyleProp } from '#/flux';

export function Section({
  title,
  children,
  style,
}: ViewStyleProp & { title: string; children: React.ReactNode }) {
  return (
    <View style={[atoms.p_lg, atoms.gap_md, atoms.rounded_md, styles.card, style]}>
      <Text style={[atoms.text_xl, atoms.font_semi_bold, styles.title]}>{title}</Text>
      <View style={[atoms.gap_md]}>{children}</View>
    </View>
  );
}

export function Row({ children, style }: ViewStyleProp & { children: React.ReactNode }) {
  return <View style={[atoms.flex_row, atoms.gap_sm, atoms.flex_wrap, style]}>{children}</View>;
}

export function Chip({
  label,
  style,
  textStyle,
}: {
  label: string;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}) {
  return (
    <View style={[atoms.p_sm, atoms.rounded_sm, atoms.border, styles.chip, style]}>
      <Text style={[atoms.text_sm, textStyle]}>{label}</Text>
    </View>
  );
}

export function Swatch({ color, label }: { color: string; label?: string }) {
  return (
    <View style={[atoms.gap_2xs, styles.swatchWrap]}>
      <View style={[styles.swatch, { backgroundColor: color }]} />
      {label ? (
        <Text style={[atoms.text_2xs, atoms.text_center, styles.label]}>{label}</Text>
      ) : null}
    </View>
  );
}

export function Txt({ children, style }: TextStyleProp & { children: React.ReactNode }) {
  return <Text style={[atoms.text_sm, style]}>{children}</Text>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#eee',
  },
  title: {
    color: '#111',
  },
  chip: {
    backgroundColor: '#f5f5f5',
    borderColor: '#ddd',
  },
  swatchWrap: {
    width: 64,
    alignItems: 'center',
  },
  swatch: {
    width: 48,
    height: 48,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#00000022',
  },
  label: {
    color: '#111',
  },
});
