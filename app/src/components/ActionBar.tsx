/**
 * fitscroll – Right-side action bar (like TikTok)
 *
 * Heart / Comment / Share / Products buttons stacked vertically.
 */

import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { colors, font, spacing } from '../theme';

interface Props {
  liked: boolean;
  likeCount: number;
  commentCount: number;
  productCount: number;
  onLike: () => void;
  onComment: () => void;
  onProducts: () => void;
  onShare: () => void;
  onTryOn?: () => void;
}

export default function ActionBar({
  liked,
  likeCount,
  commentCount,
  productCount,
  onLike,
  onComment,
  onProducts,
  onShare,
  onTryOn,
}: Props) {
  const handleLike = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onLike();
  };

  return (
    <View style={styles.container}>
      {/* Like */}
      <Pressable style={styles.action} onPress={handleLike}>
        <Ionicons
          name={liked ? 'heart' : 'heart-outline'}
          size={30}
          color={liked ? colors.heart : colors.white}
        />
        <Text style={styles.label}>{formatCount(likeCount)}</Text>
      </Pressable>

      {/* Comment */}
      <Pressable style={styles.action} onPress={onComment}>
        <Ionicons name="chatbubble-ellipses-outline" size={28} color={colors.white} />
        <Text style={styles.label}>{formatCount(commentCount)}</Text>
      </Pressable>

      {/* Products */}
      <Pressable style={styles.action} onPress={onProducts}>
        <Ionicons name="pricetag-outline" size={26} color={colors.white} />
        <Text style={styles.label}>{productCount}</Text>
      </Pressable>

      {/* Try On */}
      {onTryOn && (
        <Pressable style={styles.action} onPress={onTryOn}>
          <Ionicons name="body-outline" size={26} color={colors.white} />
          <Text style={styles.label}>Try on</Text>
        </Pressable>
      )}

      {/* Share */}
      <Pressable style={styles.action} onPress={onShare}>
        <Ionicons name="share-outline" size={26} color={colors.white} />
      </Pressable>
    </View>
  );
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    right: 12,
    bottom: 120,
    alignItems: 'center',
    gap: 20,
  },
  action: {
    alignItems: 'center',
    gap: 2,
  },
  label: {
    color: colors.white,
    fontSize: font.sizes.xs,
    fontWeight: font.semibold,
  },
});
