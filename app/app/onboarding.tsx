/**
 * fitscroll – Onboarding screen
 *
 * 1.  User picks their gender
 * 2.  User uploads / takes a selfie
 * 3.  Enters favorite brands (comma-separated)
 * 4.  Picks fashion styles
 *     → generating
 */

import { useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { colors, font, radius, spacing } from '../src/theme';
import { saveProfile, getProfile } from '../src/storage';
import { Gender } from '../src/types';

const GENDER_OPTIONS: { value: Gender; label: string; icon: string }[] = [
  { value: 'male', label: 'Male', icon: 'male-outline' },
  { value: 'female', label: 'Female', icon: 'female-outline' },
  { value: 'non-binary', label: 'Non-binary', icon: 'person-outline' },
];

const STYLE_OPTIONS = [
  'Streetwear',
  'Minimalist',
  'Athleisure',
  'Vintage',
  'Preppy',
  'Y2K',
  'Dark Academia',
  'Cottagecore',
  'Techwear',
  'Old Money',
  'Casual',
  'Avant-Garde',
];

export default function Onboarding() {
  const router = useRouter();

  const [gender, setGender] = useState<Gender | null>(null);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [brands, setBrands] = useState('');
  const [selectedStyles, setSelectedStyles] = useState<string[]>([]);
  const [step, setStep] = useState(0); // 0 = gender, 1 = photo, 2 = brands, 3 = styles

  /* ── photo picker ── */
  const pickPhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      allowsEditing: true,
      aspect: [3, 4],
    });
    if (!result.canceled && result.assets[0]) {
      setPhotoUri(result.assets[0].uri);
    }
  };

  const takePhoto = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return;
    const result = await ImagePicker.launchCameraAsync({
      quality: 0.8,
      allowsEditing: true,
      aspect: [3, 4],
    });
    if (!result.canceled && result.assets[0]) {
      setPhotoUri(result.assets[0].uri);
    }
  };

  const toggleStyle = (s: string) => {
    setSelectedStyles((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s],
    );
  };

  /* ── finish ── */
  const finish = async () => {
    const profile = await getProfile();
    profile.photoUri = photoUri;
    profile.gender = gender;
    profile.brands = brands
      .split(',')
      .map((b) => b.trim())
      .filter(Boolean);
    profile.styles = selectedStyles;

    // Build smart Pinterest keywords:
    // {brand} + {style} + "outfit" + {gender}
    const genderTag = gender === 'non-binary' ? '' : (gender ?? '');
    const keywords: string[] = [];

    for (const brand of profile.brands) {
      for (const style of selectedStyles) {
        keywords.push(`${brand} ${style} outfit ${genderTag}`.trim());
      }
    }
    // Also add style-only queries as fallback
    for (const style of selectedStyles) {
      keywords.push(`${style} outfit inspiration ${genderTag}`.trim());
    }
    // And brand-only queries
    for (const brand of profile.brands) {
      keywords.push(`${brand} outfit ${genderTag}`.trim());
    }

    profile.keywords = keywords;
    profile.onboarded = true;
    await saveProfile(profile);

    router.replace('/generating');
  };

  const canProceed = () => {
    if (step === 0) return !!gender;
    if (step === 1) return !!photoUri;
    if (step === 2) return brands.trim().length > 0;
    if (step === 3) return selectedStyles.length > 0;
    return true;
  };

  /* ── render steps ── */

  const renderGenderStep = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.title}>About You</Text>
      <Text style={styles.subtitle}>
        This helps us find outfits that fit your style
      </Text>
      <View style={styles.genderRow}>
        {GENDER_OPTIONS.map((opt) => {
          const active = gender === opt.value;
          return (
            <Pressable
              key={opt.value}
              onPress={() => setGender(opt.value)}
              style={[styles.genderCard, active && styles.genderCardActive]}
            >
              <Ionicons
                name={opt.icon as any}
                size={32}
                color={active ? colors.black : colors.grey400}
              />
              <Text style={[styles.genderLabel, active && styles.genderLabelActive]}>
                {opt.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );

  const renderPhotoStep = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.title}>Your Look</Text>
      <Text style={styles.subtitle}>
        Upload a photo of yourself so we can generate outfits for you
      </Text>

      {photoUri ? (
        <Pressable onPress={pickPhoto} style={styles.photoPreviewWrap}>
          <Image source={{ uri: photoUri }} style={styles.photoPreview} />
          <View style={styles.photoOverlay}>
            <Ionicons name="camera-outline" size={24} color={colors.white} />
            <Text style={styles.photoOverlayText}>Change</Text>
          </View>
        </Pressable>
      ) : (
        <View style={styles.photoActions}>
          <Pressable style={styles.photoBtn} onPress={pickPhoto}>
            <Ionicons name="images-outline" size={28} color={colors.white} />
            <Text style={styles.photoBtnText}>Gallery</Text>
          </Pressable>
          <Pressable style={styles.photoBtn} onPress={takePhoto}>
            <Ionicons name="camera-outline" size={28} color={colors.white} />
            <Text style={styles.photoBtnText}>Camera</Text>
          </Pressable>
        </View>
      )}
    </View>
  );

  const renderBrandsStep = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.title}>Favorite Brands</Text>
      <Text style={styles.subtitle}>
        Enter your go-to brands, separated by commas
      </Text>
      <TextInput
        style={styles.input}
        placeholder="Nike, Zara, Uniqlo, Acne Studios…"
        placeholderTextColor={colors.grey600}
        value={brands}
        onChangeText={setBrands}
        autoCapitalize="words"
        autoCorrect={false}
        multiline
      />
    </View>
  );

  const renderStylesStep = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.title}>Your Style</Text>
      <Text style={styles.subtitle}>Pick the aesthetics that match your vibe</Text>
      <View style={styles.chipGrid}>
        {STYLE_OPTIONS.map((s) => {
          const active = selectedStyles.includes(s);
          return (
            <Pressable
              key={s}
              onPress={() => toggleStyle(s)}
              style={[styles.chip, active && styles.chipActive]}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>
                {s}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );

  const steps = [renderGenderStep, renderPhotoStep, renderBrandsStep, renderStylesStep];

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        {/* Progress dots */}
        <View style={styles.dotsRow}>
          {steps.map((_, i) => (
            <View
              key={i}
              style={[styles.dot, i === step && styles.dotActive, i < step && styles.dotDone]}
            />
          ))}
        </View>

        {/* Logo */}
        <Text style={styles.logo}>fitscroll</Text>

        {steps[step]()}

        {/* Navigation buttons */}
        <View style={styles.navRow}>
          {step > 0 && (
            <Pressable style={styles.backBtn} onPress={() => setStep(step - 1)}>
              <Ionicons name="arrow-back" size={20} color={colors.white} />
            </Pressable>
          )}

          <Pressable
            style={[styles.nextBtn, !canProceed() && styles.nextBtnDisabled]}
            onPress={() => {
              if (!canProceed()) return;
              if (step < steps.length - 1) {
                setStep(step + 1);
              } else {
                finish();
              }
            }}
          >
            <Text style={styles.nextBtnText}>
              {step === steps.length - 1 ? 'Start' : 'Next'}
            </Text>
            <Ionicons
              name={step === steps.length - 1 ? 'checkmark' : 'arrow-forward'}
              size={18}
              color={colors.black}
            />
          </Pressable>
        </View>


      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/* ── styles ── */

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.black,
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: 60,
    paddingBottom: 40,
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: spacing.xl,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.grey800,
  },
  dotActive: {
    backgroundColor: colors.white,
    width: 24,
  },
  dotDone: {
    backgroundColor: colors.grey500,
  },
  logo: {
    fontSize: font.sizes.hero,
    fontWeight: font.bold,
    color: colors.white,
    textAlign: 'center',
    letterSpacing: -1.5,
    marginBottom: spacing.xxl,
  },
  stepContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  title: {
    fontSize: font.sizes.xxl,
    fontWeight: font.bold,
    color: colors.white,
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: font.sizes.md,
    color: colors.grey500,
    marginBottom: spacing.xl,
    lineHeight: 22,
  },
  /* gender step */
  genderRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  genderCard: {
    flex: 1,
    backgroundColor: colors.grey900,
    borderRadius: radius.lg,
    paddingVertical: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderWidth: 1.5,
    borderColor: colors.grey800,
  },
  genderCardActive: {
    backgroundColor: colors.white,
    borderColor: colors.white,
  },
  genderLabel: {
    color: colors.grey400,
    fontSize: font.sizes.md,
    fontWeight: font.medium as any,
  },
  genderLabelActive: {
    color: colors.black,
  },
  /* photo step */
  photoActions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  photoBtn: {
    flex: 1,
    backgroundColor: colors.grey900,
    borderRadius: radius.lg,
    paddingVertical: spacing.xxl,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.grey800,
  },
  photoBtnText: {
    color: colors.white,
    fontSize: font.sizes.sm,
    fontWeight: font.medium,
  },
  photoPreviewWrap: {
    alignSelf: 'center',
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  photoPreview: {
    width: 200,
    height: 267,
    borderRadius: radius.lg,
  },
  photoOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.55)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: spacing.sm,
  },
  photoOverlayText: {
    color: colors.white,
    fontSize: font.sizes.sm,
    fontWeight: font.medium,
  },
  /* brands step */
  input: {
    backgroundColor: colors.grey900,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    color: colors.white,
    fontSize: font.sizes.md,
    borderWidth: 1,
    borderColor: colors.grey800,
    minHeight: 56,
  },
  /* styles step */
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.grey700,
    backgroundColor: colors.transparent,
  },
  chipActive: {
    backgroundColor: colors.white,
    borderColor: colors.white,
  },
  chipText: {
    color: colors.grey400,
    fontSize: font.sizes.sm,
    fontWeight: font.medium,
  },
  chipTextActive: {
    color: colors.black,
  },
  /* nav */
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: spacing.xxl,
    gap: spacing.md,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.grey900,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.grey800,
  },
  nextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.white,
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
    borderRadius: radius.full,
  },
  nextBtnDisabled: {
    opacity: 0.3,
  },
  nextBtnText: {
    color: colors.black,
    fontSize: font.sizes.md,
    fontWeight: font.semibold,
  },
  skipBtn: {
    alignSelf: 'center',
    marginTop: spacing.lg,
  },
  skipText: {
    color: colors.grey600,
    fontSize: font.sizes.sm,
  },
});
