import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, Animated } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import * as Location from 'expo-location';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { api, subscribe, logAction } from '../api';
import { useAuth } from '../auth';
import { confirmAction, Page, Grid, Section, Btn, IconBtn, Input, Chip, Badge, Live, Mosaic, Cover, Equalizer, EventCard, Empty, Loading, s, colors, guard, notify, grad, licenceLabel } from '../ui';
import { TrackRow, TrackSearch, InvitePanel, EventForm } from '../parts';
import { togglePreview, usePreviewId } from '../player';
import { ScrollView } from 'react-native';

export function EventsList({ navigation }) {
  const [events, setEvents] = useState(null), [q, setQ] = useState(''), [filter, setFilter] = useState('all'), [form, setForm] = useState(false);
  const { user } = useAuth();
  const load = guard(async () => setEvents(await api('GET', `/events${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ''}`)));
  useFocusEffect(useCallback(() => { logAction('screen:Events'); load(); }, [q]));  // eslint-disable-line react-hooks/exhaustive-deps
  const create = async (b) => { const e = await api('POST', '/events', b); setForm(false); navigation.navigate('Event', { id: e.id }); };
  const shown = (events || []).filter((e) => filter === 'all' || (filter === 'mine' && e.owner_id === user.id) || (filter === 'live' && e.now_playing) || e.visibility === filter);
  return (
    <Page onRefresh={load}>
      <View style={[s.between, { marginBottom: 12 }]}>
        <View><Text style={s.h1}>Live events</Text><Text style={s.dim}>Vote for the next track, together</Text></View>
        <Btn small icon={form ? 'close' : 'add'} title={form ? 'Close' : 'New event'} onPress={() => setForm(!form)} />
      </View>
      {form && <EventForm onSubmit={create} />}
      <Input icon="search" placeholder="Search an event" value={q} onChangeText={setQ} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
        {[['all', 'All', 'apps'], ['live', 'Live now', 'radio'], ['mine', 'Mine', 'person'], ['public', 'Public', 'earth'], ['private', 'Private', 'lock-closed']].map(([k, l, i]) => <Chip key={k} label={l} icon={i} active={filter === k} onPress={() => setFilter(k)} />)}
      </ScrollView>
      {!events ? <Loading /> : shown.length === 0 ? <Empty icon="radio" text="No event here yet." /> : <Grid>{shown.map((e) => <EventCard key={e.id} e={e} onPress={() => navigation.navigate('Event', { id: e.id })} />)}</Grid>}
    </Page>);
}

function VoteButton({ t, onPress, disabled }) {
  const sc = useRef(new Animated.Value(1)).current;
  const press = () => { Animated.sequence([Animated.spring(sc, { toValue: 1.25, useNativeDriver: true, speed: 40 }), Animated.spring(sc, { toValue: 1, useNativeDriver: true })]).start(); onPress(); };
  return (
    <Animated.View style={{ transform: [{ scale: sc }] }}>
      <Btn small alt={!t.voted} disabled={disabled} icon={t.voted ? 'heart' : 'heart-outline'} color={t.voted ? undefined : colors.pink} title={String(t.votes)} onPress={press} />
    </Animated.View>);
}

