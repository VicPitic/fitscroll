/**
 * fitscroll – Main feed screen (TikTok-style vertical scroll)
 *
 * Shows the AI-generated content from the generating step.
 * Each "page" is an outfit post with a slideshow, action bar,
 * comments sheet, and product sheet.
 */

import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Pressable,
  Share,
  StyleSheet,
  Text,
  View,
  ViewToken,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { colors, font, radius, spacing } from '../src/theme';
import { OutfitPost } from '../src/types';
import {
  getProfile,
  cacheFeed,
  getCachedFeed,
  toggleLike,
  getLikes,
  addComment,
  getComments,
} from '../src/storage';
import { generateTryOn, getGeminiKey } from '../src/gemini';

import SlideshowCard from '../src/components/SlideshowCard';
import ActionBar from '../src/components/ActionBar';
import CaptionOverlay from '../src/components/CaptionOverlay';
import CommentsSheet from '../src/components/CommentsSheet';
import ProductSheet from '../src/components/ProductSheet';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

export default function Feed() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const flatListRef = useRef<FlatList>(null);

  const [posts, setPosts] = useState<OutfitPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const [likes, setLikes] = useState<Record<string, boolean>>({});
  const [generatingTryOn, setGeneratingTryOn] = useState(false);

  // Sheets
  const [commentsVisible, setCommentsVisible] = useState(false);
  const [productsVisible, setProductsVisible] = useState(false);
  const [activeComments, setActiveComments] = useState<
    { id: string; text: string; author: string; createdAt: string }[]
  >([]);

  const currentPost = posts[activeIndex];

  /* ── Load generated feed from cache ── */
  useEffect(() => {
    loadFeed();
  }, []);

  const loadFeed = async () => {
    setLoading(true);
    try {
      const savedLikes = await getLikes();
      setLikes(savedLikes);

      const cached = await getCachedFeed();
      if (cached.length > 0) {
        setPosts(cached);
      } else {
        // No feed — redirect to generating
        router.replace('/generating');
        return;
      }
    } catch (err) {
      console.warn('[feed] load error', err);
    } finally {
      setLoading(false);
    }
  };

  /* ── Refresh: navigate to generating to get fresh content ── */
  const handleRefresh = () => {
    router.replace('/generating');
  };

  /* ── Active index tracking ── */
  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0 && viewableItems[0].index != null) {
        setActiveIndex(viewableItems[0].index);
        // Close sheets on scroll
        setCommentsVisible(false);
        setProductsVisible(false);
      }
    },
  ).current;

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 60 }).current;

  /* ── Actions ── */
  const handleLike = async () => {
    if (!currentPost) return;
    const isLiked = await toggleLike(currentPost.id);
    setLikes((prev) => ({ ...prev, [currentPost.id]: isLiked }));
    setPosts((prev) =>
      prev.map((p) =>
        p.id === currentPost.id
          ? { ...p, likeCount: p.likeCount + (isLiked ? 1 : -1) }
          : p,
      ),
    );
  };

  const handleOpenComments = async () => {
    if (!currentPost) return;
    const comments = await getComments(currentPost.id);
    setActiveComments(comments);
    setCommentsVisible(true);
    setProductsVisible(false);
  };

  const handleSendComment = async (text: string) => {
    if (!currentPost) return;
    const updated = await addComment(currentPost.id, text);
    setActiveComments(updated);
    setPosts((prev) =>
      prev.map((p) =>
        p.id === currentPost.id ? { ...p, commentCount: updated.length } : p,
      ),
    );
  };

  const handleShare = async () => {
    if (!currentPost) return;
    try {
      await Share.share({
        message: `Check out this outfit on fitscroll: ${currentPost.captionHint}`,
      });
    } catch {}
  };

  const handleTryOn = async () => {
    if (!currentPost) return;
    if (!getGeminiKey()) {
      Alert.alert('API Key Required', 'Add your Gemini API key.');
      return;
    }
    const profile = await getProfile();
    if (!profile.photoUri) {
      Alert.alert('Photo Required', 'Upload your photo in onboarding first.');
      return;
    }

    setGeneratingTryOn(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    try {
      // Use the first image (which may be the original Pinterest image) as reference
      const outfitRef = currentPost.images[currentPost.images.length > 1 ? 1 : 0];
      const result = await generateTryOn(
        profile.photoUri,
        outfitRef,
        currentPost.captionHint,
        profile.gender,
        profile.styles?.[0] ?? null,
      );
      if (result) {
        setPosts((prev) =>
          prev.map((p) =>
            p.id === currentPost.id
              ? { ...p, images: [result, ...p.images] }
              : p,
          ),
        );
        Alert.alert('Try On Ready!', 'Swipe to see your new generated look.');
      } else {
        Alert.alert('Generation Failed', 'Could not generate try-on image. Please try again.');
      }
    } catch {
      Alert.alert('Error', 'Something went wrong with the AI generation.');
    } finally {
      setGeneratingTryOn(false);
    }
  };

  /* ── Render ── */
  if (loading) {
    return (
      <View style={styles.loader}>
        <Text style={styles.loadingLogo}>fitscroll</Text>
        <ActivityIndicator size="large" color={colors.white} />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      {/* Top bar */}
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <Text style={styles.topLogo}>fitscroll</Text>
        <Pressable
          onPress={() => router.push('/onboarding')}
          style={styles.settingsBtn}
          hitSlop={12}
        >
          <Ionicons name="person-circle-outline" size={26} color={colors.white} />
        </Pressable>
      </View>

      {/* Vertical feed */}
      <FlatList
        ref={flatListRef}
        data={posts}
        keyExtractor={(item) => item.id}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        snapToInterval={SCREEN_H}
        decelerationRate="fast"
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        renderItem={({ item, index }) => (
          <View style={[styles.postContainer, { height: SCREEN_H }]}>
            {/* Slideshow */}
            <SlideshowCard images={item.images} height={SCREEN_H} />

            {/* Bottom gradient overlay */}
            <View style={styles.bottomGradient} />

            {/* Caption */}
            <CaptionOverlay
              caption={item.captionHint}
              keywords={item.products.map((p: { name: string }) => p.name)}
            />

            {/* Right action bar */}
            <ActionBar
              liked={!!likes[item.id]}
              likeCount={item.likeCount}
              commentCount={item.commentCount}
              productCount={item.products.length}
              onLike={() => {
                setActiveIndex(index);
                handleLike();
              }}
              onComment={() => {
                setActiveIndex(index);
                handleOpenComments();
              }}
              onProducts={() => {
                setActiveIndex(index);
                setProductsVisible(true);
                setCommentsVisible(false);
              }}
              onShare={handleShare}
              onTryOn={getGeminiKey() ? handleTryOn : undefined}
            />
          </View>
        )}
        ListFooterComponent={
          <Pressable style={styles.refreshFooter} onPress={handleRefresh}>
            <Ionicons name="refresh-outline" size={22} color={colors.white} />
            <Text style={styles.refreshText}>Generate new looks</Text>
          </Pressable>
        }
      />

      {/* Try-on generating overlay */}
      {generatingTryOn && (
        <View style={styles.tryOnOverlay}>
          <View style={styles.tryOnCard}>
            <ActivityIndicator size="large" color={colors.white} />
            <Text style={styles.tryOnText}>Generating your look…</Text>
          </View>
        </View>
      )}

      {/* Sheets */}
      <CommentsSheet
        visible={commentsVisible}
        comments={activeComments}
        onClose={() => setCommentsVisible(false)}
        onSend={handleSendComment}
      />

      <ProductSheet
        visible={productsVisible}
        products={currentPost?.products ?? []}
        onClose={() => setProductsVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.black,
  },
  loader: {
    flex: 1,
    backgroundColor: colors.black,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.lg,
  },
  loadingLogo: {
    fontSize: font.sizes.xxl,
    fontWeight: font.bold,
    color: colors.white,
    letterSpacing: -1,
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  topLogo: {
    fontSize: font.sizes.xl,
    fontWeight: font.bold,
    color: colors.white,
    letterSpacing: -0.5,
  },
  settingsBtn: {
    padding: 4,
  },
  postContainer: {
    width: SCREEN_W,
  },
  bottomGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 200,
    backgroundColor: 'transparent',
    // Simple opacity overlay instead of LinearGradient
  },
  refreshFooter: {
    height: SCREEN_H,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.sm,
  },
  refreshText: {
    color: colors.grey400,
    fontSize: font.sizes.md,
    fontWeight: font.medium,
  },
  tryOnOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  tryOnCard: {
    backgroundColor: colors.grey900,
    borderRadius: radius.lg,
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.md,
    minWidth: 200,
  },
  tryOnText: {
    color: colors.white,
    fontSize: font.sizes.md,
    fontWeight: font.medium,
  },
});
