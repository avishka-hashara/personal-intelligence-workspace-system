import Constants from 'expo-constants';
import { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { Button, Card, Input, SectionHeader, T } from '@/components/ui';
import { getApiUrl, setApiUrl } from '@/lib/config';
import { clearLocalData, useOutboxCount } from '@/lib/db';
import { supabase } from '@/lib/supabase';
import { resetSyncCursor, syncNow, useSyncState } from '@/lib/sync';
import { useTheme } from '@/lib/theme';

export default function Settings() {
  const t = useTheme();
  const sync = useSyncState();
  const pending = useOutboxCount();
  const [email, setEmail] = useState<string | undefined>();
  const [url, setUrl] = useState(getApiUrl());

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email));
  }, []);

  function saveUrl() {
    setApiUrl(url);
    setUrl(getApiUrl());
    resetSyncCursor();
    syncNow({ full: true });
  }

  function signOut() {
    const warn = pending > 0 ? `${pending} unsynced change(s) on this device will be lost.` : undefined;
    Alert.alert('Sign out?', warn, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: async () => {
          await supabase.auth.signOut();
          clearLocalData();
          resetSyncCursor();
        },
      },
    ]);
  }

  return (
    <ScrollView style={{ backgroundColor: t.bg }} contentContainerStyle={styles.container}>
      <SectionHeader title="Account" />
      <Card>
        <T muted variant="small">
          Signed in as
        </T>
        <T variant="heading">{email ?? '…'}</T>
      </Card>

      <SectionHeader title="Sync" />
      <Card style={{ gap: 6 }}>
        <Row label="Status" value={sync.status} />
        <Row label="Pending changes" value={String(pending)} />
        <Row
          label="Last synced"
          value={sync.lastSyncedAt ? new Date(sync.lastSyncedAt).toLocaleString() : 'Never'}
        />
        {sync.error && <T style={{ color: t.danger, marginTop: 4 }}>{sync.error}</T>}
        <Button
          title="Sync now"
          icon="sync"
          variant="secondary"
          onPress={() => syncNow({ full: true })}
          loading={sync.status === 'syncing'}
          style={{ marginTop: 8 }}
        />
      </Card>

      <SectionHeader title="Server" />
      <Card style={{ gap: 10 }}>
        <T muted variant="small">
          URL of your deployed PIW web app (Next.js on Vercel). Sync uses its /api/v1/sync endpoints.
        </T>
        <Input
          value={url}
          onChangeText={setUrl}
          placeholder="https://your-piw.vercel.app"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
        />
        <Button title="Save server URL" variant="secondary" onPress={saveUrl} />
      </Card>

      <Button title="Sign out" variant="danger" icon="log-out-outline" onPress={signOut} style={{ marginTop: 28 }} />
      <T variant="small" muted style={{ textAlign: 'center', marginTop: 16 }}>
        PIW for Android · v{Constants.expoConfig?.version ?? '1.0.0'}
      </T>
    </ScrollView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <T muted>{label}</T>
      <T>{value}</T>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 48 },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
});
