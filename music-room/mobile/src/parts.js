import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { api } from './api';
import { togglePreview, usePreviewId } from './player';
import { Btn, IconBtn, Input, Seg, Chip, Avatar, Cover, Equalizer, Grid, s, colors, guard, notify, Empty } from './ui';

export function TrackRow({ t, right, index, voted }) {
  const playing = usePreviewId();
  const id = t.track_id || t.id, on = playing === id;
  return (
    <View style={[s.card, s.row, { padding: 10, marginBottom: 8, borderColor: on ? colors.green : colors.border }]}>
      {index != null && <Text style={{ color: index < 3 ? colors.yellow : colors.dim, fontWeight: '900', width: 28, fontSize: 16 }}>{index + 1}</Text>}
      <Cover track={t} size={50} />
      <View style={{ flex: 1, marginLeft: 12 }}>
        <View style={s.row}>{on && <Equalizer />}<Text style={s.h3} numberOfLines={1}>{t.title}</Text></View>
        <Text style={s.dim} numberOfLines={1}>{t.artist}</Text>
      </View>
      {t.preview_url ? <IconBtn name={on ? 'stop' : 'play'} size={18} color={on ? colors.green : '#fff'} onPress={guard(() => togglePreview(t))} /> : null}
      <View style={{ width: 8 }} />{right}
    </View>);
}

const QUICK = ['Daft Punk', 'Queen', 'Adele', 'Stromae', 'Michael Jackson', 'Eminem'];
/** Catalog search (Deezer through the back-end). onPick(track) is called with the chosen result. */
export function TrackSearch({ onPick, icon = 'add', label }) {
  const [q, setQ] = useState(''), [res, setRes] = useState(null);
  const run = guard(async (text) => { const v = (text ?? q).trim(); if (!v) return setRes(null); setRes(await api('GET', `/tracks/search?q=${encodeURIComponent(v)}`)); });
  return (
    <View>
      <Input icon="search" placeholder="Search a title or an artist" value={q} onChangeText={setQ} onSubmitEditing={() => run()} returnKeyType="search" />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
        {QUICK.map((x) => <Chip key={x} label={x} icon="flame" onPress={() => { setQ(x); run(x); }} />)}
      </ScrollView>
      {res && (res.length === 0 ? <Empty icon="search" text="No result" /> :
        <View>{res.map((t) => <TrackRow key={t.id} t={t} right={onPick ? <Btn small title={label} icon={icon} onPress={() => onPick(t)} /> : null} />)}</View>)}
    </View>);
}

/** Owner tool: search any user (or pick a friend) to invite, and see/remove the invited ones. */
export function InvitePanel({ invited = [], onInvite, onRemove }) {
  const [q, setQ] = useState(''), [found, setFound] = useState([]), [friends, setFriends] = useState([]);
  useEffect(() => { api('GET', '/friends').then((r) => setFriends(r.friends)).catch(() => {}); }, []);
  const has = (id) => invited.some((x) => x.id === id);
  const search = guard(async () => setFound(q.trim().length >= 2 ? await api('GET', `/users?q=${encodeURIComponent(q.trim())}`) : []));
  const List = ({ rows }) => rows.map((u) => (
    <View key={u.id} style={[s.card, s.between, { padding: 10, marginBottom: 6 }]}>
      <View style={s.row}><Avatar name={u.display_name} size={32} /><Text style={[s.text, { marginLeft: 10 }]}>{u.display_name}</Text></View>
      {has(u.id) ? <Btn small alt icon="close" title="Remove" onPress={() => onRemove(u.id)} /> : <Btn small icon="person-add" title="Invite" onPress={() => onInvite(u.id)} />}
    </View>));
  return (
    <View>
      {invited.length > 0 && <><Text style={[s.dim, { marginBottom: 6 }]}>INVITED</Text><List rows={invited} /></>}
      {friends.filter((f) => !has(f.id)).length > 0 && <><Text style={[s.dim, { marginVertical: 6 }]}>YOUR FRIENDS</Text><List rows={friends.filter((f) => !has(f.id))} /></>}
      <Text style={[s.dim, { marginVertical: 6 }]}>ANYONE</Text>
      <Input icon="search" placeholder="Search people by name" value={q} onChangeText={setQ} onSubmitEditing={search} />
      <List rows={found.filter((u) => !has(u.id))} />
    </View>);
}

