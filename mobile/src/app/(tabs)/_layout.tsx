import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';
import { View, type ColorValue } from 'react-native';
import { SyncBadge } from '@/components/SyncBadge';
import { IconButton } from '@/components/ui';
import { useTheme } from '@/lib/theme';

type IconName = keyof typeof Ionicons.glyphMap;

function icon(name: IconName, focusedName: IconName) {
  function TabIcon({ color, focused, size }: { color: ColorValue; focused: boolean; size: number }) {
    return <Ionicons name={focused ? focusedName : name} size={size} color={color} />;
  }
  return TabIcon;
}

export default function TabsLayout() {
  const t = useTheme();
  return (
    <Tabs
      screenOptions={{
        headerShadowVisible: false,
        headerStyle: { backgroundColor: t.bg },
        headerTitleStyle: { fontWeight: '700', fontSize: 20 },
        headerTintColor: t.text,
        headerRight: () => (
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingRight: 8 }}>
            <SyncBadge />
            <IconButton name="settings-outline" onPress={() => router.push('/settings')} />
          </View>
        ),
        tabBarActiveTintColor: t.accent,
        tabBarInactiveTintColor: t.textMuted,
        tabBarStyle: { backgroundColor: t.card, borderTopColor: t.border },
        sceneStyle: { backgroundColor: t.bg },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Today', tabBarIcon: icon('sunny-outline', 'sunny') }} />
      <Tabs.Screen name="tasks" options={{ title: 'Tasks', tabBarIcon: icon('checkbox-outline', 'checkbox') }} />
      <Tabs.Screen name="calendar" options={{ title: 'Calendar', tabBarIcon: icon('calendar-outline', 'calendar') }} />
      <Tabs.Screen name="habits" options={{ title: 'Habits', tabBarIcon: icon('flame-outline', 'flame') }} />
      <Tabs.Screen name="notes" options={{ title: 'Notes', tabBarIcon: icon('document-text-outline', 'document-text') }} />
    </Tabs>
  );
}
