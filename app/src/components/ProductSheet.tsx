/**
 * fitscroll – Product overlay sheet
 *
 * Shows tagged products for the current outfit with clean cards.
 */

import { useEffect, useRef } from 'react';
import {
  Animated,
  Dimensions,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Product } from '../types';
import { colors, font, radius, spacing } from '../theme';

const { height: SCREEN_H } = Dimensions.get('window');
const SHEET_H = SCREEN_H * 0.42;

interface Props {
  visible: boolean;
  products: Product[];
  onClose: () => void;
}

export default function ProductSheet({ visible, products, onClose }: Props) {
  const translateY = useRef(new Animated.Value(SHEET_H)).current;

  useEffect(() => {
    Animated.spring(translateY, {
      toValue: visible ? 0 : SHEET_H,
      useNativeDriver: true,
      damping: 20,
      stiffness: 200,
    }).start();
  }, [visible]);

  if (!visible) return null;

  return (
    <Animated.View style={[styles.sheet, { transform: [{ translateY }] }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.handle} />
        <Text style={styles.headerTitle}>Products in this look</Text>
        <Pressable onPress={onClose} hitSlop={12}>
          <Ionicons name="close" size={22} color={colors.grey500} />
        </Pressable>
      </View>

      <FlatList
        data={products}
        keyExtractor={(p) => p.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <Text style={styles.empty}>No products tagged yet</Text>
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.iconWrap}>
              <Ionicons name="pricetag" size={20} color={colors.white} />
            </View>
            <View style={styles.info}>
              <Text style={styles.productName}>{item.name}</Text>
              <Text style={styles.productBrand}>{item.brand}</Text>
            </View>
            <Text style={styles.price}>{item.priceLabel}</Text>
          </View>
        )}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: SHEET_H,
    backgroundColor: colors.grey900,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.grey800,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.grey700,
    position: 'absolute',
    top: 6,
    left: '50%',
    marginLeft: -18,
  },
  headerTitle: {
    color: colors.white,
    fontSize: font.sizes.md,
    fontWeight: font.semibold,
  },
  list: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  empty: {
    color: colors.grey600,
    textAlign: 'center',
    marginTop: spacing.xl,
    fontSize: font.sizes.sm,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.grey800,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.md,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    backgroundColor: colors.grey700,
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: {
    flex: 1,
  },
  productName: {
    color: colors.white,
    fontSize: font.sizes.md,
    fontWeight: font.semibold,
  },
  productBrand: {
    color: colors.grey500,
    fontSize: font.sizes.xs,
    marginTop: 2,
  },
  price: {
    color: colors.white,
    fontSize: font.sizes.lg,
    fontWeight: font.bold,
  },
});
