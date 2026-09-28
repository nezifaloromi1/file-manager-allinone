import { useCallback, useState } from 'react';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Pressable, ScrollView, Switch, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { atoms, useTheme, useGutters } from '@/flux';
import { settingsRepository, type AppSettings } from '#/data/repositories';
import { formatBytes, formatRetention } from '#/core/utils/format';
import { trashSummary } from '#/data/trash';
import { useFocusRevision } from '@/features/navigation/useFocusRevision';
import { Header } from '@/components/layout/Header';
import { useDrawer } from '@/features/navigation/DrawerHost';
import type { NavigationProp } from '#/lib/routes/types';

/**
 * Settings (plan.md §51).
 *
 * The toggles that are safe to flip immediately — theme, hidden files, list vs
 * grid, confirm-before-delete — are live. Everything that depends on a screen
 * that does not exist yet navigates to a registered placeholder rather than
 * silently doing nothing.
 *
 * Writes go through the settings repository, so a preference survives a restart
 * without any screen having to own persistence.
 */
export function SettingsScreen() {
  const t = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  const gutters = useGutters(['base']);
  const { open: openDrawer } = useDrawer();

  const [settings, setSettings] = useState<AppSettings | null>(null);

  // The repository caches, so this is a single read on mount. A `useState`
  // initialiser is used rather than an effect so the first paint is never a
  // frame of wrong toggle positions.
  useState(() => {
    void settingsRepository.get().then(setSettings);
  });

  // What the trash currently holds, shown on the Trash row so a user can see what
  // the safety net is costing them without opening the screen.
  const revision = useFocusRevision();
  const [trashCount, setTrashCount] = useState(0);
  const [trashBytes, setTrashBytes] = useState(0);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      void trashSummary().then((summary) => {
        if (!active) return;
        setTrashCount(summary.count);
        setTrashBytes(summary.bytes);
      });
      return () => {
        active = false;
      };
      // `revision` is the invalidation signal, not data.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [revision]),
  );

  const update = useCallback(async <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    // Optimistic: a toggle that waits for a disk write feels broken, and the
    // repository swallows write failures anyway (it must not crash Settings).
    setSettings((current) => (current ? { ...current, [key]: value } : current));
    await settingsRepository.set(key, value);
  }, []);

  return (
    <SafeAreaView style={[atoms.flex_1, t.atoms.bg]} edges={['top']}>
      <Header title="Settings" onMenu={openDrawer} testID="settingstab.header" />

      <ScrollView
        contentContainerStyle={[
          gutters,
          atoms.p_lg,
          atoms.gap_lg,
          { paddingBottom: insets.bottom + 96 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Section title="Appearance">
          <Segmented
            label="Theme"
            options={[
              { value: 'system', label: 'System' },
              { value: 'light', label: 'Light' },
              { value: 'dark', label: 'Dark' },
            ]}
            value={settings?.theme ?? 'system'}
            onChange={(value) => void update('theme', value as AppSettings['theme'])}
            testID="settings.theme"
          />
          <Segmented
            label="Default view"
            options={[
              { value: 'list', label: 'List' },
              { value: 'grid', label: 'Grid' },
            ]}
            value={settings?.view ?? 'list'}
            onChange={(value) => void update('view', value as AppSettings['view'])}
            testID="settings.view"
          />
          <ToggleRow
            label="Show file extensions"
            value={settings?.showExtensions ?? true}
            onChange={(value) => void update('showExtensions', value)}
            testID="settings.showExtensions"
          />
        </Section>

        <Section title="Files">
          <ToggleRow
            label="Show hidden files"
            hint="Dotfiles such as .gitignore"
            value={settings?.showHidden ?? false}
            onChange={(value) => void update('showHidden', value)}
            testID="settings.showHidden"
          />
          <ToggleRow
            label="Folders first"
            value={settings?.foldersFirst ?? true}
            onChange={(value) => void update('foldersFirst', value)}
            testID="settings.foldersFirst"
          />
          <ToggleRow
            label="Confirm before deleting"
            value={settings?.confirmDelete ?? true}
            onChange={(value) => void update('confirmDelete', value)}
            testID="settings.confirmDelete"
          />
          <ToggleRow
            label="Move to trash instead of deleting"
            /*
             * Two things a user needs to know, both of which used to be hidden
             * behind a hardcoded "30 days": how long the safety net lasts, and
             * that the file still occupies storage until then. A user who trashes
             * a 4 GB video to free space and does not learn that the space did not
             * come back will delete it again, more expensively.
             */
            hint={
              settings?.trashEnabled === false
                ? 'Files are deleted immediately and cannot be recovered'
                : `Recoverable for ${formatRetention(settings?.trashRetentionDays ?? 30)} · still uses storage until then`
            }
            value={settings?.trashEnabled ?? true}
            onChange={(value) => void update('trashEnabled', value)}
            testID="settings.trashEnabled"
          />
        </Section>

        <Section title="Storage">
          <LinkRow
            label="Storage access"
            hint="Grant or remove folder access"
            onPress={() => navigation.navigate('StorageAccess')}
            testID="settings.storageAccess"
          />
          <LinkRow
            label="Storage analyzer"
            hint="See what is using your space"
            onPress={() => navigation.navigate('StorageAnalyzer', {})}
            testID="settings.analyzer"
          />
          <LinkRow
            label="Trash"
            hint={
              trashCount === 0
                ? 'Empty'
                : `${trashCount} ${trashCount === 1 ? 'item' : 'items'} · ${formatBytes(trashBytes)}`
            }
            onPress={() => navigation.navigate('Trash')}
            testID="settings.trash"
          />
        </Section>

        <Section title="Privacy">
          <LinkRow
            label="Clear recent files"
            hint="Removes the list of files you have opened"
            onPress={() => navigation.navigate('PrivacySettings')}
            testID="settings.privacy"
          />
        </Section>

        <Section title="About">
          <LinkRow
            label="About this app"
            onPress={() => navigation.navigate('About')}
            testID="settings.about"
          />
        </Section>
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const t = useTheme();
  return (
    <View style={atoms.gap_sm}>
      <Text style={[atoms.text_2xs, t.atoms.text_contrast_low, styles.sectionTitle]}>
        {title.toUpperCase()}
      </Text>
      <View style={[atoms.rounded_lg, t.atoms.bg_card]}>{children}</View>
    </View>
  );
}

function ToggleRow({
  label,
  hint,
  value,
  onChange,
  testID,
}: {
  label: string;
  hint?: string;
  value: boolean;
  onChange: (value: boolean) => void;
  testID?: string;
}) {
  const t = useTheme();
  return (
    <View style={[atoms.flex_row, atoms.align_center, atoms.p_lg, atoms.gap_md]}>
      <View style={atoms.flex_1}>
        <Text style={[atoms.text_md, t.atoms.text]}>{label}</Text>
        {hint ? <Text style={[atoms.text_2xs, t.atoms.text_contrast_low]}>{hint}</Text> : null}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        accessible
        accessibilityLabel={label}
        accessibilityHint={hint}
        testID={testID}
        // Uses the theme accent rather than the platform default so the toggle
        // matches the rest of the app (design.md: one accent colour).
        trackColor={{ false: t.atoms.bg_contrast_200.backgroundColor, true: t.palette.primary_500 }}
        thumbColor={t.palette.white}
      />
    </View>
  );
}

function Segmented({
  label,
  options,
  value,
  onChange,
  testID,
}: {
  label: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
  testID?: string;
}) {
  const t = useTheme();
  return (
    <View style={[atoms.p_lg, atoms.gap_sm]}>
      <Text style={[atoms.text_md, t.atoms.text]}>{label}</Text>
      <View
        style={[
          atoms.flex_row,
          atoms.gap_2xs,
          t.atoms.bg_contrast_50,
          atoms.rounded_sm,
          atoms.p_2xs,
        ]}
        accessibilityRole="radiogroup"
        accessibilityLabel={label}
      >
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <Pressable
              key={option.value}
              onPress={() => onChange(option.value)}
              accessible
              accessibilityRole="radio"
              accessibilityLabel={option.label}
              accessibilityState={{ selected }}
              testID={`${testID}.${option.value}`}
              style={({ pressed }) => [
                atoms.flex_1,
                atoms.align_center,
                atoms.py_sm,
                atoms.rounded_xs,
                selected && t.atoms.bg_card,
                pressed && !selected && t.atoms.bg_contrast_100,
              ]}
            >
              <Text
                style={[
                  atoms.text_sm,
                  selected ? atoms.font_medium : atoms.font_normal,
                  t.atoms.text,
                ]}
              >
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function LinkRow({
  label,
  hint,
  onPress,
  testID,
}: {
  label: string;
  hint?: string;
  onPress: () => void;
  testID?: string;
}) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessible
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      testID={testID}
      style={({ pressed }) => [atoms.p_lg, pressed && t.atoms.bg_contrast_50]}
    >
      <Text style={[atoms.text_md, t.atoms.text]}>{label}</Text>
      {hint ? <Text style={[atoms.text_2xs, t.atoms.text_contrast_low]}>{hint}</Text> : null}
    </Pressable>
  );
}

const styles = {
  sectionTitle: {
    letterSpacing: 0.6,
  },
} as const;
