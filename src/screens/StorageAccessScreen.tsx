import { useCallback, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { atoms, useTheme } from '@/flux';
import { Header } from '@/components/layout/Header';
import { describeSafPick } from '#/data/storage/safUri';
import { safProvider, type SafRoot } from '#/data/storage';
import { settingsRepository } from '#/data/repositories';
import { AsyncScreen } from '@/screens/PhasePlaceholder';
import { useNavigation } from '@react-navigation/native';
import { navigate } from '#/Navigation';
import { SafStorageProvider } from '#/data/storage/SafStorageProvider';
import { ActionButton, PermissionCard } from '@/components/file/PermissionCard';

/**
 * Storage access (plan.md §11).
 *
 * "Explain why access is required before requesting it." Each card states what
 * the grant buys and what it costs, and only then offers a button.
 *
 * This screen also documents a platform limit honestly rather than letting the
 * user discover it: folders granted through the system picker can be browsed,
 * created, deleted, and shared, but **cannot be renamed, moved, or copied**,
 * because `expo-file-system` throws for those operations on `content://` URIs.
 * All Files Access removes the limit. That trade-off is the whole point of the
 * Hybrid strategy, so it is stated up front instead of surfacing as a disabled
 * button later.
 */
export function StorageAccessScreen() {
  const t = useTheme();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const [roots, setRoots] = useState<SafRoot[]>([]);

  const load = useCallback(async () => {
    const [currentRoots, settings] = await Promise.all([
      Promise.resolve(safProvider().getRoots()),
      settingsRepository.get(),
    ]);
    setRoots(currentRoots);
    return { accessMode: settings.accessMode };
  }, []);

  const addFolder = useCallback(async () => {
    try {
      const root = await SafStorageProvider.pickRoot();
      if (root) {
        const next = [...safProvider().getRoots(), root];
        safProvider().setRoots(next);
        setRoots(next);
      }
    } catch {
      // A failed pick is handled by the caller's retry affordance; the screen
      // stays as it was rather than half-updated.
    }
  }, []);

  return (
    <SafeAreaView style={[atoms.flex_1, t.atoms.bg]} edges={['top']}>
      <Header title="Storage access" onBack={() => navigation.goBack()} testID="access.header" />

      <AsyncScreen load={load} testID="access.content">
        {({ accessMode }) => (
          <ScrollView
            contentContainerStyle={[
              atoms.p_lg,
              atoms.gap_lg,
              { paddingBottom: insets.bottom + 96 },
            ]}
            showsVerticalScrollIndicator={false}
          >
            <Text style={[atoms.text_sm, t.atoms.text_contrast_medium, styles.body]}>
              This app works entirely offline and has no backend. It only touches files you point it
              at. It never requests contacts, location, camera, or microphone.
            </Text>

            <PermissionCard
              state={{ kind: 'saf', granted: roots.length > 0, rootCount: roots.length }}
              onGrant={() => void addFolder()}
              onRevoke={() => {
                safProvider().setRoots([]);
                setRoots([]);
              }}
              testID="access.saf"
            />

            {roots.length > 0 ? (
              <View style={atoms.gap_2xs}>
                {roots.map((root) => (
                  <View
                    key={root.uri}
                    style={[
                      atoms.flex_row,
                      atoms.align_center,
                      atoms.justify_between,
                      atoms.p_md,
                      atoms.rounded_sm,
                      t.atoms.bg_card,
                    ]}
                  >
                    <View style={atoms.flex_1}>
                      <Text style={[atoms.text_sm, t.atoms.text]} numberOfLines={1}>
                        {root.label}
                      </Text>
                      <Text style={[atoms.text_2xs, t.atoms.text_contrast_low]} numberOfLines={1}>
                        {describeSafPick(root.uri)}
                      </Text>
                    </View>
                    <ActionButton
                      label="Remove"
                      onPress={() => {
                        const next = safProvider()
                          .getRoots()
                          .filter((entry) => entry.uri !== root.uri);
                        safProvider().setRoots(next);
                        setRoots(next);
                      }}
                      testID={`access.remove.${root.label}`}
                    />
                  </View>
                ))}
              </View>
            ) : null}

            <PermissionCard
              state={{ kind: 'allFiles', granted: accessMode === 'allFiles' }}
              onGrant={() => {
                // The All Files Access grant is a system settings toggle, not a
                // runtime dialog. Phase 12 opens it via `expo-intent-launcher`;
                // until then, point the user there rather than opening a screen
                // that does nothing.
                void navigate('SettingsTab');
              }}
              testID="access.allFiles"
            />

            <Text style={[atoms.text_2xs, t.atoms.text_contrast_low, styles.footnote]}>
              All Files Access is requested from Android system settings, not from inside the app.
            </Text>
          </ScrollView>
        )}
      </AsyncScreen>
    </SafeAreaView>
  );
}

const styles = {
  body: {
    lineHeight: 20,
  },
  footnote: {
    lineHeight: 16,
  },
} as const;
