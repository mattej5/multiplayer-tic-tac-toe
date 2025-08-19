import GameResultDialog from '@/components/GameResultDialog';
import getWinLineStyle from '@/helpers/GetWinLineStyle';
import { useSession } from '@/providers/SessionProvider';
import * as Haptics from 'expo-haptics';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

type Cell = 'X' | 'O' | null;

export default function GameScreen() {
  const {
    // session bits
    status,
    role,
    // server-owned game state
    board,
    currentPlayer,
    gameStatus,
    winner,
    winningLine,
    makeMove,
    resetGame,
  } = useSession();

  const connected = status === 'connected';
  const isMyTurn = !!role && role === currentPlayer;
  const canPlay = connected && gameStatus === 'playing' && isMyTurn;

  const lineStyle = winningLine ? getWinLineStyle(winningLine) : null;
  let winColor = '#9ca3af';
  if (winner === 'X') {
    winColor = '#2563eb';
  } else if (winner === 'O') {
    winColor = '#dc2626';
  }

  async function onCellPress(index: number) {
    if (!canPlay || board[index] !== null) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    await makeMove(index); // provider will push updates via realtime
  }

  function resultForDialog(): 'X' | 'O' | 'draw' | null {
    return gameStatus === 'finished' ? (winner ?? 'draw') : null;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Tic-Tac-Toe</Text>

      {/* Turn + status messaging */}
      {gameStatus === 'playing' && (
        <View style={{ alignItems: 'center', marginBottom: 12 }}>
          <Text style={styles.turn}>
            You: {role ?? '—'} • Turn: {currentPlayer}
          </Text>
          {!isMyTurn && (
            <Text style={styles.subtle}>waiting for other player…</Text>
          )}
        </View>
      )}

      <View style={styles.gridWrapper}>
        {/* 3×3 grid */}
        <View style={styles.grid}>
          {board.map((cell, i) => {
            const disabled = !canPlay || cell !== null;
            return (
              <Pressable
                key={i}
                style={({ pressed }) => [
                  styles.square,
                  pressed && !disabled ? styles.squarePressed : null,
                ]}
                onPress={() => onCellPress(i)}
                android_ripple={{ borderless: false }}
                disabled={disabled}
              >
                <Text
                  style={[
                    styles.mark,
                    cell === 'X' && styles.xMark,
                    cell === 'O' && styles.oMark,
                  ]}
                >
                  {cell ?? ''}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* strike line overlay ON TOP */}
        {winningLine && (
          <View
            pointerEvents="none"
            style={[lineStyle, { backgroundColor: winColor, zIndex: 10 }]}
          />
        )}
      </View>

      <GameResultDialog
        visible={gameStatus === 'finished'}
        result={resultForDialog()}
        onReset={resetGame}
      />
    </View>
  );
}

/* --- layout constants --- */
const SIZE = 96;
const GAP = 8;
const GRID = SIZE * 3 + GAP * 2;

/* --- styles --- */
const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 48, alignItems: 'center', backgroundColor: '#fff' },
  title: { fontSize: 28, fontWeight: '700', marginBottom: 8 },
  turn: { fontSize: 18, color: '#374151', fontWeight: '600' },
  subtle: { fontSize: 14, color: '#6b7280', marginTop: 4 },

  gridWrapper: { width: GRID, height: GRID, position: 'relative', marginBottom: 20 },
  grid: {
    width: GRID, height: GRID, flexDirection: 'row', flexWrap: 'wrap',
    gap: GAP, justifyContent: 'center',
  },
  square: {
    width: SIZE, height: SIZE, borderRadius: 12, borderWidth: 2, borderColor: '#e5e7eb',
    alignItems: 'center', justifyContent: 'center', backgroundColor: '#f9fafb',
  },
  squarePressed: { backgroundColor: '#f3f4f6' },
  mark: { fontSize: 48, fontWeight: '800' },
  xMark: { color: '#2563eb' },
  oMark: { color: '#dc2626' },
});
