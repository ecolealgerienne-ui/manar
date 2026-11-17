import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { api, subscribe, logAction } from '../api';
import { useAuth } from '../auth';
import { confirmAction, Page, Grid, Section, Btn, IconBtn, Input, Chip, Badge, Seg, Live, Mosaic, PlaylistCard, Empty, Loading, s, colors, guard, grad } from '../ui';
import { TrackRow, TrackSearch, InvitePanel } from '../parts';

export function PlaylistsList({ navigation }) {
  const [list, setList] = useState(null), [q, setQ] = useState(''), [form, setForm] = useState(false), [filter, setFilter] = useState('all');
  const [f, setF] = useState({ name: '', visibility: 'public', edit_license: 'open' });
  const { user } = useAuth();
  const load = guard(async () => setList(await api('GET', `/playlists${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ''}`)));
  useFocusEffect(useCallback(() => { logAction('screen:Playlists'); load(); }, [q]));  // eslint-disable-line react-hooks/exhaustive-deps
  const create = guard(async () => { const p = await api('POST', '/playlists', f); setForm(false); setF({ ...f, name: '' }); navigation.navigate('Playlist', { id: p.id }); });
  const shown = (list || []).filter((p) => filter === 'all' || (filter === 'mine' && p.owner_id === user.id) || p.visibility === filter);
  return (
    <Page onRefresh={load}>
      <View style={[s.between, { marginBottom: 12 }]}>
        <View><Text style={s.h1}>Playlists</Text><Text style={s.dim}>Build radio stations together, in real time</Text></View>
        <Btn small icon={form ? 'close' : 'add'} title={form ? 'Close' : 'New playlist'} onPress={() => setForm(!form)} />
      </View>
      {form && (<View style={s.card}>
        <Input icon="musical-notes" placeholder="Playlist name" value={f.name} onChangeText={(name) => setF({ ...f, name })} autoCapitalize="sentences" />
        <Text style={[s.dim, { marginBottom: 6 }]}>WHO CAN SEE IT</Text>
        <Seg value={f.visibility} onChange={(visibility) => setF({ ...f, visibility })} options={[['public', 'Public', 'earth'], ['private', 'Private', 'lock-closed']]} />
        <Text style={[s.dim, { marginBottom: 6 }]}>WHO CAN EDIT IT</Text>
        <Seg value={f.edit_license} onChange={(edit_license) => setF({ ...f, edit_license })} options={[['open', 'Everyone', 'people'], ['invited', 'Invited only', 'mail']]} />
        <Btn icon="checkmark-circle" title="Create playlist" onPress={create} disabled={!f.name.trim()} />
      </View>)}
      <Input icon="search" placeholder="Search a playlist" value={q} onChangeText={setQ} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
        {[['all', 'All', 'apps'], ['mine', 'Mine', 'person'], ['public', 'Public', 'earth'], ['private', 'Private', 'lock-closed']].map(([k, l, i]) => <Chip key={k} label={l} icon={i} active={filter === k} onPress={() => setFilter(k)} />)}
      </ScrollView>
      {!list ? <Loading /> : shown.length === 0 ? <Empty icon="albums" text="No playlist here yet." /> : <Grid>{shown.map((p) => <PlaylistCard key={p.id} p={p} onPress={() => navigation.navigate('Playlist', { id: p.id })} />)}</Grid>}
    </Page>);
}

