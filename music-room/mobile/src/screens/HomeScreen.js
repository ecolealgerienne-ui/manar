import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { api, logAction } from '../api';
import { useAuth } from '../auth';
import { Page, Section, Grid, Stat, EventCard, PlaylistCard, Avatar, Btn, IconBtn, Cover, Equalizer, Live, Empty, s, colors, guard } from '../ui';
import { TrackSearch } from '../parts';

export default function HomeScreen({ navigation }) {
  const { user } = useAuth();
  const [d, setD] = useState({ events: [], playlists: [], devices: { mine: [], delegated_to_me: [] }, friends: { friends: [], incoming: [] } });
  const [busy, setBusy] = useState(false);
  const load = guard(async () => {
    setBusy(true);
    const [events, playlists, devices, friends] = await Promise.all([api('GET', '/events'), api('GET', '/playlists'), api('GET', '/devices'), api('GET', '/friends')]);
    setD({ events, playlists, devices, friends }); setBusy(false);
  });
  useFocusEffect(useCallback(() => { logAction('screen:Home'); load(); }, []));  // eslint-disable-line react-hooks/exhaustive-deps
  const go = (tab) => () => navigation.navigate(tab);
  const live = d.events.filter((e) => e.now_playing);
  const players = [...d.devices.mine, ...d.devices.delegated_to_me].filter((x) => x.player?.track);
  const hour = new Date().getHours();
  return (
    <Page onRefresh={load} refreshing={busy}>
      <LinearGradient colors={['#4c1d95', '#be185d', '#ea580c']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: 24, padding: 20 }}>
        <View style={[s.row, { flexWrap: 'wrap' }]}>
          <Avatar name={user.display_name} size={64} />
          <View style={{ marginLeft: 14, flex: 1, minWidth: 200 }}>
            <Text style={{ color: 'rgba(255,255,255,0.85)', fontWeight: '700' }}>{hour < 12 ? 'Good morning' : hour < 19 ? 'Good afternoon' : 'Good evening'} 👋</Text>
            <Text style={{ color: '#fff', fontSize: 30, fontWeight: '900' }}>{user.display_name}</Text>
            <Text style={{ color: 'rgba(255,255,255,0.85)' }}>{live.length ? `${live.length} live event${live.length > 1 ? 's' : ''} right now` : 'Start a party, vote for the next track'}</Text>
          </View>
          <View style={{ minWidth: 180, marginTop: 10 }}><Btn color="#111827" icon="add-circle" title="New live event" onPress={go('EventsTab')} /></View>
        </View>
      </LinearGradient>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 14 }}>
        <Stat icon="radio" value={d.events.length} label="Live events" colors={['#7c3aed', '#ec4899']} onPress={go('EventsTab')} />
        <Stat icon="list" value={d.playlists.length} label="Playlists" colors={['#2563eb', '#22d3ee']} onPress={go('PlaylistsTab')} />
        <Stat icon="phone-portrait" value={d.devices.mine.length + d.devices.delegated_to_me.length} label="Devices" colors={['#f97316', '#ef4444']} onPress={go('DevicesTab')} />
        <Stat icon="people" value={d.friends.friends.length} label={d.friends.incoming.length ? `Friends (+${d.friends.incoming.length} request)` : 'Friends'} colors={['#059669', '#3b82f6']} onPress={go('ProfileTab')} />
      </View>

      {players.length > 0 && (
        <Section title="Now playing on your devices" icon="musical-notes">
          <Grid>{players.map((x) => (
            <TouchableOpacity key={x.id} activeOpacity={0.88} onPress={() => navigation.navigate('Remote', { id: x.id, name: x.name })} style={[s.card, s.row, { marginBottom: 0 }]}>
              <Cover title={x.player.track.title} size={56} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <View style={s.row}><Equalizer playing={x.player.playing} /><Text style={s.h3} numberOfLines={1}>{x.player.track.title}</Text></View>
                <Text style={s.dim}>{x.player.track.artist} · {x.name}</Text>
              </View>
              <Ionicons name={x.player.playing ? 'pause-circle' : 'play-circle'} size={34} color={colors.green} />
            </TouchableOpacity>))}</Grid>
        </Section>)}

      <Section title="Live events" icon="radio" action="See all" onAction={go('EventsTab')}>
        {d.events.length === 0 ? <Empty text="No event yet. Create the first one!" /> : <Grid>{d.events.slice(0, 6).map((e) => <EventCard key={e.id} e={e} onPress={() => navigation.navigate('Event', { id: e.id })} />)}</Grid>}
      </Section>
      <Section title="Playlists" icon="albums" action="See all" onAction={go('PlaylistsTab')}>
        {d.playlists.length === 0 ? <Empty text="No playlist yet." /> : <Grid>{d.playlists.slice(0, 6).map((p) => <PlaylistCard key={p.id} p={p} onPress={() => navigation.navigate('Playlist', { id: p.id })} />)}</Grid>}
      </Section>
      <Section title="Discover music" icon="compass"><View style={s.card}><TrackSearch /></View></Section>
      {d.friends.friends.length > 0 && (
        <Section title="Friends" icon="people" action="Manage" onAction={go('ProfileTab')}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>{d.friends.friends.map((f) => (
            <TouchableOpacity key={f.id} onPress={() => navigation.navigate('Person', { id: f.id })} style={{ alignItems: 'center', marginRight: 16 }}>
              <Avatar name={f.display_name} size={58} /><Text style={[s.dim, { marginTop: 4 }]}>{f.display_name}</Text></TouchableOpacity>))}</ScrollView>
        </Section>)}
    </Page>);
}
