import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { Alert, ScrollView, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { atoms, useTheme } from '#/flux';
import { type FileItem } from '#/domain/models/fileItem';
import { describeError, toAppError } from '#/core/errors';
import { formatBytes, formatDate, formatRelativeTime } from '#/core/utils/format';
import { describeType, mimeTypeFor } from '#/domain/usecases/open';
import { basenameOf, parentUriOf } from '#/domain/usecases/folder';
import { providerForUri } from '#/data/storage';
import { openFile, openWith, shareFile } from '#/data/share';
import { recentRepository } from '#/data/repositories';
import { Header } from '@/components/layout/Header';
import { ErrorState, LoadingState } from '@/components/file/States';
import { ActionButton } from '@/components/file/PermissionCard';
import { FileTypeIcon } from '@/components/file/FileTypeIcon';
import { InfoGlyph, ShareGlyph } from '@/components/icons/ChromeGlyphs';
import type { AllNavigatorParams, NavigationProp } from '#/lib/routes/types';

/**
 * File details and open-with (plan.md §19, §14).
 *
 * ## Why a folder's size is measured lazily
 *
 * plan.md §19 is explicit that folder sizes are expensive. A directory with
 * 100,000 entries is a walk of 100,000 native round-trips — seconds on a real
 * device. So the size starts as "Calculating…", measures in the background, and
 * reports a failure as "Unavailable" rather than blocking the screen or showing
 * a wrong number. Everything else on this screen is instant.
 */

type SizeState =
  | { status: 'idle' }
  | { status: 'measuring' }
  | { status: 'done'; bytes: number }
  | { status: 'unavailable' };

export function FileDetailsScreen() {
  const t = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteProp<AllNavigatorParams, 'FileDetails'>>();
  const insets = useSafeAreaInsets();

  const uri = route.params?.uri ?? '';
  const [item, setItem] = useState<FileItem | null>(null);
  const [error, setError] = useState<ReturnType<typeof describeError> | null>(null);
  const [loading, setLoading] = useState(true);
  const [size, setSize] = useState<SizeState>({ status: 'idle' });
  const [busy, setBusy] = useState(false);

  const provider = useMemo(() => (uri ? providerForUri(uri) : null), [uri]);

  const load = useCallback(async () => {
    if (!provider || !uri) return;
    setLoading(true);
    try {
      const found = await provider.getMetadata(uri);
      if (!found) {
        setError(
          describeError(toAppError(new Error('not found'), { operation: 'details:load', uri })),
        );
        return;
      }
      setItem(found);
      setError(null);
    } catch (caught) {
      setError(describeError(toAppError(caught, { operation: 'details:load', uri })));
    } finally {
      setLoading(false);
    }
  }, [provider, uri]);

  useEffect(() => {
    void load();
  }, [load]);

  // Measured only once the metadata is on screen, and only for a directory —
  // a file already knows its size.
  useEffect(() => {
    if (!item?.isDirectory || !provider) return;
    let active = true;
    setSize({ status: 'measuring' });

    void provider
      .getSize(item.uri)
      .then((bytes) => {
        if (!active) return;
        setSize(bytes === null ? { status: 'unavailable' } : { status: 'done', bytes });
      })
      .catch(() => {
        if (active) setSize({ status: 'unavailable' });
      });

    return () => {
      active = false;
    };
  }, [item?.isDirectory, item?.uri, provider]);

  /**
   * Runs a file action, translating a failure into an alert.
   *
   * `recentRepository.record` fires after a successful open, not before, so the
   * recent list reflects files that actually opened (plan.md §27).
   */
  const run = useCallback(
    async (action: 'open' | 'openWith' | 'share') => {
      if (!provider || !item) return;
      setBusy(true);
      try {
        if (action === 'open') {
          await openFile(provider, item);
          await recentRepository.record(item);
        } else if (action === 'openWith') {
          await openWith(provider, item);
        } else {
          await shareFile(provider, item);
        }
      } catch (caught) {
        const failure = describeError(toAppError(caught, { operation: action }));
        Alert.alert(
          failure.title,
          failure.hint ? `${failure.message}\n\n${failure.hint}` : failure.message,
        );
      } finally {
        setBusy(false);
      }
    },
    [item, provider],
  );

  const confirmDelete = useCallback(() => {
    if (!provider || !item) return;
    Alert.alert(
      item.isDirectory ? `Delete ${item.name}?` : `Delete ${item.name}?`,
      'This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            void provider
              .delete(item.uri)
              .then(() => navigation.goBack())
              .catch((caught: unknown) => {
                const failure = describeError(toAppError(caught));
                Alert.alert(failure.title, failure.message);
              });
          },
        },
      ],
    );
  }, [item, navigation, provider]);

  const title = item ? basenameOf(item.uri) || item.name : 'Details';

  return (
    <SafeAreaView style={[atoms.flex_1, t.atoms.bg]} edges={['top']}>
      <Header
        title={title}
        onBack={() => navigation.goBack()}
        testID="details.header"
        actions={[
          {
            label: 'Share this file',
            onPress: () => void run('share'),
            icon: <ShareGlyph size={20} color={t.atoms.text.color} />,
            testID: 'details.share',
          },
        ]}
      />

      {loading ? (
        <LoadingState label="Reading file…" />
      ) : error || !item ? (
        <ErrorState
          error={
            error ?? describeError(toAppError(new Error('unavailable'), { operation: 'details' }))
          }
          onRetry={() => void load()}
          testID="details.error"
        />
      ) : (
        <ScrollView
          contentContainerStyle={[atoms.p_lg, atoms.gap_lg, { paddingBottom: insets.bottom + 96 }]}
          showsVerticalScrollIndicator={false}
        >
          <View
            style={[
              atoms.flex_row,
              atoms.align_center,
              atoms.gap_md,
              atoms.p_lg,
              atoms.rounded_lg,
              t.atoms.bg_card,
            ]}
          >
            <FileTypeIcon item={item} t={t} size={32} />
            <View style={atoms.flex_1}>
              <Text style={[atoms.text_md, atoms.font_medium, t.atoms.text]} numberOfLines={2}>
                {item.name}
              </Text>
              <Text style={[atoms.text_xs, t.atoms.text_contrast_medium]}>
                {describeType(item)}
                {item.isHidden ? ' · Hidden' : ''}
              </Text>
            </View>
          </View>

          <View style={[atoms.rounded_lg, t.atoms.bg_card]}>
            <DetailRow label="Type" value={describeType(item)} />
            <DetailRow
              label={item.isDirectory ? 'Size' : 'Size on disk'}
              value={item.isDirectory ? sizeLabel(size) : formatBytes(item.size)}
              testID="details.size"
            />
            <DetailRow
              label="Location"
              value={parentUriOf(item.uri) ?? '—'}
              testID="details.location"
            />
            <DetailRow label="Type (MIME)" value={mimeTypeFor(item) ?? '—'} />
            <DetailRow
              label="Modified"
              value={
                item.modifiedAt
                  ? `${formatDate(item.modifiedAt)} · ${formatRelativeTime(item.modifiedAt)}`
                  : 'Unknown'
              }
            />
            <DetailRow
              label="Created"
              value={
                item.createdAt
                  ? formatDate(item.createdAt)
                  : // Below Android API 26 the platform does not report it, and
                    // inventing a date is worse than saying so.
                    'Not reported by this device'
              }
            />
            <DetailRow label="Read access" value={provider ? 'Granted' : 'Unavailable'} last />
          </View>

          <View style={atoms.gap_sm}>
            <Text style={[atoms.text_2xs, t.atoms.text_contrast_low, styles.section]}>ACTIONS</Text>

            {item.isDirectory ? (
              <ActionButton
                label="Open in browser"
                onPress={() => navigation.navigate('Browser', { uri: item.uri, title: item.name })}
                testID="details.openFolder"
              />
            ) : (
              <>
                <ActionButton
                  label="Open"
                  primary
                  onPress={() => void run('open')}
                  disabled={busy}
                  testID="details.open"
                />
                <ActionButton
                  label="Open with…"
                  onPress={() => void run('openWith')}
                  disabled={busy}
                  testID="details.openWith"
                />
                <ActionButton
                  label="Share"
                  onPress={() => void run('share')}
                  disabled={busy}
                  testID="details.shareAction"
                />
              </>
            )}

            <ActionButton
              label="Rename"
              onPress={() =>
                navigation.navigate('NamePrompt', {
                  mode: 'rename',
                  uri: item.uri,
                  initialValue: item.name,
                })
              }
              testID="details.rename"
            />
            <ActionButton label="Copy" onPress={() => {}} disabled testID="details.copy" />
            <ActionButton label="Move" onPress={() => {}} disabled testID="details.move" />
            <ActionButton label="Delete" onPress={confirmDelete} testID="details.delete" />
          </View>

          <View style={[atoms.flex_row, atoms.gap_sm, atoms.align_center, styles.note]}>
            <InfoGlyph size={16} color={t.atoms.text_contrast_low.color} />
            <Text style={[atoms.text_2xs, t.atoms.text_contrast_low, styles.noteText]}>
              Copy and Move are disabled here. Use the selection bar in the browser, which reports
              progress and handles name conflicts.
            </Text>
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

/** `Calculating…` / `1.2 GB` / `Unavailable` for a directory's size. */
function sizeLabel(size: SizeState): string {
  switch (size.status) {
    case 'measuring':
      return 'Calculating…';
    case 'done':
      return formatBytes(size.bytes);
    case 'unavailable':
      // Not "0 B": an unavailable measurement is not an empty folder.
      return 'Unavailable';
    case 'idle':
      return '—';
  }
}

function DetailRow({
  label,
  value,
  last = false,
  testID,
}: {
  label: string;
  value: string;
  last?: boolean;
  testID?: string;
}) {
  const t = useTheme();
  return (
    <View
      style={[
        atoms.flex_row,
        atoms.align_start,
        atoms.gap_md,
        atoms.p_lg,
        !last && atoms.border_b,
        !last && t.atoms.border_contrast_low,
      ]}
      testID={testID}
    >
      <Text style={[atoms.text_sm, atoms.font_medium, t.atoms.text_contrast_medium, styles.label]}>
        {label}
      </Text>
      <Text style={[atoms.text_sm, t.atoms.text, styles.value]} selectable numberOfLines={3}>
        {value}
      </Text>
    </View>
  );
}

const styles = {
  section: {
    letterSpacing: 0.6,
  },
  label: {
    width: 96,
  },
  value: {
    flex: 1,
  },
  note: {
    alignItems: 'flex-start',
  },
  noteText: {
    flex: 1,
    lineHeight: 16,
  },
} as const;