export function PlaylistDetail({ route, navigation }) {
  const { id } = route.params; const { user } = useAuth();
  const [pl, setPl] = useState(null), [flash, setFlash] = useState(null);
  const load = guard(async () => setPl(await api('GET', `/playlists/${id}`)));
  useEffect(() => {
    logAction(`screen:Playlist:${id}`); load();
    return subscribe(`playlist:${id}`, (d) => { setPl((o) => ({ ...(o || {}), ...d })); setFlash('Edited live by someone'); setTimeout(() => setFlash(null), 1800); });
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  const apply = (p) => setPl((o) => ({ ...o, ...p }));
  // The server applies each operation on its CURRENT state (entry id + target index) so concurrent edits never overwrite each other.
  const move = guard(async (t, to) => apply(await api('POST', `/playlists/${id}/tracks/${t.id}/move`, { toIndex: to })));
  const remove = guard(async (t) => { if (!(await confirmAction('Remove this track?', `“${t.title}” will be removed from the playlist for everybody.`, { confirmText: 'Remove' }))) return; apply(await api('DELETE', `/playlists/${id}/tracks/${t.id}`)); });
  const add = guard(async (t) => apply(await api('POST', `/playlists/${id}/tracks`, { trackId: t.id })));
  const settings = guard(async (k, v) => apply(await api('PATCH', `/playlists/${id}`, { [k]: v })));
  const invite = guard(async (uid) => { await api('PUT', `/playlists/${id}/invites/${uid}`); load(); });
  const uninvite = guard(async (uid) => { await api('DELETE', `/playlists/${id}/invites/${uid}`); load(); });
  const del = guard(async () => { if (!(await confirmAction('Delete this playlist?', `“${pl.name}” and its ${pl.tracks.length} track(s) will be permanently deleted for everyone. This cannot be undone.`, { confirmText: 'Delete playlist' }))) return; await api('DELETE', `/playlists/${id}`); navigation.goBack(); });
  if (!pl) return <Loading />;
  const owner = pl.owner_id === user.id, canEdit = pl.can_edit !== false;
  const covers = pl.tracks.slice(0, 4);
  return (
    <Page onRefresh={load}>
      <LinearGradient colors={grad(`p${pl.id}${pl.name}`)} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: 24, padding: 18 }}>
        <View style={[s.row, { flexWrap: 'wrap' }]}>
          <Mosaic covers={covers} size={120} seed={pl.name} />
          <View style={{ flex: 1, marginLeft: 16, minWidth: 180 }}>
            <View style={s.row}><Live label="REAL TIME" />{flash && <Text style={{ color: '#fff', marginLeft: 8, fontSize: 11 }}>{flash}</Text>}</View>
            <Text style={{ color: '#fff', fontSize: 30, fontWeight: '900', marginTop: 6 }}>{pl.name}</Text>
            <Text style={{ color: 'rgba(255,255,255,0.85)' }}>by {pl.owner_name} · {pl.tracks.length} track{pl.tracks.length === 1 ? '' : 's'}</Text>
            <View style={[s.row, { marginTop: 8, flexWrap: 'wrap' }]}>
              <Badge icon={pl.visibility === 'public' ? 'earth' : 'lock-closed'} text={pl.visibility === 'public' ? 'Public' : 'Private'} />
              <Badge icon={pl.edit_license === 'open' ? 'create' : 'mail'} text={pl.edit_license === 'open' ? 'Everyone edits' : 'Invited edit'} />
              {!canEdit && <Badge icon="eye" text="Read only" />}
            </View>
          </View>
        </View>
      </LinearGradient>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -6 }}>
        <View style={{ flex: 1, minWidth: 320, padding: 6 }}>
          <Section title="Tracks" icon="list">
            {pl.tracks.length === 0 ? <Empty text="Empty playlist. Add the first track!" /> : pl.tracks.map((t, i) => (
              <TrackRow key={t.id} t={t} index={i} right={canEdit ? (
                <View style={s.row}>
                  <IconBtn name="arrow-up" size={16} disabled={i === 0} onPress={() => move(t, i - 1)} /><View style={{ width: 4 }} />
                  <IconBtn name="arrow-down" size={16} disabled={i === pl.tracks.length - 1} onPress={() => move(t, i + 1)} /><View style={{ width: 4 }} />
                  <IconBtn name="close" size={16} color={colors.red} onPress={() => remove(t)} /></View>) : null} />))}
          </Section>
        </View>
        {canEdit && <View style={{ flex: 1, minWidth: 320, padding: 6 }}><Section title="Add tracks" icon="add-circle"><TrackSearch label="Add" onPick={add} /></Section></View>}
      </View>
      {owner && (<Section title="Owner tools" icon="settings">
        <View style={s.card}>
          <Text style={[s.dim, { marginBottom: 6 }]}>WHO CAN SEE IT</Text>
          <Seg value={pl.visibility} onChange={(v) => settings('visibility', v)} options={[['public', 'Public', 'earth'], ['private', 'Private', 'lock-closed']]} />
          <Text style={[s.dim, { marginBottom: 6 }]}>WHO CAN EDIT IT</Text>
          <Seg value={pl.edit_license} onChange={(v) => settings('edit_license', v)} options={[['open', 'Everyone', 'people'], ['invited', 'Invited only', 'mail']]} />
          <Btn small alt icon="trash" color={colors.red} title="Delete playlist" onPress={del} />
        </View>
        <View style={s.card}><Text style={[s.h3, { marginBottom: 8 }]}>Collaborators</Text><InvitePanel invited={pl.invited} onInvite={invite} onRemove={uninvite} /></View>
      </Section>)}
    </Page>);
}
