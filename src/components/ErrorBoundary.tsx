import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Pressable, type StyleProp, Text, View, type ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { atoms as a, useTheme } from '#/flux';
import { logger } from '#/logger';

interface Props {
  children?: ReactNode;
  renderError?: (error: any) => ReactNode;
  getErrorMetadata?: (error: Error) => Record<string, unknown>;
  style?: StyleProp<ViewStyle>;
}

interface State {
  hasError: boolean;
  error: any;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: undefined,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    logger.error(error, {
      errorInfo,
      ...this.props.getErrorMetadata?.(error),
    });
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.renderError) {
        return this.props.renderError(this.state.error);
      }

      return (
        <View style={[{ height: '100%', flex: 1 }, this.props.style]}>
          <ErrorScreen
            details={this.state.error?.toString()}
            onPressTryAgain={() => this.setState({ hasError: false, error: undefined })}
          />
        </View>
      );
    }

    return this.props.children;
  }
}

function ErrorScreen({
  details,
  onPressTryAgain,
}: {
  details?: string;
  onPressTryAgain?: () => void;
}) {
  const t = useTheme();

  return (
    <View style={[a.flex, a.justify_center, a.px_xl, a.py_2xl, t.atoms.bg]}>
      <View style={[a.mb_md, a.align_center]}>
        <View
          style={[
            a.rounded_full,
            { width: 50, height: 50 },
            a.align_center,
            a.justify_center,
            { backgroundColor: t.palette.contrast_950 },
          ]}
        >
          <Svg fill="none" width={24} height={24} viewBox="0 0 24 24">
            <Path
              fill="#fff"
              fillRule="evenodd"
              clipRule="evenodd"
              d="M11.14 4.494a.995.995 0 0 1 1.72 0l7.001 12.008a.996.996 0 0 1-.86 1.498H4.999a.996.996 0 0 1-.86-1.498L11.14 4.494Zm3.447-1.007c-1.155-1.983-4.019-1.983-5.174 0L2.41 15.494C1.247 17.491 2.686 20 4.998 20h14.004c2.312 0 3.751-2.509 2.587-4.506L14.587 3.487ZM13 9.019a1 1 0 1 0-2 0v2.994a1 1 0 1 0 2 0V9.02Zm-1 4.731a1.25 1.25 0 1 0 0 2.5 1.25 1.25 0 0 0 0-2.5Z"
            />
          </Svg>
        </View>
      </View>
      <Text style={[a.text_center, a.font_bold, a.text_2xl, a.mb_md, t.atoms.text]}>Oh no!</Text>
      <Text style={[a.text_center, a.text_md, a.mb_xl, t.atoms.text_contrast_high]}>
        There was an unexpected issue in the application. Please let us know if this happened to
        you!
      </Text>
      {details ? (
        <View
          style={[
            a.w_full,
            a.border,
            t.atoms.border_contrast_medium,
            t.atoms.bg_contrast_25,
            a.mb_xl,
            a.py_sm,
            a.px_lg,
            a.rounded_xs,
            a.overflow_hidden,
          ]}
        >
          <Text style={[a.text_center, a.text_md, t.atoms.text_contrast_high]}>{details}</Text>
        </View>
      ) : null}
      <Pressable
        accessibilityRole="button"
        onPress={onPressTryAgain}
        style={({ pressed }) => [
          a.align_center,
          a.self_center,
          a.px_xl,
          a.py_sm,
          a.rounded_full,
          {
            backgroundColor: t.palette.primary_500,
            opacity: pressed ? 0.8 : 1,
          },
        ]}
      >
        <Text style={[a.text_md, a.font_bold, { color: '#fff' }]}>Try again</Text>
      </Pressable>
    </View>
  );
}
