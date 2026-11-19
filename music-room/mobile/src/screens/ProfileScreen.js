import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { api, setBaseUrl, state, logAction } from '../api';
import { useAuth } from '../auth';
import { confirmAction, Page, Grid, Section, Btn, Input, Chip, Badge, Avatar, Empty, Loading, s, colors, guard, notify } from '../ui';
import { useSocialLogin } from '../social';

const sessionLabel = (x) => (x.device && x.device !== 'unknown' ? x.device : x.platform === 'web' ? 'Web browser' : x.platform || 'Unknown device');
const ipLabel = (ip = '') => (/^(::1|127\.0\.0\.1|::ffff:127\.0\.0\.1)$/.test(ip) ? 'this computer (local)' : ip.replace('::ffff:', ''));
const GENRES = ['Pop', 'Rock', 'Hip-hop', 'Electro', 'Jazz', 'Classical', 'Reggae', 'Metal', 'R&B', 'Raï', 'Latin', 'Soul'];

export function ProfileScreen({ navigation }) {
  const { user, refresh, signOut } = useAuth();
  const [f, setF] = useState(null), [fr, setFr] = useState(null), [q, setQ] = useState(''), [found, setFound] = useState([]), [cfg, setCfg] = useState(null), [sessions, setSessions] = useState([]);
  const [pw, setPw] = useState({ current: '', next: '' }), [server, setServer] = useState(state.baseUrl), [demo, setDemo] = useState('');
  useEffect(() => { if (user) setF({ display_name: user.display_name, public_info: user.public_info, friends_info: user.friends_info, private_info: user.private_info, prefs: user.music_prefs }); }, [user]);
  const loadAll = guard(async () => { setFr(await api('GET', '/friends')); setSessions(await api('GET', '/me/sessions')); setCfg(await api('GET', '/config')); });
  useFocusEffect(useCallback(() => { logAction('screen:Profile'); loadAll(); refresh(); }, []));  // eslint-disable-line react-hooks/exhaustive-deps
  const link = guard(async (provider, token) => { await api('POST', `/me/social/${provider}`, { token }); await refresh(); notify('Linked', provider); });
  const social = useSocialLogin(link);
  if (!f || !fr) return <Loading />;
  const set = (k) => (v) => setF({ ...f, [k]: v });
  const togglePref = (g) => setF({ ...f, prefs: f.prefs.includes(g) ? f.prefs.filter((x) => x !== g) : [...f.prefs, g] });
  const save = guard(async () => { await api('PATCH', '/me', { display_name: f.display_name, public_info: f.public_info, friends_info: f.friends_info, private_info: f.private_info, music_prefs: f.prefs }); await refresh(); notify('Saved', 'Your profile is up to date'); });
  const search = guard(async () => setFound(await api('GET', `/users?q=${encodeURIComponent(q)}`)));
  const ask = guard(async (id) => { await api('POST', '/friends/requests', { userId: id }); notify('Request sent'); loadAll(); });
  const accept = guard(async (id) => { await api('POST', `/friends/requests/${id}/accept`); loadAll(); });
  const unlink = guard(async (p) => { if (!(await confirmAction(`Unlink ${p}?`, 'You will no longer be able to log in with this account.', { confirmText: 'Unlink' }))) return; await api('DELETE', `/me/social/${p}`); await refresh(); });
  const changePw = guard(async () => { await api('POST', '/me/password', pw); setPw({ current: '', next: '' }); notify('Password changed'); });
  const saveServer = guard(async () => { await setBaseUrl(server); notify('Saved', 'Server address updated'); });
  const revoke = guard(async (x) => { if (!(await confirmAction('Disconnect this device?', `${sessionLabel(x)} will be logged out immediately.`, { confirmText: 'Disconnect' }))) return; await api('DELETE', `/me/sessions/${x.id}`); loadAll(); });
  const revokeOthers = guard(async () => { if (!(await confirmAction('Disconnect all other devices?', 'Every device except this one will be logged out. Do it if you think someone else has access to your account.', { confirmText: 'Disconnect all' }))) return; const r = await api('DELETE', '/me/sessions'); notify('Done', `${r.revoked} device(s) disconnected`); loadAll(); });
  const removeFriend = guard(async (x) => { if (!(await confirmAction(`Remove ${x.display_name} from your friends?`, 'They will no longer see your friends-only information, and any device control you gave them is withdrawn.', { confirmText: 'Remove friend' }))) return; await api('DELETE', `/friends/${x.id}`); notify('Friend removed', x.display_name); loadAll(); });
  const logout = guard(async () => { if (await confirmAction('Log out?', 'You will need to log in again on this device.', { confirmText: 'Log out', danger: false })) signOut(); });
  const real = cfg?.social || {};
  return (
    <Page onRefresh={loadAll}>
      <LinearGradient colors={['#450a0a', '#b91c1c', '#fb7185']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: 24, padding: 20 }}>
        <View style={[s.row, { flexWrap: 'wrap' }]}>
          <Avatar name={user.display_name} size={76} />
          <View style={{ marginLeft: 16, flex: 1, minWidth: 200 }}>
            <Text style={{ color: '#fff', fontSize: 28, fontWeight: '900' }}>{user.display_name}</Text>
            <Text style={{ color: 'rgba(255,255,255,0.85)' }}>{user.email || 'no e-mail'}</Text>
            <View style={[s.row, { marginTop: 8, flexWrap: 'wrap' }]}>
              <Badge icon={user.email_verified ? 'checkmark-circle' : 'alert-circle'} text={user.email_verified ? 'E-mail verified' : 'Not verified'} color={user.email_verified ? colors.green : colors.orange} />
              {user.social.map((p) => <Badge key={p} icon="link" text={p} color={colors.cyan} />)}<Badge icon="people" text={`${fr.friends.length} friends`} />
            </View>
          </View>
          <Btn alt small icon="log-out" title="Log out" onPress={logout} />
        </View>
      </LinearGradient>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -6 }}>
        <View style={{ flex: 1, minWidth: 320, padding: 6 }}>
          <Section title="My information" icon="person-circle">
            <View style={s.card}>
              <Input icon="person" placeholder="Display name" value={f.display_name} onChangeText={set('display_name')} autoCapitalize="words" />
              <View style={[s.row, { marginBottom: 4 }]}><Ionicons name="earth" size={14} color={colors.cyan} /><Text style={[s.dim, { marginLeft: 6 }]}>PUBLIC · everyone sees it</Text></View>
              <Input placeholder="Bio, city…" value={f.public_info} onChangeText={set('public_info')} multiline />
              <View style={[s.row, { marginBottom: 4 }]}><Ionicons name="people" size={14} color={colors.green} /><Text style={[s.dim, { marginLeft: 6 }]}>FRIENDS ONLY</Text></View>
              <Input placeholder="Phone, favourite venue…" value={f.friends_info} onChangeText={set('friends_info')} multiline />
              <View style={[s.row, { marginBottom: 4 }]}><Ionicons name="lock-closed" size={14} color={colors.pink} /><Text style={[s.dim, { marginLeft: 6 }]}>PRIVATE · only you</Text></View>
              <Input placeholder="Notes to self" value={f.private_info} onChangeText={set('private_info')} multiline />
              <View style={[s.row, { marginBottom: 8 }]}><Ionicons name="musical-notes" size={14} color={colors.accent} /><Text style={[s.dim, { marginLeft: 6 }]}>MUSIC PREFERENCES</Text></View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 10 }}>{GENRES.map((g) => <View key={g} style={{ marginBottom: 8 }}><Chip label={g} active={f.prefs.includes(g)} onPress={() => togglePref(g)} /></View>)}</View>
              <Btn icon="save" title="Save profile" onPress={save} />
            </View>
          </Section>
          <Section title="Linked accounts" icon="link">
            <View style={s.card}>
              {['google', 'facebook'].map((p) => { const on = user.social.includes(p); return (
                <View key={p} style={[s.between, { marginBottom: 10 }]}><View style={s.row}><Ionicons name={p === 'google' ? 'logo-google' : 'logo-facebook'} size={22} color={colors.text} /><Text style={[s.text, { marginLeft: 10, textTransform: 'capitalize' }]}>{p}</Text></View>
                  {on ? <Btn small alt icon="unlink" title="Unlink" onPress={() => unlink(p)} /> : real[p] ? <Btn small icon="link" title="Link" onPress={social[p]} /> :
                    cfg?.social_demo ? <Btn small icon="link" title="Link (demo)" disabled={!demo.trim()} onPress={() => link(p, `dev:${demo.trim()}`)} /> : null}</View>); })}
              {cfg?.social_demo && (!real.google || !real.facebook) && <><Input placeholder="Demo account name (dev mode)" value={demo} onChangeText={setDemo} /><Text style={s.dim}>Demo linking is for development. Real login needs Google/Facebook client IDs.</Text></>}
            </View>
          </Section>
        </View>
        <View style={{ flex: 1, minWidth: 320, padding: 6 }}>
          <Section title="Friends" icon="people">
            {fr.incoming.map((r) => <View key={r.id} style={[s.card, s.between, { borderColor: colors.accent }]}><View style={s.row}><Avatar name={r.display_name} size={36} /><Text style={[s.text, { marginLeft: 10 }]}>{r.display_name} wants to be friends</Text></View><Btn small icon="checkmark" title="Accept" onPress={() => accept(r.id)} /></View>)}
            {fr.friends.length === 0 && fr.incoming.length === 0 && <Empty icon="people" text="No friends yet. Search people below." />}
            {fr.friends.map((x) => (
              <TouchableOpacity key={x.id} onPress={() => navigation.navigate('Person', { id: x.id })} style={[s.card, s.between, { padding: 10, marginBottom: 8 }]}>
                <View style={s.row}><Avatar name={x.display_name} size={38} /><Text style={[s.h3, { marginLeft: 10 }]}>{x.display_name}</Text></View><View style={s.row}><Btn small alt icon="person-remove" color={colors.red} title="Remove" onPress={() => removeFriend(x)} /><Ionicons name="chevron-forward" size={18} color={colors.dim} style={{ marginLeft: 6 }} /></View></TouchableOpacity>))}
            {fr.outgoing.length > 0 && <Text style={s.dim}>Pending: {fr.outgoing.map((x) => x.display_name).join(', ')}</Text>}
            <View style={{ height: 10 }} />
            <Input icon="search" placeholder="Find people by name" value={q} onChangeText={setQ} onSubmitEditing={search} />
            <Btn small alt icon="search" title="Search" onPress={search} />
            {found.filter((x) => x.id !== user.id).map((x) => <View key={x.id} style={[s.card, s.between, { padding: 10, marginTop: 8, marginBottom: 0 }]}><TouchableOpacity style={s.row} onPress={() => navigation.navigate('Person', { id: x.id })}><Avatar name={x.display_name} size={32} /><Text style={[s.text, { marginLeft: 10 }]}>{x.display_name}</Text></TouchableOpacity><Btn small icon="person-add" title="Add" onPress={() => ask(x.id)} /></View>)}
          </Section>
          {user.has_password && <Section title="Security" icon="shield-checkmark"><View style={s.card}>
            <Input icon="key" placeholder="Current password" secureTextEntry value={pw.current} onChangeText={(current) => setPw({ ...pw, current })} />
            <Input icon="key" placeholder="New password (8+, letters & digits)" secureTextEntry value={pw.next} onChangeText={(next) => setPw({ ...pw, next })} />
            <Btn alt icon="refresh" title="Change password" onPress={changePw} /></View></Section>}
          <Section title="Devices logged in to my account" icon="shield">
            <Text style={[s.dim, { marginBottom: 8 }]}>If you see a device you don’t recognise, disconnect it: it is logged out at once. This protects you if a phone is lost or a session is stolen.</Text>
            {sessions.map((x) => (<View key={x.id} style={[s.card, s.between, { padding: 10, marginBottom: 6, borderColor: x.current ? colors.green : colors.border }]}>
              <View style={{ flex: 1, paddingRight: 8 }}><View style={s.row}><Ionicons name={x.platform === 'web' ? 'laptop' : 'phone-portrait'} size={16} color={colors.dim} /><Text style={[s.text, { marginLeft: 6 }]}>{sessionLabel(x)}</Text>{x.current && <Badge icon="checkmark-circle" text="This device" color={colors.green} />}</View>
                <Text style={s.dim}>Logged in {new Date(x.created_at).toLocaleString()} · {ipLabel(x.ip)}</Text></View>
              {!x.current && <Btn small alt icon="log-out" title="Disconnect" onPress={() => revoke(x)} />}</View>))}
            {sessions.length > 1 && <Btn small alt icon="shield-half" title="Disconnect all other devices" onPress={revokeOthers} />}
          </Section>
          <Section title="Server" icon="server"><View style={s.card}><Input icon="globe" value={server} onChangeText={setServer} keyboardType="url" /><Btn alt icon="save" title="Save address" onPress={saveServer} /></View></Section>
        </View>
      </View>
    </Page>);
}

