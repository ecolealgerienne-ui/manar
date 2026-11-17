import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, ScrollView, Text, View, Switch } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { api, subscribe, logAction } from '../api';
import { useAuth } from '../auth';
import { Btn, Input, s, guard, Loading, notify } from '../ui';
import TrackPicker from './TrackPicker';

export function PlaylistsList({ navigation }) {
  const [list, setList] = useState(null);
  const [f, setF] = useState({ name: '', priv: false, invitedOnly: false });
  const load = guard(async () => setList(await api('GET', '/playlists')));
  useFocusEffect(useCallback(() => { logAction('screen:Playlists'); load(); }, []));  // eslint-disable-line react-hooks/exhaustive-deps
  const create = guard(async () => {
    const p = await api('POST', '/playlists', { name: f.name, visibility: f.priv ? 'private' : 'public', edit_license: f.invitedOnly ? 'invited' : 'open' });
    setF({ ...f, name: '' }); navigation.navigate('Playlist', { id: p.id });
  });
  return (
    <FlatList style={s.screen} data={list} keyExtractor={(p) => String(p.id)} ListEmptyComponent={list ? <Text style={s.dim}>No playlist yet</Text> : <Loading />}
      ListHeaderComponent={<View>
        <Text style={s.h1}>Playlists</Text>
        <View style={s.card}>
          <Input placeholder="New playlist name" value={f.name} onChangeText={(name) => setF({ ...f, name })} autoCapitalize="sentences" />
          <View style={[s.row, { marginBottom: 8 }]}><Text style={s.text}>Private</Text><Switch value={f.priv} onValueChange={(priv) => setF({ ...f, priv })} /></View>
          <View style={[s.row, { marginBottom: 8 }]}><Text style={s.text}>Only invited users can edit</Text><Switch value={f.invitedOnly} onValueChange={(invitedOnly) => setF({ ...f, invitedOnly })} /></View>
          <Btn title="Create playlist" onPress={create} disabled={!f.name.trim()} />
        </View>
      </View>}
      renderItem={({ item }) => (
        <View style={[s.card, s.row]}>
          <View style={{ flex: 1 }}><Text style={s.text}>{item.name}</Text><Text style={s.dim}>{item.visibility} · editing: {item.edit_license}</Text></View>
          <Btn small title="Open" onPress={() => navigation.navigate('Playlist', { id: item.id })} />
        </View>)} />
  );
}

export function PlaylistDetail({ route }) {
  const { id } = route.params; const { user } = useAuth();
  const [pl, setPl] = useState(null), [friends, setFriends] = useState([]);
  const load = guard(async () => setPl(await api('GET', `/playlists/${id}`)));
  useEffect(() => { logAction(`screen:Playlist:${id}`); load(); const un = subscribe(`playlist:${id}`, (d) => setPl((o) => ({ ...(o || {}), ...d }))); return un; }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { api('GET', '/friends').then((r) => setFriends(r.friends)).catch(() => {}); }, []);
  const apply = (p) => setPl((o) => ({ ...o, ...p }));
  // Concurrency: we send the entry id + target index, the server applies it on its current state; the WebSocket then refreshes everyone.
  const move = guard(async (t, to) => apply(await api('POST', `/playlists/${id}/tracks/${t.id}/move`, { toIndex: to })));
  const remove = guard(async (t) => apply(await api('DELETE', `/playlists/${id}/tracks/${t.id}`)));
  const add = guard(async (t) => apply(await api('POST', `/playlists/${id}/tracks`, { trackId: t.id })));
  const invite = guard(async (uid) => { await api('PUT', `/playlists/${id}/invites/${uid}`); notify('Invited'); });
  const toggle = guard(async (k, v) => apply(await api('PATCH', `/playlists/${id}`, { [k]: v })));
  if (!pl) return <Loading />;
  const owner = pl.owner_id === user.id, canEdit = pl.can_edit !== false;
  return (
    <ScrollView style={s.screen} keyboardShouldPersistTaps="handled">
      <Text style={s.h1}>{pl.name}</Text>
      <Text style={s.dim}>{pl.visibility} · editing: {pl.edit_license} · v{pl.version}{canEdit ? '' : ' · read only'}</Text>
      {pl.tracks.map((t, i) => (
        <View key={t.id} style={[s.card, s.row]}>
          <View style={{ flex: 1 }}><Text style={s.text}>{i + 1}. {t.title}</Text><Text style={s.dim}>{t.artist}</Text></View>
          {canEdit && <View style={s.row}>
            <Btn small alt title="↑" disabled={i === 0} onPress={() => move(t, i - 1)} />
            <View style={{ width: 4 }} /><Btn small alt title="↓" disabled={i === pl.tracks.length - 1} onPress={() => move(t, i + 1)} />
            <View style={{ width: 4 }} /><Btn small alt title="✕" onPress={() => remove(t)} />
          </View>}
        </View>))}
      {canEdit && <><Text style={s.h2}>Add a track</Text><TrackPicker onPick={add} /></>}
      {owner && <>
        <Text style={s.h2}>Settings</Text>
        <View style={[s.row, s.card]}><Text style={s.text}>Private</Text><Switch value={pl.visibility === 'private'} onValueChange={(v) => toggle('visibility', v ? 'private' : 'public')} /></View>
        <View style={[s.row, s.card]}><Text style={s.text}>Only invited can edit</Text><Switch value={pl.edit_license === 'invited'} onValueChange={(v) => toggle('edit_license', v ? 'invited' : 'open')} /></View>
        <Text style={s.h2}>Invite friends</Text>
        {friends.map((f) => <View key={f.id} style={[s.card, s.row]}><Text style={s.text}>{f.display_name}</Text><Btn small title="Invite" onPress={() => invite(f.id)} /></View>)}
      </>}
    </ScrollView>
  );
}
