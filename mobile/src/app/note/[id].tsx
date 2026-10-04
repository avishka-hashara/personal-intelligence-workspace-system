import { router, Stack, useLocalSearchParams } from 'expo-router';
import { format } from 'date-fns';
import { useEffect, useRef, useState } from 'react';
import { Alert, KeyboardAvoidingView, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { IconButton, T } from '@/components/ui';
import { getOne, useEntity } from '@/lib/db';
import { deleteEntity, updateEntity } from '@/lib/sync';
import { useTheme } from '@/lib/theme';

const SAVE_DELAY_MS = 800;

export default function NoteEditor() {
  const t = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const note = useEntity('notes', id);
  const [title, setTitle] = useState(note?.title === 'Untitled Note' ? '' : (note?.title ?? ''));
  const [content, setContent] = useState(note?.content ?? '');
  const [saved, setSaved] = useState(true);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Mirrors the inputs so flush() (also run on unmount) sees the latest text
  const latest = useRef({ title, content });

  function flush() {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const current = getOne('notes', id);
    if (!current) return;
    const nextTitle = latest.current.title.trim() || 'Untitled Note';
    if (current.title !== nextTitle || (current.content ?? '') !== latest.current.content) {
      updateEntity('notes', id, { title: nextTitle, content: latest.current.content });
    }
    setSaved(true);
  }

  function schedule() {
    setSaved(false);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(flush, SAVE_DELAY_MS);
  }

  // Save pending edits on leave; discard notes that were never written in
  useEffect(
    () => () => {
      flush();
      const current = getOne('notes', id);
      if (current && current.title === 'Untitled Note' && !current.content?.trim()) {
        deleteEntity('notes', id);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [id]
  );

  function remove() {
    Alert.alert('Delete note?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          if (timer.current) clearTimeout(timer.current);
          deleteEntity('notes', id);
          router.back();
        },
      },
    ]);
  }

  if (!note) {
    return (
      <View style={{ flex: 1, backgroundColor: t.bg, padding: 16 }}>
        <T muted>This note no longer exists.</T>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: t.bg }} behavior="padding">
      <Stack.Screen
        options={{
          headerRight: () => (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <T variant="small" muted>
                {saved ? 'Saved' : 'Saving…'}
              </T>
              <IconButton name="trash-outline" onPress={remove} color={t.danger} />
            </View>
          ),
        }}
      />
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <TextInput
          value={title}
          onChangeText={(v) => {
            setTitle(v);
            latest.current.title = v;
            schedule();
          }}
          placeholder="Untitled Note"
          placeholderTextColor={t.textFaint}
          style={[styles.title, { color: t.text }]}
          multiline
        />
        {note.updatedAt && (
          <T variant="small" muted style={{ marginBottom: 12 }}>
            Edited {format(new Date(note.updatedAt), 'MMM d, yyyy · HH:mm')} · Markdown
          </T>
        )}
        <TextInput
          value={content}
          onChangeText={(v) => {
            setContent(v);
            latest.current.content = v;
            schedule();
          }}
          placeholder="Start writing…"
          placeholderTextColor={t.textFaint}
          style={[styles.body, { color: t.text }]}
          multiline
          autoFocus={!note.content}
          textAlignVertical="top"
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 80, flexGrow: 1 },
  title: { fontSize: 26, fontWeight: '700', paddingVertical: 4 },
  body: { fontSize: 16, lineHeight: 24, minHeight: 400 },
});
