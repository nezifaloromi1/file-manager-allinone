import { StyleSheet, Text, View } from 'react-native';

import { atoms, tokens, useTheme } from '#/flux';

import { Section } from './helpers';

const RADII = [
  'rounded_0',
  'rounded_2xs',
  'rounded_xs',
  'rounded_sm',
  'rounded_md',
  'rounded_lg',
  'rounded_xl',
  'rounded_full',
] as const;

const BORDERS = [
  'border_0',
  'border',
  'border_t',
  'border_b',
  'border_l',
  'border_r',
  'border_x',
  'border_y',
  'border_t_0',
  'border_b_0',
  'border_l_0',
  'border_r_0',
  'border_x_0',
  'border_y_0',
  'border_transparent',
] as const;

const OVERFLOW_KEYS = [
  'overflow_visible',
  'overflow_hidden',
  'overflow_auto',
  'overflow_x_hidden',
  'overflow_y_hidden',
  'overflow_x_visible',
  'overflow_y_visible',
  'hidden',
  'contents',
  'inline',
  'block',
  'pointer',
  'debug',
] as const;

export function RadiiBordersSection() {
  const t = useTheme();
  return (
    <Section title="Radii · Borders · Overflow">
      <View style={[atoms.flex_row, atoms.gap_md, atoms.flex_wrap]}>
        {RADII.map((k) => {
          const tokenKey = k.replace('rounded_', '') as keyof typeof tokens.borderRadius;
          return (
            <View key={k} style={[atoms.gap_2xs, atoms.align_center]}>
              <View
                style={[
                  atoms[k],
                  atoms.border,
                  t.atoms.border_contrast_medium,
                  styles.radiusBox,
                  t.atoms.bg_contrast_100,
                ]}
              />
              <Text style={[atoms.text_2xs, t.atoms.text_contrast_low]}>{k}</Text>
              <Text style={[atoms.text_2xs, t.atoms.text_contrast_low]}>
                {String(tokens.borderRadius[tokenKey])}
              </Text>
            </View>
          );
        })}
      </View>

      <View style={[atoms.flex_row, atoms.gap_md, atoms.flex_wrap]}>
        {BORDERS.map((k) => (
          <View key={k} style={[atoms.gap_2xs, atoms.align_center]}>
            <View
              style={[
                atoms[k],
                atoms.rounded_sm,
                t.atoms.border_contrast_high,
                styles.borderBox,
                t.atoms.bg_contrast_50,
              ]}
            />
            <Text style={[atoms.text_2xs, t.atoms.text_contrast_low]}>{k}</Text>
          </View>
        ))}
      </View>

      <View style={[atoms.flex_row, atoms.gap_sm, atoms.flex_wrap]}>
        {OVERFLOW_KEYS.map((k) => (
          <View
            key={k}
            style={[
              atoms[k],
              atoms.p_md,
              atoms.rounded_sm,
              atoms.border,
              t.atoms.border_contrast_medium,
              t.atoms.bg_contrast_50,
              styles.overflowBox,
            ]}
          >
            <Text style={[atoms.text_2xs, t.atoms.text]}>{k}</Text>
          </View>
        ))}
      </View>
    </Section>
  );
}

const styles = StyleSheet.create({
  radiusBox: { width: 56, height: 56 },
  borderBox: { width: 72, height: 48 },
  overflowBox: { minWidth: 100 },
});
