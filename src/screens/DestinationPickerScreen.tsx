import { useCallback, useState } from 'react';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { FlatList, Text, View, type ListRenderItemInfo } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { atoms, useTheme } from '@/flux';
import { Header } from '@/components/layout/Header';
import { describeError, toAppError } from '#/core/errors';
import { type FileItem } from '#/domain/models/fileItem';
import { type ConflictPolicy } from '#/domain/models/operation';
import { basenameOf, canGoUp, toBreadcrumbs, type Breadcrumb } from '#/domain/usecases/folder';
import { providerForUri } from '#/data/storage';
import { INTERNAL_STORAGE_URI, volumeRootFor } from '#/data/storage/paths';
import { FileRow } from '@/components/file/FileRow';
import { ErrorState, LoadingState } from '@/components/file/States';
import { Breadcrumbs } from '@/features/browser/Breadcrumbs';
import { BrowserMenuItems } from '@/features/browser/BrowserToolbar';
import { ConflictDialog, type ConflictRequest } from '@/features/operations/ConflictDialog';
import { useOperations } from '@/features/operations/OperationsProvider';
import { takePendingTransfer } from '@/features/operations/pendingTransfer';
import type { AllNavigatorParams } from '#/lib/routes/types';

/**
 * The copy/move destination picker (plan.md §22, §24).
 *
 * A thinner browser: walk to a folder, confirm, done. Choosing the destination
 * *before* any bytes move is deliberate — discovering a collision halfway
 * through a 5 GB transfer and then asking where to put the rest is a far worse
 * experience, and plan.md §24 wants every collision resolved up front.
 *
 * The picker owns the whole gesture. It reads the pending selection, lets the
 * user pick a folder, then starts the transfer through the queue and returns to
 * the browser — so the browser never has to be handed a result.
 */
export function DestinationPickerScreen() {
  const t = useTheme();
  const navigation = useNavigation();
  const route = useRoute<RouteProp<AllNavigatorParams, 'DestinationPicker'>>();
  const insets = useSafeAreaInsets();
  const { startTransfer } = useOperations();

  const mode = route.params?.mode ?? 'copy';

  const [uri, setUri] = useState(INTERNAL_STORAGE_URI);
  const [folders, setFolders] = useState<FileItem[]>([]);
  const [error, setError] = useState<ReturnType<typeof describeError> | null>(null);
  const [loading, setLoading] = useState(true);
  const [conflict, setConflict] = useState<ConflictRequest | null>(null);
  const [pendingResolver, setPendingResolver] = useState<((policy: ConflictPolicy) => void) | null>(
    null,
  );

  const load = useCallback(async (target: string) => {
    setLoading(true);
    try {
      const provider = providerForUri(target);
      const listed = await provider.list(target);
      // Folders only: picking a file as a destination is meaningless.
      setFolders(listed.filter((child) => child.isDirectory));
      setError(null);
    } catch (caught) {
      setError(describeError(toAppError(caught, { operation: 'destination:list' })));
    } finally {
      setLoading(false);
    }
  }, []);

  useState(() => {
    void load(INTERNAL_STORAGE_URI);
  });

  const { rootUri, label } = volumeRootFor(uri);
  const crumbs = toBreadcrumbs(uri, rootUri, label);

  /**
   * Asks the user about a collision.
   *
   * A promise that resolves when the dialog closes, so `planTransfer` can await
   * it exactly as it would any other conflict source. A pending resolver is held
   * in state because the dialog is a separate component with its own lifecycle.
   */
  const askConflict = useCallback(
    (_name: string, _item: FileItem) =>
      new Promise<ConflictPolicy>((resolve) => {
        setPendingResolver(() => (policy: ConflictPolicy) => {
          setPendingResolver(null);
          setConflict(null);
          resolve(policy);
        });
        setConflict({ name: _name, remaining: 1 });
      }),
    [],
  );

  const confirm = useCallback(async () => {
    const transfer = takePendingTransfer();

    if (!transfer || transfer.items.length === 0) {
      // Nothing staged — most likely the user backed out and returned. Going
      // back is the correct outcome, not an error.
      navigation.goBack();
      return;
    }

    const provider = providerForUri(uri);

    await startTransfer({
      kind: transfer.mode,
      items: transfer.items,
      destinationUri: uri,
      provider,
      askConflict,
    });

    navigation.goBack();
  }, [askConflict, navigation, startTransfer, uri]);

  const renderRow = useCallback(
    ({ item }: ListRenderItemInfo<FileItem>) => (
      <FileRow
        item={item}
        onPress={() => {
          setUri(item.uri);
          void load(item.uri);
        }}
      />
    ),
    [load],
  );

  const atRoot = !canGoUp(uri, rootUri);

  const goUp = useCallback(() => {
    const parent = crumbs.length > 1 ? crumbs[crumbs.length - 2].uri : null;
    if (!parent || atRoot) return;
    setUri(parent);
    void load(parent);
  }, [atRoot, crumbs, load]);

  return (
    <SafeAreaView style={[atoms.flex_1, t.atoms.bg]} edges={['top']}>
      <Header
        title="Choose a folder"
        onBack={goUp}
        testID="destination.header"
        actions={[
          {
            label: `${mode === 'copy' ? 'Copy' : 'Move'} into ${basenameOf(uri) || label}`,
            onPress: () => void confirm(),
            icon: (
              <Text
                style={[atoms.text_sm, atoms.font_medium, t.atoms.text_link]}
                testID="destination.confirm"
              >
                {mode === 'copy' ? 'Copy here' : 'Move here'}
              </Text>
            ),
            testID: 'destination.confirm',
          },
        ]}
      />

      <Breadcrumbs
        crumbs={crumbs}
        onPressCrumb={(crumb: Breadcrumb) => {
          setUri(crumb.uri);
          void load(crumb.uri);
        }}
      />

      {loading ? (
        <LoadingState label="Opening folder…" />
      ) : error ? (
        <ErrorState error={error} onRetry={() => void load(uri)} testID="destination.error" />
      ) : folders.length === 0 ? (
        <View style={atoms.p_lg}>
          <Text style={[atoms.text_sm, t.atoms.text_contrast_medium]}>
            No sub-folders here. You can still choose this folder.
          </Text>
        </View>
      ) : (
        <FlatList
          data={folders}
          renderItem={renderRow}
          keyExtractor={(item) => item.uri}
          contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
          testID="destination.list"
        />
      )}

      <ConflictDialog
        request={conflict}
        onResolve={(policy) => {
          if (pendingResolver) pendingResolver(policy);
        }}
      />
    </SafeAreaView>
  );
}

/** Re-exported so the browser can present the same overflow menu. */
export { BrowserMenuItems };
