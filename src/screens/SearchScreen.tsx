import { useCallback, useMemo, useState } from 'react';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { atoms, useTheme } from '#/flux';
import { formatCount } from '#/core/utils/format';
import { type FileType } from '#/domain/models/fileType';
import { CATEGORIES, type CategoryId, findCategory } from '#/domain/models/categories';
import { FILE_TYPE_LABELS } from '@/components/file/fileTypePresentation';
import { providerForUri } from '#/data/storage';
import { INTERNAL_STORAGE_URI, volumeRootFor } from '#/data/storage/paths';
import { basenameOf } from '#/domain/usecases/folder';
import { useSearch } from '@/features/search/useSearch';
import { Header } from '@/components/layout/Header';
import { FileRow } from '@/components/file/FileRow';
import { SearchBar } from '@/components/file/SearchBar';
import { ErrorState, EmptyState } from '@/components/file/States';
import { Pill } from '@/components/file/FilterPills';
import { navigate } from '#/Navigation';
import type { AllNavigatorParams, NavigationProp } from '#/lib/routes/types';

/**
 * Volume-wide search (plan.md §16).
 *
 * Results stream from a cancellable, bounded walk rather than a query over an
 * index — plan.md is explicit that a mobile file manager should not need
 * Elasticsearch, and the caps mean a huge volume degrades to "showing the first
 * N" instead of running for minutes.
 *
 * The truncation notice is stated rather than hidden. Silently showing 2,000 of
 * 50,000 matches reads as "these are all your results", which is a lie.
 */
export function SearchScreen() {
  const t = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteProp<AllNavigatorParams, 'Search'>>();
  const insets = useSafeAreaInsets();

  // Search defaults to the primary volume: a global search is the useful one,
  // and the caller can scope it by passing a root.
  const rootUri = route.params?.rootUri ?? INTERNAL_STORAGE_URI;
  const provider = useMemo(() => providerForUri(rootUri), [rootUri]);

  // Seeded from the route so a Home category tile opens a pre-filtered search,
  // and so a query passed in is searched rather than merely shown.
  const initialCategory = route.params?.category ?? null;
  const [category, setCategory] = useState<CategoryId | null>(initialCategory);
  const [types, setTypes] = useState<readonly FileType[]>(
    () =>
      route.params?.types ?? (initialCategory ? (findCategory(initialCategory)?.types ?? []) : []),
  );

  // A category chip and a type filter are the same thing expressed twice; the
  // category is the friendlier entry point and sets the types.
  const applyCategory = useCallback((next: CategoryId | null) => {
    setCategory(next);
    setTypes(next ? (findCategory(next)?.types ?? []) : []);
  }, []);

  const { query, onChangeQuery, clear, state, results, truncated, scanned } = useSearch({
    rootUri,
    provider,
    types,
  });

  const rootLabel = volumeRootFor(rootUri).label;
  // Named from the selected category when there is one; otherwise the raw types,
  // because a type set assembled elsewhere has no category label to borrow.
  const filterCaption =
    category !== null
      ? (findCategory(category)?.label ?? '')
      : types.map((type) => FILE_TYPE_LABELS[type] ?? type).join(', ');

  const body = () => {
    if (state.status === 'error') {
      return <ErrorState error={state.error} testID="search.error" />;
    }
    if (state.status === 'too-short') {
      return (
        <EmptyState
          title="Keep typing"
          message="Search needs at least two characters to be useful."
          testID="search.tooShort"
        />
      );
    }
    if (state.status === 'searching' && results.length === 0) {
      return (
        <EmptyState
          title="Searching…"
          message={`Walking ${rootLabel}.`}
          testID="search.searching"
        />
      );
    }
    if (state.status === 'done' && results.length === 0) {
      return (
        <EmptyState
          title="No matches"
          message={`Nothing in ${rootLabel} matches “${query.trim()}”.`}
          testID="search.empty"
        />
      );
    }

    return (
      <View style={atoms.gap_sm}>
        <Text
          style={[atoms.text_2xs, t.atoms.text_contrast_low, styles.count]}
          testID="search.count"
        >
          {formatCount(results.length, 'result')}
          {truncated ? ' · showing the first matches' : ''}
          {state.status === 'done' ? ` · ${formatCount(scanned, 'folder')} searched` : ''}
        </Text>

        {results.map((item) => (
          <FileRow
            key={item.uri}
            item={item}
            onPress={(selected) => {
              if (selected.isDirectory) {
                void navigate('Browser', { uri: selected.uri, title: selected.name });
                return;
              }
              void navigate('FileDetails', { uri: selected.uri });
            }}
            testID="search.row"
          />
        ))}
      </View>
    );
  };

  return (
    <SafeAreaView style={[atoms.flex_1, t.atoms.bg]} edges={['top']}>
      <Header
        title={`Search ${basenameOf(rootUri) || rootLabel}`}
        onBack={() => navigation.goBack()}
        testID="search.header"
      />

      <View style={atoms.px_md}>
        <SearchBar
          value={query}
          onChangeText={onChangeQuery}
          onClear={clear}
          onSubmit={() => undefined}
          placeholder={`Search ${rootLabel}`}
          autoFocus
          testID="search.field"
        />
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[atoms.px_md, atoms.gap_2xs, styles.pills]}
      >
        <Pill
          label="All"
          selected={category === null}
          onPress={() => applyCategory(null)}
          testID="search.category.all"
        />
        {CATEGORIES.map((entry) => (
          <Pill
            key={entry.id}
            label={entry.label}
            selected={category === entry.id}
            onPress={() => applyCategory(entry.id)}
            testID={`search.category.${entry.id}`}
          />
        ))}
      </ScrollView>

      <ScrollView
        contentContainerStyle={[atoms.p_lg, atoms.gap_sm, { paddingBottom: insets.bottom + 96 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {filterCaption.length > 0 ? (
          <Text style={[atoms.text_2xs, t.atoms.text_contrast_low]}>
            {`Filtered to ${filterCaption}`}
          </Text>
        ) : null}
        {body()}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = {
  pills: {
    paddingTop: 12,
    paddingBottom: 4,
  },
  count: {
    paddingBottom: 4,
  },
} as const;
