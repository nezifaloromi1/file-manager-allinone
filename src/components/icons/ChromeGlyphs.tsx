import Svg, { Circle, Path, Rect } from 'react-native-svg';

import type { SvgProps } from 'react-native-svg';

type Props = Omit<SvgProps, 'width' | 'height' | 'color'> & {
  size?: number;
  color?: string;
  width?: number;
  height?: number;
};

/**
 * Small utility glyphs used across the file browser (plan.md §39).
 *
 * Drawn rather than pulled from an icon font: the app already renders type
 * glyphs as vectors, so a handful of extra paths keeps the whole icon set
 * visually consistent and avoids a font-loading dependency.
 */

export function CloseCircleGlyph({
  size = 20,
  color = 'currentColor',
  width,
  height,
  style,
  ...props
}: Props) {
  const w = width ?? size;
  const h = height ?? w;
  return (
    <Svg {...props} width={w} height={h} viewBox="0 0 24 24" fill="none" style={style}>
      <Circle cx="12" cy="12" r="9" stroke={color} strokeWidth={1.75} />
      <Path d="m9 9 6 6M15 9l-6 6" stroke={color} strokeWidth={1.75} strokeLinecap="round" />
    </Svg>
  );
}

export function CheckGlyph({
  size = 20,
  color = 'currentColor',
  width,
  height,
  style,
  ...props
}: Props) {
  const w = width ?? size;
  const h = height ?? w;
  return (
    <Svg {...props} width={w} height={h} viewBox="0 0 24 24" fill="none" style={style}>
      <Path
        d="m5 12.5 4.5 4.5L19 7.5"
        stroke={color}
        strokeWidth={2.25}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function ChevronDownGlyph({
  size = 20,
  color = 'currentColor',
  width,
  height,
  style,
  ...props
}: Props) {
  const w = width ?? size;
  const h = height ?? w;
  return (
    <Svg {...props} width={w} height={h} viewBox="0 0 24 24" fill="none" style={style}>
      <Path
        d="m6 9.5 6 6 6-6"
        stroke={color}
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function ChevronRightGlyph({
  size = 20,
  color = 'currentColor',
  width,
  height,
  style,
  ...props
}: Props) {
  const w = width ?? size;
  const h = height ?? w;
  return (
    <Svg {...props} width={w} height={h} viewBox="0 0 24 24" fill="none" style={style}>
      <Path
        d="m9.5 6 6 6-6 6"
        stroke={color}
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function ChevronLeftGlyph({
  size = 20,
  color = 'currentColor',
  width,
  height,
  style,
  ...props
}: Props) {
  const w = width ?? size;
  const h = height ?? w;
  return (
    <Svg {...props} width={w} height={h} viewBox="0 0 24 24" fill="none" style={style}>
      <Path
        d="m14.5 6-6 6 6 6"
        stroke={color}
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function OverflowGlyph({
  size = 20,
  color = 'currentColor',
  width,
  height,
  style,
  ...props
}: Props) {
  const w = width ?? size;
  const h = height ?? w;
  return (
    <Svg {...props} width={w} height={h} viewBox="0 0 24 24" fill="none" style={style}>
      <Circle cx="12" cy="5.5" r="1.6" fill={color} />
      <Circle cx="12" cy="12" r="1.6" fill={color} />
      <Circle cx="12" cy="18.5" r="1.6" fill={color} />
    </Svg>
  );
}

export function StarGlyph({
  size = 20,
  color = 'currentColor',
  filled = false,
  width,
  height,
  style,
  ...props
}: Props & { filled?: boolean }) {
  const w = width ?? size;
  const h = height ?? w;
  const d =
    'm12 3.75 2.6 5.27 5.82.85-4.21 4.1.99 5.79L12 17.02l-5.2 2.74.99-5.79-4.21-4.1 5.82-.85Z';
  return (
    <Svg {...props} width={w} height={h} viewBox="0 0 24 24" fill="none" style={style}>
      <Path
        d={d}
        stroke={color}
        strokeWidth={1.75}
        strokeLinejoin="round"
        fill={filled ? color : 'none'}
      />
    </Svg>
  );
}

export function TrashGlyph({
  size = 20,
  color = 'currentColor',
  width,
  height,
  style,
  ...props
}: Props) {
  const w = width ?? size;
  const h = height ?? w;
  return (
    <Svg {...props} width={w} height={h} viewBox="0 0 24 24" fill="none" style={style}>
      <Path d="M4.5 6.75h15" stroke={color} strokeWidth={1.75} strokeLinecap="round" />
      <Path
        d="M6.5 6.75v11.5A1.75 1.75 0 0 0 8.25 20h7.5a1.75 1.75 0 0 0 1.75-1.75V6.75"
        stroke={color}
        strokeWidth={1.75}
        strokeLinecap="round"
      />
      <Path
        d="M9.25 6.75V5.5a1.75 1.75 0 0 1 1.75-1.75h2a1.75 1.75 0 0 1 1.75 1.75v1.25"
        stroke={color}
        strokeWidth={1.75}
        strokeLinecap="round"
      />
      <Path
        d="M10.5 10.5v5.5M13.5 10.5v5.5"
        stroke={color}
        strokeWidth={1.75}
        strokeLinecap="round"
      />
    </Svg>
  );
}

export function ShareGlyph({
  size = 20,
  color = 'currentColor',
  width,
  height,
  style,
  ...props
}: Props) {
  const w = width ?? size;
  const h = height ?? w;
  return (
    <Svg {...props} width={w} height={h} viewBox="0 0 24 24" fill="none" style={style}>
      <Path d="M12 15.5V4" stroke={color} strokeWidth={1.75} strokeLinecap="round" />
      <Path
        d="m8.5 7.5 3.5-3.5 3.5 3.5"
        stroke={color}
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M6 12.75H5.5A1.5 1.5 0 0 0 4 14.25v4.25A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5v-4.25a1.5 1.5 0 0 0-1.5-1.5H18"
        stroke={color}
        strokeWidth={1.75}
        strokeLinecap="round"
      />
    </Svg>
  );
}

export function MoveGlyph({
  size = 20,
  color = 'currentColor',
  width,
  height,
  style,
  ...props
}: Props) {
  const w = width ?? size;
  const h = height ?? w;
  return (
    <Svg {...props} width={w} height={h} viewBox="0 0 24 24" fill="none" style={style}>
      <Path d="M12 3.5v17M3.5 12h17" stroke={color} strokeWidth={1.75} strokeLinecap="round" />
      <Path
        d="m9 6.5 3-3 3 3M9 17.5l3 3 3-3M6.5 9l-3 3 3 3M17.5 9l3 3-3 3"
        stroke={color}
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function CopyGlyph({
  size = 20,
  color = 'currentColor',
  width,
  height,
  style,
  ...props
}: Props) {
  const w = width ?? size;
  const h = height ?? w;
  return (
    <Svg {...props} width={w} height={h} viewBox="0 0 24 24" fill="none" style={style}>
      <Path
        d="M9.5 3.75h7A1.75 1.75 0 0 1 18.25 5.5v7"
        stroke={color}
        strokeWidth={1.75}
        strokeLinecap="round"
      />
      <Path
        d="M5.75 8.25h6.5A1.75 1.75 0 0 1 14 10v6.25a1.75 1.75 0 0 1-1.75 1.75h-6.5A1.75 1.75 0 0 1 4 16.25V10a1.75 1.75 0 0 1 1.75-1.75Z"
        stroke={color}
        strokeWidth={1.75}
        strokeLinecap="round"
      />
    </Svg>
  );
}

export function PencilGlyph({
  size = 20,
  color = 'currentColor',
  width,
  height,
  style,
  ...props
}: Props) {
  const w = width ?? size;
  const h = height ?? w;
  return (
    <Svg {...props} width={w} height={h} viewBox="0 0 24 24" fill="none" style={style}>
      <Path
        d="M4.5 19.5h3.2l9.1-9.1a2.26 2.26 0 0 0-3.2-3.2l-9.1 9.1Z"
        stroke={color}
        strokeWidth={1.75}
        strokeLinejoin="round"
      />
      <Path d="m13.4 8.2 2.4 2.4" stroke={color} strokeWidth={1.75} />
    </Svg>
  );
}

export function InfoGlyph({
  size = 20,
  color = 'currentColor',
  width,
  height,
  style,
  ...props
}: Props) {
  const w = width ?? size;
  const h = height ?? w;
  return (
    <Svg {...props} width={w} height={h} viewBox="0 0 24 24" fill="none" style={style}>
      <Circle cx="12" cy="12" r="8.75" stroke={color} strokeWidth={1.75} />
      <Path d="M12 11v5.5" stroke={color} strokeWidth={1.75} strokeLinecap="round" />
      <Circle cx="12" cy="8" r="1.1" fill={color} />
    </Svg>
  );
}

export function NewFolderGlyph({
  size = 20,
  color = 'currentColor',
  width,
  height,
  style,
  ...props
}: Props) {
  const w = width ?? size;
  const h = height ?? w;
  return (
    <Svg {...props} width={w} height={h} viewBox="0 0 24 24" fill="none" style={style}>
      <Path
        d="M3 7.5A1.5 1.5 0 0 1 4.5 6h4.19a1.5 1.5 0 0 1 1.06.44l1.5 1.5a1.5 1.5 0 0 0 1.06.44h6.19A1.5 1.5 0 0 1 20 9.88v8.62A1.5 1.5 0 0 1 18.5 20h-14A1.5 1.5 0 0 1 3 18.5Z"
        stroke={color}
        strokeWidth={1.75}
        strokeLinejoin="round"
      />
      <Path d="M12 11v5.5M9.25 13.75h5.5" stroke={color} strokeWidth={1.75} strokeLinecap="round" />
    </Svg>
  );
}

export function GridGlyph({
  size = 20,
  color = 'currentColor',
  width,
  height,
  style,
  ...props
}: Props) {
  const w = width ?? size;
  const h = height ?? w;
  return (
    <Svg {...props} width={w} height={h} viewBox="0 0 24 24" fill="none" style={style}>
      <Rect x="3.75" y="3.75" width="7" height="7" rx="1.25" stroke={color} strokeWidth={1.75} />
      <Rect x="13.25" y="3.75" width="7" height="7" rx="1.25" stroke={color} strokeWidth={1.75} />
      <Rect x="3.75" y="13.25" width="7" height="7" rx="1.25" stroke={color} strokeWidth={1.75} />
      <Rect x="13.25" y="13.25" width="7" height="7" rx="1.25" stroke={color} strokeWidth={1.75} />
    </Svg>
  );
}

export function ListGlyph({
  size = 20,
  color = 'currentColor',
  width,
  height,
  style,
  ...props
}: Props) {
  const w = width ?? size;
  const h = height ?? w;
  return (
    <Svg {...props} width={w} height={h} viewBox="0 0 24 24" fill="none" style={style}>
      <Path
        d="M4 6.5h.01M4 12h.01M4 17.5h.01"
        stroke={color}
        strokeWidth={2.5}
        strokeLinecap="round"
      />
      <Path
        d="M8 6.5h12M8 12h12M8 17.5h12"
        stroke={color}
        strokeWidth={1.75}
        strokeLinecap="round"
      />
    </Svg>
  );
}

export function SortGlyph({
  size = 20,
  color = 'currentColor',
  width,
  height,
  style,
  ...props
}: Props) {
  const w = width ?? size;
  const h = height ?? w;
  return (
    <Svg {...props} width={w} height={h} viewBox="0 0 24 24" fill="none" style={style}>
      <Path
        d="M4.5 6.75h15M4.5 12h9M4.5 17.25h4"
        stroke={color}
        strokeWidth={1.75}
        strokeLinecap="round"
      />
    </Svg>
  );
}

export function EyeGlyph({
  size = 20,
  color = 'currentColor',
  off = false,
  width,
  height,
  style,
  ...props
}: Props & { off?: boolean }) {
  const w = width ?? size;
  const h = height ?? w;
  return (
    <Svg {...props} width={w} height={h} viewBox="0 0 24 24" fill="none" style={style}>
      <Path
        d="M2.75 12S6 5.75 12 5.75 21.25 12 21.25 12 18 18.25 12 18.25 2.75 12 2.75 12Z"
        stroke={color}
        strokeWidth={1.75}
        strokeLinejoin="round"
      />
      <Circle cx="12" cy="12" r="2.75" stroke={color} strokeWidth={1.75} />
      {off ? (
        <Path d="m4.5 4.5 15 15" stroke={color} strokeWidth={1.75} strokeLinecap="round" />
      ) : null}
    </Svg>
  );
}

export function SelectAllGlyph({
  size = 20,
  color = 'currentColor',
  width,
  height,
  style,
  ...props
}: Props) {
  const w = width ?? size;
  const h = height ?? w;
  return (
    <Svg {...props} width={w} height={h} viewBox="0 0 24 24" fill="none" style={style}>
      <Rect x="4" y="4" width="16" height="16" rx="2.5" stroke={color} strokeWidth={1.75} />
      <Path
        d="m8 12.25 2.75 2.75L16 9.75"
        stroke={color}
        strokeWidth={1.9}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function StorageGlyph({
  size = 20,
  color = 'currentColor',
  width,
  height,
  style,
  ...props
}: Props) {
  const w = width ?? size;
  const h = height ?? w;
  return (
    <Svg {...props} width={w} height={h} viewBox="0 0 24 24" fill="none" style={style}>
      <Path
        d="M3.75 12.75h16.5v5.5a1.5 1.5 0 0 1-1.5 1.5h-13.5a1.5 1.5 0 0 1-1.5-1.5Z"
        stroke={color}
        strokeWidth={1.75}
        strokeLinejoin="round"
      />
      <Path
        d="M5.25 12.75 7.4 5.4a1.5 1.5 0 0 1 1.42-1.03h6.36A1.5 1.5 0 0 1 16.6 5.4l2.15 7.35"
        stroke={color}
        strokeWidth={1.75}
        strokeLinejoin="round"
      />
      <Path d="M13.5 16.25h.01" stroke={color} strokeWidth={2.4} strokeLinecap="round" />
    </Svg>
  );
}

export function RecentGlyph({
  size = 20,
  color = 'currentColor',
  width,
  height,
  style,
  ...props
}: Props) {
  const w = width ?? size;
  const h = height ?? w;
  return (
    <Svg {...props} width={w} height={h} viewBox="0 0 24 24" fill="none" style={style}>
      <Path
        d="M3.75 12a8.25 8.25 0 1 0 2.6-6.02"
        stroke={color}
        strokeWidth={1.75}
        strokeLinecap="round"
      />
      <Path
        d="M3.75 4.75V10h5.25"
        stroke={color}
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M12 7.75V12l2.75 1.75"
        stroke={color}
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function SettingsGlyph({
  size = 20,
  color = 'currentColor',
  width,
  height,
  style,
  ...props
}: Props) {
  const w = width ?? size;
  const h = height ?? w;
  return (
    <Svg {...props} width={w} height={h} viewBox="0 0 24 24" fill="none" style={style}>
      <Circle cx="12" cy="12" r="2.9" stroke={color} strokeWidth={1.75} />
      <Path
        d="M12 3.5v2.1M12 18.4v2.1M20.5 12h-2.1M5.6 12H3.5M18 6l-1.5 1.5M7.5 16.5 6 18M18 18l-1.5-1.5M7.5 7.5 6 6"
        stroke={color}
        strokeWidth={1.75}
        strokeLinecap="round"
      />
    </Svg>
  );
}