export function EventDetail({ route, navigation }) {
  const { id } = route.params; const { user } = useAuth();
  const [ev, setEv] = useState(null), [pos, setPos] = useState(null), [edit, setEdit] = useState(false), [flash, setFlash] = useState(null);
  const posRef = useRef(null);
  const load = guard(async () => { const q = posRef.current ? `?lat=${posRef.current.lat}&lng=${posRef.current.lng}` : ''; setEv(await api('GET', `/events/${id}${q}`)); });
  const getPos = async () => {
    const p = await Location.requestForegroundPermissionsAsync();
    if (p.status !== 'granted') throw new Error('Location permission is required to vote at this event');
    const l = await Location.getCurrentPositionAsync({}); posRef.current = { lat: l.coords.latitude, lng: l.coords.longitude }; setPos(posRef.current); return posRef.current;
  };
  useEffect(() => {
    logAction(`screen:Event:${id}`);
    (async () => { try { const e0 = await api('GET', `/events/${id}`); if (e0.license === 'geo_time') await getPos().catch(() => {}); } catch { /* shown by load */ } load(); })();
    return subscribe(`event:${id}`, () => { load(); setFlash('Updated live'); setTimeout(() => setFlash(null), 1500); });
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  const withPos = async () => (ev?.license === 'geo_time' ? (posRef.current || (await getPos())) : undefined);
  const merge = (d) => setEv((o) => ({ ...o, ...d }));
  const vote = guard(async (t) => merge(await api(t.voted ? 'DELETE' : 'PUT', `/events/${id}/tracks/${t.id}/vote`, { position: await withPos() })));
  const suggest = guard(async (t) => { merge(await api('POST', `/events/${id}/tracks`, { trackId: t.id, position: await withPos() })); notify('Added to the queue', t.title); });
  const next = guard(async () => merge(await api('POST', `/events/${id}/next`)));
  const save = async (b) => { merge(await api('PATCH', `/events/${id}`, b)); setEdit(false); await load(); };
  const del = guard(async () => { if (!(await confirmAction('Delete this event?', `“${ev.name}”, its queue and all the votes will be permanently deleted. This cannot be undone.`, { confirmText: 'Delete event' }))) return; await api('DELETE', `/events/${id}`); navigation.goBack(); });
  const invite = guard(async (uid) => { await api('PUT', `/events/${id}/invites/${uid}`); load(); });
  const uninvite = guard(async (uid) => { await api('DELETE', `/events/${id}/invites/${uid}`); load(); });
  const prev = usePreviewId();
  if (!ev) return <Loading />;
  const owner = ev.owner_id === user.id, cv = ev.can_vote, canVote = !cv || cv.ok || cv.code === 'POSITION_REQUIRED';
  const [licIcon, licText] = licenceLabel(ev.license);
  const covers = [ev.nowPlaying, ...ev.queue].filter(Boolean);
  return (
    <Page onRefresh={load}>
      <LinearGradient colors={grad(`e${ev.id}${ev.name}`)} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: 24, padding: 18 }}>
        <View style={[s.between, { alignItems: 'flex-start' }]}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', flex: 1 }}>
            <Badge icon={ev.visibility === 'public' ? 'earth' : 'lock-closed'} text={ev.visibility === 'public' ? 'Public' : 'Private'} /><Badge icon={licIcon} text={licText} />
            {ev.license === 'geo_time' && ev.start_at && <Badge icon="time" text={`${new Date(ev.start_at).toTimeString().slice(0, 5)} → ${new Date(ev.end_at).toTimeString().slice(0, 5)} · ${ev.radius_m} m`} />}
          </View>
          <View style={s.row}>{flash && <Text style={{ color: '#fff', marginRight: 8, fontSize: 11 }}>{flash}</Text>}<Live /></View>
        </View>
        <View style={[s.row, { marginTop: 12, flexWrap: 'wrap' }]}>
          <Mosaic covers={covers} size={110} seed={ev.name} />
          <View style={{ flex: 1, marginLeft: 16, minWidth: 180 }}>
            <Text style={{ color: '#fff', fontSize: 30, fontWeight: '900' }}>{ev.name}</Text>
            <Text style={{ color: 'rgba(255,255,255,0.85)' }}>by {ev.owner_name}{ev.description ? ` · ${ev.description}` : ''}</Text>
            <View style={[s.row, { marginTop: 8 }]}><Badge icon="list" text={`${ev.queue.length} in queue`} /><Badge icon="heart" text={`${ev.queue.reduce((a, t) => a + t.votes, 0)} votes`} /></View>
          </View>
        </View>
      </LinearGradient>

      {cv && !cv.ok && <View style={[s.note, { marginTop: 12 }]}><Text style={{ color: '#fde68a' }}>You can’t vote right now: {cv.reason}</Text>
        {cv.code === 'POSITION_REQUIRED' && <Btn small alt icon="locate" title="Use my position" onPress={guard(async () => { await getPos(); load(); })} />}</View>}

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -6, marginTop: 8 }}>
        <View style={{ flex: 1, minWidth: 320, padding: 6 }}>
          <Section title="Now playing" icon="musical-notes">
            {ev.nowPlaying ? <TrackRow t={{ ...ev.nowPlaying, id: ev.nowPlaying.track_id }} right={<Equalizer />} /> : <Empty icon="pause-circle" text="Nothing playing. The owner starts the best-voted track." />}
            {owner && <Btn icon="play-skip-forward" title="Play next track (most voted)" onPress={next} disabled={!ev.queue.length} />}
          </Section>
          <Section title="Queue" icon="trending-up">
            <Text style={[s.dim, { marginBottom: 8 }]}>Most votes first. With the same score, the track that got there first stays first, so a new vote puts a track right after those already at that level.</Text>
            {ev.queue.length === 0 ? <Empty text="The queue is empty. Suggest a track!" /> : ev.queue.map((t, i) => (
              <View key={t.id}>{i === 0 && <View style={[s.row, { marginBottom: 4 }]}><Ionicons name="flash" size={14} color={colors.yellow} /><Text style={{ color: colors.yellow, fontWeight: '800', fontSize: 11, marginLeft: 4 }}>NEXT UP</Text></View>}
                <TrackRow t={t} index={i} right={<VoteButton t={t} onPress={() => vote(t)} disabled={!canVote} />} /></View>))}
          </Section>
        </View>
        <View style={{ flex: 1, minWidth: 320, padding: 6 }}>
          <Section title="Suggest a track" icon="add-circle"><TrackSearch label="Suggest" icon="add" onPick={suggest} /></Section>
        </View>
      </View>

      {owner && (<Section title="Owner tools" icon="settings">
        <View style={[s.row, { flexWrap: 'wrap', gap: 8, marginBottom: 10 }]}><Btn small alt icon="create" title={edit ? 'Close settings' : 'Visibility & licence'} onPress={() => setEdit(!edit)} /><Btn small alt icon="trash" color={colors.red} title="Delete event" onPress={del} /></View>
        {edit && <EventForm submitLabel="Save settings" onSubmit={save} initial={{ name: ev.name, description: ev.description || '', visibility: ev.visibility, license: ev.license, radius: ev.radius_m || 200, lat: ev.lat, lng: ev.lng, start: ev.start_at ? new Date(ev.start_at).toTimeString().slice(0, 5) : undefined, end: ev.end_at ? new Date(ev.end_at).toTimeString().slice(0, 5) : undefined }} />}
        <View style={s.card}><Text style={[s.h3, { marginBottom: 8 }]}>Invitations</Text><InvitePanel invited={ev.invited} onInvite={invite} onRemove={uninvite} /></View>
      </Section>)}
    </Page>);
}
