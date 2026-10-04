import { router } from 'expo-router';
import { formatDistanceToNow } from 'date-fns';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { Card, Empty, Fab, Input, T } from '@/components/ui';
import { useEntities } from '@/lib/db';
import { createEntity, syncNow, useSyncState } from '@/lib/sync';
import { useTheme } from '@/lib/theme';

function preview(content?: string | null) {
  return (content ?? '').replace(/[#>*_`\-[\]]/g, '').replace(/\s+/g, ' ').trim();
}

export default function Notes() {
  const t = useTheme();
  const notes = useEntities('notes');
  const { status } = useSyncState();
  const [query, setQuery] = useState('');

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return notes
      .filter((n) => !q || n.title.toLowerCase().includes(q) || (n.content ?? '').toLowerCase().includes(q))
      .sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''));
  }, [notes, query]);

  function newNote() {
    const note = createEntity('notes', { title: 'Untitled Note', content: '' });
    router.push({ pathname: '/note/[id]', params: { id: note.id } });
  }

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
        <Input placeholder="Search notes…" value={query} onChangeText={setQuery} />
      </View>
      <FlatList
        data={visible}
        keyExtractor={(n) => n.id}
        contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 100 }}
        refreshControl={
          <RefreshControl refreshing={status === 'syncing'} onRefresh={() => syncNow({ full: true })} tintColor={t.accent} />
        }
        renderItem={({ item }) => (
          <Pressable onPress={() => router.push({ pathname: '/note/[id]', params: { id: item.id } })}>
            <Card>
              <T variant="heading" numberOfLines={1}>
                {item.title || 'Untitled Note'}
              </T>
              {!!preview(item.content) && (
                <T muted numberOfLines={2} style={styles.preview}>
                  {preview(item.content)}
                </T>
              )}
              {item.updatedAt && (
                <T variant="small" style={{ color: t.textFaint, marginTop: 6 }}>
                  {formatDistanceToNow(new Date(item.updatedAt), { addSuffix: true })}
                </T>
              )}
            </Card>
          </Pressable>
        )}
        ListEmptyComponent={
          <Empty icon="document-text-outline" title={query ? 'No matches' : 'No notes yet'} hint="Tap + to write one." />
        }
      />
      <Fab onPress={newNote} icon="create-outline" />
    </View>
  );
}

const styles = StyleSheet.create({
  preview: { marginTop: 4 },
});
