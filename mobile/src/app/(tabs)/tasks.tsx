import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { TaskRow } from '@/components/TaskRow';
import { Chip, Empty, Fab, Input } from '@/components/ui';
import { useEntities, type Task } from '@/lib/db';
import { bySortKey, createTask, isOpen } from '@/lib/domain';
import { syncNow, useSyncState } from '@/lib/sync';
import { useTheme } from '@/lib/theme';

type Filter = 'active' | 'inbox' | 'next' | 'in_progress' | 'scheduled' | 'done';

const FILTERS: { key: Filter; label: string; match: (t: Task) => boolean }[] = [
  { key: 'active', label: 'Active', match: isOpen },
  { key: 'inbox', label: 'Inbox', match: (t) => t.status === 'inbox' },
  { key: 'next', label: 'Next', match: (t) => t.status === 'next' },
  { key: 'in_progress', label: 'In progress', match: (t) => t.status === 'in_progress' },
  { key: 'scheduled', label: 'Scheduled', match: (t) => isOpen(t) && !!t.dueAt },
  { key: 'done', label: 'Done', match: (t) => t.status === 'done' },
];

export default function Tasks() {
  const t = useTheme();
  const tasks = useEntities('tasks');
  const { status } = useSyncState();
  const [filter, setFilter] = useState<Filter>('active');
  const [query, setQuery] = useState('');

  const visible = useMemo(() => {
    const f = FILTERS.find((x) => x.key === filter)!;
    const q = query.trim().toLowerCase();
    const list = tasks.filter((task) => !task.parentTaskId && f.match(task) && (!q || task.title.toLowerCase().includes(q)));
    if (filter === 'scheduled') return list.sort((a, b) => (a.dueAt ?? '').localeCompare(b.dueAt ?? ''));
    if (filter === 'done') return list.sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''));
    return list.sort(bySortKey);
  }, [tasks, filter, query]);

  function quickAdd() {
    const title = query.trim();
    if (!title) return;
    createTask({ title, status: filter === 'inbox' ? 'inbox' : 'next' });
    setQuery('');
  }

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <View style={styles.top}>
        <Input
          placeholder="Search or add a task…"
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={quickAdd}
          returnKeyType="done"
          submitBehavior="submit"
        />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {FILTERS.map((f) => (
            <Chip key={f.key} label={f.label} active={filter === f.key} onPress={() => setFilter(f.key)} />
          ))}
        </ScrollView>
      </View>
      <FlatList
        data={visible}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <TaskRow task={item} />}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 }}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={status === 'syncing'} onRefresh={() => syncNow({ full: true })} tintColor={t.accent} />
        }
        ListEmptyComponent={
          <Empty
            icon="checkbox-outline"
            title={query ? 'No matches' : 'Nothing here'}
            hint={query ? 'Press enter to add it as a task.' : 'Tap + to add a task.'}
          />
        }
      />
      <Fab onPress={() => router.push({ pathname: '/task/[id]', params: { id: 'new' } })} />
    </View>
  );
}

const styles = StyleSheet.create({
  top: { paddingHorizontal: 16, paddingTop: 8, gap: 10 },
  chips: { gap: 8, paddingBottom: 6 },
});
