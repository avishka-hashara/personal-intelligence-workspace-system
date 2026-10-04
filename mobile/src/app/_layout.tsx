import type { Session } from '@supabase/supabase-js';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ActivityIndicator, AppState, useColorScheme, View } from 'react-native';
import { supabase } from '@/lib/supabase';
import { syncNow } from '@/lib/sync';
import { useTheme } from '@/lib/theme';

const SYNC_INTERVAL_MS = 60_000;

export default function RootLayout() {
  const scheme = useColorScheme();
  const t = useTheme();
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  const signedIn = !!session;

  // Full reconcile on sign-in/launch, incremental on foreground and every minute
  useEffect(() => {
    if (!signedIn) return;
    syncNow({ full: true });
    const appState = AppState.addEventListener('change', (s) => {
      if (s === 'active') syncNow();
    });
    const interval = setInterval(() => {
      if (AppState.currentState === 'active') syncNow();
    }, SYNC_INTERVAL_MS);
    return () => {
      appState.remove();
      clearInterval(interval);
    };
  }, [signedIn]);

  const navTheme = scheme === 'dark' ? DarkTheme : DefaultTheme;

  if (session === undefined) {
    return (
      <View style={{ flex: 1, backgroundColor: t.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={t.accent} />
      </View>
    );
  }

  return (
    <ThemeProvider
      value={{
        ...navTheme,
        colors: { ...navTheme.colors, background: t.bg, card: t.bg, text: t.text, border: t.border, primary: t.accent },
      }}
    >
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShadowVisible: false,
          headerStyle: { backgroundColor: t.bg },
          headerTintColor: t.text,
          contentStyle: { backgroundColor: t.bg },
        }}
      >
        <Stack.Protected guard={signedIn}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="task/[id]" options={{ title: 'Task', presentation: 'modal' }} />
          <Stack.Screen name="note/[id]" options={{ title: '' }} />
          <Stack.Screen name="settings" options={{ title: 'Settings' }} />
        </Stack.Protected>
        <Stack.Protected guard={!signedIn}>
          <Stack.Screen name="login" options={{ headerShown: false }} />
        </Stack.Protected>
      </Stack>
    </ThemeProvider>
  );
}
