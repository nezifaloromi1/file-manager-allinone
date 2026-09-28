import type { SvgProps } from 'react-native-svg';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { type FileType } from '#/domain/models/fileType';

type GlyphProps = Omit<SvgProps, 'width' | 'height' | 'color'> & {
  size?: number;
  color?: string;
  width?: number;
  height?: number;
};

/**
 * Per-type glyphs (plan.md §13, §39).
 *
 * One glyph per `FileType`, drawn rather than imported, so a file's identity is
 * readable at 20px without a bitmap and scales without blurring. Every glyph
 * shares the same 24×24 box and a 1.75 stroke so they read as one family.
 *
 * Shape, not colour, carries the type: plan.md §40 requires that meaning is
 * never communicated by colour alone, and this also keeps the rows legible for
 * colour-blind users and in a forced-high-contrast theme.
 */

const STROKE = 1.75;

function glyphProps({
  size = 22,
  color = 'currentColor',
  width,
  height,
  style,
  ...props
}: GlyphProps) {
  return {
    resolvedWidth: width ?? size,
    resolvedHeight: height ?? size,
    shared: {
      color,
      style,
      fill: 'none' as const,
      stroke: color,
      strokeWidth: STROKE,
      strokeLinecap: 'round' as const,
      strokeLinejoin: 'round' as const,
      viewBox: '0 0 24 24',
    },
    pass: props,
  };
}

export function FolderGlyph(props: GlyphProps) {
  const { resolvedWidth, resolvedHeight, shared, pass } = glyphProps(props);
  return (
    <Svg {...pass} {...shared} width={resolvedWidth} height={resolvedHeight}>
      <Path d="M3 7.5A1.5 1.5 0 0 1 4.5 6h4.19a1.5 1.5 0 0 1 1.06.44l1.5 1.5a1.5 1.5 0 0 0 1.06.44h6.19A1.5 1.5 0 0 1 20 9.88v8.62A1.5 1.5 0 0 1 18.5 20h-14A1.5 1.5 0 0 1 3 18.5Z" />
    </Svg>
  );
}

export function ImageGlyph(props: GlyphProps) {
  const { resolvedWidth, resolvedHeight, shared, pass } = glyphProps(props);
  return (
    <Svg {...pass} {...shared} width={resolvedWidth} height={resolvedHeight}>
      <Rect x="3" y="5" width="18" height="14" rx="2" />
      <Circle cx="8.5" cy="10" r="1.5" />
      <Path d="m4 17 4.5-4.5a1.5 1.5 0 0 1 2.12 0L15 17" />
      <Path d="m14 15 1.88-1.88a1.5 1.5 0 0 1 2.12 0L20 15.24" />
    </Svg>
  );
}

export function VideoGlyph(props: GlyphProps) {
  const { resolvedWidth, resolvedHeight, shared, pass } = glyphProps(props);
  return (
    <Svg {...pass} {...shared} width={resolvedWidth} height={resolvedHeight}>
      <Rect x="3" y="6" width="12.5" height="12" rx="2" />
      <Path d="m15.5 10.5 4-2.5a.75.75 0 0 1 1.13.65v6.7a.75.75 0 0 1-1.13.65l-4-2.5Z" />
    </Svg>
  );
}

export function AudioGlyph(props: GlyphProps) {
  const { resolvedWidth, resolvedHeight, shared, pass } = glyphProps(props);
  return (
    <Svg {...pass} {...shared} width={resolvedWidth} height={resolvedHeight}>
      <Path d="M9 17.5V6.2l9-1.7v11" />
      <Circle cx="6.5" cy="17.5" r="2.5" />
      <Circle cx="15.5" cy="15.5" r="2.5" />
    </Svg>
  );
}

export function DocumentGlyph(props: GlyphProps) {
  const { resolvedWidth, resolvedHeight, shared, pass } = glyphProps(props);
  return (
    <Svg {...pass} {...shared} width={resolvedWidth} height={resolvedHeight}>
      <Path d="M6 3.5h7.5L18.5 8.5v12a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1v-16a1 1 0 0 1 1-1Z" />
      <Path d="M13.5 3.5v5h5" />
      <Path d="M9 13h6M9 16.5h4" />
    </Svg>
  );
}

