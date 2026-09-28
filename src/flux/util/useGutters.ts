import { useBreakpoints } from '#/flux/breakpoints';
import * as tokens from '#/flux/tokens';

type Gutter = 'compact' | 'base' | 'wide' | 0;

const gutters: Record<
  Exclude<Gutter, 0>,
  Record<'gtPhone' | 'gtMobile' | 'gtTablet' | 'default', number>
> = {
  compact: {
    default: tokens.space.sm,
    gtPhone: tokens.space.sm,
    gtMobile: tokens.space.md,
    gtTablet: tokens.space.md,
  },
  base: {
    default: tokens.space.lg,
    gtPhone: tokens.space.lg,
    gtMobile: tokens.space.xl,
    gtTablet: tokens.space.xl,
  },
  wide: {
    default: tokens.space.xl,
    gtPhone: tokens.space.xl,
    gtMobile: tokens.space._3xl,
    gtTablet: tokens.space._3xl,
  },
};

type Gutters = {
  paddingTop: number;
  paddingRight: number;
  paddingBottom: number;
  paddingLeft: number;
};

export function useGutters([all]: [Gutter]): Gutters;
export function useGutters([vertical, horizontal]: [Gutter, Gutter]): Gutters;
export function useGutters([top, right, bottom, left]: [Gutter, Gutter, Gutter, Gutter]): Gutters;
export function useGutters(sides: Gutter[]): Gutters {
  const { activeBreakpoint } = useBreakpoints();
  const bp = activeBreakpoint || 'default';

  const top = sides[0];
  const hasRight = sides[1] !== undefined;
  const hasBottom = sides[2] !== undefined;

  const right = hasRight ? sides[1] : top;
  const bottom = hasRight ? (hasBottom ? sides[2] : top) : top;
  const left = hasRight ? (hasBottom ? sides[3] : sides[1]) : top;

  const resolve = (gutter: Gutter) => (gutter === 0 ? 0 : gutters[gutter][bp]);

  return {
    paddingTop: resolve(top),
    paddingRight: resolve(right),
    paddingBottom: resolve(bottom),
    paddingLeft: resolve(left),
  };
}
