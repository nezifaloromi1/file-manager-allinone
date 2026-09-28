import { Router } from '#/lib/routes/router';
import type { AllNavigatorParams } from '#/lib/routes/types';

/**
 * Path ↔ screen mapping (plan.md §3).
 *
 * The paths are chosen so a shared link opens the right place: `/storage/…`
 * for a folder, and every other destination at a short root. `Browser` takes
 * the URI as a query parameter rather than a path segment because a
 * `content://` URI contains slashes and percent escapes that would break
 * segment matching.
 */
type AllNavigatableRoutes = Omit<AllNavigatorParams, 'NotFound' | 'Flat'>;

export const router = new Router<AllNavigatableRoutes>({
  HomeTab: '/',
  StorageTab: '/storage',
  RecentTab: '/recent',
  FavoritesTab: '/favorites',
  SettingsTab: '/settings',

  Browser: '/browse',
  FileDetails: '/details',
  Search: '/search',

  NamePrompt: '/prompt',
  Conflict: '/conflict',
  SortFilter: '/sort',
  DestinationPicker: '/destination',
  OpenWith: '/open-with',
  Operations: '/operations',

  Trash: '/trash',
  StorageAnalyzer: '/analyzer',
  StorageAccess: '/access',

  AppearanceSettings: '/settings/appearance',
  FileSettings: '/settings/files',
  PrivacySettings: '/settings/privacy',
  About: '/about',
  // Registered in dev only, so a release build resolves it to NotFound.
  FluxShowcase: '/flux',
});
