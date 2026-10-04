import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { format, isPast, isSameDay, isToday } from 'date-fns';
import { useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { TaskRow } from '@/components/TaskRow';
import { Card, Checkbox, Empty, Input, SectionHeader, T } from '@/components/ui';
import { useEntities } from '@/lib/db';
import { calculateStreak, calculateTaskScore, createTask, dayKey, isOpen, toggleHabitCheckIn } from '@/lib/domain';
import { syncNow, useSyncState } from '@/lib/sync';
import { blockKindColors, useTheme } from '@/lib/theme';

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

export default function Today() {
  const t = useTheme();
  const tasks = useEntities('tasks');
  const habits = useEntities('habits');
  const logs = useEntities('habit_logs');
  const pauses = useEntities('habit_pauses');
  const blocks = useEntities('time_blocks');
  const { status } = useSyncState();
  const [title, setTitle] = useState('');
  const today = dayKey();

  // Same idea as the web Today view: due/overdue/in-progress first, ranked by score
  const focus = useMemo(() => {
    const open = tasks.filter(isOpen);
    const urgent = open.filter(
      (task) =>
        task.status === 'in_progress' || (task.dueAt && (isToday(new Date(task.dueAt)) || isPast(new Date(task.dueAt))))
    );
    const pool = urgent.length > 0 ? urgent : open;
    return [...pool].sort((a, b) => calculateTaskScore(b) - calculateTaskScore(a)).slice(0, 7);
  }, [tasks]);

  const doneToday = useMemo(
    () => tasks.filter((x) => x.status === 'done' && x.updatedAt && isToday(new Date(x.updatedAt))).length,
    [tasks]
  );

  const todayBlocks = useMemo(
    () =>
      blocks
        .filter((b) => isSameDay(new Date(b.startAt), new Date()))
        .sort((a, b) => a.startAt.localeCompare(b.startAt)),
    [blocks]
  );

  const activeHabits = habits.filter((h) => h.active);
  const checked = new Set(logs.filter((l) => l.loggedOn === today).map((l) => l.habitId));

  function add() {
    if (!title.trim()) return;
    createTask({ title, dueAt: new Date(new Date().setHours(23, 59, 0, 0)).toISOString() });
    setTitle('');
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
      <T muted>{format(new Date(), 'EEEE, MMMM d')}</T>
      <T variant="title" style={{ marginBottom: 16 }}>
        {greeting()}
      </T>

      <View style={styles.stats}>
        <Stat label="Focus" value={focus.length} icon="flash" color={t.accent} />
        <Stat label="Done today" value={doneToday} icon="checkmark-done" color={t.success} />
        <Stat label="Habits" value={`${checked.size}/${activeHabits.length}`} icon="flame" color={t.warning} />
      </View>

      <Input
        placeholder="Add a task for today…"
        value={title}
        onChangeText={setTitle}
        onSubmitEditing={add}
        returnKeyType="done"
        submitBehavior="submit"
        style={{ marginTop: 16 }}
      />

      <SectionHeader title="Focus" />
      <Card style={{ paddingVertical: 2 }}>
        {focus.length === 0 ? (
          <Empty icon="sparkles-outline" title="All clear" hint="Nothing due. Add a task or enjoy the space." />
        ) : (
          focus.map((task) => <TaskRow key={task.id} task={task} />)
        )}
      </Card>

      {todayBlocks.length > 0 && (
        <>
          <SectionHeader
            title="Schedule"
            right={
              <Pressable onPress={() => router.navigate('/calendar')}>
                <T variant="small" style={{ color: t.accent }}>
                  Open calendar
                </T>
              </Pressable>
            }
          />
          <Card style={{ gap: 10 }}>
            {todayBlocks.map((b) => {
              const task = b.taskId ? tasks.find((x) => x.id === b.taskId) : undefined;
              return (
                <View key={b.id} style={styles.block}>
                  <View style={[styles.blockBar, { backgroundColor: blockKindColors[b.kind] ?? t.accent }]} />
                  <T variant="small" muted style={{ width: 92 }}>
                    {format(new Date(b.startAt), 'HH:mm')}–{format(new Date(b.endAt), 'HH:mm')}
                  </T>
                  <T numberOfLines={1} style={{ flex: 1 }}>
                    {b.title || task?.title || b.kind}
                  </T>
                </View>
              );
            })}
          </Card>
        </>
      )}

      {activeHabits.length > 0 && (
        <>
          <SectionHeader title="Habits" />
          <Card style={{ gap: 12 }}>
            {activeHabits.map((h) => {
              const streak = calculateStreak(h.id, logs, pauses);
              return (
                <View key={h.id} style={styles.habit}>
                  <Checkbox
                    checked={checked.has(h.id)}
                    onPress={() => toggleHabitCheckIn(h.id, today)}
                    color={h.colour || t.success}
                  />
                  <T style={{ flex: 1 }}>{h.title}</T>
                  {streak.currentStreak > 0 && (
                    <View style={styles.streak}>
                      <Ionicons name="flame" size={14} color={t.warning} />
                      <T variant="small" style={{ color: t.warning }}>
                        {streak.currentStreak}
                      </T>
                    </View>
                  )}
                </View>
              );
            })}
          </Card>
        </>
      )}
    </ScrollView>
  );
}

function Stat({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: number | string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
}) {
  return (
    <Card style={{ flex: 1, gap: 4, padding: 12 }}>
      <Ionicons name={icon} size={18} color={color} />
      <T variant="heading">{value}</T>
      <T variant="small" muted>
        {label}
      </T>
    </Card>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 40 },
  stats: { flexDirection: 'row', gap: 10 },
  block: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  blockBar: { width: 4, height: 22, borderRadius: 2 },
  habit: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  streak: { flexDirection: 'row', alignItems: 'center', gap: 2 },
});
