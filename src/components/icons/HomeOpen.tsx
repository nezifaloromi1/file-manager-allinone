import type { SvgProps } from 'react-native-svg';
import Svg, { Path } from 'react-native-svg';

type Props = Omit<SvgProps, 'width' | 'height' | 'color'> & {
  size?: number;
  color?: string;
  width?: number;
  height?: number;
};

export function HomeOpen_Stroke2_Corner0_Rounded({
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
        d="M11.37 1.724a1 1 0 0 1 1.26 0l8 6.5A1 1 0 0 1 21 9v11a1 1 0 0 1-1 1h-6a1 1 0 0 1-1-1v-5h-2v5a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 .37-.776l8-6.5ZM5 9.476V19h4v-5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v5h4V9.476l-7-5.688-7 5.688Z"
      />
    </Svg>
  );
}

export function HomeOpen_Filled_Corner0_Rounded({
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
        d="M12.63 1.724a1 1 0 0 0-1.26 0l-8 6.5A1 1 0 0 0 3 9v11a1 1 0 0 0 1 1h5a1 1 0 0 0 1-1v-6h4v6a1 1 0 0 0 1 1h5a1 1 0 0 0 1-1V9a1 1 0 0 0-.37-.776l-8-6.5Z"
      />
    </Svg>
  );
}

export type HomeOpenIconProps = Props;
