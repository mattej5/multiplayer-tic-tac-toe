import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

type Result = 'X' | 'O' | 'draw' | null;

interface Props {
  visible: boolean;
  result: Result;
  onReset: () => void;     // required: reset board & start new round
}

export default function GameResultDialog({ visible, result, onReset }: Readonly<Props>) {
  if (!result) return null;

  const title =
    result === 'draw'
      ? 'Draw'
      : `${result} wins!`;

  const emoji =
    result === 'draw'
      ? '🤝'
      : '🏆';

  return (
    <Modal animationType="fade" transparent visible={visible} onRequestClose={onReset}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.emoji}>{emoji}</Text>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>
            {result === 'draw' ? 'No more moves left.' : 'Nice game!'}
          </Text>

          <View style={styles.actions}>
            <Pressable onPress={onReset} style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}>
              <Text style={styles.primaryBtnLabel}>Play Again</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    borderRadius: 16,
    backgroundColor: 'white',
    paddingHorizontal: 20,
    paddingVertical: 24,
    alignItems: 'center',
  },
  emoji: { fontSize: 44, marginBottom: 8 },
  title: { fontSize: 24, fontWeight: '800', marginBottom: 4 },
  subtitle: { fontSize: 16, color: '#6b7280', marginBottom: 16 },
  actions: { flexDirection: 'row', gap: 12 },
  primaryBtn: {
    backgroundColor: '#111827',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  primaryBtnLabel: { color: 'white', fontSize: 16, fontWeight: '700' },
  textBtn: {
    backgroundColor: 'transparent',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  textBtnLabel: { color: '#111827', fontSize: 16, fontWeight: '700' },
  pressed: { opacity: 0.9 },
});
