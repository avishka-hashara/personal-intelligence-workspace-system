import { addMinutes, differenceInMinutes, format } from 'date-fns';
import { useMemo, useState } from 'react';
import { Alert, KeyboardAvoidingView, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useEntities, type TimeBlock } from '@/lib/db';
import { isOpen } from '@/lib/domain';
import { pick } from '@/lib/pickers';
import { createEntity, deleteEntity, updateEntity } from '@/lib/sync';
import { blockKindColors, useTheme } from '@/lib/theme';
import { Button, Chip, Input, SectionHeader, T } from './ui';

const KINDS = ['work', 'study', 'rest', 'admin'];
const DURATIONS = [15, 30, 45, 60, 90, 120];

export function BlockSheet(props: {
  visible: boolean;
  onClose: () => void;
  block?: TimeBlock | null;
  defaultStart: Date;
}) {
  // Remount the form per open so its state initialises from the block being edited
  return (
    <Modal visible={props.visible} transparent animationType="slide" onRequestClose={props.onClose}>
      {props.visible && <BlockForm key={props.block?.id ?? 'new'} {...props} />}
    </Modal>
  );
}

function BlockForm({
  onClose,
  block,
  defaultStart,
}: {
  onClose: () => void;
  block?: TimeBlock | null;
  defaultStart: Date;
}) {
  const t = useTheme();
  const tasks = useEntities('tasks');
  const [title, setTitle] = useState(block?.title ?? '');
  const [kind, setKind] = useState(block?.kind ?? 'work');
  const [start, setStart] = useState(() => (block ? new Date(block.startAt) : defaultStart));
  const [duration, setDuration] = useState(
    block ? differenceInMinutes(new Date(block.endAt), new Date(block.startAt)) : 60
  );
  const [taskId, setTaskId] = useState<string | null>(block?.taskId ?? null);

  const openTasks = useMemo(() => tasks.filter(isOpen).slice(0, 30), [tasks]);

  function save() {
    const linked = taskId ? tasks.find((x) => x.id === taskId) : undefined;
    const fields = {
      title: title.trim() || linked?.title || null,
      kind,
      startAt: start.toISOString(),
      endAt: addMinutes(start, duration).toISOString(),
      taskId,
    };
    if (block) updateEntity('time_blocks', block.id, fields);
    else createEntity('time_blocks', { ...fields, locked: false });
    onClose();
  }

  function remove() {
    if (!block) return;
    Alert.alert('Delete block?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          deleteEntity('time_blocks', block.id);
          onClose();
        },
      },
    ]);
  }

  async function chooseTime() {
    const time = await pick('time', start);
    if (time) {
      const next = new Date(start);
      next.setHours(time.getHours(), time.getMinutes(), 0, 0);
      setStart(next);
    }
  }

  return (
    <>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <KeyboardAvoidingView behavior="padding">
        <View style={[styles.sheet, { backgroundColor: t.card, borderColor: t.border }]}>
          <View style={[styles.handle, { backgroundColor: t.border }]} />
          <ScrollView keyboardShouldPersistTaps="handled">
            <T variant="heading">{block ? 'Edit time block' : 'New time block'}</T>
            <T muted variant="small">
              {format(start, 'EEEE, MMM d')}
            </T>
            <Input placeholder="Title (optional)" value={title} onChangeText={setTitle} style={{ marginTop: 14 }} />

            <SectionHeader title="Kind" />
            <View style={styles.wrap}>
              {KINDS.map((k) => (
                <Chip key={k} label={k} active={kind === k} color={blockKindColors[k]} onPress={() => setKind(k)} />
              ))}
            </View>

            <SectionHeader title="Start" />
            <Pressable onPress={chooseTime} style={[styles.field, { backgroundColor: t.cardAlt, borderColor: t.border }]}>
              <T>
                {format(start, 'HH:mm')} → {format(addMinutes(start, duration), 'HH:mm')}
              </T>
            </Pressable>

            <SectionHeader title="Duration" />
            <View style={styles.wrap}>
              {DURATIONS.map((d) => (
                <Chip key={d} label={d < 60 ? `${d}m` : `${d / 60}h`} active={duration === d} onPress={() => setDuration(d)} />
              ))}
            </View>

            {openTasks.length > 0 && (
              <>
                <SectionHeader title="Link task" />
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                  <Chip label="None" active={!taskId} onPress={() => setTaskId(null)} />
                  {openTasks.map((task) => (
                    <Chip
                      key={task.id}
                      label={task.title.length > 24 ? task.title.slice(0, 24) + '…' : task.title}
                      active={taskId === task.id}
                      onPress={() => setTaskId(task.id)}
                    />
                  ))}
                </ScrollView>
              </>
            )}

            <Button title={block ? 'Save' : 'Add block'} onPress={save} style={{ marginTop: 22 }} />
            {block && <Button title="Delete" variant="danger" onPress={remove} style={{ marginTop: 10 }} />}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 20,
    paddingTop: 10,
    maxHeight: 640,
  },
  handle: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 14 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  field: { borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 14, paddingVertical: 12 },
});