export function Person({ route }) {
  const { id } = route.params;
  const [u, setU] = useState(null);
  useEffect(() => { logAction(`screen:Person:${id}`); api('GET', `/users/${id}`).then(setU).catch((e) => notify('Error', e.message)); }, [id]);
  const ask = guard(async () => { await api('POST', '/friends/requests', { userId: id }); notify('Request sent'); });
  const remove = guard(async () => { if (!(await confirmAction(`Remove ${u.display_name} from your friends?`, 'They will no longer see your friends-only information, and any device control you gave them is withdrawn.', { confirmText: 'Remove friend' }))) return; await api('DELETE', `/friends/${id}`); setU({ ...u, is_friend: false, friends_info: undefined }); notify('Friend removed', u.display_name); });
  if (!u) return <Loading />;
  return (
    <Page>
      <LinearGradient colors={['#7f1d1d', '#dc2626', '#fb7185']} style={{ borderRadius: 24, padding: 22, alignItems: 'center' }}>
        <Avatar name={u.display_name} size={90} /><Text style={{ color: '#fff', fontSize: 28, fontWeight: '900', marginTop: 10 }}>{u.display_name}</Text>
        <View style={[s.row, { marginTop: 6 }]}><Badge icon={u.is_friend ? 'people' : 'earth'} text={u.is_friend ? 'Friend' : 'Public profile'} /></View>
      </LinearGradient>
      <Section title="About" icon="earth"><View style={s.card}><Text style={s.text}>{u.public_info || 'No public information.'}</Text></View></Section>
      {u.is_friend && <Section title="Only visible to friends" icon="people"><View style={s.card}><Text style={s.text}>{u.friends_info || 'Nothing shared with friends.'}</Text></View></Section>}
      <Section title="Music tastes" icon="musical-notes"><View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>{(u.music_prefs || []).length ? u.music_prefs.map((g) => <Chip key={g} label={g} active />) : <Text style={s.dim}>Not specified.</Text>}</View></Section>
      <View style={{ marginTop: 16 }}>{u.is_friend ? <Btn alt icon="person-remove" color={colors.red} title="Remove from friends" onPress={remove} /> : <Btn icon="person-add" title="Add as friend" onPress={ask} />}</View>
    </Page>);
}
