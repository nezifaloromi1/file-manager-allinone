/**
 * The five tab destinations (plan.md §3).
 *
 * Declared once and imported by both the navigator and the bottom bar, because
 * the two must agree exactly. When they are defined separately, a tab can end up
 * registered but with no bar item (invisible destination) or shown in the bar
 * with no screen (dead tap) — and neither failure is visible until someone runs
 * the app.
 */

export const TABS = [
  { name: 'Home', root: 'HomeTab', label: 'Home', icon: 'home' },
  { name: 'Storage', root: 'StorageTab', label: 'Storage', icon: 'storage' },
  { name: 'Recent', root: 'RecentTab', label: 'Recent', icon: 'recent' },
  { name: 'Favorites', root: 'FavoritesTab', label: 'Favorites', icon: 'favorites' },
  { name: 'Settings', root: 'SettingsTab', label: 'Settings', icon: 'settings' },
] as const;

export type TabName = (typeof TABS)[number]['name'];
export type TabRoot = (typeof TABS)[number]['root'];
export type TabIcon = (typeof TABS)[number]['icon'];

export function findTab(name: string) {
  return TABS.find((tab) => tab.name === name || tab.root === name);
}
