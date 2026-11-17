import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider, useAuth } from './src/auth';
import { Loading } from './src/ui';
import AuthScreen from './src/screens/AuthScreen';
import { EventsList, EventDetail } from './src/screens/EventsScreen';
import { PlaylistsList, PlaylistDetail } from './src/screens/PlaylistsScreen';
import { DevicesList, Remote } from './src/screens/DevicesScreen';
import ProfileScreen from './src/screens/ProfileScreen';

const Stack = createNativeStackNavigator(), Tabs = createBottomTabNavigator();
const stack = (List, Detail, l, d, tl, td) => function S() {
  return (<Stack.Navigator>
    <Stack.Screen name={l} component={List} options={{ title: tl }} />
    <Stack.Screen name={d} component={Detail} options={{ title: td }} />
  </Stack.Navigator>);
};
const EventsStack = stack(EventsList, EventDetail, 'Events', 'Event', 'Events', 'Event');
const PlaylistsStack = stack(PlaylistsList, PlaylistDetail, 'Playlists', 'Playlist', 'Playlists', 'Playlist');
const DevicesStack = stack(DevicesList, Remote, 'Devices', 'Remote', 'Devices', 'Remote control');

function Root() {
  const { ready, user } = useAuth();
  if (!ready) return <Loading />;
  if (!user) return <AuthScreen />;
  return (
    <Tabs.Navigator screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="EventsTab" component={EventsStack} options={{ title: 'Events' }} />
      <Tabs.Screen name="PlaylistsTab" component={PlaylistsStack} options={{ title: 'Playlists' }} />
      <Tabs.Screen name="DevicesTab" component={DevicesStack} options={{ title: 'Devices' }} />
      <Tabs.Screen name="ProfileTab" component={ProfileScreen} options={{ title: 'Profile' }} />
    </Tabs.Navigator>
  );
}
export default function App() {
  return (<AuthProvider><NavigationContainer><StatusBar style="dark" /><Root /></NavigationContainer></AuthProvider>);
}
