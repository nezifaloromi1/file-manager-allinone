import { useCallback, useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import { Alert, ScrollView, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { atoms, useTheme } from '@/flux';
import { type TrashItem } from '#/domain/models/trash';
import { formatBytes, formatRelativeTime, formatRetention } from '#/core/utils/format';
import { emptyTrash, purgeItem, restoreItem, trashSummary } from '#/data/trash';
import { settingsRepository } from '#/data/repositories';
import { AsyncScreen } from '@/screens/PhasePlaceholder';
import { EmptyState } from '@/components/file/States';
import { useFocusRevision } from '@/features/navigation/useFocusRevision';
import { useDrawer } from '@/features/navigation/DrawerHost';
import { Header } from '@/components/layout/Header';
import { FileTypeGlyph } from '@/components/icons/FileTypeGlyph';
import { navigate } from '#/Navigation';

/**
 * The trash (plan.md §25).
 *
 * Four actions, and each one is destructive in a way the user may not expect:
 * restore puts bytes back, delete-forever is immediate, and empty-trash is both
 * at once. Every one of them is behind a confirmation that names what will be
 * lost, because the whole point of this screen is that it is where a user comes
 * *after* believing something is gone.
 *
 * ## Why the header states the storage cost
 *
 * A trashed file still occupies the user's storage. That is the price of the
 * safety net, and a user who deletes a 4 GB video to free space and does not
 * learn that the space did not come back will delete it again, more expensively,
 * and conclude the app is broken.
 */
export function TrashScreen() {
  const t = useTheme();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { open: openDrawer } = useDrawer();

  // The browser can trash something while this screen is in the stack, so the
  // list re-reads on focus rather than only on mount.
  const revision = useFocusRevision();
  const [busy, setBusy] = useState(false);
  const [localRevision, setLocalRevision] = useState(0);

  const load = useCallback(async () => {
    const [summary, settings] = await Promise.all([trashSummary(), settingsRepository.get()]);
    return { ...summary, retentionDays: settings.trashRetentionDays };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localRevision, revision]);

  const reload = useCallback(() => setLocalRevision((current) => current + 1), []);

  const onRestore = useCallback(
    (record: TrashItem) => {
      void restoreItem(record).then(
        (restored) => {
          reload();
          Alert.alert(
            'Restored',
            `${restored.name} is back in ${
              record.isDirectory ? 'its folder' : 'the folder it came from'
            }.`,
          );
        },
        (error: unknown) => {
          Alert.alert(
            'Could not restore this item',
            error instanceof Error ? error.message : 'The original folder is unavailable.',
          );
        },
      );
    },
    [reload],
  );

  const onPurge = useCallback(
    (record: TrashItem) => {
      Alert.alert(
        `Delete ${record.originalName} for good?`,
        'This cannot be undone. The file is not kept anywhere else.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete forever',
            style: 'destructive',
            onPress: () => {
              void purgeItem(record).then(reload, () => {
                // The bytes may already be gone even if the purge reported a
                // failure; either way the record is dropped, so the screen does
                // not keep offering an action that cannot succeed.
                reload();
              });
            },
          },
        ],
      );
    },
    [reload],
  );

  const onEmpty = useCallback(() => {
    Alert.alert(
      'Empty the trash?',
      'Every item in the trash is deleted for good. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Empty trash',
          style: 'destructive',
          onPress: () => {
            setBusy(true);
            void emptyTrash().finally(() => {
              setBusy(false);
              reload();
            });
          },
        },
      ],
    );
  }, [reload]);

  return (
    <SafeAreaView style={[atoms.flex_1, t.atoms.bg]} edges={['top']}>
      <Header
        title="Trash"
        onMenu={openDrawer}
        onBack={navigation.canGoBack() ? () => navigation.goBack() : undefined}
        testID="trash.header"
        actions={
          busy
            ? undefined
            : [
                {
                  label: 'Empty trash',
                  onPress: onEmpty,
                  icon: (
                    <Text style={[atoms.text_sm, atoms.font_medium, t.atoms.text_link]}>Empty</Text>
                  ),
                  testID: 'trash.empty',
                },
              ]
        }
      />

      <AsyncScreen load={load} loadingLabel="Checking the trash…" testID="trash.content">
        {({ items, count, bytes, isEmpty, retentionDays }) => (
          <ScrollView
            contentContainerStyle={[
              atoms.p_lg,
              atoms.gap_md,
              { paddingBottom: insets.bottom + 96 },
            ]}
            showsVerticalScrollIndicator={false}
          >
            {!isEmpty ? (
              <View style={[atoms.p_md, t.atoms.bg_contrast_50, atoms.rounded_sm, atoms.gap_2xs]}>
                <Text style={[atoms.text_sm, atoms.font_medium, t.atoms.text]}>
                  {`${count} ${count === 1 ? 'item' : 'items'} · ${formatBytes(bytes)}`}
                </Text>
                {/* The retention window and its cost, stated rather than implied. */}
                <Text style={[atoms.text_2xs, t.atoms.text_contrast_medium, styles.note]}>
                  {`Items are kept for ${formatRetention(retentionDays)}, then deleted automatically. They still take up storage until then.`}
                </Text>
              </View>
            ) : null}

            {isEmpty ? (
              <EmptyState
                title="The trash is empty"
                message="Deleted files appear here and can be restored before they are cleared."
                testID="trash.emptyState"
              />
            ) : (
              <View style={atoms.gap_sm}>
                {items.map((record) => (
                  <TrashRow
                    key={record.id}
                    record={record}
                    onRestore={() => onRestore(record)}
                    onPurge={() => onPurge(record)}
                    testID="trash.row"
                  />
                ))}
              </View>
            )}

            {isEmpty ? (
              <Text
                style={[atoms.text_2xs, t.atoms.text_contrast_low, styles.browse]}
                onPress={() => void navigate('Browser', { uri: 'file:///storage/emulated/0/' })}
                accessibilityRole="link"
              >
                Browse your files
              </Text>
            ) : null}
          </ScrollView>
        )}
      </AsyncScreen>
    </SafeAreaView>
  );
}

