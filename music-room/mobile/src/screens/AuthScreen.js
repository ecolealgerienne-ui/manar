import React, { useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { api, setBaseUrl, state } from '../api';
import { useAuth } from '../auth';
import { Btn, Input, s, guard, notify } from '../ui';
import { useSocialLogin } from '../social';

export default function AuthScreen() {
  const { signIn } = useAuth();
  const [mode, setMode] = useState('login'); // login | register | forgot | reset
  const [f, setF] = useState({ email: '', password: '', name: '', code: '' });
  const [server, setServer] = useState(state.baseUrl);
  const [cfg, setCfg] = useState(null), [demoName, setDemoName] = useState('');
  const [pendingVerify, setPendingVerify] = useState(null); // dev mode: token returned by the API
  const set = (k) => (v) => setF((x) => ({ ...x, [k]: v }));

  const loadCfg = async () => { try { setCfg(await api('GET', '/config')); } catch { setCfg(null); } };
  useEffect(() => { loadCfg(); }, []);
  const saveServer = guard(async () => { await setBaseUrl(server); await loadCfg(); notify('Saved', cfg ? 'Server reachable' : 'Address saved (check that the server is running)'); });

  const socialLogin = guard(async (provider, token) => { const r = await api('POST', '/auth/social', { provider, token }); await signIn(r.token); });
  const social = useSocialLogin(socialLogin);

  const verifyNow = guard(async () => {
    const r = await fetch(`${state.baseUrl}/auth/verify-email?token=${encodeURIComponent(pendingVerify)}`);
    if (!r.ok) throw new Error('Verification failed');
    setPendingVerify(null); notify('E-mail verified', 'You can now log in.');
  });

  const submit = guard(async () => {
    if (mode === 'login') {
      try { const r = await api('POST', '/auth/login', { email: f.email, password: f.password }); await signIn(r.token); }
      catch (e) {
        if (e.code === 'EMAIL_NOT_VERIFIED') { const r = await api('POST', '/auth/resend-verification', { email: f.email }); if (r.dev_verify_token) setPendingVerify(r.dev_verify_token); notify('E-mail not verified', 'Open the link we sent you, then log in.'); } else throw e;
      }
    } else if (mode === 'register') {
      const r = await api('POST', '/auth/register', { email: f.email, password: f.password, display_name: f.name });
      if (r.dev_verify_token) setPendingVerify(r.dev_verify_token);
      notify('Account created', r.dev_verify_token ? 'Dev mode: tap "Verify my e-mail" below.' : 'Check your mailbox to verify your e-mail.'); setMode('login');
    } else if (mode === 'forgot') {
      const r = await api('POST', '/auth/forgot-password', { email: f.email });
      if (r.dev_reset_code) setF((x) => ({ ...x, code: r.dev_reset_code }));
      notify('Done', r.dev_reset_code ? 'Dev mode: the code was filled in for you.' : r.message); setMode('reset');
    } else {
      await api('POST', '/auth/reset-password', { code: f.code, password: f.password }); notify('Password changed', 'You can log in.'); setMode('login');
    }
  });
  const title = { login: 'Log in', register: 'Create account', forgot: 'Forgot password', reset: 'New password' }[mode];
  const real = cfg?.social || {};
  return (
    <ScrollView style={s.screen} contentContainerStyle={{ paddingTop: 30 }} keyboardShouldPersistTaps="handled">
      <Text style={[s.h1, { fontSize: 26 }]}>Music Room</Text>
      {!cfg && <View style={s.note}><Text style={s.text}>Cannot reach the server at {state.baseUrl}. Start the backend and set its address at the bottom of this page (on a phone use your PC's IP, not localhost).</Text></View>}
      <Text style={s.h2}>{title}</Text>
      {mode === 'register' && <Input placeholder="Display name" value={f.name} onChangeText={set('name')} autoCapitalize="words" />}
      {mode !== 'reset' && <Input placeholder="E-mail" value={f.email} onChangeText={set('email')} keyboardType="email-address" />}
      {mode === 'reset' && <Input placeholder="Code received by e-mail" value={f.code} onChangeText={set('code')} autoCapitalize="characters" />}
      {mode !== 'forgot' && <Input placeholder={mode === 'reset' ? 'New password (8+, letters and digits)' : 'Password'} value={f.password} onChangeText={set('password')} secureTextEntry />}
      <Btn title={title} onPress={submit} />
      {pendingVerify && <View style={s.note}><Text style={s.text}>Dev mode (no mail server): confirm the e-mail here.</Text><Btn title="Verify my e-mail" onPress={verifyNow} /></View>}

      {mode === 'login' && (<>
        {(real.google || real.facebook) && <Text style={s.h2}>Or continue with</Text>}
        {real.google && <Btn alt title="Google" onPress={social.google} />}
        {real.facebook && <Btn alt title="Facebook" onPress={social.facebook} />}
        {cfg?.social_demo && !(real.google && real.facebook) && (<>
          <Text style={s.h2}>Social login (demo, no Google/Facebook keys configured)</Text>
          <Input placeholder="Pick a name, e.g. alice" value={demoName} onChangeText={setDemoName} />
          {!real.google && <Btn alt title="Google (demo)" disabled={!demoName.trim()} onPress={() => socialLogin('google', `dev:${demoName.trim()}`)} />}
          {!real.facebook && <Btn alt title="Facebook (demo)" disabled={!demoName.trim()} onPress={() => socialLogin('facebook', `dev:${demoName.trim()}`)} />}
          <Text style={s.dim}>Real Google/Facebook login activates once you set the client IDs (see README).</Text>
        </>)}
        <View style={{ height: 10 }} />
        <Btn alt title="Create an account" onPress={() => setMode('register')} />
        <Btn alt title="Forgot password?" onPress={() => setMode('forgot')} />
      </>)}
      {mode !== 'login' && <Btn alt title="Back to log in" onPress={() => setMode('login')} />}

      <Text style={s.h2}>Server address</Text>
      <Input value={server} onChangeText={setServer} placeholder="http://192.168.x.x:4000" keyboardType="url" />
      <Btn alt title="Save address" onPress={saveServer} />
    </ScrollView>
  );
}
