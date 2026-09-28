import {
  type NavigationState,
  type PartialState,
  type NavigationProp as NavigationPropType,
} from '@react-navigation/native';

import type { FileType } from '#/domain/models/fileType';
import type { CategoryId } from '#/domain/models/categories';

/**
 * The route table for the File Manager.
 *
 * Only routes that exist are declared. Unimplemented placeholder routes are
 * removed rather than left as dead type definitions, because a route that
 * type-checks but renders "NotFound" is worse than a route that does not exist:
 * it looks implemented.
 *
 * Screens that a feature will add later are still declared, with their param
 * shapes, so navigation is type-safe before the screen exists.
 */

export type CommonNavigatorParams = {
  NotFound: undefined;

  /**
   * The file browser. `uri` is a `file://` or `content://` directory URI, so
   * the browser is addressable by deep link.
   */
  Browser: { uri: string; title?: string };
  /** File or folder properties (plan.md §19). */
  FileDetails: { uri: string };
  /**
   * Search results within a directory tree (plan.md §16).
   *
   * `types` seeds the type filter, which is how a Home category tile ("Videos")
   * opens a search already restricted to videos rather than to everything.
   */
  Search: { rootUri?: string; query?: string; types?: FileType[]; category?: CategoryId };

  /** Rename / create-folder confirmation (plan.md §20, §21). */
  NamePrompt: {
    mode: 'create' | 'rename';
    parentUri?: string;
    uri?: string;
    initialValue: string;
  };
  /** Name-collision resolution (plan.md §24). */
  Conflict: { name: string; count: number };
  /** Sort and filter sheet, presented over the browser (plan.md §17, §18). */
  SortFilter: undefined;
  /** Pick a destination for a copy or move (plan.md §22). */
  DestinationPicker: { operationId: string; mode: 'copy' | 'move' };
  /** Open-with chooser (plan.md §14). */
  OpenWith: { uri: string };
  /** Running operations, with progress (plan.md §22, §48). */
  Operations: undefined;

  /** Trash and restore (plan.md §25). */
  Trash: undefined;
  /** Storage analyzer and duplicate finder (plan.md §29, §30). */
  StorageAnalyzer: { volumeId?: string };

  /** Storage access management (plan.md §11). */
  StorageAccess: undefined;

  /**
   * The design-system showcase, dev builds only.
   *
   * Declared in the param map so `__DEV__`-gated registration type-checks; the
   * router sends it to NotFound in a release build.
   */
  FluxShowcase: undefined;

  /** Appearance settings (plan.md §41, §51). */
  AppearanceSettings: undefined;
  /** Files behaviour settings (plan.md §51). */
  FileSettings: undefined;
  /** Privacy: clear recent, empty trash (plan.md §51). */
  PrivacySettings: undefined;
  About: undefined;
};

/** Params for the five tab roots (plan.md §3). */
export type TabNavigatorParams = CommonNavigatorParams & {
  HomeTab: undefined;
  StorageTab: undefined;
  RecentTab: undefined;
  FavoritesTab: undefined;
  SettingsTab: undefined;
};

/** Everything reachable, for a generic `useNavigation()`. */
export type AllNavigatorParams = CommonNavigatorParams &
  TabNavigatorParams & {
    /** Flat navigator used on web, where a tab bar makes no sense. */
    Flat: undefined;
  };

export type RootStackParamList = AllNavigatorParams;

export type { NativeStackScreenProps } from '@react-navigation/native-stack';

export type NavigationProp = NavigationPropType<AllNavigatorParams>;

// NOTE
// this isn't strictly correct but it should be close enough
// a TS wizard might be able to get this 100%
// -prf
export type State = NavigationState | Omit<PartialState<NavigationState>, 'stale'>;

export type RouteParams = Record<string, string>;
export type MatchResult = { params: RouteParams };
export type Route = {
  match: (path: string) => MatchResult | undefined;
  build: (params?: Record<string, string>) => string;
};
