export type Device = {
  fontScale: '-2' | '-1' | '0' | '1' | '2';
  fontFamily: 'system' | 'theme';
};

const storage: Device = {
  fontScale: '0',
  fontFamily: 'system',
};

export const device = {
  get<K extends keyof Device>(key: [K]): Device[K] | undefined {
    return storage[key[0]];
  },
  set<K extends keyof Device>(key: [K], value: Device[K]): void {
    storage[key[0]] = value;
  },
};