export function ArchiveGlyph(props: GlyphProps) {
  const { resolvedWidth, resolvedHeight, shared, pass } = glyphProps(props);
  return (
    <Svg {...pass} {...shared} width={resolvedWidth} height={resolvedHeight}>
      <Rect x="3" y="4" width="18" height="4.5" rx="1" />
      <Path d="M4.5 8.5v10a1.5 1.5 0 0 0 1.5 1.5h12a1.5 1.5 0 0 0 1.5-1.5v-10" />
      <Path d="M10.5 12.5h3" />
    </Svg>
  );
}

export function ApkGlyph(props: GlyphProps) {
  const { resolvedWidth, resolvedHeight, shared, pass } = glyphProps(props);
  return (
    <Svg {...pass} {...shared} width={resolvedWidth} height={resolvedHeight}>
      <Path d="M6.5 8.5h11v7.25a1.75 1.75 0 0 1-1.75 1.75H8.25A1.75 1.75 0 0 1 6.5 15.75Z" />
      <Path d="m8 5.5-1.5-2.5M16 5.5l1.5-2.5" />
      <Path d="M6.5 11.5H4.75A1.75 1.75 0 0 0 3 13.25v2.5A1.75 1.75 0 0 0 4.75 17.5M17.5 11.5h1.75A1.75 1.75 0 0 1 21 13.25v2.5a1.75 1.75 0 0 1-1.75 1.75" />
    </Svg>
  );
}

export function TextGlyph(props: GlyphProps) {
  const { resolvedWidth, resolvedHeight, shared, pass } = glyphProps(props);
  return (
    <Svg {...pass} {...shared} width={resolvedWidth} height={resolvedHeight}>
      <Path d="M6 3.5h7.5L18.5 8.5v12a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1v-16a1 1 0 0 1 1-1Z" />
      <Path d="M13.5 3.5v5h5" />
      <Path d="M8.75 12.5h6.5M8.75 16h4.5" />
    </Svg>
  );
}

export function CodeGlyph(props: GlyphProps) {
  const { resolvedWidth, resolvedHeight, shared, pass } = glyphProps(props);
  return (
    <Svg {...pass} {...shared} width={resolvedWidth} height={resolvedHeight}>
      <Path d="m8.5 8-4 4 4 4M15.5 8l4 4-4 4M13.5 5.5l-3 13" />
    </Svg>
  );
}

export function FontGlyph(props: GlyphProps) {
  const { resolvedWidth, resolvedHeight, shared, pass } = glyphProps(props);
  return (
    <Svg {...pass} {...shared} width={resolvedWidth} height={resolvedHeight}>
      <Path d="M5 19 12 5l7 14" />
      <Path d="M7.8 14.5h8.4" />
    </Svg>
  );
}

export function UnknownGlyph(props: GlyphProps) {
  const { resolvedWidth, resolvedHeight, shared, pass } = glyphProps(props);
  return (
    <Svg {...pass} {...shared} width={resolvedWidth} height={resolvedHeight}>
      <Path d="M6 3.5h7.5L18.5 8.5v12a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1v-16a1 1 0 0 1 1-1Z" />
      <Path d="M13.5 3.5v5h5" />
      <Path d="M9.75 14.5a2.25 2.25 0 1 1 3 2.12v.88" />
      <Path d="M12.75 20.5h.01" />
    </Svg>
  );
}

const GLYPHS: Record<FileType, (props: GlyphProps) => React.JSX.Element> = {
  DIRECTORY: FolderGlyph,
  IMAGE: ImageGlyph,
  VIDEO: VideoGlyph,
  AUDIO: AudioGlyph,
  DOCUMENT: DocumentGlyph,
  ARCHIVE: ArchiveGlyph,
  APK: ApkGlyph,
  TEXT: TextGlyph,
  CODE: CodeGlyph,
  FONT: FontGlyph,
  UNKNOWN: UnknownGlyph,
};

export function glyphForFileType(type: FileType): (props: GlyphProps) => React.JSX.Element {
  return GLYPHS[type] ?? UnknownGlyph;
}

/**
 * Renders the glyph for a `FileType`.
 *
 * A component rather than a function reference so callers can write
 * `<FileTypeGlyph type="IMAGE" />` instead of resolving a component first, and
 * so the lookup stays in one place if the registry grows.
 */
export function FileTypeGlyph({
  type,
  ...props
}: GlyphProps & { type: FileType }): React.JSX.Element {
  const Glyph = glyphForFileType(type);
  return <Glyph {...props} />;
}

export type FileTypeGlyphProps = GlyphProps;
