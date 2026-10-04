import Ionicons from '@expo/vector-icons/Ionicons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { format } from 'date-fns';
import { useMemo, useState } from 'react';
import { Alert, KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Button, Checkbox, Chip, Input, SectionHeader, T } from '@/components/ui';
import { useEntities, useEntity, type TaskStatus } from '@/lib/db';
import { bySortKey, createTask, deleteTask, describeRrule, RECURRENCE_PRESETS, toggleTask, updateTask } from '@/lib/domain';
import { pickDateTime } from '@/lib/pickers';
import { priorityColors, priorityLabels, useTheme } from '@/lib/theme';

const STATUSES: { key: TaskStatus; label: string }[] = [
  { key: 'inbox', label: 'Inbox' },
  { key: 'next', label: 'Next' },
  { key: 'in_progress', label: 'In progress' },
  { key: 'blocked', label: 'Blocked' },
  { key: 'done', label: 'Done' },
];

export default function TaskEditor() {
  const t = useTheme();
  const { id, parent } = useLocalSearchParams<{ id: string; parent?: string }>();
  const isNew = id === 'new';
  const existing = useEntity('tasks', isNew ? undefined : id);
  const allTasks = useEntities('tasks');

  const [title, setTitle] = useState(existing?.title ?? '');
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const [status, setStatus] = useState<TaskStatus>(existing?.status ?? 'next');
  const [priority, setPriority] = useState(existing?.priority ?? 0);
  const [dueAt, setDueAt] = useState<string | null>(existing?.dueAt ?? null);
  const [estimate, setEstimate] = useState(existing?.estimateMinutes ? String(existing.estimateMinutes) : '');
  const [rrule, setRrule] = useState<string | null>(existing?.rrule ?? null);
  const [subtaskTitle, setSubtaskTitle] = useState('');

  const subtasks = useMemo(
    () => (isNew ? [] : allTasks.filter((x) => x.parentTaskId === id).sort(bySortKey)),
    [allTasks, id, isNew]
  );

  if (!isNew && !existing) {
    return (
      <View style={[styles.container, { backgroundColor: t.bg }]}>
        <T muted>This task no longer exists.</T>
      </View>
    );
  }

  function save() {
    if (!title.trim()) {
      Alert.alert('Title required');
      return;
    }
    const estimateMinutes = estimate ? parseInt(estimate, 10) || null : null;
    const fields = { title: title.trim(), notes: notes || null, status, priority, dueAt, estimateMinutes, rrule };
    if (isNew) {
      createTask({ ...fields, parentTaskId: parent ?? null });
    } else {
      updateTask(id, fields);
    }
    router.back();
  }

  function remove() {
    Alert.alert('Delete task?', 'This also deletes its subtasks.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          deleteTask(id);
          router.back();
        },
      },
    ]);
  }

  async function chooseDue() {
    const base = dueAt ? new Date(dueAt) : new Date(new Date().setHours(17, 0, 0, 0));
    const picked = await pickDateTime(base);
    if (picked) setDueAt(picked.toISOString());
  }

  function addSubtask() {
    if (!subtaskTitle.trim()) return;
    createTask({ title: subtaskTitle, parentTaskId: id, status: 'next' });
    setSubtaskTitle('');
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: t.bg }} behavior="padding">
      <Stack.Screen
        options={{
          title: isNew ? 'New task' : 'Edit task',
          headerRight: () => (
            <Pressable onPress={save} hitSlop={10}>
              <T variant="heading" style={{ color: t.accent }}>
                Save
              </T>
            </Pressable>
          ),
        }}
      />
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Input
          placeholder="What needs doing?"
          value={title}
          onChangeText={setTitle}
          autoFocus={isNew}
          style={{ fontSize: 18, fontWeight: '600' }}
        />
        <Input
          placeholder="Notes"
          value={notes}
          onChangeText={setNotes}
          multiline
          style={{ minHeight: 90, textAlignVertical: 'top', marginTop: 10 }}
        />

        <SectionHeader title="Status" />
        <View style={styles.wrap}>
          {STATUSES.map((s) => (
            <Chip key={s.key} label={s.label} active={status === s.key} onPress={() => setStatus(s.key)} />
          ))}
        </View>

        <SectionHeader title="Priority" />
        <View style={styles.wrap}>
          {priorityLabels.map((label, i) => (
            <Chip
              key={label}
              label={label}
              icon="flag"
              active={priority === i}
              color={i > 0 ? priorityColors[i] : undefined}
              onPress={() => setPriority(i)}
            />
          ))}
        </View>

        <SectionHeader title="Due" />
        <View style={styles.rowBetween}>
          <Pressable onPress={chooseDue} style={[styles.field, { backgroundColor: t.cardAlt, borderColor: t.border }]}>
            <Ionicons name="calendar-outline" size={18} color={t.textMuted} />
            <T>{dueAt ? format(new Date(dueAt), 'EEE, MMM d · HH:mm') : 'No due date'}</T>
          </Pressable>
          {dueAt && <Button title="Clear" variant="ghost" onPress={() => setDueAt(null)} />}
        </View>

        <SectionHeader title="Estimate (minutes)" />
        <Input placeholder="e.g. 30" keyboardType="number-pad" value={estimate} onChangeText={setEstimate} />

        <SectionHeader title={`Repeat${rrule ? ` · ${describeRrule(rrule)}` : ''}`} />
        <View style={styles.wrap}>
          {RECURRENCE_PRESETS.map((p) => (
            <Chip key={p.label} label={p.label} active={rrule === p.rrule} onPress={() => setRrule(p.rrule)} />
          ))}
        </View>

        {!isNew && !existing?.parentTaskId && (
          <>
            <SectionHeader title={`Subtasks (${subtasks.filter((s) => s.status === 'done').length}/${subtasks.length})`} />
            {subtasks.map((s) => (
              <View key={s.id} style={styles.subtask}>
                <Checkbox checked={s.status === 'done'} onPress={() => toggleTask(s)} />
                <T
                  style={[{ flex: 1 }, s.status === 'done' && { textDecorationLine: 'line-through', color: t.textFaint }]}
                >
                  {s.title}
                </T>
                <Pressable onPress={() => deleteTask(s.id)} hitSlop={8}>
                  <Ionicons name="close" size={18} color={t.textFaint} />
                </Pressable>
              </View>
            ))}
            <Input
              placeholder="Add subtask…"
              value={subtaskTitle}
              onChangeText={setSubtaskTitle}
              onSubmitEditing={addSubtask}
              submitBehavior="submit"
              returnKeyType="done"
              style={{ marginTop: 6 }}
            />
          </>
        )}

        <Button title={isNew ? 'Create task' : 'Save changes'} onPress={save} style={{ marginTop: 28 }} />
        {!isNew && <Button title="Delete task" variant="danger" icon="trash-outline" onPress={remove} style={{ marginTop: 10 }} />}
        {existing?.createdAt && (
          <T variant="small" muted style={{ textAlign: 'center', marginTop: 16 }}>
            Created {format(new Date(existing.createdAt), 'MMM d, yyyy')}
          </T>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 48 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  field: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  subtask: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
});
