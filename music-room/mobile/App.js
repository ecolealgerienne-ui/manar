import React, { useEffect, useState } from 'react';
import { Text } from 'react-native';
import { NavigationContainer, DarkTheme, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider, useAuth } from './src/auth';
import { colors, Loading, loadTheme } from './src/ui';
import AuthScreen from './src/screens/AuthScreen';
import { EventsList, EventDetail } from './src/screens/EventsScreen';
import { PlaylistsList, PlaylistDetail } from './src/screens/PlaylistsScreen';
import { DevicesList, Remote } from './src/screens/DevicesScreen';
import ProfileScreen from './src/screens/ProfileScreen';

const Stack = createNativeStackNavigator(), Tabs = createBottomTabNavigator();
const navTheme = () => { const b = colors.dark ? DarkTheme : DefaultTheme; return { ...b, colors: { ...b.colors, background: colors.bg, card: colors.card, text: colors.text, border: colors.cardBorder, primary: colors.accent } }; };
const hdr = () => ({ headerStyle: { backgroundColor: colors.card }, headerTintColor: colors.text, headerTitleStyle: { fontWeight: '900', textTransform: colors.upper ? 'uppercase' : 'none', letterSpacing: colors.upper ? 2 : 0 } });
const Icon = (e) => ({ tabBarIcon: () => <Text style={{ fontSize: 18 }}>{e}</Text> });

function mk(List, Detail, listName, detailName, extra) {
  return function S() {
    return (<Stack.Navigator screenOptions={hdr()}>
      <Stack.Screen name={listName} component={List} options={{ title: extra.title }} />
      <Stack.Screen name={detailName} component={Detail} options={{ title: extra.detail }} />
    </Stack.Navigator>);
  };
}
const EventsStack = mk(EventsList, EventDetail, 'Events', 'Event', { title: 'Live', detail: 'Event' });
const PlaylistsStack = mk(PlaylistsList, PlaylistDetail, 'Playlists', 'Playlist', { title: 'Playlists', detail: 'Playlist' });
const DevicesStack = mk(DevicesList, Remote, 'Devices', 'Remote', { title: 'Devices', detail: 'Remote control' });

function Root({ onTheme }) {
  const { ready, user } = useAuth();
  if (!ready) return <Loading />;
  if (!user) return <AuthScreen onTheme={onTheme} />;
  const Profile = () => <ProfileScreen onTheme={onTheme} />;
  return (
    <Tabs.Navigator screenOptions={{ headerShown: false, tabBarActiveTintColor: colors.accent, tabBarInactiveTintColor: colors.dim,
      tabBarStyle: { backgroundColor: colors.card, borderTopColor: colors.accent, borderTopWidth: 2 }, tabBarLabelStyle: { fontWeight: '800', textTransform: colors.upper ? 'uppercase' : 'none', fontSize: 10 } }}>
      <Tabs.Screen name="EventsTab" component={EventsStack} options={{ title: 'Vote', ...Icon(colors.upper ? '🎸' : '🎀') }} />
      <Tabs.Screen name="PlaylistsTab" component={PlaylistsStack} options={{ title: 'Playlists', ...Icon('🎶') }} />
      <Tabs.Screen name="DevicesTab" component={DevicesStack} options={{ title: 'Devices', ...Icon('📱') }} />
      <Tabs.Screen name="ProfileTab" component={Profile} options={{ title: 'Profile', ...Icon(colors.upper ? '🖤' : '💗') }} />
    </Tabs.Navigator>
  );
}

export default function App() {
  const [theme, setTheme] = useState(null);
  useEffect(() => { loadTheme().then(setTheme); }, []);
  if (!theme) return <Loading />;
  // The key re-mounts the tree so every screen re-reads the mutated style objects.
  return (<AuthProvider key={theme}><NavigationContainer theme={navTheme()}><StatusBar style={colors.dark ? 'light' : 'dark'} /><Root onTheme={setTheme} /></NavigationContainer></AuthProvider>);
}
