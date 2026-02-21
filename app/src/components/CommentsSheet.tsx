/**
 * fitscroll – Bottom pull-up comments sheet
 */

import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, font, radius, spacing } from '../theme';

const { height: SCREEN_H } = Dimensions.get('window');
const SHEET_H = SCREEN_H * 0.55;

interface CommentItem {
  id: string;
  text: string;
  author: string;
  createdAt: string;
}

interface Props {
  visible: boolean;
  comments: CommentItem[];
  onClose: () => void;
  onSend: (text: string) => void;
}

export default function CommentsSheet({ visible, comments, onClose, onSend }: Props) {
  const translateY = useRef(new Animated.Value(SHEET_H)).current;
  const [text, setText] = useState('');

  useEffect(() => {
    Animated.spring(translateY, {
      toValue: visible ? 0 : SHEET_H,
      useNativeDriver: true,
      damping: 20,
      stiffness: 200,
    }).start();
  }, [visible]);

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setText('');
  };

  const timeAgo = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h`;
    return `${Math.floor(hrs / 24)}d`;
  };

  if (!visible) return null;

  return (
    <Animated.View style={[styles.sheet, { transform: [{ translateY }] }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
        keyboardVerticalOffset={20}
      >
        {/* Handle + header */}
        <View style={styles.header}>
          <View style={styles.handle} />
          <Text style={styles.headerTitle}>
            {comments.length} {comments.length === 1 ? 'comment' : 'comments'}
          </Text>
          <Pressable onPress={onClose} hitSlop={12}>
            <Ionicons name="close" size={22} color={colors.grey500} />
          </Pressable>
        </View>

        {/* Comment list */}
        <FlatList
          data={comments}
          keyExtractor={(c) => c.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <Text style={styles.empty}>No comments yet — be the first!</Text>
          }
          renderItem={({ item }) => (
            <View style={styles.commentRow}>
              <View style={styles.avatar}>
                <Text style={styles.avatarLetter}>
                  {item.author.charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={styles.commentBody}>
                <Text style={styles.commentAuthor}>{item.author}</Text>
                <Text style={styles.commentText}>{item.text}</Text>
                <Text style={styles.commentTime}>{timeAgo(item.createdAt)}</Text>
              </View>
            </View>
          )}
        />

        {/* Input */}
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            placeholder="Add a comment…"
            placeholderTextColor={colors.grey600}
            value={text}
            onChangeText={setText}
            returnKeyType="send"
            onSubmitEditing={handleSend}
          />
          <Pressable onPress={handleSend} style={styles.sendBtn}>
            <Ionicons
              name="arrow-up-circle"
              size={32}
              color={text.trim() ? colors.white : colors.grey700}
            />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
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
    alignSelf: 'center',
    left: '50%',
    marginLeft: -18,
  },
  headerTitle: {
    color: colors.white,
    fontSize: font.sizes.md,
    fontWeight: font.semibold,
  },
  list: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.md,
  },
  empty: {
    color: colors.grey600,
    textAlign: 'center',
    marginTop: spacing.xl,
    fontSize: font.sizes.sm,
  },
  commentRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.grey800,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: {
    color: colors.white,
    fontWeight: font.bold,
    fontSize: font.sizes.sm,
  },
  commentBody: {
    flex: 1,
  },
  commentAuthor: {
    color: colors.grey400,
    fontSize: font.sizes.xs,
    fontWeight: font.semibold,
    marginBottom: 2,
  },
  commentText: {
    color: colors.white,
    fontSize: font.sizes.sm,
    lineHeight: 18,
  },
  commentTime: {
    color: colors.grey600,
    fontSize: font.sizes.xs,
    marginTop: 4,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.grey800,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    gap: spacing.xs,
  },
  input: {
    flex: 1,
    backgroundColor: colors.grey800,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    color: colors.white,
    fontSize: font.sizes.sm,
  },
  sendBtn: {
    padding: 2,
  },
});
