import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { api, setBaseUrl, state, logAction } from '../api';
import { useAuth } from '../auth';
import { Btn, Input, s, guard, Loading, notify, ThemePicker } from '../ui';
import { useSocialLogin, socialConfigured } from '../social';

export default function ProfileScreen({ onTheme }) {
  const { user, refresh, signOut } = useAuth();
  const [f, setF] = useState(null), [fr, setFr] = useState(null), [q, setQ] = useState(''), [found, setFound] = useState([]);
  const [pw, setPw] = useState({ current: '', next: '' }), [server, setServer] = useState(state.baseUrl);
  useEffect(() => { if (user) setF({ display_name: user.display_name, public_info: user.public_info, friends_info: user.friends_info, private_info: user.private_info, prefs: user.music_prefs.join(', ') }); }, [user]);
  const loadFriends = guard(async () => setFr(await api('GET', '/friends')));
  useFocusEffect(useCallback(() => { logAction('screen:Profile'); loadFriends(); refresh(); }, []));  // eslint-disable-line react-hooks/exhaustive-deps
  const link = useSocialLogin(guard(async (provider, token) => { await api('POST', `/me/social/${provider}`, { token }); await refresh(); notify('Linked', provider); }));
  if (!f || !fr) return <Loading />;
  const set = (k) => (v) => setF({ ...f, [k]: v });
  const save = guard(async () => { await api('PATCH', '/me', { display_name: f.display_name, public_info: f.public_info, friends_info: f.friends_info, private_info: f.private_info, music_prefs: f.prefs.split(',').map((x) => x.trim()).filter(Boolean) }); await refresh(); notify('Saved'); });
  const search = guard(async () => setFound(await api('GET', `/users?q=${encodeURIComponent(q)}`)));
  const ask = guard(async (id) => { await api('POST', '/friends/requests', { userId: id }); notify('Request sent'); loadFriends(); });
  const accept = guard(async (id) => { await api('POST', `/friends/requests/${id}/accept`); loadFriends(); });
  const unlink = guard(async (p) => { await api('DELETE', `/me/social/${p}`); await refresh(); });
  const changePw = guard(async () => { await api('POST', '/me/password', pw); setPw({ current: '', next: '' }); notify('Password changed'); });
  const saveServer = guard(async () => { await setBaseUrl(server); notify('Saved', 'Server address updated'); });
  return (
    <ScrollView style={s.screen} keyboardShouldPersistTaps="handled">
      <Text style={s.h1}>Profile</Text>
      <Text style={s.dim}>{user.email || 'no e-mail'} {user.email_verified ? '✓ verified' : '(not verified)'}</Text>
      <Text style={s.h2}>Display name</Text><Input value={f.display_name} onChangeText={set('display_name')} autoCapitalize="words" />
      <Text style={s.h2}>Public information (everyone)</Text><Input value={f.public_info} onChangeText={set('public_info')} multiline />
      <Text style={s.h2}>Friends-only information</Text><Input value={f.friends_info} onChangeText={set('friends_info')} multiline />
      <Text style={s.h2}>Private information (only me)</Text><Input value={f.private_info} onChangeText={set('private_info')} multiline />
      <Text style={s.h2}>Music preferences (comma separated)</Text><Input value={f.prefs} onChangeText={set('prefs')} placeholder="jazz, rock, electro" />
      <Btn title="Save profile" onPress={save} />

      <Text style={s.h2}>Linked accounts</Text>
      {['google', 'facebook'].map((p) => { const on = user.social.includes(p); return (
        <View key={p} style={[s.row, { marginBottom: 8 }]}><Text style={s.text}>{p}</Text>
          {on ? <Btn small alt title="Unlink" onPress={() => unlink(p)} /> : <Btn small title="Link" disabled={!socialConfigured[p] || !link.ready[p]} onPress={link[p]} />}</View>); })}

      <Text style={s.h2}>Friends</Text>
      {fr.incoming.map((r) => <View key={r.id} style={[s.card, s.row]}><Text style={s.text}>{r.display_name} wants to be your friend</Text><Btn small title="Accept" onPress={() => accept(r.id)} /></View>)}
      {fr.friends.map((x) => <View key={x.id} style={s.card}><Text style={s.text}>{x.display_name}</Text></View>)}
      {fr.outgoing.length > 0 && <Text style={s.dim}>Pending: {fr.outgoing.map((x) => x.display_name).join(', ')}</Text>}
      <Input placeholder="Find people by name" value={q} onChangeText={setQ} onSubmitEditing={search} />
      <Btn small alt title="Search" onPress={search} />
      {found.filter((x) => x.id !== user.id).map((x) => <View key={x.id} style={[s.card, s.row]}><Text style={s.text}>{x.display_name}</Text><Btn small title="Add" onPress={() => ask(x.id)} /></View>)}

      {user.has_password && <><Text style={s.h2}>Change password</Text>
        <Input placeholder="Current password" secureTextEntry value={pw.current} onChangeText={(current) => setPw({ ...pw, current })} />
        <Input placeholder="New password" secureTextEntry value={pw.next} onChangeText={(next) => setPw({ ...pw, next })} />
        <Btn alt title="Change password" onPress={changePw} /></>}

      <Text style={s.h2}>Style</Text><ThemePicker onChange={onTheme} />
      <Text style={s.h2}>Back-end address</Text><Input value={server} onChangeText={setServer} keyboardType="url" />
      <Btn alt title="Save address" onPress={saveServer} />
      <Btn alt title="Log out" onPress={signOut} />
    </ScrollView>
  );
}