function TrashRow({
  record,
  onRestore,
  onPurge,
  testID,
}: {
  record: TrashItem;
  onRestore: () => void;
  onPurge: () => void;
  testID?: string;
}) {
  const t = useTheme();

  return (
    <View
      style={[atoms.p_md, atoms.gap_xs, t.atoms.bg_contrast_50, atoms.rounded_sm]}
      testID={testID}
    >
      <View style={[atoms.flex_row, atoms.gap_sm, atoms.align_center]}>
        <FileTypeGlyph
          type={record.isDirectory ? 'DIRECTORY' : 'UNKNOWN'}
          size={24}
          color={t.palette.primary_500}
        />
        <View style={[atoms.flex_1, atoms.gap_2xs]}>
          {/* The stored name, not the trash filename: the trash appends a hash,
              and showing `report.pdf.a1b2c3` would be a filename the user never
              had and cannot match against anything. */}
          <Text numberOfLines={1} style={[atoms.text_sm, atoms.font_medium, t.atoms.text]}>
            {record.originalName}
          </Text>
          <Text numberOfLines={1} style={[atoms.text_2xs, t.atoms.text_contrast_low]}>
            {[
              `Deleted ${formatRelativeTime(record.deletedAt)}`,
              record.size !== null ? formatBytes(record.size) : null,
              record.isDirectory ? 'Folder' : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          </Text>
        </View>
      </View>

      <View style={[atoms.flex_row, atoms.gap_sm]}>
        <RowAction label="Restore" onPress={onRestore} testID={`${testID}.restore`} />
        <RowAction
          label="Delete forever"
          onPress={onPurge}
          destructive
          testID={`${testID}.purge`}
        />
      </View>
    </View>
  );
}

function RowAction({
  label,
  onPress,
  destructive,
  testID,
}: {
  label: string;
  onPress: () => void;
  destructive?: boolean;
  testID?: string;
}) {
  const t = useTheme();
  return (
    <Text
      onPress={onPress}
      accessibilityRole="button"
      testID={testID}
      style={[
        atoms.text_2xs,
        atoms.font_medium,
        destructive ? t.atoms.text_error : t.atoms.text_link,
      ]}
    >
      {label}
    </Text>
  );
}

const styles = {
  note: {
    lineHeight: 16,
  },
  browse: {
    textAlign: 'center',
    paddingTop: 8,
  },
} as const;
