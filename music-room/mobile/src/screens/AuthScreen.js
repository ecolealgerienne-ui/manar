import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { api, setBaseUrl, state } from '../api';
import { useAuth } from '../auth';
import { Btn, Input, Page, s, guard, notify, colors, useCols } from '../ui';
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
  const wide = useCols() >= 2;
  const Feature = ({ icon, title, text }) => (<View style={[s.row, { marginTop: 18 }]}><View style={{ width: 46, height: 46, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' }}><Ionicons name={icon} size={24} color="#fff" /></View><View style={{ marginLeft: 12, flex: 1 }}><Text style={{ color: '#fff', fontWeight: '800', fontSize: 16 }}>{title}</Text><Text style={{ color: 'rgba(255,255,255,0.85)' }}>{text}</Text></View></View>);
  return (
    <Page>
      <View style={{ flexDirection: wide ? 'row' : 'column', gap: 16, marginTop: wide ? 30 : 0 }}>
        <LinearGradient colors={['#450a0a', '#b91c1c', '#fb7185']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flex: 1, borderRadius: 28, padding: wide ? 24 : 16, justifyContent: 'center' }}>
          <View style={s.row}><Ionicons name="musical-notes" size={40} color="#fff" /><Text style={{ color: '#fff', fontSize: 38, fontWeight: '900', marginLeft: 10 }}>Music Room</Text></View>
          <Text style={{ color: 'rgba(255,255,255,0.9)', fontSize: 16, marginTop: 6 }}>Music, collaboration and mobility.</Text>
          {wide && <>
          <Feature icon="radio" title="Live vote" text="Everyone votes, the best track plays next." />
          <Feature icon="albums" title="Shared playlists" text="Edit together, in real time." />
          <Feature icon="game-controller" title="Delegated control" text="Give a friend the remote of your speaker." />
          </>}
        </LinearGradient>
        <View style={[s.card, { flex: 1, padding: 20, marginBottom: 0 }]}>
          {!cfg && <View style={s.note}><Text style={{ color: '#fde68a' }}>Cannot reach the server at {state.baseUrl}. Start the backend and set its address at the bottom (on a phone use your PC's IP, not localhost).</Text></View>}
          <Text style={[s.h1, { marginBottom: 12 }]}>{title}</Text>
          {mode === 'register' && <Input icon="person" placeholder="Display name" value={f.name} onChangeText={set('name')} autoCapitalize="words" />}
          {mode !== 'reset' && <Input icon="mail" placeholder="E-mail" value={f.email} onChangeText={set('email')} keyboardType="email-address" />}
          {mode === 'reset' && <Input icon="key" placeholder="Code received by e-mail" value={f.code} onChangeText={set('code')} autoCapitalize="characters" />}
          {mode !== 'forgot' && <Input icon="lock-closed" placeholder={mode === 'reset' ? 'New password (8+, letters and digits)' : 'Password'} value={f.password} onChangeText={set('password')} secureTextEntry />}
          <Btn title={title} onPress={submit} />
          {pendingVerify && <View style={s.note}><Text style={{ color: '#fde68a', marginBottom: 8 }}>Dev mode (no mail server): confirm the e-mail here.</Text><Btn icon="checkmark-circle" title="Verify my e-mail" onPress={verifyNow} /></View>}
          {mode === 'login' && (<>
            <View style={s.row}><Btn alt style={{ flex: 1, marginRight: 6 }} title="Create account" onPress={() => setMode('register')} /><Btn alt style={{ flex: 1, marginLeft: 6 }} title="Forgot password?" onPress={() => setMode('forgot')} /></View>
            {(real.google || real.facebook) && <Text style={[s.dim, { marginVertical: 8 }]}>OR CONTINUE WITH</Text>}
            {real.google && <Btn alt icon="logo-google" title="Google" onPress={social.google} />}
            {real.facebook && <Btn alt icon="logo-facebook" title="Facebook" onPress={social.facebook} />}
            {cfg?.social_demo && !(real.google && real.facebook) && (<View style={{ marginTop: 6 }}>
              <Text style={[s.dim, { marginBottom: 6 }]}>SOCIAL LOGIN · DEMO (no Google/Facebook keys configured)</Text>
              <Input icon="person" placeholder="Pick a name, e.g. alice" value={demoName} onChangeText={setDemoName} />
              <View style={s.row}>
                {!real.google && <Btn alt style={{ flex: 1, marginRight: 6 }} icon="logo-google" title="Google (demo)" disabled={!demoName.trim()} onPress={() => socialLogin('google', `dev:${demoName.trim()}`)} />}
                {!real.facebook && <Btn alt style={{ flex: 1, marginLeft: 6 }} icon="logo-facebook" title="Facebook (demo)" disabled={!demoName.trim()} onPress={() => socialLogin('facebook', `dev:${demoName.trim()}`)} />}
              </View></View>)}
          </>)}
          {mode !== 'login' && <Btn alt icon="arrow-back" title="Back to log in" onPress={() => setMode('login')} />}
          <Text style={[s.dim, { marginTop: 12, marginBottom: 6 }]}>SERVER ADDRESS</Text>
          <Input icon="server" value={server} onChangeText={setServer} placeholder="http://192.168.x.x:4000" keyboardType="url" />
          <Btn small alt icon="save" title="Save address" onPress={saveServer} />
        </View>
      </View>
    </Page>
  );
}
