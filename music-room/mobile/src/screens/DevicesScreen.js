import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Device from 'expo-device';
import { api, subscribe, logAction } from '../api';
import { confirmAction, Page, Grid, Section, Btn, IconBtn, Input, Chip, Badge, Avatar, Cover, Equalizer, Empty, Loading, s, colors, guard, notify, grad } from '../ui';
import { applyDeviceState, stopDevice } from '../player';

const ICON = { ios: 'phone-portrait', android: 'phone-portrait', web: 'laptop' };

export function DevicesList({ navigation }) {
  const [d, setD] = useState(null), [friends, setFriends] = useState([]), [name, setName] = useState(Device.deviceName || '');
  const load = guard(async () => { setD(await api('GET', '/devices')); setFriends((await api('GET', '/friends')).friends); });
  useFocusEffect(useCallback(() => { logAction('screen:Devices'); load(); }, []));  // eslint-disable-line react-hooks/exhaustive-deps
  const add = guard(async () => { await api('POST', '/devices', { name }); setName(''); load(); });
  const del = guard(async (x) => { if (!(await confirmAction('Remove this device?', `“${x.name}” will be removed and every friend loses control of it.`, { confirmText: 'Remove device' }))) return; await api('DELETE', `/devices/${x.id}`); load(); });
  const toggle = guard(async (dev, f, on) => { await api(on ? 'PUT' : 'DELETE', `/devices/${dev.id}/delegates/${f.id}`); load(); });
  if (!d) return <Loading />;
  const open = (x) => navigation.navigate('Remote', { id: x.id, name: x.name });
  const Now = ({ x }) => (<View style={[s.row, { marginTop: 8 }]}>{x.player.track ? (<><Equalizer playing={x.player.playing} /><Text style={[s.text, { flex: 1 }]} numberOfLines={1}>{x.player.track.title} · {x.player.track.artist}</Text></>) : <Text style={s.dim}>No track loaded</Text>}</View>);
  return (
    <Page onRefresh={load}>
      <Text style={s.h1}>Devices</Text><Text style={[s.dim, { marginBottom: 12 }]}>Control any speaker, delegate it to your friends</Text>
      <View style={s.card}>
        <Text style={[s.h3, { marginBottom: 8 }]}>Add this device</Text>
        <View style={s.row}><View style={{ flex: 1, marginRight: 8 }}><Input icon="phone-portrait" placeholder="Name (Phone, Car, Speaker…)" value={name} onChangeText={setName} autoCapitalize="sentences" /></View><View style={{ marginTop: -10 }}><Btn icon="add" title="Register" onPress={add} disabled={!name.trim()} /></View></View>
      </View>
      <Section title="My devices" icon="hardware-chip">
        {d.mine.length === 0 ? <Empty icon="phone-portrait" text="No device yet. Register this one above." /> : (
          <Grid>{d.mine.map((x) => (
            <View key={x.id} style={[s.card, { padding: 0, overflow: 'hidden', marginBottom: 0 }]}>
              <LinearGradient colors={grad(`d${x.id}${x.name}`)} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ padding: 14 }}>
                <View style={s.between}><View style={s.row}><Ionicons name={ICON[x.platform] || 'musical-notes'} size={26} color="#fff" /><View style={{ marginLeft: 10 }}><Text style={{ color: '#fff', fontSize: 20, fontWeight: '900' }}>{x.name}</Text><Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 11 }}>{[x.platform, x.model].filter(Boolean).join(' · ') || 'device'}</Text></View></View>
                  <IconBtn name="trash" size={16} color={colors.red} onPress={() => del(x)} /></View>
                <Now x={x} />
              </LinearGradient>
              <View style={{ padding: 14 }}>
                <Btn icon="game-controller" title="Open remote control" onPress={() => open(x)} />
                <Text style={[s.dim, { marginBottom: 8 }]}>WHO CAN CONTROL IT</Text>
                {friends.length === 0 ? <Text style={s.dim}>Add friends (Profile tab) to delegate this device.</Text> : friends.map((f) => { const on = x.delegates.some((z) => z.id === f.id); return (
                  <View key={f.id} style={[s.between, { marginBottom: 6 }]}><View style={s.row}><Avatar name={f.display_name} size={30} /><Text style={[s.text, { marginLeft: 8 }]}>{f.display_name}</Text></View>
                    <Btn small alt={!on} icon={on ? 'checkmark-circle' : 'add'} title={on ? 'Allowed' : 'Allow'} onPress={() => toggle(x, f, !on)} /></View>); })}
              </View>
            </View>))}</Grid>)}
      </Section>
      <Section title="Delegated to me" icon="key">
        {d.delegated_to_me.length === 0 ? <Empty icon="key" text="No friend gave you control of a device yet." /> : (
          <Grid>{d.delegated_to_me.map((x) => (
            <View key={x.id} style={s.card}>
              <View style={s.between}><View style={s.row}><Avatar name={x.owner_name} size={40} /><View style={{ marginLeft: 10 }}><Text style={s.h3}>{x.name}</Text><Text style={s.dim}>owned by {x.owner_name}</Text></View></View><Badge icon="key" text="Delegated" color={colors.green} /></View>
              <Now x={x} /><View style={{ height: 8 }} /><Btn icon="game-controller" title="Control" onPress={() => open(x)} />
            </View>))}</Grid>)}
      </Section>
    </Page>);
}

