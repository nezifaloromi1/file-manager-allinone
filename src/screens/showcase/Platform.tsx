import { StyleSheet, Text, View } from 'react-native';

import { IS_ANDROID, IS_IOS, IS_NATIVE, IS_WEB } from '#/env';
import { android, atoms, ios, native, platform, useTheme, web } from '#/flux';
import { isAndroid, isFabric, isIOS, isNative, isWeb } from '#/flux/base';

import { Section } from './helpers';

function RowItem({ label, value }: { label: string; value: string }) {
  const t = useTheme();
  return (
    <View style={[atoms.flex_row, atoms.justify_between, atoms.py_sm, styles.row]}>
      <Text style={[atoms.text_sm, t.atoms.text_contrast_medium]}>{label}</Text>
      <Text style={[atoms.text_sm, atoms.font_medium, t.atoms.text]}>{value}</Text>
    </View>
  );
}

export function PlatformSection() {
  const t = useTheme();
  const iosOnly = ios({ label: 'ios value' });
  const androidOnly = android({ label: 'android value' });
  const nativeOnly = native({ label: 'native value' });
  const webOnly = web({ label: 'web value' });
  const platformPick = platform({
    web: 'picked:web',
    ios: 'picked:ios',
    android: 'picked:android',
    default: 'picked:default',
  });

  return (
    <Section title="Platform flags · wrappers">
      <View style={[atoms.border, atoms.rounded_sm, t.atoms.border_contrast_low, styles.panel]}>
        <RowItem label="isWeb" value={String(isWeb)} />
        <RowItem label="isIOS" value={String(isIOS)} />
        <RowItem label="isAndroid" value={String(isAndroid)} />
        <RowItem label="isNative" value={String(isNative)} />
        <RowItem label="isFabric" value={String(isFabric)} />
        <RowItem label="IS_WEB" value={String(IS_WEB)} />
        <RowItem label="IS_IOS" value={String(IS_IOS)} />
        <RowItem label="IS_ANDROID" value={String(IS_ANDROID)} />
        <RowItem label="IS_NATIVE" value={String(IS_NATIVE)} />
        <RowItem label="web({…})" value={JSON.stringify(webOnly)} />
        <RowItem label="ios({…})" value={JSON.stringify(iosOnly)} />
        <RowItem label="android({…})" value={JSON.stringify(androidOnly)} />
        <RowItem label="native({…})" value={JSON.stringify(nativeOnly)} />
        <RowItem label="platform()" value={String(platformPick)} />
      </View>

      <Text style={[atoms.text_2xs, t.atoms.text_contrast_low]}>flex · absolute · wrap</Text>
      <View
        style={[
          atoms.flex_row,
          atoms.justify_between,
          atoms.align_center,
          atoms.p_md,
          atoms.border,
          atoms.rounded_sm,
          t.atoms.border_contrast_low,
          t.atoms.bg_contrast_50,
        ]}
      >
        <Text style={[atoms.text_sm, t.atoms.text]}>left</Text>
        <Text style={[atoms.text_sm, t.atoms.text]}>center</Text>
        <Text style={[atoms.text_sm, t.atoms.text]}>right</Text>
      </View>
      <View style={[atoms.flex_row, atoms.flex_wrap, atoms.gap_sm]}>
        {Array.from({ length: 8 }, (_, i) => (
          <View
            key={i}
            style={[atoms.p_md, atoms.rounded_sm, t.atoms.bg_contrast_100, styles.gridBox]}
          >
            <Text style={[atoms.text_2xs, t.atoms.text]}>{i}</Text>
          </View>
        ))}
      </View>
      <View style={[atoms.flex_row, atoms.gap_md]}>
        <View
          style={[
            atoms.aspect_square,
            atoms.border,
            t.atoms.border_contrast_medium,
            t.atoms.bg_contrast_50,
            { width: 72 },
          ]}
        />
        <View
          style={[
            atoms.aspect_card,
            atoms.border,
            t.atoms.border_contrast_medium,
            t.atoms.bg_contrast_50,
            { width: 120 },
          ]}
        />
      </View>
    </Section>
  );
}

const styles = StyleSheet.create({
  row: {
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#00000015',
  },
  panel: { paddingVertical: 4 },
  gridBox: { minWidth: 40, alignItems: 'center' },
});
