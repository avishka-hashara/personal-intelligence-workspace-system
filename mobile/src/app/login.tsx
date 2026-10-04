import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { KeyboardAvoidingView, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Card, Input, T } from '@/components/ui';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { useTheme } from '@/lib/theme';

export default function Login() {
  const t = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ kind: 'error' | 'info'; text: string } | null>(null);

  // Same flow as the web login page: try sign-in, fall back to sign-up
  async function submit() {
    if (!email.trim() || !password) return;
    setLoading(true);
    setMessage(null);
    const creds = { email: email.trim(), password };
    const { data, error: signInError } = await supabase.auth.signInWithPassword(creds);
    if (!signInError && data.session) {
      setLoading(false);
      return; // root layout swaps to the app on auth state change
    }
    const { data: signUp, error: signUpError } = await supabase.auth.signUp(creds);
    setLoading(false);
    if (signUpError) {
      setMessage({ kind: 'error', text: signInError?.message || signUpError.message });
    } else if (!signUp.session) {
      setMessage({ kind: 'info', text: 'Account created! If email confirmation is enabled, check your inbox.' });
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <View style={[styles.logo, { backgroundColor: t.accentSoft }]}>
            <Ionicons name="sparkles" size={28} color={t.accent} />
          </View>
          <T variant="title" style={{ textAlign: 'center' }}>
            Sign in to PIW
          </T>
          <T muted style={{ textAlign: 'center', marginTop: 6, marginBottom: 28 }}>
            Your tasks, calendar, habits and notes — offline-first and synced with the web workspace.
          </T>

          {!isSupabaseConfigured && (
            <Card style={{ marginBottom: 16, backgroundColor: t.dangerSoft }}>
              <T style={{ color: t.danger }}>
                Supabase is not configured. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in mobile/.env.
              </T>
            </Card>
          )}

          <View style={{ gap: 12 }}>
            <Input
              placeholder="you@example.com"
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
            />
            <Input
              placeholder="Password"
              secureTextEntry
              autoComplete="password"
              value={password}
              onChangeText={setPassword}
              onSubmitEditing={submit}
              returnKeyType="go"
            />
            <Button title="Continue" icon="arrow-forward" onPress={submit} loading={loading} />
          </View>

          {message && (
            <T style={{ marginTop: 16, textAlign: 'center', color: message.kind === 'error' ? t.danger : t.success }}>
              {message.text}
            </T>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  logo: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 20,
  },
});
