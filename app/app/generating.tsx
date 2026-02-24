/**
 * fitscroll – Feed generation screen
 *
 * Shown immediately after onboarding.  Does:
 *  1.  Searches Pinterest via the hosted bridge using the user's keywords.
 *  2.  For each Pinterest outfit image, calls Gemini to generate
 *      the user wearing that outfit.
 *  3.  Saves the results as the initial feed (cached locally).
 *  4.  Navigates to /feed when done (or on error with partial results).
 *
 * While this happens the user sees a sleek progress screen so they know
 * the app is working for them – not just showing stock photos.
 */

import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  Image,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, font, radius, spacing } from '../src/theme';
import { OutfitPost } from '../src/types';
import { getProfile, cacheFeed } from '../src/storage';
import { searchPinterest, PinterestOutfit } from '../src/pinterest';
import { generateTryOn } from '../src/gemini';
import { PINTEREST_FETCH_LIMIT } from '../src/config';

const { width: SCREEN_W } = Dimensions.get('window');

const STATUS_MESSAGES = [
  'Finding outfit inspiration…',
  'Downloading looks from Pinterest…',
  'Generating your personalized feed…',
  'Applying your style…',
  'Almost ready…',
];

export default function Generating() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [status, setStatus] = useState(STATUS_MESSAGES[0]);
  const [progress, setProgress] = useState(0); // 0..1
  const [completed, setCompleted] = useState(0);
  const [total, setTotal] = useState(PINTEREST_FETCH_LIMIT);
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Animated values
  const progressAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(0.6)).current;
  const fadeIn = useRef(new Animated.Value(0)).current;

  // Run pulse animation loop
  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.6,
          duration: 1200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    pulse.start();

    Animated.timing(fadeIn, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();

    return () => pulse.stop();
  }, []);

  // Animate progress bar
  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: progress,
      duration: 400,
      easing: Easing.out(Easing.ease),
      useNativeDriver: false,
    }).start();
  }, [progress]);

  // Main generation pipeline
  useEffect(() => {
    runPipeline();
  }, []);

  const runPipeline = async () => {
    try {
      const profile = await getProfile();
      const userPhotoUri = profile.photoUri;

      if (!userPhotoUri) {
        setError('No photo found. Please go back and upload one.');
        return;
      }

      // ── Step 1: Search Pinterest ──
      setStatus('Finding outfit inspiration…');
      setProgress(0.05);

      const keywords = profile.keywords.length > 0
        ? profile.keywords
        : ['fashion outfit inspiration'];

      const pinterestOutfits = await searchPinterest(keywords, PINTEREST_FETCH_LIMIT, true);

      if (pinterestOutfits.length === 0) {
        setError(
          'No outfits found.\n\n' +
          'The bridge server may still be scraping, or pinscrape returned no results.\n' +
          'Check the Python server logs and try again.',
        );
        return;
      }

      setTotal(pinterestOutfits.length);
      setStatus('Downloading looks from Pinterest…');
      setProgress(0.15);

      // ── Step 2: Generate try-on for each outfit ──
      setStatus('Generating your personalized feed…');

      // Determine the user's primary style for environment selection
      const primaryStyle = profile.styles.length > 0 ? profile.styles[0] : null;

      const posts: OutfitPost[] = [];
      let done = 0;
      let aiSuccessCount = 0;

      for (const outfit of pinterestOutfits) {
        const idx = done + 1;
        setStatus(`Creating look ${idx} of ${pinterestOutfits.length}…`);

        try {
          // Use sourceUrl (original Pinterest CDN) for Gemini — more reliable
          // than bridge-served URL which requires bridge to stay up
          const imageUrlForGemini = outfit.sourceUrl || outfit.imageUrl;

          // Pick the style that best matches this outfit's caption
          const outfitStyle = profile.styles.find(
            (s: string) => outfit.captionHint.toLowerCase().includes(s.toLowerCase()),
          ) ?? primaryStyle;

          console.log(`[generating] Outfit ${idx}: calling generateTryOn with`, imageUrlForGemini.slice(0, 80));

          const generatedUri = await generateTryOn(
            userPhotoUri,
            imageUrlForGemini,
            outfit.captionHint,
            profile.gender,
            outfitStyle,
          );

          if (generatedUri) {
            aiSuccessCount++;
            console.log(`[generating] ✓ Outfit ${idx}: AI image generated`);
            // Show the latest generated image as preview
            setPreviewUri(generatedUri);

            posts.push({
              id: `gen-${Date.now()}-${done}-${Math.random().toString(36).slice(2, 6)}`,
              images: [generatedUri, outfit.sourceUrl || outfit.imageUrl], // generated first, original second
              captionHint: outfit.captionHint,
              products: outfit.products,
              liked: false,
              likeCount: Math.floor(Math.random() * 500) + 50,
              commentCount: Math.floor(Math.random() * 30),
              comments: [],
              createdAt: new Date().toISOString(),
            });
          } else {
            console.warn(`[generating] ✗ Outfit ${idx}: Gemini returned null, using Pinterest image`);
            // If Gemini failed, still include the Pinterest image as fallback
            posts.push({
              id: `pin-${Date.now()}-${done}-${Math.random().toString(36).slice(2, 6)}`,
              images: [outfit.sourceUrl || outfit.imageUrl],
              captionHint: outfit.captionHint,
              products: outfit.products,
              liked: false,
              likeCount: Math.floor(Math.random() * 500) + 50,
              commentCount: Math.floor(Math.random() * 30),
              comments: [],
              createdAt: new Date().toISOString(),
            });
          }
        } catch (e) {
          console.warn(`[generating] ✗ Outfit ${idx} exception:`, e);
          // Still include the original image
          posts.push({
            id: `pin-${Date.now()}-${done}`,
            images: [outfit.sourceUrl || outfit.imageUrl],
            captionHint: outfit.captionHint,
            products: outfit.products,
            liked: false,
            likeCount: Math.floor(Math.random() * 500) + 50,
            commentCount: Math.floor(Math.random() * 30),
            comments: [],
            createdAt: new Date().toISOString(),
          });
        }

        done++;
        setCompleted(done);
        setProgress(0.15 + (done / pinterestOutfits.length) * 0.8);
      }

      // ── Step 3: Save & navigate ──
      console.log(`[generating] Pipeline done: ${aiSuccessCount}/${pinterestOutfits.length} AI-generated, ${posts.length} total posts`);
      setStatus(aiSuccessCount > 0
        ? `Done! ${aiSuccessCount} AI looks generated`
        : 'Done! Loading your feed…');
      setProgress(1);

      if (posts.length > 0) {
        await cacheFeed(posts);
      }

      // Small delay so the user sees 100%
      setTimeout(() => {
        router.replace('/feed');
      }, 800);
    } catch (e) {
      console.warn('[generating] Pipeline error:', e);
      setError('Something went wrong while generating your feed. Please try again.');
    }
  };

  return (
    <Animated.View style={[styles.screen, { opacity: fadeIn }]}>
      <View style={[styles.content, { paddingTop: insets.top + 60 }]}>
        {/* Logo */}
        <Animated.Text style={[styles.logo, { opacity: pulseAnim }]}>
          fitscroll
        </Animated.Text>

        {/* Preview image */}
        <View style={styles.previewContainer}>
          {previewUri ? (
            <Image
              source={{ uri: previewUri }}
              style={styles.preview}
              resizeMode="cover"
            />
          ) : (
            <Animated.View style={[styles.previewPlaceholder, { opacity: pulseAnim }]}>
              <Text style={styles.previewEmoji}>👤</Text>
              <Text style={styles.previewHint}>Your looks appear here</Text>
            </Animated.View>
          )}
        </View>

        {/* Status text */}
        <Text style={styles.status}>{error ?? status}</Text>

        {/* Progress bar */}
        {!error && (
          <View style={styles.progressTrack}>
            <Animated.View
              style={[
                styles.progressFill,
                {
                  width: progressAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0%', '100%'],
                  }),
                },
              ]}
            />
          </View>
        )}

        {/* Counter */}
        {!error && completed > 0 && (
          <Text style={styles.counter}>
            {completed} / {total} looks generated
          </Text>
        )}

        {/* Error hint */}
        {error && (
          <Text
            style={styles.errorHint}
            onPress={() => router.replace('/onboarding')}
          >
            Tap to go back
          </Text>
        )}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.black,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
  },
  logo: {
    fontSize: font.sizes.hero,
    fontWeight: font.bold,
    color: colors.white,
    letterSpacing: -1.5,
    marginBottom: spacing.xxl,
  },
  previewContainer: {
    width: SCREEN_W * 0.55,
    height: SCREEN_W * 0.75,
    borderRadius: radius.lg,
    overflow: 'hidden',
    marginBottom: spacing.xl,
    backgroundColor: colors.grey900,
  },
  preview: {
    width: '100%',
    height: '100%',
  },
  previewPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  previewEmoji: {
    fontSize: 48,
  },
  previewHint: {
    color: colors.grey600,
    fontSize: font.sizes.sm,
  },
  status: {
    color: colors.grey400,
    fontSize: font.sizes.md,
    textAlign: 'center',
    marginBottom: spacing.lg,
    lineHeight: 22,
    paddingHorizontal: spacing.md,
  },
  progressTrack: {
    width: '100%',
    height: 4,
    backgroundColor: colors.grey800,
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: spacing.md,
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.white,
    borderRadius: 2,
  },
  counter: {
    color: colors.grey500,
    fontSize: font.sizes.sm,
    fontWeight: font.medium,
  },
  errorHint: {
    color: colors.grey500,
    fontSize: font.sizes.md,
    marginTop: spacing.lg,
    textDecorationLine: 'underline',
  },
});
