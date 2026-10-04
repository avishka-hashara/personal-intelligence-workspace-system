import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { type ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type PressableProps,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { useTheme } from '@/lib/theme';

export type IconName = keyof typeof Ionicons.glyphMap;

export function tap() {
  Haptics.selectionAsync().catch(() => {});
}

export function T({
  children,
  variant = 'body',
  muted,
  style,
  numberOfLines,
}: {
  children: ReactNode;
  variant?: 'title' | 'heading' | 'body' | 'small' | 'label';
  muted?: boolean;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
}) {
  const t = useTheme();
  return (
    <Text
      numberOfLines={numberOfLines}
      style={[styles[variant], { color: muted ? t.textMuted : t.text }, style]}
    >
      {children}
    </Text>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const t = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: t.card, borderColor: t.border }, style]}>{children}</View>
  );
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  icon,
  loading,
  disabled,
  style,
}: {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  icon?: IconName;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const t = useTheme();
  const bg = { primary: t.accent, secondary: t.cardAlt, danger: t.dangerSoft, ghost: 'transparent' }[variant];
  const fg = { primary: t.onAccent, secondary: t.text, danger: t.danger, ghost: t.accent }[variant];
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      android_ripple={{ color: t.border }}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: bg, opacity: disabled ? 0.5 : pressed ? 0.85 : 1 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <>
          {icon && <Ionicons name={icon} size={18} color={fg} />}
          <Text style={[styles.buttonText, { color: fg }]}>{title}</Text>
        </>
      )}
    </Pressable>
  );
}

export function IconButton({
  name,
  onPress,
  color,
  size = 22,
  ...rest
}: { name: IconName; onPress: () => void; color?: string; size?: number } & Omit<PressableProps, 'onPress'>) {
  const t = useTheme();
  return (
    <Pressable onPress={onPress} hitSlop={10} style={styles.iconButton} {...rest}>
      <Ionicons name={name} size={size} color={color ?? t.text} />
    </Pressable>
  );
}

export function Input(props: TextInputProps) {
  const t = useTheme();
  return (
    <TextInput
      placeholderTextColor={t.textFaint}
      {...props}
      style={[
        styles.input,
        { backgroundColor: t.cardAlt, color: t.text, borderColor: t.border },
        props.style,
      ]}
    />
  );
}

export function Checkbox({ checked, onPress, color }: { checked: boolean; onPress: () => void; color?: string }) {
  const t = useTheme();
  const c = color ?? t.accent;
  return (
    <Pressable
      onPress={() => {
        tap();
        onPress();
      }}
      hitSlop={12}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      style={[styles.checkbox, { borderColor: checked ? c : t.textFaint, backgroundColor: checked ? c : 'transparent' }]}
    >
      {checked && <Ionicons name="checkmark" size={15} color={t.bg} />}
    </Pressable>
  );
}

export function Chip({
  label,
  active,
  onPress,
  color,
  icon,
}: {
  label: string;
  active?: boolean;
  onPress?: () => void;
  color?: string;
  icon?: IconName;
}) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.chip,
        {
          backgroundColor: active ? (color ?? t.accent) : t.cardAlt,
          borderColor: active ? (color ?? t.accent) : t.border,
        },
      ]}
    >
      {icon && <Ionicons name={icon} size={13} color={active ? t.onAccent : t.textMuted} />}
      <Text style={[styles.chipText, { color: active ? t.onAccent : t.textMuted }]}>{label}</Text>
    </Pressable>
  );
}

export function Empty({ icon, title, hint }: { icon: IconName; title: string; hint?: string }) {
  const t = useTheme();
  return (
    <View style={styles.empty}>
      <Ionicons name={icon} size={40} color={t.textFaint} />
      <T variant="heading" style={{ marginTop: 12 }}>
        {title}
      </T>
      {hint && (
        <T muted style={{ textAlign: 'center', marginTop: 4 }}>
          {hint}
        </T>
      )}
    </View>
  );
}

export function SectionHeader({ title, right }: { title: string; right?: ReactNode }) {
  return (
    <View style={styles.sectionHeader}>
      <T variant="label" muted>
        {title}
      </T>
      {right}
    </View>
  );
}

export function Fab({ onPress, icon = 'add' }: { onPress: () => void; icon?: IconName }) {
  const t = useTheme();
  return (
    <Pressable
      onPress={() => {
        tap();
        onPress();
      }}
      accessibilityLabel="Add"
      style={({ pressed }) => [styles.fab, { backgroundColor: t.accent, opacity: pressed ? 0.85 : 1 }]}
    >
      <Ionicons name={icon} size={28} color={t.onAccent} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 28, fontWeight: '700', letterSpacing: -0.5 },
  heading: { fontSize: 17, fontWeight: '600' },
  body: { fontSize: 15, lineHeight: 21 },
  small: { fontSize: 13 },
  label: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8 },
  card: { borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, padding: 14 },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 12,
    paddingVertical: 13,
    paddingHorizontal: 18,
    overflow: 'hidden',
  },
  buttonText: { fontSize: 15, fontWeight: '600' },
  iconButton: { padding: 6 },
  input: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 7,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipText: { fontSize: 13, fontWeight: '500' },
  empty: { alignItems: 'center', paddingVertical: 48, paddingHorizontal: 32 },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 8,
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    width: 58,
    height: 58,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
  },
});
