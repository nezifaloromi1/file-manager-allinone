import { Pressable, StyleSheet, Text, View } from 'react-native';

import { atoms, computeFontScaleMultiplier, useFlux, useTheme } from '#/flux';

import { Section } from './helpers';

const SCALES = ['-2', '-1', '0', '1', '2'] as const;

export function FontsSection() {
  const flux = useFlux();
  const t = useTheme();
  const { scale, scaleMultiplier, family, setFontScale, setFontFamily } = flux.fonts;

  return (
    <Section title="Fonts · scale · family">
      <View style={[atoms.gap_sm]}>
        <Text style={[atoms.text_sm, atoms.font_semi_bold, t.atoms.text]}>font scale</Text>
        <View style={[atoms.flex_row, atoms.gap_sm, atoms.flex_wrap]}>
          {SCALES.map((s) => (
            <Pressable
              key={s}
              onPress={() => setFontScale(s)}
              style={[
                atoms.p_md,
                atoms.px_lg,
                atoms.rounded_full,
                atoms.border,
                styles.btn,
                scale === s && styles.btnActive,
              ]}
            >
              <Text
                style={[
                  atoms.text_sm,
                  atoms.font_medium,
                  t.atoms.text,
                  scale === s && styles.btnTextActive,
                ]}
              >
                {s}
              </Text>
            </Pressable>
          ))}
        </View>
        <Text style={[atoms.text_2xs, t.atoms.text_contrast_medium]}>
          scale={scale} · multiplier={scaleMultiplier.toFixed(4)}
        </Text>
      </View>

      <View style={[atoms.gap_sm]}>
        <Text style={[atoms.text_sm, atoms.font_semi_bold, t.atoms.text]}>font family</Text>
        <View style={[atoms.flex_row, atoms.gap_sm]}>
          {(['system', 'theme'] as const).map((ff) => (
            <Pressable
              key={ff}
              onPress={() => setFontFamily(ff)}
              style={[
                atoms.p_md,
                atoms.px_lg,
                atoms.rounded_full,
                atoms.border,
                styles.btn,
                family === ff && styles.btnActive,
              ]}
            >
              <Text
                style={[
                  atoms.text_sm,
                  atoms.font_medium,
                  t.atoms.text,
                  family === ff && styles.btnTextActive,
                ]}
              >
                {ff}
              </Text>
            </Pressable>
          ))}
        </View>
        <Text style={[atoms.text_2xs, t.atoms.text_contrast_medium]}>family={family}</Text>
      </View>

      <View style={[atoms.gap_sm]}>
        <Text style={[atoms.text_sm, atoms.font_semi_bold, t.atoms.text]}>
          computeFontScaleMultiplier
        </Text>
        {SCALES.map((s) => (
          <View key={s} style={[atoms.flex_row, atoms.justify_between, styles.row]}>
            <Text style={[atoms.text_sm, t.atoms.text]}>{s}</Text>
            <Text style={[atoms.text_sm, t.atoms.text_contrast_medium]}>
              {computeFontScaleMultiplier(s).toFixed(4)}
            </Text>
          </View>
        ))}
      </View>
    </Section>
  );
}

const styles = StyleSheet.create({
  btn: { backgroundColor: '#f5f5f5', borderColor: '#ccc' },
  btnActive: { backgroundColor: '#111', borderColor: '#111' },
  btnTextActive: { color: '#fff' },
  row: { paddingHorizontal: 4 },
});
