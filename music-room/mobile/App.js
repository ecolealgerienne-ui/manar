import React from 'react';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { AuthProvider, useAuth } from './src/auth';
import { View } from 'react-native';
import { Loading, colors, DialogHost } from './src/ui';
import AuthScreen from './src/screens/AuthScreen';
import HomeScreen from './src/screens/HomeScreen';
import { EventsList, EventDetail } from './src/screens/EventsScreen';
import { PlaylistsList, PlaylistDetail } from './src/screens/PlaylistsScreen';
import { DevicesList, Remote } from './src/screens/DevicesScreen';
import { ProfileScreen, Person } from './src/screens/ProfileScreen';

const Stack = createNativeStackNavigator(), Tabs = createBottomTabNavigator();
const theme = { ...DarkTheme, colors: { ...DarkTheme.colors, background: colors.bg, card: colors.surface, border: colors.border, primary: colors.accent, text: '#fff' } };
const hdr = { headerStyle: { backgroundColor: colors.surface }, headerTintColor: '#fff', headerTitleStyle: { fontWeight: '800' } };
const tab = (icon, focusedIcon) => ({ tabBarIcon: ({ focused, color, size }) => <Ionicons name={focused ? focusedIcon : icon} size={size} color={color} /> });

function Main() {
  return (
    <Tabs.Navigator screenOptions={{ headerStyle: hdr.headerStyle, headerTintColor: '#fff', headerTitleStyle: hdr.headerTitleStyle, tabBarActiveTintColor: colors.pink, tabBarInactiveTintColor: colors.dim,
      tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border, height: 62, paddingBottom: 8, paddingTop: 6 }, tabBarLabelStyle: { fontWeight: '700', fontSize: 11 } }}>
      <Tabs.Screen name="HomeTab" component={HomeScreen} options={{ title: 'Home', headerTitle: 'Music Room', ...tab('home-outline', 'home') }} />
      <Tabs.Screen name="EventsTab" component={EventsList} options={{ title: 'Live', headerTitle: 'Live events', ...tab('radio-outline', 'radio') }} />
      <Tabs.Screen name="PlaylistsTab" component={PlaylistsList} options={{ title: 'Playlists', ...tab('albums-outline', 'albums') }} />
      <Tabs.Screen name="DevicesTab" component={DevicesList} options={{ title: 'Devices', ...tab('phone-portrait-outline', 'phone-portrait') }} />
      <Tabs.Screen name="ProfileTab" component={ProfileScreen} options={{ title: 'Profile', ...tab('person-circle-outline', 'person-circle') }} />
    </Tabs.Navigator>);
}

function Root() {
  const { ready, user } = useAuth();
  if (!ready) return <Loading />;
  if (!user) return <AuthScreen />;
  return (
    <Stack.Navigator screenOptions={hdr}>
      <Stack.Screen name="Main" component={Main} options={{ headerShown: false }} />
      <Stack.Screen name="Event" component={EventDetail} options={{ title: 'Event' }} />
      <Stack.Screen name="Playlist" component={PlaylistDetail} options={{ title: 'Playlist' }} />
      <Stack.Screen name="Remote" component={Remote} options={{ title: 'Remote control' }} />
      <Stack.Screen name="Person" component={Person} options={{ title: 'Profile' }} />
    </Stack.Navigator>);
}
export default function App() {
  return (<AuthProvider><View style={{ flex: 1 }}><NavigationContainer theme={theme}><StatusBar style="light" /><Root /></NavigationContainer><DialogHost /></View></AuthProvider>);
}
