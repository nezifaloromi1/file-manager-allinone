import { StyleSheet, Text, View } from 'react-native';

import { atoms, useTheme } from '#/flux';

import { Section } from './helpers';

const SIZES = [
  'text_2xs',
  'text_xs',
  'text_sm',
  'text_md',
  'text_lg',
  'text_xl',
  'text_2xl',
  'text_3xl',
  'text_4xl',
  'text_5xl',
] as const;

const WEIGHTS = ['font_normal', 'font_medium', 'font_semi_bold', 'font_bold'] as const;
const LEADING = ['leading_tight', 'leading_snug', 'leading_relaxed'] as const;
const DECOR = ['underline', 'strike_through', 'italic'] as const;
const ALIGN = ['text_left', 'text_center', 'text_right'] as const;

function TypeRow({ label, style }: { label: string; style?: any }) {
  const t = useTheme();
  return (
    <View style={[atoms.flex_row, atoms.align_baseline, atoms.gap_md, atoms.border_b, atoms.pb_sm]}>
      <Text style={[atoms.text_2xs, t.atoms.text_contrast_low, styles.meta]}>{label}</Text>
      <Text style={[atoms.text_md, t.atoms.text, style]}>The quick brown fox jumps</Text>
    </View>
  );
}

export function TypographySection() {
  const t = useTheme();
  return (
    <Section title="Typography">
      <View style={[atoms.gap_sm]}>
        <Text style={[atoms.text_2xs, t.atoms.text_contrast_low]}>Type scale</Text>
        {SIZES.map((size) => (
          <TypeRow key={size} label={size} style={atoms[size]} />
        ))}
      </View>

      <View style={[atoms.gap_sm]}>
        <Text style={[atoms.text_2xs, t.atoms.text_contrast_low]}>Weights · decoration</Text>
        {WEIGHTS.map((w) => (
          <TypeRow key={w} label={w} style={[atoms.text_lg, atoms[w]]} />
        ))}
        {DECOR.map((d) => (
          <TypeRow key={d} label={d} style={[atoms.text_lg, atoms[d]]} />
        ))}
      </View>

      <View style={[atoms.gap_sm]}>
        <Text style={[atoms.text_2xs, t.atoms.text_contrast_low]}>Line height</Text>
        {LEADING.map((l) => (
          <View key={l} style={[atoms.gap_2xs]}>
            <Text style={[atoms.text_2xs, t.atoms.text_contrast_low]}>{l}</Text>
            <Text style={[atoms.text_md, t.atoms.text, atoms[l]]}>
              Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor
              incididunt ut labore et dolore magna aliqua.
            </Text>
          </View>
        ))}
      </View>

      <View style={[atoms.gap_sm]}>
        <Text style={[atoms.text_2xs, t.atoms.text_contrast_low]}>Text align</Text>
        {ALIGN.map((a) => (
          <View key={a} style={[atoms.border, atoms.p_sm, atoms.rounded_sm]}>
            <Text style={[atoms.text_2xs, t.atoms.text_contrast_low]}>{a}</Text>
            <Text style={[atoms.text_md, t.atoms.text, atoms[a]]}>Aligned text sample</Text>
          </View>
        ))}
      </View>
    </Section>
  );
}

const styles = StyleSheet.create({
  meta: {
    width: 110,
  },
});
