import { useSession } from '@/providers/SessionProvider';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

export default function SessionScreen() {
  const { code, status, peers, role, players, createSession, joinSession, leaveSession } = useSession();
  const [input, setInput] = useState('');

  const connected = status === 'connected';

  // Extract status message from nested ternary
  let statusMessage = '';
  if (status === 'full') {
    statusMessage = '🚫 Room is full';
  } else if (connected) {
    statusMessage = '✅ Session Connected';
  } else {
    statusMessage = '⏳ Waiting for other player…';
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Multiplayer Session</Text>

      {code ? (
        <>
          <Text style={styles.label}>Session Code</Text>
          <Text style={styles.code}>{code}</Text>
          <Text style={styles.status}>
            {statusMessage}
          </Text>
          <Text style={styles.small}>
            Members: {peers.length} {peers.length < 2 ? '(need 2+)' : ''}
          </Text>
          <Text style={styles.small}>
            Your role: {role ?? '—'} | X: {players.x ?? '—'} | O: {players.o ?? '—'}
          </Text>

          <Pressable onPress={leaveSession} style={({ pressed }) => [styles.btnGhost, pressed && styles.pressed]}>
            <Text style={styles.btnGhostText}>Leave Session</Text>
          </Pressable>
        </>
      ) : (
        <>
          <Pressable onPress={createSession} style={({ pressed }) => [styles.btnPrimary, pressed && styles.pressed]}>
            <Text style={styles.btnPrimaryText}>Create Session</Text>
          </Pressable>

          <View style={styles.joinRow}>
            <TextInput
              placeholder="Enter code"
              autoCapitalize="characters"
              value={input}
              onChangeText={(t) => setInput(t.toUpperCase())}
              style={styles.input}
              maxLength={6}
            />
            <Pressable onPress={() => joinSession(input)} style={({ pressed }) => [styles.btn, pressed && styles.pressed]}>
              <Text style={styles.btnText}>Join</Text>
            </Pressable>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 48, paddingHorizontal: 20, backgroundColor: '#fff' },
  title: { fontSize: 24, fontWeight: '800', marginBottom: 16 },
  label: { fontSize: 14, color: '#6b7280' },
  code: { fontSize: 32, fontWeight: '900', letterSpacing: 6, marginTop: 4, marginBottom: 8 },
  status: { fontSize: 16, marginBottom: 4 },
  small: { fontSize: 12, color: '#6b7280', marginBottom: 16 },
  btnPrimary: { backgroundColor: '#111827', paddingVertical: 12, borderRadius: 12, alignItems: 'center', marginBottom: 16 },
  btnPrimaryText: { color: 'white', fontSize: 16, fontWeight: '700' },
  joinRow: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  input: { flex: 1, borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, paddingHorizontal: 12, height: 44 },
  btn: { backgroundColor: '#111827', paddingHorizontal: 16, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  btnText: { color: 'white', fontWeight: '700' },
  btnGhost: { paddingVertical: 10, alignItems: 'center' },
  btnGhostText: { color: '#111827', fontWeight: '700' },
  pressed: { opacity: 0.9 },
});
