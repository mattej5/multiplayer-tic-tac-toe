// providers/SessionProvider.tsx
import { supabase } from '@/lib/supabase';
import React, {
    createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
} from 'react';

type Status = 'idle' | 'connecting' | 'connected' | 'waiting' | 'full';
type Role = 'X' | 'O' | null;
type Cell = 'X' | 'O' | null;
type GameStatus = 'playing' | 'finished';

type SessionContextValue = {
  // session/presence
  code: string;
  status: Status;
  role: Role;
  peers: string[];
  players: { x: string | null; o: string | null };
  clientId: string;
  createSession: () => Promise<void>;
  joinSession: (code: string) => Promise<void>;
  leaveSession: () => Promise<void>;

  // game state (server-authoritative)
  board: Cell[];
  currentPlayer: 'X' | 'O';
  gameStatus: GameStatus;
  winner: 'X' | 'O' | 'draw' | null;
  winningLine: number[] | null;

  // game actions
  makeMove: (cellIndex: number) => Promise<void>;
  resetGame: () => Promise<void>;
};

const SessionContext = createContext<SessionContextValue | null>(null);

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used within SessionProvider');
  return ctx;
}

function randomCode(len = 4) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: len }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('');
}

export function SessionProvider({ children }: Readonly<{ children: React.ReactNode }>) {
  // ---------- session state ----------
  const [code, setCode] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [peers, setPeers] = useState<string[]>([]);
  const [role, setRole] = useState<Role>(null);
  const [players, setPlayers] = useState<{ x: string | null; o: string | null }>({ x: null, o: null });

  // Keep presence channel alive across tabs
  const presenceChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Ephemeral identity for this app run
  const clientId = useMemo(() => Math.random().toString(36).slice(2, 10), []);

  // ---------- game state (lives in provider) ----------
  const [board, setBoard] = useState<Cell[]>(Array(9).fill(null));
  const [currentPlayer, setCurrentPlayer] = useState<'X' | 'O'>('X');
  const [gameStatus, setGameStatus] = useState<GameStatus>('playing');
  const [winner, setWinner] = useState<'X' | 'O' | 'draw' | null>(null);
  const [winningLine, setWinningLine] = useState<number[] | null>(null);

  // Separate realtime channel for Postgres Changes on public.games
  const gameChangesRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // ----- helpers -----
  const fetchRoles = useCallback(async (sessionCode: string) => {
    if (!sessionCode) return;
    const { data, error } = await supabase
      .from('sessions')
      .select('player_x_id, player_o_id')
      .eq('code', sessionCode)
      .single();
    if (!error && data) {
      setPlayers({ x: data.player_x_id ?? null, o: data.player_o_id ?? null });
    }
  }, []);

  const hydrateGame = useCallback(async (sessionCode: string) => {
    if (!sessionCode) return;
    const { data } = await supabase
      .from('games')
      .select('board,current_player,status,winner,winning_line,move_count')
      .eq('code', sessionCode)
      .maybeSingle();

    if (!data) {
      // create/init the row if missing
      await supabase.rpc('reset_game', { p_code: sessionCode, p_client_id: clientId }).match(() => {});
      return;
    }
    setBoard((data.board ?? []).map((v: string | null) => (v === 'X' || v === 'O' ? v : null)));
    setCurrentPlayer((data.current_player as 'X' | 'O') ?? 'X');
    setGameStatus((data.status as GameStatus) ?? 'playing');
    setWinner((data.winner as 'X' | 'O' | 'draw' | null) ?? null);
    setWinningLine((data.winning_line as number[] | null) ?? null);
  }, [clientId]);

  const subscribeGameChanges = useCallback(async (sessionCode: string) => {
    if (!sessionCode) return;

    // Cleanup previous subscription
    if (gameChangesRef.current) {
      await gameChangesRef.current.unsubscribe();
      gameChangesRef.current = null;
    }

    // --- Your snippet, placed in the provider ---
    const ch = supabase
      .channel(`game:${sessionCode}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'games',
        filter: `code=eq.${sessionCode}`,
      }, (payload) => {
        const row = payload.new as any;
        if (!row) return;
        setBoard((row.board ?? []).map((v: string | null) => (v === 'X' || v === 'O' ? v : null)));
        setCurrentPlayer((row.current_player as 'X' | 'O') ?? 'X');
        setGameStatus((row.status as GameStatus) ?? 'playing');
        setWinner((row.winner as 'X' | 'O' | 'draw' | null) ?? null);
        setWinningLine((row.winning_line as number[] | null) ?? null);
      })
      .subscribe();

    gameChangesRef.current = ch;
  }, []);

  const joinPresenceChannel = useCallback(async (sessionCode: string, prefer: Role) => {
    // Cleanup previous presence channel
    if (presenceChannelRef.current) {
      await presenceChannelRef.current.unsubscribe();
      presenceChannelRef.current = null;
    }
    setRole(null);
    setPlayers({ x: null, o: null });

    const name = `t3:${sessionCode}`;
    const channel = supabase.channel(name, { config: { presence: { key: clientId } } });
    presenceChannelRef.current = channel;

    setStatus('connecting');

    channel
      .on('presence', { event: 'sync' }, async () => {
        const state = channel.presenceState() as Record<string, any[]>;
        const members = Object.keys(state);
        setPeers(members);
        const nextStatus = (prev: Status) => {
          if (prev === 'full') return 'full';
          return members.length >= 2 ? 'connected' : 'waiting';
        };
        setStatus(nextStatus);
        await fetchRoles(sessionCode);
      })
      .subscribe(async (subStatus) => {
        if (subStatus === 'SUBSCRIBED') {
          await channel.track({ joinedAt: Date.now() }).catch(() => {});

          // Atomically claim X/O (or FULL)
          const { data: assigned, error: rpcError } = await supabase.rpc('claim_role', {
            p_code: sessionCode,
            p_client_id: clientId,
            p_prefer: prefer,
          });

          if (rpcError) {
            console.warn('claim_role error', rpcError);
            return;
          }

          if (assigned === 'FULL') {
            setStatus('full');
            setRole(null);
          } else if (assigned === 'X' || assigned === 'O') {
            setRole(assigned);
            await fetchRoles(sessionCode);
          }
        }
      });
  }, [clientId, fetchRoles]);

  // ----- public actions -----
  const createSession = useCallback(async () => {
    const c = randomCode(4);
    setCode(c);
    await joinPresenceChannel(c, 'X'); // creator prefers X
    // hydrate + subscribe game state
    await hydrateGame(c);
    await subscribeGameChanges(c);
  }, [joinPresenceChannel, hydrateGame, subscribeGameChanges]);

  const joinSession = useCallback(async (c: string) => {
    const sessionCode = c.trim().toUpperCase();
    if (!sessionCode) return;
    setCode(sessionCode);
    await joinPresenceChannel(sessionCode, null);
    await hydrateGame(sessionCode);
    await subscribeGameChanges(sessionCode);
  }, [joinPresenceChannel, hydrateGame, subscribeGameChanges]);

  const leaveSession = useCallback(async () => {
    if (code) {
      await supabase.rpc('release_role', { p_code: code, p_client_id: clientId }).match(() => {});
    }
    if (presenceChannelRef.current) {
      await presenceChannelRef.current.unsubscribe();
      presenceChannelRef.current = null;
    }
    if (gameChangesRef.current) {
      await gameChangesRef.current.unsubscribe();
      gameChangesRef.current = null;
    }
    // reset UI state
    setPeers([]);
    setCode('');
    setRole(null);
    setPlayers({ x: null, o: null });
    setStatus('idle');

    setBoard(Array(9).fill(null));
    setCurrentPlayer('X');
    setGameStatus('playing');
    setWinner(null);
    setWinningLine(null);
  }, [clientId, code]);

  const makeMove = useCallback(async (cellIndex: number) => {
    if (!code) return;
    const { error } = await supabase.rpc('make_move', {
      p_code: code,
      p_client_id: clientId,
      p_cell_index: cellIndex, // 0..8
    });
    if (error) {
      // surface this in UI if you like
      console.warn('make_move error:', error.message);
    }
    // No local setState here; realtime will push the update.
  }, [code, clientId]);

  const resetGame = useCallback(async () => {
    if (!code) return;
    const { error } = await supabase.rpc('reset_game', { p_code: code, p_client_id: clientId });
    if (error) console.warn('reset_game error:', error.message);
  }, [code, clientId]);

  // Cleanup on provider unmount
  useEffect(() => {
    return () => {
      if (presenceChannelRef.current) presenceChannelRef.current.unsubscribe();
      if (gameChangesRef.current) gameChangesRef.current.unsubscribe();
    };
  }, []);

  const value = useMemo<SessionContextValue>(() => ({
    // session
    code, status, role, peers, players, clientId,
    createSession, joinSession, leaveSession,

    // game
    board, currentPlayer, gameStatus, winner, winningLine,
    makeMove, resetGame,
  }), [
    code, status, role, peers, players, clientId,
    createSession, joinSession, leaveSession,
    board, currentPlayer, gameStatus, winner, winningLine,
    makeMove, resetGame,
  ]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}
