import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { format, isPast, isToday, isTomorrow } from 'date-fns';
import { Pressable, StyleSheet, View } from 'react-native';
import { type Task } from '@/lib/db';
import { toggleTask } from '@/lib/domain';
import { priorityColors, useTheme } from '@/lib/theme';
import { Checkbox, T } from './ui';

export function formatDue(dueAt: string): string {
  const d = new Date(dueAt);
  if (isToday(d)) return 'Today';
  if (isTomorrow(d)) return 'Tomorrow';
  return format(d, 'EEE, MMM d');
}

export function TaskRow({ task }: { task: Task }) {
  const t = useTheme();
  const done = task.status === 'done';
  const overdue = !!task.dueAt && !done && isPast(new Date(task.dueAt)) && !isToday(new Date(task.dueAt));
  const priority = task.priority ?? 0;

  return (
    <Pressable
      onPress={() => router.push({ pathname: '/task/[id]', params: { id: task.id } })}
      android_ripple={{ color: t.border }}
      style={[styles.row, { borderBottomColor: t.border }]}
    >
      <Checkbox checked={done} onPress={() => toggleTask(task)} color={priority > 0 ? priorityColors[priority] : undefined} />
      <View style={styles.body}>
        <T
          numberOfLines={2}
          style={done ? { textDecorationLine: 'line-through', color: t.textFaint } : undefined}
        >
          {task.title}
        </T>
        {(task.dueAt || task.rrule || task.estimateMinutes || task.status === 'in_progress') && (
          <View style={styles.meta}>
            {task.status === 'in_progress' && <Meta icon="play-circle" label="In progress" color={t.accent} />}
            {task.dueAt && (
              <Meta icon="calendar-outline" label={formatDue(task.dueAt)} color={overdue ? t.danger : t.textMuted} />
            )}
            {task.rrule && <Meta icon="repeat" label="" color={t.textMuted} />}
            {!!task.estimateMinutes && <Meta icon="time-outline" label={`${task.estimateMinutes}m`} color={t.textMuted} />}
          </View>
        )}
      </View>
      {priority > 0 && <Ionicons name="flag" size={14} color={priorityColors[priority]} />}
    </Pressable>
  );
}

function Meta({ icon, label, color }: { icon: keyof typeof Ionicons.glyphMap; label: string; color: string }) {
  return (
    <View style={styles.metaItem}>
      <Ionicons name={icon} size={12} color={color} />
      {!!label && <T variant="small" style={{ color }}>{label}</T>}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  body: { flex: 1, gap: 3 },
  meta: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 3 },
});
