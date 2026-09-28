import { StyleSheet, Text, View } from 'react-native';

import { atoms, extractPadding, useTheme, utils } from '#/flux';

import { Section } from './helpers';

const BASE = '#1085fe';

function RowItem({ label, value }: { label: string; value: string }) {
  const t = useTheme();
  return (
    <View style={[atoms.flex_row, atoms.justify_between, atoms.py_sm, styles.row]}>
      <Text style={[atoms.text_sm, t.atoms.text_contrast_medium]}>{label}</Text>
      <Text style={[atoms.text_sm, atoms.font_medium, t.atoms.text]}>{value}</Text>
    </View>
  );
}

export function UtilsSection() {
  const t = useTheme();
  const lightened = [20, 40, 60].map((a) => utils.lighten(BASE, a));
  const darkened = [20, 40, 60].map((a) => utils.darken(BASE, a));
  const contrastWhite = utils.contrastRatio(BASE, '#ffffff') ?? 1;
  const contrastBlack = utils.contrastRatio(BASE, '#000000') ?? 1;
  const withAlpha = utils.alpha('#000000', 0.3);
  const selected = utils.select('light', {
    light: 'light value',
    dark: 'dark value',
    dim: 'dim value',
  });
  const selectedDim = utils.select('dim', { light: 'light value', default: 'default fallback' });
  const flat = utils.flatten([atoms.p_lg, atoms.rounded_md, t.atoms.bg]);
  const padding = extractPadding([{ paddingHorizontal: 16, paddingTop: 8 }]);

  return (
    <Section title="Utils · color helpers">
      <View style={[atoms.gap_sm]}>
        <Text style={[atoms.text_sm, atoms.font_semi_bold, t.atoms.text]}>base {BASE}</Text>
        <View style={[styles.bar, { backgroundColor: BASE }]} />
      </View>

      <View style={[atoms.gap_sm]}>
        <Text style={[atoms.text_sm, atoms.font_semi_bold, t.atoms.text]}>lighten</Text>
        <View style={[atoms.flex_row, atoms.gap_sm]}>
          {lightened.map((c, i) => (
            <View key={i} style={[atoms.gap_2xs, atoms.align_center]}>
              <View style={[styles.swatch, { backgroundColor: c }]} />
              <Text style={[atoms.text_2xs, t.atoms.text_contrast_low]}>{c}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={[atoms.gap_sm]}>
        <Text style={[atoms.text_sm, atoms.font_semi_bold, t.atoms.text]}>darken</Text>
        <View style={[atoms.flex_row, atoms.gap_sm]}>
          {darkened.map((c, i) => (
            <View key={i} style={[atoms.gap_2xs, atoms.align_center]}>
              <View style={[styles.swatch, { backgroundColor: c }]} />
              <Text style={[atoms.text_2xs, t.atoms.text_contrast_low]}>{c}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={[atoms.border, atoms.rounded_sm, t.atoms.border_contrast_low, styles.panel]}>
        <RowItem label="contrastRatio(base, #fff)" value={contrastWhite.toFixed(2)} />
        <RowItem label="contrastRatio(base, #000)" value={contrastBlack.toFixed(2)} />
        <RowItem label="WCAG AA (4.5) on white" value={contrastWhite >= 4.5 ? 'PASS' : 'FAIL'} />
        <RowItem label="WCAG AAA (7) on white" value={contrastWhite >= 7 ? 'PASS' : 'FAIL'} />
        <RowItem label="alpha('#000000', 0.3)" value={String(withAlpha)} />
        <RowItem label="select('light', …)" value={String(selected)} />
        <RowItem label="select('dim', {light, default})" value={String(selectedDim)} />
        <RowItem label="flatten([...])" value={Object.keys(flat || {}).join(', ')} />
        <RowItem
          label="extractPadding"
          value={`t=${padding.paddingTop} r=${padding.paddingRight} b=${padding.paddingBottom} l=${padding.paddingLeft}`}
        />
        <RowItem
          label="leading({lineHeight:1.5, fontSize:16})"
          value={String(utils.leading({ lineHeight: 1.5, fontSize: 16 }))}
        />
      </View>
    </Section>
  );
}

const styles = StyleSheet.create({
  row: {
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#00000015',
  },
  panel: { paddingVertical: 4 },
  bar: { height: 32, borderRadius: 6 },
  swatch: { width: 48, height: 48, borderRadius: 8 },
});
