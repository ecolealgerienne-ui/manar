import React from 'react';
import { Text } from 'react-native';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider, useAuth } from './src/auth';
import { colors, Loading } from './src/ui';
import AuthScreen from './src/screens/AuthScreen';
import { EventsList, EventDetail } from './src/screens/EventsScreen';
import { PlaylistsList, PlaylistDetail } from './src/screens/PlaylistsScreen';
import { DevicesList, Remote } from './src/screens/DevicesScreen';
import ProfileScreen from './src/screens/ProfileScreen';

const Stack = createNativeStackNavigator(), Tabs = createBottomTabNavigator();
const theme = { ...DarkTheme, colors: { ...DarkTheme.colors, background: colors.bg, card: colors.card, primary: colors.accent } };
const hdr = { headerStyle: { backgroundColor: colors.card }, headerTintColor: colors.text };
const Icon = (e) => ({ tabBarIcon: () => <Text>{e}</Text> });

function mk(List, Detail, listName, detailName, extra) {
  return function S() {
    return (<Stack.Navigator screenOptions={hdr}>
      <Stack.Screen name={listName} component={List} options={{ title: extra.title }} />
      <Stack.Screen name={detailName} component={Detail} options={{ title: extra.detail }} />
    </Stack.Navigator>);
  };
}
const EventsStack = mk(EventsList, EventDetail, 'Events', 'Event', { title: 'Events', detail: 'Event' });
const PlaylistsStack = mk(PlaylistsList, PlaylistDetail, 'Playlists', 'Playlist', { title: 'Playlists', detail: 'Playlist' });
const DevicesStack = mk(DevicesList, Remote, 'Devices', 'Remote', { title: 'Devices', detail: 'Remote control' });

function Root() {
  const { ready, user } = useAuth();
  if (!ready) return <Loading />;
  if (!user) return <AuthScreen />;
  return (
    <Tabs.Navigator screenOptions={{ headerShown: false, tabBarStyle: { backgroundColor: colors.card } }}>
      <Tabs.Screen name="EventsTab" component={EventsStack} options={{ title: 'Vote', ...Icon('🎉') }} />
      <Tabs.Screen name="PlaylistsTab" component={PlaylistsStack} options={{ title: 'Playlists', ...Icon('🎶') }} />
      <Tabs.Screen name="DevicesTab" component={DevicesStack} options={{ title: 'Devices', ...Icon('📱') }} />
      <Tabs.Screen name="ProfileTab" component={ProfileScreen} options={{ title: 'Profile', ...Icon('👤') }} />
    </Tabs.Navigator>
  );
}
export default function App() {
  return (<AuthProvider><NavigationContainer theme={theme}><StatusBar style="light" /><Root /></NavigationContainer></AuthProvider>);
}
