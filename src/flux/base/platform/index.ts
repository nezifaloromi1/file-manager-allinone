import { type Platform } from 'react-native';

export const isIOS = false;
export const isAndroid = false;
export const isNative = false;
export const isWeb = true;
// @ts-ignore
export const isFabric = Boolean(global?.nativeFabricUIManager);

/**
 * Identity function on web. Returns nothing on other platforms.
 *
 * Note: Platform splitting does not tree-shake away the other platforms,
 * so don't do stuff like e.g. rely on platform-specific imports. Use
 * platform-split files instead.
 */
export const web = (value: any) => (isWeb ? value : undefined);

/**
 * Identity function on iOS. Returns nothing on other platforms.
 *
 * Note: Platform splitting does not tree-shake away the other platforms,
 * so don't do stuff like e.g. rely on platform-specific imports. Use
 * platform-split files instead.
 */
export const ios = (value: any) => (isIOS ? value : undefined);

/**
 * Identity function on Android. Returns nothing on other platforms..
 *
 * Note: Platform splitting does not tree-shake away the other platforms,
 * so don't do stuff like e.g. rely on platform-specific imports. Use
 * platform-split files instead.
 */
export const android = (value: any) => (isAndroid ? value : undefined);

/**
 * Identity function on iOS and Android. Returns nothing on web.
 *
 * Note: Platform splitting does not tree-shake away the other platforms,
 * so don't do stuff like e.g. rely on platform-specific imports. Use
 * platform-split files instead.
 */
export const native = (value: any) => (isNative ? value : undefined);

/**
 * Note: Platform splitting does not tree-shake away the other platforms,
 * so don't do stuff like e.g. rely on platform-specific imports. Use
 * platform-split files instead.
 */
export const platform = ((specifics) => {
  // @ts-ignore
  return specifics.web || specifics.default;
}) as Platform['select'];
