import { useMemo } from 'react';
import { useNavigation } from '@react-navigation/native';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { atoms, useTheme } from '@/flux';
import { Header } from '@/components/layout/Header';
import { formatProgressLabel, isTerminal } from '#/domain/models/operation';
import { useOperations, type OperationEntry } from '@/features/operations/OperationsProvider';
import { ProgressBar } from '@/components/file/ProgressBar';
import { EmptyState, ErrorState } from '@/components/file/States';

/**
 * The operation log (plan.md §23, §48).
 *
 * Lists every copy, move, and delete the app has run, with the ones still going
 * showing progress. Reachable while a transfer is in flight — the queue is owned
 * by a provider above the navigator, so navigating here does not interrupt
 * anything.
 *
 * Finished entries are kept until cleared rather than auto-dismissed: a user who
 * starts three copies needs to see that all three finished, and the last line of
 * a progress bar disappearing the instant it completes loses that.
 */
export function OperationsScreen() {
  const t = useTheme();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { entries, cancel, clearFinished } = useOperations();

  const finished = useMemo(
    () => entries.filter((entry) => isTerminal(entry.operation.state)),
    [entries],
  );

  return (
    <SafeAreaView style={[atoms.flex_1, t.atoms.bg]} edges={['top']}>
      <Header
        title="Operations"
        onBack={() => navigation.goBack()}
        testID="operations.header"
        actions={
          finished.length > 0
            ? [
                {
                  label: 'Clear finished operations',
                  onPress: clearFinished,
                  icon: (
                    <Text
                      style={[atoms.text_sm, atoms.font_medium, t.atoms.text_link]}
                      testID="operations.clear"
                    >
                      Clear
                    </Text>
                  ),
                  testID: 'operations.clear',
                },
              ]
            : undefined
        }
      />

      {entries.length === 0 ? (
        <EmptyState
          title="No operations yet"
          message="Copies, moves, and deletions you run will appear here with their progress."
          testID="operations.empty"
        />
      ) : (
        <ScrollView
          contentContainerStyle={[atoms.p_lg, atoms.gap_md, { paddingBottom: insets.bottom + 96 }]}
          showsVerticalScrollIndicator={false}
        >
          {entries.map((entry) => (
            <OperationRow key={entry.operation.id} entry={entry} onCancel={cancel} />
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function OperationRow({
  entry,
  onCancel,
}: {
  entry: OperationEntry;
  onCancel: (id: string) => void;
}) {
  const t = useTheme();
  const { operation, result } = entry;
  const running = operation.state === 'RUNNING' || operation.state === 'QUEUED';

  return (
    <View
      style={[
        atoms.rounded_lg,
        t.atoms.bg_card,
        operation.state === 'FAILED' && t.atoms.border_contrast_medium,
        atoms.border,
      ]}
      testID={`operation.${operation.id}`}
    >
      <ProgressBar
        progress={operation.progress}
        label={operation.label}
        onCancel={running ? () => onCancel(operation.id) : undefined}
        compact
        testID={`operation.${operation.id}.progress`}
      />

      <View style={[atoms.px_lg, atoms.pb_lg, atoms.gap_2xs]}>
        {operation.error ? (
          <ErrorState error={operation.error} compact testID={`operation.${operation.id}.error`} />
        ) : result ? (
          <Text style={[atoms.text_2xs, t.atoms.text_contrast_low]}>
            {summarise(result.completed, result.failed, result.skipped)}
          </Text>
        ) : (
          <Text style={[atoms.text_2xs, t.atoms.text_contrast_low]}>
            {formatProgressLabel(operation.progress)}
          </Text>
        )}
      </View>
    </View>
  );
}

function summarise(completed: number, failed: number, skipped: number): string {
  const parts = [`${completed} done`];
  if (skipped > 0) parts.push(`${skipped} skipped`);
  if (failed > 0) parts.push(`${failed} failed`);
  return parts.join(' · ');
}
