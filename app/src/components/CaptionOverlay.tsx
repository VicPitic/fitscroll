/**
 * fitscroll – Caption overlay at the bottom of each post
 */

import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, font, spacing } from '../theme';

interface Props {
  caption: string;
  keywords?: string[];
}

export default function CaptionOverlay({ caption, keywords = [] }: Props) {
  const [expanded, setExpanded] = useState(false);

  return (
    <View style={styles.container}>
      <Pressable onPress={() => setExpanded(!expanded)}>
        <Text style={styles.caption} numberOfLines={expanded ? undefined : 2}>
          {caption}
        </Text>
      </Pressable>
      {keywords.length > 0 && (
        <View style={styles.tags}>
          {keywords.slice(0, 4).map((k, i) => (
            <Text key={i} style={styles.tag}>
              #{k.replace(/\s+/g, '')}
            </Text>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 90,
    left: spacing.md,
    right: 72, // leave space for action bar
    gap: spacing.xs,
  },
  caption: {
    color: colors.white,
    fontSize: font.sizes.md,
    fontWeight: font.medium,
    textShadowColor: 'rgba(0,0,0,0.7)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
    lineHeight: 22,
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  tag: {
    color: colors.grey300,
    fontSize: font.sizes.xs,
    fontWeight: font.medium,
  },
});
