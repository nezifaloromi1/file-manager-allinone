import { StyleSheet } from 'react-native';

import * as common from './common';
import { ios, isFabric } from '../platform';

export const atoms = {
  ...common.atoms,
  fixed: {
    position: 'absolute',
  },
  sticky: {},
  overflow_auto: {},
  flex_0: {
    flex: 0,
  },
  border: {
    borderWidth: StyleSheet.hairlineWidth,
  },
  border_t: {
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  border_b: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  border_l: {
    borderLeftWidth: StyleSheet.hairlineWidth,
  },
  border_r: {
    borderRightWidth: StyleSheet.hairlineWidth,
  },
  border_x: {
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderRightWidth: StyleSheet.hairlineWidth,
  },
  border_y: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  border_transparent: {
    borderColor: 'transparent',
  },
  curve_circular: ios({
    borderCurve: 'circular',
  }),
  curve_continuous: ios({
    borderCurve: 'continuous',
  }),
  shadow_xs: isFabric
    ? {}
    : {
        shadowRadius: 8,
        shadowOpacity: 0.1,
        elevation: 4,
        shadowOffset: {
          width: 0,
          height: 2,
        },
      },
  shadow_sm: isFabric
    ? {}
    : {
        shadowRadius: 4,
        shadowOpacity: 0.1,
        elevation: 8,
        shadowOffset: {
          width: 0,
          height: 4,
        },
      },
  shadow_md: isFabric
    ? {}
    : {
        shadowRadius: 8,
        shadowOpacity: 0.1,
        elevation: 16,
        shadowOffset: {
          width: 0,
          height: 8,
        },
      },
  shadow_lg: isFabric
    ? {}
    : {
        shadowRadius: 16,
        shadowOpacity: 0.1,
        elevation: 32,
        shadowOffset: {
          width: 0,
          height: 16,
        },
      },
  shadow_xl: isFabric
    ? {}
    : {
        shadowRadius: 40,
        shadowOpacity: 0.1,
        elevation: 48,
        shadowOffset: {
          width: 0,
          height: 10,
        },
      },
  inline: {},
  block: {},
  pointer: {},
} as const;
