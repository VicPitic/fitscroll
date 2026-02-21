/**
 * fitscroll – Entry / splash → onboarding or feed
 */

import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { getProfile, getCachedFeed } from '../src/storage';
import { colors } from '../src/theme';

export default function Index() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    (async () => {
      const profile = await getProfile();
      if (!profile.onboarded) {
        router.replace('/onboarding');
      } else {
        // Check if we already have a generated feed
        const cached = await getCachedFeed();
        if (cached.length > 0) {
          router.replace('/feed');
        } else {
          // Onboarded but no feed yet – regenerate
          router.replace('/generating');
        }
      }
      setChecking(false);
    })();
  }, []);

  if (!checking) return null;

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={colors.white} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.black,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
