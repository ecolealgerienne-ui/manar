import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import * as Device from 'expo-device';
import { api, subscribe, logAction } from '../api';
import { Btn, Input, s, guard, Loading, notify, colors } from '../ui';

export function DevicesList({ navigation }) {
  const [d, setD] = useState(null), [friends, setFriends] = useState([]), [name, setName] = useState(Device.deviceName || '');
  const load = guard(async () => { setD(await api('GET', '/devices')); setFriends((await api('GET', '/friends')).friends); });
  useFocusEffect(useCallback(() => { logAction('screen:Devices'); load(); }, []));  // eslint-disable-line react-hooks/exhaustive-deps
  const add = guard(async () => { await api('POST', '/devices', { name }); setName(''); load(); });
  const del = guard(async (id) => { await api('DELETE', `/devices/${id}`); load(); });
  const toggle = guard(async (dev, f, on) => { await api(on ? 'PUT' : 'DELETE', `/devices/${dev.id}/delegates/${f.id}`); load(); });
  if (!d) return <Loading />;
  return (
    <ScrollView style={s.screen} keyboardShouldPersistTaps="handled">
      <Text style={s.h1}>My devices</Text>
      <View style={s.card}><Input placeholder="Device name (Phone, Car, Speaker…)" value={name} onChangeText={setName} autoCapitalize="sentences" /><Btn title="Register this device" onPress={add} disabled={!name.trim()} /></View>
      {d.mine.map((dev) => (
        <View key={dev.id} style={s.card}>
          <View style={s.row}><View><Text style={s.text}>{dev.name}</Text><Text style={s.dim}>{dev.platform} · {dev.model}</Text></View>
            <View style={s.row}><Btn small title="Control" onPress={() => navigation.navigate('Remote', { id: dev.id, name: dev.name })} /><View style={{ width: 6 }} /><Btn small alt title="🗑" onPress={() => del(dev.id)} /></View></View>
          <Text style={s.h2}>Who can control it?</Text>
          {friends.length === 0 && <Text style={s.dim}>Add friends (Profile tab) to delegate control.</Text>}
          {friends.map((f) => { const on = dev.delegates.some((x) => x.id === f.id); return (
            <View key={f.id} style={[s.row, { marginBottom: 6 }]}><Text style={s.text}>{f.display_name}</Text><Btn small alt={!on} title={on ? 'Allowed ✓' : 'Allow'} onPress={() => toggle(dev, f, !on)} /></View>); })}
        </View>))}
      <Text style={s.h1}>Delegated to me</Text>
      {d.delegated_to_me.length === 0 && <Text style={s.dim}>No friend gave you control yet.</Text>}
      {d.delegated_to_me.map((dev) => (
        <View key={dev.id} style={[s.card, s.row]}><View><Text style={s.text}>{dev.name}</Text><Text style={s.dim}>owner: {dev.owner_name}</Text></View>
          <Btn small title="Control" onPress={() => navigation.navigate('Remote', { id: dev.id, name: dev.name })} /></View>))}
    </ScrollView>
  );
}

export function Remote({ route }) {
  const { id } = route.params;
  const [st, setSt] = useState(null), [pls, setPls] = useState([]);
  useEffect(() => { logAction(`screen:Remote:${id}`); api('GET', `/devices/${id}/state`).then(setSt).catch((e) => notify('Error', e.message)); api('GET', '/playlists').then(setPls).catch(() => {}); return subscribe(`device:${id}`, setSt); }, [id]);
  const cmd = guard(async (command, extra = {}) => setSt(await api('POST', `/devices/${id}/commands`, { command, ...extra })));
  if (!st) return <Loading />;
  const cur = st.queue?.[st.index];
  return (
    <ScrollView style={s.screen}>
      <Text style={s.h1}>{st.name}</Text>
      <View style={s.card}><Text style={s.text}>{cur ? `${cur.title} — ${cur.artist}` : 'No track loaded'}</Text><Text style={s.dim}>{st.playing ? 'Playing' : 'Paused'} · volume {st.volume ?? 50}</Text></View>
      <View style={s.row}><Btn small title="⏮" onPress={() => cmd('previous')} /><Btn small title={st.playing ? '⏸' : '▶'} onPress={() => cmd(st.playing ? 'pause' : 'play')} /><Btn small title="⏭" onPress={() => cmd('next')} /></View>
      <Text style={s.h2}>Volume</Text>
      <View style={s.row}>{[0, 25, 50, 75, 100].map((v) => <Btn key={v} small alt={st.volume !== v} title={String(v)} onPress={() => cmd('volume', { value: v })} />)}</View>
      <Text style={s.h2}>Load a playlist</Text>
      {pls.map((p) => <View key={p.id} style={[s.card, s.row]}><Text style={s.text}>{p.name}</Text><Btn small title="Load" onPress={() => cmd('load', { playlistId: p.id })} /></View>)}
      <Text style={s.h2}>Queue</Text>
      {(st.queue || []).map((t, i) => <Text key={t.id + i} style={[s.text, i === st.index && { color: colors.accent, fontWeight: '800' }]}>{i + 1}. {t.title}</Text>)}
    </ScrollView>
  );
}
