import { type StyleProp } from 'react-native';

export const flatten = <T>(style: StyleProp<T>): T extends (infer U)[] ? U : T => {
  const defs = ([] as any).concat(style);
  return Object.assign({}, ...defs.filter(Boolean).flat());
};
