import { StyleSheet, Text, View } from 'react-native';

import { atoms, tokens, useTheme } from '#/flux';

import { Section } from './helpers';

function TokenTable({ title, entries }: { title: string; entries: [string, string | number][] }) {
  const t = useTheme();
  return (
    <View style={[atoms.gap_sm]}>
      <Text style={[atoms.text_sm, atoms.font_semi_bold, t.atoms.text]}>{title}</Text>
      <View style={[atoms.border, atoms.rounded_sm, t.atoms.border_contrast_low]}>
        {entries.map(([k, v]) => (
          <View
            key={k}
            style={[atoms.flex_row, atoms.justify_between, atoms.px_md, atoms.py_sm, styles.row]}
          >
            <Text style={[atoms.text_sm, t.atoms.text]}>{k}</Text>
            <Text style={[atoms.text_sm, t.atoms.text_contrast_medium]}>{String(v)}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

export function TokensSection() {
  return (
    <Section title="Tokens">
      <TokenTable title="space" entries={Object.entries(tokens.space)} />
      <TokenTable title="fontSize" entries={Object.entries(tokens.fontSize)} />
      <TokenTable title="lineHeight (unitless)" entries={Object.entries(tokens.lineHeight)} />
      <TokenTable title="borderRadius" entries={Object.entries(tokens.borderRadius)} />
      <TokenTable title="fontWeight" entries={Object.entries(tokens.fontWeight)} />
      <TokenTable title="duration (ms)" entries={Object.entries(tokens.duration)} />
      <TokenTable title="touchTarget (px)" entries={Object.entries(tokens.touchTarget)} />
      <TokenTable title="layer" entries={Object.entries(tokens.layer)} />
      <TokenTable title="storageFill" entries={Object.entries(tokens.storageFill)} />
      <TokenTable title="byteUnits" entries={Object.entries(tokens.byteUnits)} />
      <TokenTable title="TRACKING" entries={[['TRACKING', tokens.TRACKING]]} />
    </Section>
  );
}

const styles = StyleSheet.create({
  row: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#00000015',
  },
});
