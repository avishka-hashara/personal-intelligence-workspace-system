import Ionicons from '@expo/vector-icons/Ionicons';
import { format, subDays } from 'date-fns';
import { useMemo, useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { Card, Chip, Empty, Input, T, tap } from '@/components/ui';
import { useEntities, type Habit } from '@/lib/db';
import { calculateStreak, createHabit, dayKey, pauseHabit, resumeHabit, toggleHabitCheckIn } from '@/lib/domain';
import { deleteEntity, syncNow, updateEntity, useSyncState } from '@/lib/sync';
import { useTheme } from '@/lib/theme';

const COLOURS = ['#10b981', '#6366f1', '#f59e0b', '#ec4899', '#0ea5e9', '#ef4444'];

export default function Habits() {
  const t = useTheme();
  const habits = useEntities('habits');
  const logs = useEntities('habit_logs');
  const pauses = useEntities('habit_pauses');
  const { status } = useSyncState();
  const [title, setTitle] = useState('');
  const [colour, setColour] = useState(COLOURS[0]);
  const [showArchived, setShowArchived] = useState(false);

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => subDays(new Date(), 6 - i)), []);
  const logSet = useMemo(() => new Set(logs.map((l) => `${l.habitId}|${l.loggedOn}`)), [logs]);
  const visible = habits
    .filter((h) => h.active !== showArchived)
    .sort((a, b) => (a.createdAt ?? '').localeCompare(b.createdAt ?? ''));

  function add() {
    if (!title.trim()) return;
    createHabit({ title, colour });
    setTitle('');
  }

  function options(h: Habit, paused: boolean) {
    Alert.alert(h.title, undefined, [
      paused
        ? { text: 'Resume', onPress: () => resumeHabit(h.id) }
        : { text: 'Pause from today', onPress: () => pauseHabit(h.id) },
      { text: h.active ? 'Archive' : 'Restore', onPress: () => updateEntity('habits', h.id, { active: !h.active }) },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () =>
          Alert.alert('Delete habit?', 'Its history will be removed.', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Delete', style: 'destructive', onPress: () => deleteEntity('habits', h.id) },
          ]),
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  return (
    <ScrollView
      style={{ backgroundColor: t.bg }}
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        <RefreshControl refreshing={status === 'syncing'} onRefresh={() => syncNow({ full: true })} tintColor={t.accent} />
      }
    >
      <Input
        placeholder="New habit, e.g. Read 20 pages"
        value={title}
        onChangeText={setTitle}
        onSubmitEditing={add}
        submitBehavior="submit"
        returnKeyType="done"
      />
      <View style={styles.colours}>
        {COLOURS.map((c) => (
          <Pressable
            key={c}
            onPress={() => setColour(c)}
            style={[styles.swatch, { backgroundColor: c, borderColor: colour === c ? t.text : 'transparent' }]}
          />
        ))}
        <View style={{ flex: 1 }} />
        <Chip label={showArchived ? 'Archived' : 'Active'} icon="archive-outline" active={showArchived} onPress={() => setShowArchived((s) => !s)} />
      </View>

      {visible.length === 0 ? (
        <Empty
          icon="flame-outline"
          title={showArchived ? 'No archived habits' : 'No habits yet'}
          hint={showArchived ? undefined : 'Small daily actions compound. Add your first above.'}
        />
      ) : (
        <View style={{ gap: 12, marginTop: 8 }}>
          {visible.map((h) => {
            const streak = calculateStreak(h.id, logs, pauses);
            const color = h.colour || t.success;
            return (
              <Card key={h.id}>
                <Pressable onLongPress={() => options(h, streak.isPaused)} style={styles.habitHeader}>
                  <View style={[styles.colourDot, { backgroundColor: color }]} />
                  <T variant="heading" style={{ flex: 1 }} numberOfLines={1}>
                    {h.title}
                  </T>
                  {streak.isPaused && (
                    <T variant="small" style={{ color: t.warning }}>
                      Paused
                    </T>
                  )}
                  <Pressable onPress={() => options(h, streak.isPaused)} hitSlop={10}>
                    <Ionicons name="ellipsis-horizontal" size={18} color={t.textMuted} />
                  </Pressable>
                </Pressable>

                <View style={styles.grid}>
                  {days.map((d) => {
                    const key = dayKey(d);
                    const done = logSet.has(`${h.id}|${key}`);
                    return (
                      <Pressable
                        key={key}
                        onPress={() => {
                          tap();
                          toggleHabitCheckIn(h.id, key);
                        }}
                        style={styles.cell}
                      >
                        <T variant="small" muted>
                          {format(d, 'EEEEE')}
                        </T>
                        <View
                          style={[
                            styles.box,
                            {
                              backgroundColor: done ? color : t.cardAlt,
                              borderColor: key === dayKey() ? color : t.border,
                            },
                          ]}
                        >
                          {done && <Ionicons name="checkmark" size={16} color="#fff" />}
                        </View>
                      </Pressable>
                    );
                  })}
                </View>

                <View style={styles.streaks}>
                  <Ionicons name="flame" size={14} color={t.warning} />
                  <T variant="small" muted>
                    {streak.currentStreak} day streak · best {streak.bestStreak}
                  </T>
                </View>
              </Card>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 40 },
  colours: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 12 },
  swatch: { width: 26, height: 26, borderRadius: 13, borderWidth: 2 },
  habitHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  colourDot: { width: 10, height: 10, borderRadius: 5 },
  grid: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 14 },
  cell: { alignItems: 'center', gap: 4 },
  box: { width: 36, height: 36, borderRadius: 10, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  streaks: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 12 },
});
