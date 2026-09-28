import { type ComponentType } from 'react';
import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { atoms, useTheme } from '@/flux';
import { Header } from '@/components/layout/Header';
import { AppError, describeError, toAppError } from '#/core/errors';
import { ErrorState, LoadingState } from '@/components/file/States';

/**
 * A screen that is not built yet.
 *
 * Deliberately explicit rather than silent: a screen that renders a blank view
 * looks like a bug, and one that renders fake content is worse. This states
 * which phase delivers it, so an empty tab is never mistaken for a regression.
 *
 * The `empty` state is reused from the real error/empty components so these
 * placeholders look identical to the screens that will replace them.
 */
export function PhasePlaceholder({
  title,
  phase,
  summary,
  testID,
}: {
  title: string;
  phase: string;
  summary: string;
  testID?: string;
}) {
  const t = useTheme();
  const navigation = useNavigation();

  return (
    <SafeAreaView style={[atoms.flex_1, t.atoms.bg]} edges={['top']}>
      <Header title={title} onBack={() => navigation.goBack()} testID="placeholder.header" />
      <View style={atoms.flex_1}>
        <View style={[atoms.p_lg, atoms.py_xl, atoms.align_center, atoms.gap_sm]} testID={testID}>
          <Text style={[atoms.text_lg, atoms.font_medium, t.atoms.text, styles.center]}>
            {summary}
          </Text>
          <Text style={[atoms.text_sm, t.atoms.text_contrast_medium, styles.center]}>
            Arrives in {phase}.
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

/**
 * Runs an async loader and renders loading / error / content.
 *
 * Extracted because most screens here follow the same shape, and getting the
 * three states subtly different per screen is how a screen ends up showing a
 * spinner forever after a failure.
 */
export function AsyncScreen<T>({
  load,
  children,
  loadingLabel = 'Loading…',
  errorTestID = 'screen.error',
  testID,
}: {
  load: () => Promise<T>;
  children: (data: T) => React.ReactNode;
  loadingLabel?: string;
  errorTestID?: string;
  testID?: string;
}) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<AppError | null>(null);
  const [loading, setLoading] = useState(true);

  const run = useCallback(async () => {
    setLoading(true);
    try {
      setData(await load());
      setError(null);
    } catch (caught) {
      setError(toAppError(caught));
    } finally {
      setLoading(false);
    }
  }, [load]);

  useEffect(() => {
    void run();
  }, [run]);

  // Refresh on focus: storage figures and permission state change underneath us.
  useFocusEffect(
    useCallback(() => {
      void run();
    }, [run]),
  );

  if (error) {
    return (
      <View style={atoms.flex_1}>
        <ErrorState error={describeError(error)} onRetry={() => void run()} testID={errorTestID} />
      </View>
    );
  }
  if (loading) {
    return <LoadingState label={loadingLabel} />;
  }
  return (
    <View style={atoms.flex_1} testID={testID}>
      {data === null ? null : children(data)}
    </View>
  );
}

export type { ComponentType };

const styles = {
  center: {
    textAlign: 'center',
  },
} as const;