export function Remote({ route }) {
  const { id } = route.params;
  const [st, setSt] = useState(null), [pls, setPls] = useState([]), [speaker, setSpeaker] = useState(false);
  const speakerRef = useRef(false);
  const cmd = guard(async (command, extra = {}) => setSt(await api('POST', `/devices/${id}/commands`, { command, ...extra })));
  const cmdRef = useRef(cmd); cmdRef.current = cmd;
  useEffect(() => {
    logAction(`screen:Remote:${id}`);
    api('GET', `/devices/${id}/state`).then(setSt).catch((e) => notify('Error', e.message));
    api('GET', '/playlists').then(setPls).catch(() => {});
    const un = subscribe(`device:${id}`, (d) => { setSt(d); if (speakerRef.current) applyDeviceState(d, () => cmdRef.current('next')).catch(() => {}); });
    return () => { un(); stopDevice(); };
  }, [id]);
  const toggleSpeaker = () => { const v = !speaker; setSpeaker(v); speakerRef.current = v; if (v && st) applyDeviceState(st, () => cmdRef.current('next')).catch((e) => notify('Audio', e.message)); else stopDevice(); };
  if (!st) return <Loading />;
  const cur = st.queue?.[st.index ?? 0], vol = st.volume ?? 50;
  return (
    <Page>
      <LinearGradient colors={grad(`d${id}${st.name}`)} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: 28, padding: 22, alignItems: 'center' }}>
        <Text style={{ color: 'rgba(255,255,255,0.85)', fontWeight: '700', marginBottom: 12 }}>REMOTE · {st.name}</Text>
        <Cover title={cur?.title || st.name} size={180} radius={24} />
        <Text style={{ color: '#fff', fontSize: 24, fontWeight: '900', marginTop: 16, textAlign: 'center' }} numberOfLines={2}>{cur ? cur.title : 'No track loaded'}</Text>
        <Text style={{ color: 'rgba(255,255,255,0.85)', marginBottom: 14 }}>{cur ? cur.artist : 'Load a playlist below'}</Text>
        <View style={[s.row, { gap: 16 }]}>
          <IconBtn name="play-skip-back" onPress={() => cmd('previous')} bg="rgba(0,0,0,0.35)" />
          <IconBtn name={st.playing ? 'pause' : 'play'} big onPress={() => cmd(st.playing ? 'pause' : 'play')} bg="#fff" color="#111" />
          <IconBtn name="play-skip-forward" onPress={() => cmd('next')} bg="rgba(0,0,0,0.35)" />
        </View>
        <View style={[s.row, { marginTop: 18 }]}>
          <IconBtn name="volume-low" size={18} bg="rgba(0,0,0,0.35)" onPress={() => cmd('volume', { value: Math.max(0, vol - 10) })} />
          <View style={{ width: 150, height: 8, borderRadius: 4, backgroundColor: 'rgba(0,0,0,0.35)', marginHorizontal: 10 }}><View style={{ width: `${vol}%`, height: 8, borderRadius: 4, backgroundColor: '#fff' }} /></View>
          <IconBtn name="volume-high" size={18} bg="rgba(0,0,0,0.35)" onPress={() => cmd('volume', { value: Math.min(100, vol + 10) })} />
          <Text style={{ color: '#fff', marginLeft: 10, fontWeight: '800' }}>{vol}</Text>
        </View>
      </LinearGradient>
      <View style={{ marginTop: 12 }}><Btn alt={!speaker} icon={speaker ? 'volume-high' : 'headset'} title={speaker ? 'This screen is playing the sound (tap to stop)' : 'Play the sound on THIS device'} onPress={toggleSpeaker} /></View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -6 }}>
        <View style={{ flex: 1, minWidth: 300, padding: 6 }}>
          <Section title="Load a playlist" icon="albums">
            {pls.length === 0 ? <Empty text="No playlist available." /> : pls.map((p) => (
              <View key={p.id} style={[s.card, s.between, { padding: 10, marginBottom: 8 }]}><View style={s.row}><Cover title={p.name} size={44} uri={p.covers?.[0]?.cover} /><View style={{ marginLeft: 10 }}><Text style={s.h3}>{p.name}</Text><Text style={s.dim}>{p.track_count} tracks</Text></View></View>
                <Btn small icon="download" title="Load" onPress={() => cmd('load', { playlistId: p.id })} /></View>))}
          </Section>
        </View>
        <View style={{ flex: 1, minWidth: 300, padding: 6 }}>
          <Section title="Queue" icon="list">
            {(st.queue || []).length === 0 ? <Empty text="Queue is empty." /> : st.queue.map((t, i) => (
              <View key={t.id + i} style={[s.card, s.row, { padding: 10, marginBottom: 6, borderColor: i === st.index ? colors.green : colors.border }]}>
                <Text style={{ color: colors.dim, width: 24, fontWeight: '800' }}>{i + 1}</Text>{i === st.index && <Equalizer playing={st.playing} />}<Text style={[s.text, { flex: 1 }]} numberOfLines={1}>{t.title}</Text><Text style={s.dim}>{t.artist}</Text></View>))}
          </Section>
        </View>
      </View>
    </Page>);
}
