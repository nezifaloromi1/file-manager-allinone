import { useCallback } from 'react';
import { useNavigation } from '@react-navigation/native';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { atoms, useTheme } from '@/flux';
import { type Volume, createStorageUsage } from '#/domain/models/storage';
import { localProvider, safProvider } from '#/data/storage';
import { settingsRepository } from '#/data/repositories';
import { AsyncScreen } from '@/screens/PhasePlaceholder';
import { Header } from '@/components/layout/Header';
import { useDrawer } from '@/features/navigation/DrawerHost';
import { StorageCard } from '@/components/file/StorageCard';
import { PermissionCard } from '@/components/file/PermissionCard';
import { EmptyState } from '@/components/file/States';
import { TrashGlyph } from '@/components/icons/ChromeGlyphs';
import type { NavigationProp } from '#/lib/routes/types';

/**
 * Storage (plan.md §4, §11, §19).
 *
 * Lists every volume the app can reach — internal storage, any SAF roots the
 * user granted, and removable media — with a live usage card each.
 *
 * A SAF root reports no capacity, because SAF grants do not expose volume size
 * and substituting the device-wide figure would be a lie. Those cards say so
 * rather than showing a wrong number.
 */
export function StorageScreen() {
  const t = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  const { open: openDrawer } = useDrawer();

  const load = useCallback(async () => {
    const [localVolumes, safRoots, settings] = await Promise.all([
      localProvider().listVolumes(),
      safProvider().listVolumes(),
      settingsRepository.get(),
    ]);

    return {
      volumes: [...localVolumes, ...safRoots],
      safRootCount: safProvider().getRoots().length,
      accessMode: settings.accessMode,
    };
  }, []);

  return (
    <SafeAreaView style={[atoms.flex_1, t.atoms.bg]} edges={['top']}>
      <Header title="Storage" onMenu={openDrawer} testID="storagetab.header" />

      <AsyncScreen load={load} loadingLabel="Reading storage…" testID="storage.content">
        {({ volumes, accessMode, safRootCount }) => (
          <ScrollView
            contentContainerStyle={[
              atoms.p_lg,
              atoms.gap_lg,
              { paddingBottom: insets.bottom + 96 },
            ]}
            showsVerticalScrollIndicator={false}
          >
            {volumes.length === 0 ? (
              <EmptyState
                title="No storage available"
                message="Grant access to a folder to get started."
                actionLabel="Manage access"
                onAction={() => navigation.navigate('StorageAccess')}
              />
            ) : (
              volumes.map((volume) => (
                <VolumeCard
                  key={volume.id}
                  volume={volume}
                  onOpen={() =>
                    navigation.navigate('Browser', { uri: volume.rootUri, title: volume.label })
                  }
                />
              ))
            )}

            <View style={atoms.gap_sm}>
              <Text style={[atoms.text_2xs, t.atoms.text_contrast_low, styles.sectionTitle]}>
                ACCESS
              </Text>
              <PermissionCard
                state={{ kind: 'allFiles', granted: accessMode === 'allFiles' }}
                onGrant={() => navigation.navigate('StorageAccess')}
                onRevoke={() => navigation.navigate('StorageAccess')}
                testID="storage.allFiles"
              />
              <PermissionCard
                state={{ kind: 'saf', granted: safRootCount > 0, rootCount: safRootCount }}
                onGrant={() => navigation.navigate('StorageAccess')}
                onRevoke={() => navigation.navigate('StorageAccess')}
                testID="storage.saf"
              />
            </View>

            <Pressable
              onPress={() => navigation.navigate('Trash')}
              accessible
              accessibilityRole="button"
              accessibilityLabel="Open trash"
              testID="storage.trash"
              style={({ pressed }) => [
                atoms.flex_row,
                atoms.align_center,
                atoms.gap_md,
                atoms.p_lg,
                atoms.rounded_lg,
                t.atoms.bg_card,
                pressed && t.atoms.bg_contrast_50,
              ]}
            >
              <TrashGlyph size={20} color={t.atoms.text.color} />
              <Text style={[atoms.text_md, atoms.font_medium, t.atoms.text]}>Trash</Text>
            </Pressable>

            <Pressable
              onPress={() => navigation.navigate('StorageAnalyzer', {})}
              accessible
              accessibilityRole="button"
              accessibilityLabel="Open storage analyzer"
              testID="storage.analyzer"
              style={({ pressed }) => [
                atoms.flex_row,
                atoms.align_center,
                atoms.gap_md,
                atoms.p_lg,
                atoms.rounded_lg,
                t.atoms.bg_card,
                pressed && t.atoms.bg_contrast_50,
              ]}
            >
              <Text style={[atoms.text_md, atoms.font_medium, t.atoms.text]}>Storage analyzer</Text>
            </Pressable>
          </ScrollView>
        )}
      </AsyncScreen>
    </SafeAreaView>
  );
}

function VolumeCard({ volume, onOpen }: { volume: Volume; onOpen: () => void }) {
  const t = useTheme();
  const usage = createStorageUsage(volume);

  return (
    <View style={atoms.gap_2xs}>
      <StorageCard usage={usage} onPress={onOpen} testID={`storage.volume.${volume.id}`} />
      {volume.totalBytes === null ? (
        // Stated rather than hidden: a card with no figures and no explanation
        // reads as a bug.
        <Text style={[atoms.text_2xs, t.atoms.text_contrast_low, styles.footnote]}>
          System-picked folders do not report storage size.
        </Text>
      ) : null}
    </View>
  );
}

const styles = {
  sectionTitle: {
    letterSpacing: 0.6,
  },
  footnote: {
    paddingHorizontal: 4,
    lineHeight: 14,
  },
} as const;
