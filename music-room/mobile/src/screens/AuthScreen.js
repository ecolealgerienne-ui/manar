import React, { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { api, setBaseUrl, state } from '../api';
import { useAuth } from '../auth';
import { Btn, Input, s, guard, notify, Banner, ThemePicker } from '../ui';
import { useSocialLogin, socialConfigured } from '../social';

export default function AuthScreen({ onTheme }) {
  const { signIn } = useAuth();
  const [mode, setMode] = useState('login'); // login | register | forgot | reset
  const [f, setF] = useState({ email: '', password: '', name: '', code: '' });
  const [server, setServer] = useState(state.baseUrl);
  const set = (k) => (v) => setF((x) => ({ ...x, [k]: v }));

  const social = useSocialLogin(guard(async (provider, token) => { const r = await api('POST', '/auth/social', { provider, token }); await signIn(r.token); }));

  const submit = guard(async () => {
    await setBaseUrl(server);
    if (mode === 'login') {
      try { const r = await api('POST', '/auth/login', { email: f.email, password: f.password }); await signIn(r.token); }
      catch (e) {
        if (e.code === 'EMAIL_NOT_VERIFIED') { await api('POST', '/auth/resend-verification', { email: f.email }); notify('E-mail not verified', 'We sent you a new verification link. Open it, then log in.'); } else throw e;
      }
    } else if (mode === 'register') {
      const r = await api('POST', '/auth/register', { email: f.email, password: f.password, display_name: f.name });
      notify('Check your mailbox', r.message); setMode('login');
    } else if (mode === 'forgot') {
      const r = await api('POST', '/auth/forgot-password', { email: f.email }); notify('Done', r.message); setMode('reset');
    } else {
      await api('POST', '/auth/reset-password', { code: f.code, password: f.password }); notify('Password changed', 'You can log in.'); setMode('login');
    }
  });
  const title = { login: 'Log in', register: 'Create account', forgot: 'Forgot password', reset: 'Choose a new password' }[mode];
  return (
    <ScrollView style={s.screen} contentContainerStyle={{ paddingTop: 40 }} keyboardShouldPersistTaps="handled">
      <Banner />
      <Text style={s.h2}>{title}</Text>
      {mode === 'register' && <Input placeholder="Display name" value={f.name} onChangeText={set('name')} autoCapitalize="words" />}
      {mode !== 'reset' && <Input placeholder="E-mail" value={f.email} onChangeText={set('email')} keyboardType="email-address" />}
      {mode === 'reset' && <Input placeholder="Code received by e-mail" value={f.code} onChangeText={set('code')} autoCapitalize="characters" />}
      {mode !== 'forgot' && <Input placeholder={mode === 'reset' ? 'New password (8+, letters & digits)' : 'Password'} value={f.password} onChangeText={set('password')} secureTextEntry />}
      <Btn title={title} onPress={submit} />
      {mode === 'login' && (<>
        <Btn alt title="Continue with Google" disabled={!socialConfigured.google || !social.ready.google} onPress={social.google} />
        <Btn alt title="Continue with Facebook" disabled={!socialConfigured.facebook || !social.ready.facebook} onPress={social.facebook} />
        {(!socialConfigured.google || !socialConfigured.facebook) && <Text style={s.dim}>Social buttons are disabled until client IDs are set in mobile/.env</Text>}
      </>)}
      <View style={{ marginTop: 10 }}>
        {mode !== 'login' && <Btn alt small title="← Back to log in" onPress={() => setMode('login')} />}
        {mode === 'login' && <><Btn alt small title="Create an account" onPress={() => setMode('register')} /><View style={{ height: 8 }} /><Btn alt small title="Forgot password?" onPress={() => setMode('forgot')} /></>}
      </View>
      <Text style={[s.h2, { marginTop: 24 }]}>Style</Text>
      <ThemePicker onChange={onTheme} />
      <Text style={s.h2}>Back-end address</Text>
      <Input value={server} onChangeText={setServer} placeholder="http://192.168.x.x:4000" keyboardType="url" />
      <Text style={s.dim}>The app is only a remote control: set your server URL here (test / production).</Text>
    </ScrollView>
  );
}
