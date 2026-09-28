import { StyleSheet, Text, View } from 'react-native';

import { atoms, tokens, useGutters, useTheme } from '#/flux';

import { Section } from './helpers';

const SPACE_KEYS = ['_2xs', 'xs', 'sm', 'md', 'lg', 'xl', '_2xl', '_3xl', '_4xl', '_5xl'] as const;
const PAD_KEYS = ['p', 'px', 'py', 'pt', 'pb', 'pl', 'pr'] as const;
const MARGIN_KEYS = ['m', 'mx', 'my', 'mt', 'mb', 'ml', 'mr'] as const;

function gapAtomKey(k: (typeof SPACE_KEYS)[number]): keyof typeof atoms {
  return (k.startsWith('_') ? `gap${k}` : `gap_${k}`) as keyof typeof atoms;
}

function Bar({ size, label }: { size: number; label: string }) {
  return (
    <View style={[atoms.flex_row, atoms.align_center, atoms.gap_md]}>
      <Text style={[atoms.text_2xs, styles.meta]}>{label}</Text>
      <View style={[styles.bar, { width: size * 2 }]} />
      <Text style={[atoms.text_2xs, styles.val]}>{size}px</Text>
    </View>
  );
}

export function SpacingSection() {
  const t = useTheme();
  const gutters = useGutters(['base']);
  const guttersWide = useGutters(['wide']);
  const guttersPair = useGutters(['compact', 'wide']);

  return (
    <Section title="Spacing · gutters">
      <View style={[atoms.gap_sm]}>
        <Text style={[atoms.text_2xs, t.atoms.text_contrast_low]}>tokens.space</Text>
        {SPACE_KEYS.map((k) => (
          <Bar key={k} size={tokens.space[k]} label={k} />
        ))}
      </View>

      <View style={[atoms.gap_sm]}>
        <Text style={[atoms.text_2xs, t.atoms.text_contrast_low]}>Padding atoms</Text>
        <View style={[atoms.flex_row, atoms.gap_sm, atoms.flex_wrap]}>
          {PAD_KEYS.map((prefix) =>
            SPACE_KEYS.map((k) => {
              const key = `${prefix}_${k}` as keyof typeof atoms;
              const style = atoms[key];
              if (!style) return null;
              return (
                <View
                  key={key}
                  style={[
                    style,
                    atoms.border,
                    atoms.rounded_sm,
                    t.atoms.border_contrast_medium,
                    styles.box,
                  ]}
                >
                  <Text style={[atoms.text_2xs, t.atoms.text_contrast_medium]}>{key}</Text>
                </View>
              );
            }),
          )}
        </View>
      </View>

      <View style={[atoms.gap_sm]}>
        <Text style={[atoms.text_2xs, t.atoms.text_contrast_low]}>Margin atoms</Text>
        <View style={[atoms.flex_row, atoms.gap_sm, atoms.flex_wrap]}>
          {MARGIN_KEYS.map((prefix) =>
            SPACE_KEYS.map((k) => {
              const key = `${prefix}_${k}` as keyof typeof atoms;
              if (!atoms[key]) return null;
              return (
                <View key={key} style={[atoms.border, atoms.rounded_sm, styles.boxMargin]}>
                  <View style={[atoms[key], atoms.border, atoms.rounded_sm, styles.inner]}>
                    <Text style={[atoms.text_2xs, t.atoms.text]}>{key}</Text>
                  </View>
                </View>
              );
            }),
          )}
        </View>
      </View>

      <View style={[atoms.gap_sm]}>
        <Text style={[atoms.text_2xs, t.atoms.text_contrast_low]}>gap_* · useGutters()</Text>
        <View style={[atoms.flex_row, atoms.gap_md, atoms.border, atoms.p_sm, atoms.rounded_sm]}>
          {SPACE_KEYS.map((k) => (
            <View key={k} style={[atoms[gapAtomKey(k)], styles.gapDot]} />
          ))}
        </View>
        <View style={[atoms.border, atoms.rounded_sm, gutters, styles.gutterBox]}>
          <Text style={[atoms.text_2xs, t.atoms.text]}>{"useGutters(['base'])"}</Text>
        </View>
        <View style={[atoms.border, atoms.rounded_sm, guttersWide, styles.gutterBox]}>
          <Text style={[atoms.text_2xs, t.atoms.text]}>{'useGutters(["wide"])'}</Text>
        </View>
        <View style={[atoms.border, atoms.rounded_sm, guttersPair, styles.gutterBox]}>
          <Text style={[atoms.text_2xs, t.atoms.text]}>{"useGutters(['compact', 'wide'])"}</Text>
        </View>
      </View>
    </Section>
  );
}

const styles = StyleSheet.create({
  meta: { width: 48, color: '#888' },
  val: { color: '#888', width: 40 },
  bar: { height: 12, backgroundColor: '#4078f2', borderRadius: 2 },
  box: { minWidth: 56, minHeight: tokens.touchTarget.comfortable, justifyContent: 'center' },
  boxMargin: {
    backgroundColor: '#f3f3f3',
    borderColor: '#ddd',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 4,
  },
  inner: { backgroundColor: '#e8f0fe', borderColor: '#4078f2', borderRadius: 4 },
  gapDot: { width: 24, height: 24, backgroundColor: '#4078f2', borderRadius: 4 },
  gutterBox: { minHeight: 48, backgroundColor: '#fafafa' },
});
