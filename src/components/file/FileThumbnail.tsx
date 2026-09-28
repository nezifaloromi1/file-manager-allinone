import { useState } from 'react';
import { View } from 'react-native';
import { Image as ExpoImage } from 'expo-image';

import { type FileItem } from '#/domain/models/fileItem';
import { hasThumbnail } from '#/domain/models/fileType';
import { useTheme } from '#/flux';
import { FileTypeIcon } from '@/components/file/FileTypeIcon';

/**
 * Grid tile artwork (plan.md §6).
 *
 * Images and video get a real thumbnail; everything else gets its type glyph.
 * `expo-image` is used rather than `Image` because it decodes off the JS thread
 * and caches, which matters when scrolling a 100,000-item directory
 * (plan.md §46).
 *
 * Thumbnails are only attempted for types that actually have image data. A
 * mislabelled file — a `.jpg` that is really an encrypted blob — fails to
 * decode, and the fallback is the type glyph rather than a broken-image box.
 */

export function FileThumbnail({ item, size = 72 }: { item: FileItem; size?: number }) {
  const t = useTheme();
  const [failed, setFailed] = useState(false);

  const showable = !item.isDirectory && hasThumbnail(item.type) && !failed;

  if (!showable) {
    return (
      <View style={styles.fallback}>
        <FileTypeIcon item={item} t={t} size={Math.round(size * 0.5)} />
      </View>
    );
  }

  return (
    // `expo-image`, not React Native's `Image`: it decodes off the JS thread,
    // caches to disk, and downsamples to the requested size. A 4000px photo
    // rendered into a 72px tile is the single biggest source of jank and memory
    // pressure in an image grid (plan.md §46).
    <ExpoImage
      source={{ uri: item.uri }}
      style={styles.image}
      // Explicit decode target. Without this, `expo-image` decodes at full
      // resolution and scales in memory.
      contentFit="cover"
      transition={120}
      // Decorative: the tile's accessibility label already announces name and
      // size, so announcing the image again would be noise (plan.md §40).
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      onError={() => setFailed(true)}
    />
  );
}

const styles = {
  image: {
    width: '100%',
    height: '100%',
  },
  fallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
} as const;
