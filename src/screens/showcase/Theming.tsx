import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ThemeProvider, atoms, useTheme, type ThemeName } from '#/flux';
import { useSetThemePrefs } from '@/state/shell';

import { Row, Section, Swatch } from './helpers';

const BG_KEYS = [
  'bg',
  'bg_contrast_25',
  'bg_contrast_50',
  'bg_contrast_100',
  'bg_contrast_200',
  'bg_contrast_300',
  'bg_contrast_400',
  'bg_contrast_500',
  'bg_contrast_600',
  'bg_contrast_700',
  'bg_contrast_800',
  'bg_contrast_900',
  'bg_contrast_950',
  'bg_contrast_975',
] as const;

const TEXT_KEYS = [
  'text',
  'text_link',
  'text_contrast_low',
  'text_contrast_medium',
  'text_contrast_high',
  'text_inverted',
] as const;

const BORDER_KEYS = [
  'border_contrast_low',
  'border_contrast_medium',
  'border_contrast_high',
] as const;

const SHADOW_KEYS = ['shadow_xs', 'shadow_sm', 'shadow_md', 'shadow_lg', 'shadow_xl'] as const;

function ThemePanel({ themeName }: { themeName: ThemeName }) {
  return (
    <ThemeProvider theme={themeName}>
      <PanelBody />
    </ThemeProvider>
  );
}

function PanelBody() {
  const t = useTheme();

  return (
    <View
      style={[
        atoms.p_lg,
        atoms.gap_md,
        atoms.rounded_md,
        t.atoms.bg,
        t.atoms.border_contrast_low,
        atoms.border,
      ]}
    >
      <Text style={[atoms.text_lg, atoms.font_bold, t.atoms.text]}>{t.name}</Text>

      <View style={[atoms.gap_sm]}>
        <Text style={[atoms.text_sm, atoms.font_semi_bold, t.atoms.text]}>Backgrounds</Text>
        <Row>
          {BG_KEYS.map((key) => (
            <Swatch key={key} color={t.atoms[key].backgroundColor} label={key.replace('bg_', '')} />
          ))}
        </Row>
      </View>

      <View style={[atoms.gap_sm]}>
        <Text style={[atoms.text_sm, atoms.font_semi_bold, t.atoms.text]}>Text</Text>
        <View style={[atoms.gap_2xs]}>
          {TEXT_KEYS.map((key) => (
            <View key={key} style={[atoms.flex_row, atoms.align_center, atoms.gap_sm]}>
              <View style={[styles.dot, { backgroundColor: t.atoms[key].color }]} />
              <Text style={[atoms.text_sm, t.atoms[key]]}>{key}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={[atoms.gap_sm]}>
        <Text style={[atoms.text_sm, atoms.font_semi_bold, t.atoms.text]}>Borders</Text>
        <Row>
          {BORDER_KEYS.map((key) => (
            <View
              key={key}
              style={[
                atoms.p_md,
                atoms.rounded_sm,
                atoms.border,
                t.atoms.bg,
                t.atoms[key],
                styles.borderBox,
              ]}
            >
              <Text style={[atoms.text_xs, t.atoms.text]}>{key}</Text>
            </View>
          ))}
        </Row>
      </View>

      <View style={[atoms.gap_sm]}>
        <Text style={[atoms.text_sm, atoms.font_semi_bold, t.atoms.text]}>Shadows</Text>
        <Row>
          {SHADOW_KEYS.map((key) => (
            <View
              key={key}
              style={[atoms.p_xl, atoms.rounded_md, t.atoms.bg, t.atoms[key], styles.shadowBox]}
            >
              <Text style={[atoms.text_xs, t.atoms.text]}>{key}</Text>
            </View>
          ))}
        </Row>
      </View>
    </View>
  );
}

function ThemeButtons() {
  const { setColorMode, setDarkTheme } = useSetThemePrefs();
  const t = useTheme();

  const items: { label: string; onPress: () => void }[] = [
    { label: 'System', onPress: () => setColorMode('system') },
    { label: 'Light', onPress: () => setColorMode('light') },
    {
      label: 'Dim',
      onPress: () => {
        setColorMode('dark');
        setDarkTheme('dim');
      },
    },
    {
      label: 'Dark',
      onPress: () => {
        setColorMode('dark');
        setDarkTheme('dark');
      },
    },
  ];

  return (
    <Row>
      {items.map((item) => (
        <Pressable
          key={item.label}
          onPress={item.onPress}
          style={[
            atoms.p_md,
            atoms.px_lg,
            atoms.rounded_full,
            atoms.border,
            t.atoms.bg_contrast_50,
          ]}
        >
          <Text style={[atoms.text_sm, atoms.font_medium, t.atoms.text]}>{item.label}</Text>
        </Pressable>
      ))}
    </Row>
  );
}

export function ThemingSection() {
  return (
    <Section title="Theming · ThemeProvider · useTheme">
      <ThemeButtons />
      <View style={[atoms.gap_lg]}>
        {(['light', 'dim', 'dark'] as const).map((name) => (
          <ThemePanel key={name} themeName={name} />
        ))}
      </View>
    </Section>
  );
}

const styles = StyleSheet.create({
  dot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#00000033',
  },
  borderBox: {
    minWidth: 120,
  },
  shadowBox: {
    minWidth: 100,
    backgroundColor: '#fff',
  },
});
