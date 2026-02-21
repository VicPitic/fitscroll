/**
 * fitscroll – Slideshow card component
 *
 * Displays a paginated horizontal slideshow of images with dot indicators.
 * Fills the entire screen like TikTok.
 */

import { useRef, useState, useCallback } from 'react';
import {
  Dimensions,
  FlatList,
  Image,
  NativeScrollEvent,
  NativeSyntheticEvent,
  StyleSheet,
  View,
  ActivityIndicator,
} from 'react-native';
import { colors } from '../theme';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

interface Props {
  images: string[];
  height?: number;
}

export default function SlideshowCard({ images, height = SCREEN_H }: Props) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [loadingStates, setLoadingStates] = useState<Record<number, boolean>>({});

  const onScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_W);
      if (idx !== activeIndex) setActiveIndex(idx);
    },
    [activeIndex],
  );

  const onLoadStart = (idx: number) =>
    setLoadingStates((s) => ({ ...s, [idx]: true }));
  const onLoadEnd = (idx: number) =>
    setLoadingStates((s) => ({ ...s, [idx]: false }));

  return (
    <View style={[styles.container, { height }]}>
      <FlatList
        data={images}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        keyExtractor={(_, i) => `slide-${i}`}
        renderItem={({ item, index }) => (
          <View style={[styles.slide, { height }]}>
            <Image
              source={{ uri: item }}
              style={styles.image}
              resizeMode="cover"
              onLoadStart={() => onLoadStart(index)}
              onLoadEnd={() => onLoadEnd(index)}
            />
            {loadingStates[index] && (
              <View style={styles.loaderOverlay}>
                <ActivityIndicator color={colors.white} size="small" />
              </View>
            )}
          </View>
        )}
      />

      {/* Dot indicators */}
      {images.length > 1 && (
        <View style={styles.dots}>
          {images.map((_, i) => (
            <View
              key={i}
              style={[styles.dot, i === activeIndex && styles.dotActive]}
            />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: SCREEN_W,
    backgroundColor: colors.black,
  },
  slide: {
    width: SCREEN_W,
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: SCREEN_W,
    height: '100%',
  },
  loaderOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  dots: {
    position: 'absolute',
    bottom: 100,
    alignSelf: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  dotActive: {
    backgroundColor: colors.white,
    width: 18,
  },
});
