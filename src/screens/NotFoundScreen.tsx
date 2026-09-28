import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { atoms, useTheme } from '@/flux';
import { Header } from '@/components/layout/Header';
import { useNavigation } from '@react-navigation/native';
import { EmptyState } from '@/components/file/States';
import { navigate } from '#/Navigation';

/**
 * The unresolvable-route screen.
 *
 * Reached by a deep link this build cannot satisfy. It says so and offers a way
 * back, rather than rendering an empty view that looks like a crash.
 */
export function NotFoundScreen() {
  const t = useTheme();
  const navigation = useNavigation();

  return (
    <SafeAreaView style={[atoms.flex_1, t.atoms.bg]} edges={['top']}>
      <Header title="Not found" onBack={() => navigation.goBack()} testID="notFound.header" />
      <View style={atoms.flex_1}>
        <EmptyState
          title="This link doesn't go anywhere"
          message="The screen it pointed to is not available in this version of the app."
          actionLabel="Go to Home"
          onAction={() => void navigate('HomeTab')}
        />
      </View>
    </SafeAreaView>
  );
}
