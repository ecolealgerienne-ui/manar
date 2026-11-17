import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, ScrollView, Text, View, Switch } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import * as Location from 'expo-location';
import { api, subscribe, logAction } from '../api';
import { useAuth } from '../auth';
import { Btn, Input, s, guard, Loading, colors, notify } from '../ui';
import TrackPicker from './TrackPicker';

export function EventsList({ navigation }) {
  const [events, setEvents] = useState(null);
  const [f, setF] = useState({ name: '', priv: false, license: 'open' });
  const load = guard(async () => setEvents(await api('GET', '/events')));
  useFocusEffect(useCallback(() => { logAction('screen:Events'); load(); }, []));  // eslint-disable-line react-hooks/exhaustive-deps
  const create = guard(async () => {
    const b = { name: f.name, visibility: f.priv ? 'private' : 'public', license: f.license };
    if (f.license === 'geo_time') {
      const p = await Location.requestForegroundPermissionsAsync();
      if (p.status !== 'granted') throw new Error('Location permission is required for a place/time licence');
      const l = await Location.getCurrentPositionAsync({});
      Object.assign(b, { lat: l.coords.latitude, lng: l.coords.longitude, radius_m: 200, start_at: Date.now(), end_at: Date.now() + 2 * 3600000 });
    }
    const e = await api('POST', '/events', b); setF({ ...f, name: '' }); navigation.navigate('Event', { id: e.id });
  });
  const licences = [['open', 'Everyone votes'], ['invited', 'Invited only'], ['geo_time', 'Here, next 2h']];
  return (
    <FlatList style={s.screen} data={events} keyExtractor={(e) => String(e.id)} ListEmptyComponent={events ? <Text style={s.dim}>No event yet</Text> : <Loading />}
      ListHeaderComponent={<View>
        <Text style={s.h1}>Live events</Text>
        <View style={s.card}>
          <Input placeholder="New event name" value={f.name} onChangeText={(name) => setF({ ...f, name })} autoCapitalize="sentences" />
          <View style={[s.row, { marginBottom: 8 }]}><Text style={s.text}>Private (invited only can see it)</Text><Switch value={f.priv} onValueChange={(priv) => setF({ ...f, priv })} /></View>
          <View style={[s.row, { marginBottom: 8, flexWrap: 'wrap' }]}>{licences.map(([k, l]) => <Btn key={k} small alt={f.license !== k} title={l} onPress={() => setF({ ...f, license: k })} />)}</View>
          <Btn title="Create event" onPress={create} disabled={!f.name.trim()} />
        </View>
        <Btn alt small title="Refresh" onPress={load} />
      </View>}
      renderItem={({ item }) => (
        <View style={[s.card, s.row]}>
          <View style={{ flex: 1 }}><Text style={s.text}>{item.name}</Text><Text style={s.dim}>{item.visibility} · votes: {item.license}</Text></View>
          <Btn small title="Open" onPress={() => navigation.navigate('Event', { id: item.id })} />
        </View>)} />
  );
}

export function EventDetail({ route }) {
  const { id } = route.params; const { user } = useAuth();
  const [ev, setEv] = useState(null), [friends, setFriends] = useState([]);
  const [pos, setPos] = useState(null);
  const load = guard(async () => {
    let q = '';
    if (pos) q = `?lat=${pos.lat}&lng=${pos.lng}`;
    setEv(await api('GET', `/events/${id}${q}`));
  });
  useEffect(() => { logAction(`screen:Event:${id}`); load(); const un = subscribe(`event:${id}`, (d) => setEv((o) => ({ ...(o || {}), ...d, can_vote: o?.can_vote }))); return un; }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { api('GET', '/friends').then((r) => setFriends(r.friends)).catch(() => {}); }, []);
  const withPos = async () => {
    if (ev?.license !== 'geo_time') return undefined;
    const p = await Location.requestForegroundPermissionsAsync();
    if (p.status !== 'granted') throw new Error('Location permission required to vote here');
    const l = await Location.getCurrentPositionAsync({});
    const v = { lat: l.coords.latitude, lng: l.coords.longitude }; setPos(v); return v;
  };
  const refresh = (d) => setEv((o) => ({ ...o, ...d }));
  const vote = guard(async (t) => refresh(await api(t.voted ? 'DELETE' : 'PUT', `/events/${id}/tracks/${t.id}/vote`, { position: await withPos() })));
  const suggest = guard(async (t) => { refresh(await api('POST', `/events/${id}/tracks`, { trackId: t.id, position: await withPos() })); notify('Added', `${t.title} is in the queue`); });
  const next = guard(async () => refresh(await api('POST', `/events/${id}/next`)));
  const invite = guard(async (uid) => { await api('PUT', `/events/${id}/invites/${uid}`); notify('Invited'); });
  if (!ev) return <Loading />;
  const owner = ev.owner_id === user.id;
  return (
    <ScrollView style={s.screen} keyboardShouldPersistTaps="handled">
      <Text style={s.h1}>{ev.name}</Text>
      <Text style={s.dim}>{ev.visibility} · licence: {ev.license}{ev.can_vote && !ev.can_vote.ok ? ` · you cannot vote: ${ev.can_vote.reason}` : ''}</Text>
      <Text style={s.h2}>Now playing</Text>
      <View style={s.card}>{ev.nowPlaying ? <Text style={s.text}>▶ {ev.nowPlaying.title} — {ev.nowPlaying.artist}</Text> : <Text style={s.dim}>Nothing playing</Text>}</View>
      {owner && <Btn title="Play next track (best voted)" onPress={next} />}
      <Text style={s.h2}>Queue (most votes first)</Text>
      {ev.queue.map((t, i) => (
        <View key={t.id} style={[s.card, s.row]}>
          <View style={{ flex: 1 }}><Text style={s.text}>{i + 1}. {t.title}</Text><Text style={s.dim}>{t.artist}</Text></View>
          <Btn small alt={!t.voted} title={`${t.voted ? '♥' : '♡'} ${t.votes}`} onPress={() => vote(t)} />
        </View>))}
      <Text style={s.h2}>Suggest a track</Text>
      <TrackPicker label="Suggest" onPick={suggest} />
      {owner && <><Text style={s.h2}>Invite friends</Text>{friends.map((f) => <View key={f.id} style={[s.card, s.row]}><Text style={s.text}>{f.display_name}</Text><Btn small title="Invite" onPress={() => invite(f.id)} /></View>)}</>}
    </ScrollView>
  );
}
