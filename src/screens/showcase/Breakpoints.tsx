import { StyleSheet, Text, View } from 'react-native';

import { atoms, useBreakpoints, useLayoutBreakpoints, useTheme } from '#/flux';

import { Section } from './helpers';

function Flag({ label, on }: { label: string; on: boolean }) {
  const t = useTheme();
  return (
    <View style={[atoms.flex_row, atoms.align_center, atoms.gap_sm]}>
      <View style={[styles.pill, { backgroundColor: on ? '#1a7f37' : '#d0d7de' }]} />
      <Text style={[atoms.text_sm, t.atoms.text]}>
        {label}: {String(on)}
      </Text>
    </View>
  );
}

export function BreakpointsSection() {
  const b = useBreakpoints();
  const layout = useLayoutBreakpoints();
  const t = useTheme();

  return (
    <Section title="Breakpoints">
      <View
        style={[
          atoms.p_md,
          atoms.gap_sm,
          atoms.rounded_sm,
          atoms.border,
          t.atoms.border_contrast_low,
          t.atoms.bg_contrast_25,
        ]}
      >
        <Text style={[atoms.text_sm, atoms.font_semi_bold, t.atoms.text]}>useBreakpoints()</Text>
        <Flag label="gtPhone (≥500)" on={b.gtPhone} />
        <Flag label="gtMobile (≥800)" on={b.gtMobile} />
        <Flag label="gtTablet (≥1300)" on={b.gtTablet} />
        <Text style={[atoms.text_sm, atoms.mt_sm, t.atoms.text_contrast_medium]}>
          activeBreakpoint: {String(b.activeBreakpoint)}
        </Text>
      </View>
      <View
        style={[
          atoms.p_md,
          atoms.gap_sm,
          atoms.rounded_sm,
          atoms.border,
          t.atoms.border_contrast_low,
          t.atoms.bg_contrast_25,
        ]}
      >
        <Text style={[atoms.text_sm, atoms.font_semi_bold, t.atoms.text]}>
          useLayoutBreakpoints()
        </Text>
        <Flag label="rightNavVisible (≥1100)" on={layout.rightNavVisible} />
        <Flag label="centerColumnOffset (1100–1300)" on={layout.centerColumnOffset} />
        <Flag label="leftNavMinimal (≤1300)" on={layout.leftNavMinimal} />
      </View>
      <Text style={[atoms.text_2xs, t.atoms.text_contrast_low]}>
        Resize window / device width to flip flags
      </Text>
    </Section>
  );
}

const styles = StyleSheet.create({
  pill: { width: 10, height: 10, borderRadius: 5 },
});
