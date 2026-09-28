import { Platform } from 'react-native';

export const isIOS = Platform.OS === 'ios';
export const isAndroid = Platform.OS === 'android';
export const isNative = true;
export const isWeb = false;
// @ts-ignore
export const isFabric = Boolean(global?.nativeFabricUIManager);

export const web = (value: any) => (isWeb ? value : undefined);
export const ios = (value: any) => (isIOS ? value : undefined);
export const android = (value: any) => (isAndroid ? value : undefined);
export const native = (value: any) => (isNative ? value : undefined);

export const platform = Platform.select;
