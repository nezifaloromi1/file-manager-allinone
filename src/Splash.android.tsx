import { useEffect, type PropsWithChildren } from 'react';
import * as SplashScreen from 'expo-splash-screen';

type Props = {
  isReady: boolean;
};

export function Splash({ isReady, children }: PropsWithChildren<Props>) {
  useEffect(() => {
    if (isReady) {
      SplashScreen.hideAsync();
    }
  }, [isReady]);
  if (isReady) {
    return children;
  }
}
