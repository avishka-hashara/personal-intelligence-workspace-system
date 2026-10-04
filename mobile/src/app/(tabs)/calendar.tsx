import { addDays, addWeeks, differenceInMinutes, format, isSameDay, isToday, startOfWeek } from 'date-fns';
import { useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { BlockSheet } from '@/components/BlockSheet';
import { TaskRow } from '@/components/TaskRow';
import { Card, Empty, Fab, IconButton, SectionHeader, T, tap } from '@/components/ui';
import { useEntities, type TimeBlock } from '@/lib/db';
import { syncNow, useSyncState } from '@/lib/sync';
import { blockKindColors, useTheme } from '@/lib/theme';

export default function Calendar() {
  const t = useTheme();
  const blocks = useEntities('time_blocks');
  const tasks = useEntities('tasks');
  const { status } = useSyncState();
  const [selected, setSelected] = useState(() => new Date());
  const [weekOffset, setWeekOffset] = useState(0);
  const [sheet, setSheet] = useState<{ open: boolean; block: TimeBlock | null }>({ open: false, block: null });

  const weekStart = useMemo(() => addWeeks(startOfWeek(new Date(), { weekStartsOn: 1 }), weekOffset), [weekOffset]);
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);

  const dayBlocks = useMemo(
    () =>
      blocks.filter((b) => isSameDay(new Date(b.startAt), selected)).sort((a, b) => a.startAt.localeCompare(b.startAt)),
    [blocks, selected]
  );
  const dayTasks = useMemo(
    () => tasks.filter((x) => x.dueAt && isSameDay(new Date(x.dueAt), selected)),
    [tasks, selected]
  );

  const busyDays = useMemo(() => {
    const set = new Set<string>();
    blocks.forEach((b) => set.add(format(new Date(b.startAt), 'yyyy-MM-dd')));
    tasks.forEach((x) => x.dueAt && x.status !== 'done' && set.add(format(new Date(x.dueAt), 'yyyy-MM-dd')));
    return set;
  }, [blocks, tasks]);

  const plannedMinutes = dayBlocks.reduce(
    (sum, b) => sum + differenceInMinutes(new Date(b.endAt), new Date(b.startAt)),
    0
  );

  const defaultStart = useMemo(() => {
    const d = new Date(selected);
    const now = new Date();
    d.setHours(isToday(selected) ? now.getHours() + 1 : 9, 0, 0, 0);
    return d;
  }, [selected]);

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <View style={styles.weekHeader}>
        <IconButton name="chevron-back" onPress={() => setWeekOffset((w) => w - 1)} />
        <Pressable
          onPress={() => {
            setWeekOffset(0);
            setSelected(new Date());
          }}
        >
          <T variant="heading">{format(weekStart, 'MMMM yyyy')}</T>
        </Pressable>
        <IconButton name="chevron-forward" onPress={() => setWeekOffset((w) => w + 1)} />
      </View>

      <View style={styles.strip}>
        {days.map((d) => {
          const active = isSameDay(d, selected);
          const key = format(d, 'yyyy-MM-dd');
          return (
            <Pressable
              key={key}
              onPress={() => {
                tap();
                setSelected(d);
              }}
              style={[styles.day, { backgroundColor: active ? t.accent : 'transparent' }]}
            >
              <T variant="small" style={{ color: active ? t.onAccent : t.textMuted }}>
                {format(d, 'EEEEE')}
              </T>
              <T
                variant="heading"
                style={{ color: active ? t.onAccent : isToday(d) ? t.accent : t.text }}
              >
                {format(d, 'd')}
              </T>
              <View
                style={[
                  styles.dot,
                  { backgroundColor: busyDays.has(key) ? (active ? t.onAccent : t.accent) : 'transparent' },
                ]}
              />
            </Pressable>
          );
        })}
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
        refreshControl={
          <RefreshControl refreshing={status === 'syncing'} onRefresh={() => syncNow({ full: true })} tintColor={t.accent} />
        }
      >
        <T variant="title">{isToday(selected) ? 'Today' : format(selected, 'EEEE')}</T>
        <T muted>
          {format(selected, 'MMMM d')} · {Math.floor(plannedMinutes / 60)}h {plannedMinutes % 60}m planned
        </T>

        <SectionHeader title="Time blocks" />
        {dayBlocks.length === 0 ? (
          <Card>
            <Empty icon="time-outline" title="No blocks" hint="Tap + to plan focused time." />
          </Card>
        ) : (
          <View style={{ gap: 10 }}>
            {dayBlocks.map((b) => {
              const task = b.taskId ? tasks.find((x) => x.id === b.taskId) : undefined;
              const color = blockKindColors[b.kind] ?? t.accent;
              return (
                <Pressable key={b.id} onPress={() => setSheet({ open: true, block: b })}>
                  <Card style={[styles.block, { borderLeftColor: color }]}>
                    <View style={{ flex: 1 }}>
                      <T variant="heading" numberOfLines={1}>
                        {b.title || task?.title || b.kind}
                      </T>
                      <T variant="small" muted>
                        {format(new Date(b.startAt), 'HH:mm')} – {format(new Date(b.endAt), 'HH:mm')} · {b.kind}
                        {b.locked ? ' · locked' : ''}
                      </T>
                    </View>
                  </Card>
                </Pressable>
              );
            })}
          </View>
        )}

        <SectionHeader title="Due this day" />
        <Card style={{ paddingVertical: 2 }}>
          {dayTasks.length === 0 ? (
            <T muted style={{ paddingVertical: 12 }}>
              No tasks due.
            </T>
          ) : (
            dayTasks.map((task) => <TaskRow key={task.id} task={task} />)
          )}
        </Card>
      </ScrollView>

      <Fab onPress={() => setSheet({ open: true, block: null })} />
      <BlockSheet
        visible={sheet.open}
        block={sheet.block}
        defaultStart={defaultStart}
        onClose={() => setSheet({ open: false, block: null })}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  weekHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingTop: 4,
  },
  strip: { flexDirection: 'row', paddingHorizontal: 8, paddingVertical: 8 },
  day: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 14, marginHorizontal: 2, gap: 2 },
  dot: { width: 5, height: 5, borderRadius: 3 },
  block: { borderLeftWidth: 4, flexDirection: 'row', alignItems: 'center' },
});
