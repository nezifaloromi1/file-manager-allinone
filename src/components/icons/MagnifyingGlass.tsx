import type { SvgProps } from 'react-native-svg';
import Svg, { Path } from 'react-native-svg';

type Props = Omit<SvgProps, 'width' | 'height' | 'color'> & {
  size?: number;
  color?: string;
  width?: number;
  height?: number;
};

export function MagnifyingGlass_Stroke2_Corner0_Rounded({
  size = 28,
  color = 'currentColor',
  width,
  height,
  style,
  ...props
}: Props) {
  const resolvedWidth = width ?? size;
  const resolvedHeight = height ?? resolvedWidth;

  return (
    <Svg
      {...props}
      width={resolvedWidth}
      height={resolvedHeight}
      color={color}
      style={style}
      fill="none"
      stroke={color}
      strokeWidth={2}
      viewBox="0 0 24 24"
    >
      <Path
        fill="none"
        stroke={color}
        strokeWidth={2}
        fillRule="evenodd"
        clipRule="evenodd"
        d="M11 5a6 6 0 1 0 0 12 6 6 0 0 0 0-12Zm-8 6a8 8 0 1 1 14.32 4.906l3.387 3.387a1 1 0 0 1-1.414 1.414l-3.387-3.387A8 8 0 0 1 3 11Z"
      />
    </Svg>
  );
}

export function MagnifyingGlass_Filled_Stroke2_Corner0_Rounded({
  size = 28,
  color = 'currentColor',
  width,
  height,
  style,
  ...props
}: Props) {
  const resolvedWidth = width ?? size;
  const resolvedHeight = height ?? resolvedWidth;

  return (
    <Svg
      {...props}
      width={resolvedWidth}
      height={resolvedHeight}
      color={color}
      style={style}
      fill={color}
      stroke="none"
      viewBox="0 0 24 24"
    >
      <Path
        fill={color}
        stroke="none"
        fillRule="evenodd"
        clipRule="evenodd"
        d="M5 11a6 6 0 1 1 12 0 6 6 0 0 1-12 0Zm6-8a8 8 0 1 0 4.906 14.32l3.387 3.387a1 1 0 0 0 1.414-1.414l-3.387-3.387A8 8 0 0 0 11 3Zm4 8a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z"
      />
    </Svg>
  );
}

export type MagnifyingGlassIconProps = Props;