const pad = (n) => String(n).padStart(2, '0');
const hhmm = (ms) => { const d = new Date(ms); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const toMs = (txt, ref) => { const m = /^(\d{1,2}):(\d{2})$/.exec(txt.trim()); if (!m) return null; const d = new Date(ref); d.setHours(+m[1], +m[2], 0, 0); return d.getTime(); };

/** Create / edit an event: visibility + licence (everyone / invited / place & time with a time window and a radius). */
export function EventForm({ initial, onSubmit, submitLabel = 'Create event' }) {
  const t0 = Date.now();
  const [f, setF] = useState({ name: '', description: '', visibility: 'public', license: 'open', radius: 200, start: hhmm(t0), end: hhmm(t0 + 2 * 3600000), lat: null, lng: null, ...initial });
  const set = (k) => (v) => setF((x) => ({ ...x, [k]: v }));
  const locate = guard(async () => {
    const p = await Location.requestForegroundPermissionsAsync();
    if (p.status !== 'granted') throw new Error('Location permission refused');
    const l = await Location.getCurrentPositionAsync({}); setF((x) => ({ ...x, lat: l.coords.latitude, lng: l.coords.longitude }));
  });
  const submit = guard(async () => {
    const b = { name: f.name, description: f.description, visibility: f.visibility, license: f.license };
    if (f.license === 'geo_time') {
      const start = toMs(f.start, t0); let end = toMs(f.end, t0);
      if (start == null || end == null) throw new Error('Use the HH:MM format for the time window (e.g. 16:00 → 18:00)');
      if (end <= start) end += 86400000;
      if (f.lat == null) throw new Error('Tap "Use my position" to set the event location');
      Object.assign(b, { start_at: start, end_at: end, lat: f.lat, lng: f.lng, radius_m: f.radius });
    }
    await onSubmit(b);
  });
  return (
    <View style={s.card}>
      <Input icon="calendar" placeholder="Event name (party, birthday…)" value={f.name} onChangeText={set('name')} autoCapitalize="sentences" />
      <Input icon="document-text" placeholder="Description (optional)" value={f.description} onChangeText={set('description')} autoCapitalize="sentences" />
      <Text style={[s.dim, { marginBottom: 6 }]}>WHO CAN FIND IT</Text>
      <Seg value={f.visibility} onChange={set('visibility')} options={[['public', 'Public', 'earth'], ['private', 'Private', 'lock-closed']]} />
      <Text style={[s.dim, { marginBottom: 6 }]}>WHO CAN VOTE</Text>
      <Seg value={f.license} onChange={set('license')} options={[['open', 'Everyone', 'people'], ['invited', 'Invited', 'mail'], ['geo_time', 'Place & time', 'location']]} />
      {f.license === 'geo_time' && (
        <View style={{ backgroundColor: colors.surface2, borderRadius: 14, padding: 12, marginBottom: 10 }}>
          <View style={s.row}>
            <View style={{ flex: 1, marginRight: 8 }}><Text style={s.dim}>FROM (HH:MM)</Text><Input value={f.start} onChangeText={set('start')} placeholder="16:00" /></View>
            <View style={{ flex: 1 }}><Text style={s.dim}>TO (HH:MM)</Text><Input value={f.end} onChangeText={set('end')} placeholder="18:00" /></View>
          </View>
          <Text style={[s.dim, { marginBottom: 6 }]}>RADIUS</Text>
          <Seg value={f.radius} onChange={set('radius')} options={[[50, '50 m'], [100, '100 m'], [200, '200 m'], [500, '500 m'], [1000, '1 km']]} />
          <Btn alt icon="locate" title={f.lat != null ? `Position set (${f.lat.toFixed(4)}, ${f.lng.toFixed(4)})` : 'Use my position'} onPress={locate} />
        </View>)}
      <Btn title={submitLabel} icon="checkmark-circle" onPress={submit} disabled={!f.name.trim()} />
    </View>);
}
