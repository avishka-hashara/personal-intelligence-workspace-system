import Ionicons from '@expo/vector-icons/Ionicons';
import { ActivityIndicator, Pressable, StyleSheet } from 'react-native';
import { useOutboxCount } from '@/lib/db';
import { syncNow, useSyncState } from '@/lib/sync';
import { useTheme } from '@/lib/theme';
import { T } from './ui';

/** Compact header indicator: spinner while syncing, cloud state otherwise. Tap to sync. */
export function SyncBadge() {
  const t = useTheme();
  const { status } = useSyncState();
  const pending = useOutboxCount();

  const icon =
    status === 'offline' ? 'cloud-offline-outline' : status === 'error' ? 'alert-circle-outline' : 'cloud-done-outline';
  const color = status === 'error' ? t.danger : status === 'offline' ? t.warning : t.textMuted;

  return (
    <Pressable onPress={() => syncNow({ full: true })} hitSlop={10} style={styles.badge}>
      {status === 'syncing' ? <ActivityIndicator size="small" color={t.textMuted} /> : <Ionicons name={icon} size={20} color={color} />}
      {pending > 0 && status !== 'syncing' && (
        <T variant="small" style={{ color: t.warning }}>
          {pending}
        </T>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8 },
});
