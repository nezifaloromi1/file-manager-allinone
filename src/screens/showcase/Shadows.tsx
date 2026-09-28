import { StyleSheet, Text, View } from 'react-native';

import { atoms, useTheme } from '#/flux';

import { Section } from './helpers';

const SHADOW_ATOMS = ['shadow_xs', 'shadow_sm', 'shadow_md', 'shadow_lg', 'shadow_xl'] as const;

export function ShadowsSection() {
  const t = useTheme();
  return (
    <Section title="Shadows">
      <View style={[atoms.flex_row, atoms.gap_md, atoms.flex_wrap]}>
        {SHADOW_ATOMS.map((k) => (
          <View key={k} style={[atoms.gap_sm, atoms.align_center]}>
            <View style={[atoms.p_xl, atoms.rounded_md, t.atoms.bg, t.atoms[k], styles.card]}>
              <Text style={[atoms.text_xs, t.atoms.text]}>card</Text>
            </View>
            <Text style={[atoms.text_2xs, t.atoms.text_contrast_low]}>{k}</Text>
          </View>
        ))}
      </View>
      <View style={[atoms.gap_lg, atoms.p_lg, t.atoms.bg_contrast_50, atoms.rounded_md]}>
        {(['shadow_xs', 'shadow_md', 'shadow_xl'] as const).map((k) => (
          <View key={k} style={[atoms.p_xl, atoms.rounded_md, t.atoms.bg, t.atoms[k], styles.card]}>
            <Text style={[atoms.text_sm, t.atoms.text]}>{k}</Text>
          </View>
        ))}
      </View>
    </Section>
  );
}

const styles = StyleSheet.create({
  card: {
    minWidth: 88,
    minHeight: 64,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
