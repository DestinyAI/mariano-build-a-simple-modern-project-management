/**
 * Front-door authentication.
 *
 * TeamFlow's shared database is reached with an anonymous token (see src/cloud.ts),
 * so this layer is purely a client-side gate: a fixed list of accounts, checked in
 * the browser, with the chosen identity remembered in AsyncStorage. It keeps the
 * workspace behind a username/password without pretending to be real security —
 * the credentials ship in the bundle.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

export type UserRole = 'admin';

export interface AuthUser {
  username: string;
  displayName: string;
  role: UserRole;
}

interface Credential extends AuthUser {
  password: string;
}

/** The only accounts that can sign in. Username and password are case-sensitive. */
const USERS: Credential[] = [
  { username: 'Juan', password: 'Juan', displayName: 'Juan', role: 'admin' },
  { username: 'Mariano', password: 'Mariano', displayName: 'Mariano', role: 'admin' },
];

/** Where the signed-in identity is remembered between reloads. */
const AUTH_KEY = 'teamflow:auth';

export interface AuthValue {
  /** False until the persisted session has been read back from storage. */
  ready: boolean;
  /** The signed-in user, or null when nobody is signed in. */
  user: AuthUser | null;
  /** Check credentials against USERS; on a match, starts a session and returns true. */
  signIn: (username: string, password: string) => Promise<boolean>;
  /** End the session and forget the stored identity. */
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

/** Drop the password before anything leaves this module. */
function publicUser(credential: Credential): AuthUser {
  return { username: credential.username, displayName: credential.displayName, role: credential.role };
}

export function AuthProvider({ children }: { children: React.ReactNode }): React.ReactElement {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    let cancelled = false;
    const hydrate = async (): Promise<void> => {
      let restored: AuthUser | null = null;
      try {
        const raw = await AsyncStorage.getItem(AUTH_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as { username?: unknown };
          // Re-match against USERS so a renamed/removed account can't linger.
          const match = USERS.find(candidate => candidate.username === parsed.username);
          if (match) restored = publicUser(match);
        }
      } catch {
        restored = null;
      }
      if (cancelled) return;
      setUser(restored);
      setReady(true);
    };
    void hydrate();
    return () => {
      cancelled = true;
    };
  }, []);

  const signIn = useCallback(async (username: string, password: string): Promise<boolean> => {
    const match = USERS.find(
      candidate => candidate.username === username && candidate.password === password,
    );
    if (!match) return false;
    const next = publicUser(match);
    setUser(next);
    try {
      await AsyncStorage.setItem(AUTH_KEY, JSON.stringify(next));
    } catch {
      // A failed write just means the session won't survive a reload.
    }
    return true;
  }, []);

  const signOut = useCallback(async (): Promise<void> => {
    setUser(null);
    try {
      // Also drop the device-local "acting as" pick (src/storage.ts CURRENT_MEMBER_KEY),
      // so the next account on this browser doesn't inherit it.
      await AsyncStorage.multiRemove([AUTH_KEY, 'teamflow:current-member']);
    } catch {
      // Nothing actionable if the keys can't be cleared.
    }
  }, []);

  const value = useMemo<AuthValue>(
    () => ({ ready, user, signIn, signOut }),
    [ready, user, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside an AuthProvider');
  return context;
}
