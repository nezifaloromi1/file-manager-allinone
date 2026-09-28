import { Text, View } from 'react-native';

import { useTheme } from '#/flux';
import { DEFAULT_PALETTE, DEFAULT_SUBDUED_PALETTE, invertPalette } from '#/flux/base';

import { Section, Swatch } from './helpers';

const CONTRAST_STEPS = [
  'contrast_0',
  'contrast_25',
  'contrast_50',
  'contrast_100',
  'contrast_200',
  'contrast_300',
  'contrast_400',
  'contrast_500',
  'contrast_600',
  'contrast_700',
  'contrast_800',
  'contrast_900',
  'contrast_950',
  'contrast_975',
  'contrast_1000',
] as const;

const SCALE_STEPS = [
  '_25',
  '_50',
  '_100',
  '_200',
  '_300',
  '_400',
  '_500',
  '_600',
  '_700',
  '_800',
  '_900',
  '_950',
  '_975',
] as const;

const SCALES = ['primary', 'positive', 'negative'] as const;

function ScaleRow({ prefix, palette }: { prefix: string; palette: Record<string, string> }) {
  return (
    <View style={{ gap: 8 }}>
      <Text style={{ fontSize: 13, fontWeight: '600', color: '#111' }}>{prefix}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {SCALE_STEPS.map((step) => {
          const key = `${prefix}${step}`;
          const color = palette[key];
          if (!color) return null;
          return <Swatch key={key} color={color} label={step.replace('_', '')} />;
        })}
      </View>
    </View>
  );
}

function PaletteBody({ palette, label }: { palette: Record<string, string>; label: string }) {
  return (
    <View style={{ gap: 16 }}>
      <Text style={{ fontSize: 15, fontWeight: '700', color: '#111' }}>{label}</Text>

      <View style={{ gap: 8 }}>
        <Text style={{ fontSize: 13, fontWeight: '600', color: '#111' }}>contrast</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {CONTRAST_STEPS.map((key) => (
            <Swatch key={key} color={palette[key]} label={key.replace('contrast_', '')} />
          ))}
        </View>
      </View>

      {SCALES.map((scale) => (
        <ScaleRow key={scale} prefix={scale} palette={palette} />
      ))}

      <View style={{ gap: 8 }}>
        <Text style={{ fontSize: 13, fontWeight: '600', color: '#111' }}>static</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {(['white', 'black', 'pink', 'yellow'] as const).map((key) => (
            <Swatch key={key} color={palette[key]} label={key} />
          ))}
        </View>
      </View>
    </View>
  );
}

export function PaletteSection() {
  const t = useTheme();
  return (
    <Section title="Palette">
      <PaletteBody
        palette={DEFAULT_PALETTE as unknown as Record<string, string>}
        label="DEFAULT_PALETTE"
      />
      <PaletteBody
        palette={DEFAULT_SUBDUED_PALETTE as unknown as Record<string, string>}
        label="DEFAULT_SUBDUED_PALETTE"
      />
      <PaletteBody
        palette={invertPalette(DEFAULT_PALETTE) as unknown as Record<string, string>}
        label="invertPalette"
      />
      <PaletteBody
        palette={t.palette as unknown as Record<string, string>}
        label={`Active theme — ${t.name}`}
      />
    </Section>
  );
}
