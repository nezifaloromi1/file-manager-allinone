import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { atoms, useTheme } from '#/flux';
import { Screen } from '@/components/Screen';

import { BreakpointsSection } from './showcase/Breakpoints';
import { FontsSection } from './showcase/Fonts';
import { PaletteSection } from './showcase/Palette';
import { PlatformSection } from './showcase/Platform';
import { RadiiBordersSection } from './showcase/RadiiBorders';
import { ShadowsSection } from './showcase/Shadows';
import { SpacingSection } from './showcase/Spacing';
import { ThemingSection } from './showcase/Theming';
import { TokensSection } from './showcase/Tokens';
import { TypographySection } from './showcase/Typography';
import { UtilsSection } from './showcase/Utils';

/**
 * One-screen design system showcase (dev only).
 * All sections stacked in a single ScrollView.
 */
export function FluxShowcaseScreen() {
  const t = useTheme();

  return (
    <Screen>
      <ScrollView
        style={[styles.root, t.atoms.bg]}
        contentContainerStyle={[styles.content, styles.scrollContent]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[atoms.gap_5xl]}>
          <Text style={[atoms.text_3xl, atoms.font_normal, t.atoms.text, styles.header]}>
            Design System
          </Text>
          <ThemingSection />
          <PaletteSection />
          <TypographySection />
          <SpacingSection />
          <RadiiBordersSection />
          <ShadowsSection />
          <BreakpointsSection />
          <FontsSection />
          <PlatformSection />
          <TokensSection />
          <UtilsSection />
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { gap: 8 },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 40 },
  header: { marginBottom: 8 },
});
