import React from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, Alert, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Visual identity inspired by the anime NANA (Ai Yazawa): a punk-rock "noir" theme (Nana O. / Black Stones:
 * black, crimson, silver, studs and tartan) and a "Hachi" theme (soft pink, cream, rounded and cute).
 * Original design only — no artwork from the series is used.
 * `colors` and `s` are mutated in place by applyTheme(), and the root is re-mounted with a new key (see App.js).
 */
export const THEMES = {
  noir: { name: 'noir', label: 'Nana noir', dark: true, bg: '#0a0a0c', card: '#16161a', cardBorder: '#2a2a31', text: '#f4f1ee', dim: '#8e8a90',
    accent: '#d6203a', accentText: '#ffffff', alt: '#24242b', altText: '#d8d4d0', input: '#101013', inputBorder: '#3a3a44', ok: '#22c55e', bad: '#ff5468',
    radius: 3, btnRadius: 2, upper: true, tagline: 'PLAY LOUD · SHARE THE ROOM', logo: '✦' },
  hachi: { name: 'hachi', label: 'Hachi rose', dark: false, bg: '#fff3f6', card: '#ffffff', cardBorder: '#ffd3e0', text: '#3b2230', dim: '#a77c90',
    accent: '#ff5c9a', accentText: '#ffffff', alt: '#ffe1ec', altText: '#a8325f', input: '#ffffff', inputBorder: '#ffb7cf', ok: '#16a34a', bad: '#e11d48',
    radius: 18, btnRadius: 22, upper: false, tagline: 'music is better together ♡', logo: '♡' },
};

export const colors = { ...THEMES.noir };

const build = (c) => ({
  screen: { flex: 1, backgroundColor: c.bg, padding: 16 },
  card: { backgroundColor: c.card, borderRadius: c.radius, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: c.cardBorder, borderLeftWidth: c.upper ? 4 : 1, borderLeftColor: c.accent },
  h1: { color: c.text, fontSize: 22, fontWeight: '900', marginBottom: 12, textTransform: c.upper ? 'uppercase' : 'none', letterSpacing: c.upper ? 2 : 0 },
  h2: { color: c.accent, fontSize: 13, fontWeight: '800', marginVertical: 8, textTransform: c.upper ? 'uppercase' : 'none', letterSpacing: c.upper ? 1.5 : 0.3 },
  text: { color: c.text }, dim: { color: c.dim, fontSize: 12 },
  input: { backgroundColor: c.input, color: c.text, borderRadius: c.btnRadius, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: c.inputBorder },
  btn: { backgroundColor: c.accent, borderRadius: c.btnRadius, padding: 12, alignItems: 'center', marginBottom: 10, borderWidth: 1, borderColor: c.accent },
  btnAlt: { backgroundColor: c.alt, borderColor: c.cardBorder },
  btnText: { color: c.accentText, fontWeight: '800', textTransform: c.upper ? 'uppercase' : 'none', letterSpacing: c.upper ? 1 : 0 },
  btnTextAlt: { color: c.altText },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  err: { color: c.bad, marginBottom: 8 },
  banner: { alignItems: 'center', paddingVertical: 14, marginBottom: 14, borderBottomWidth: 2, borderBottomColor: c.accent },
  bannerLogo: { color: c.accent, fontSize: 26, fontWeight: '900', letterSpacing: c.upper ? 3 : 1, textTransform: c.upper ? 'uppercase' : 'none' },
  bannerTag: { color: c.dim, fontSize: 11, letterSpacing: c.upper ? 3 : 0.5, marginTop: 4 },
  studs: { color: c.accent, letterSpacing: 6, fontSize: 10, marginTop: 6 },
});
export const s = build(colors);

export async function applyTheme(name) {
  const t = THEMES[name] || THEMES.noir;
  Object.assign(colors, t);
  const fresh = build(t);
  for (const k of Object.keys(s)) Object.assign(s[k], fresh[k]);
  try { await AsyncStorage.setItem('theme', t.name); } catch { /* ignore */ }
  return t.name;
}
export async function loadTheme() { try { return await applyTheme((await AsyncStorage.getItem('theme')) || 'noir'); } catch { return 'noir'; } }

export const Banner = () => (
  <View style={s.banner}>
    <Text style={s.bannerLogo}>{colors.logo} Music Room {colors.logo}</Text>
    <Text style={s.bannerTag}>{colors.tagline}</Text>
    {colors.upper && <Text style={s.studs}>◆ ◆ ◆ ◆ ◆ ◆ ◆</Text>}
  </View>);

export const Btn = ({ title, onPress, alt, small, disabled }) => (
  <TouchableOpacity accessibilityRole="button" disabled={disabled} onPress={onPress} style={[s.btn, alt && s.btnAlt, small && { padding: 8, marginBottom: 0, paddingHorizontal: 14 }, disabled && { opacity: 0.4 }]}>
    <Text style={[s.btnText, alt && s.btnTextAlt]}>{title}</Text>
  </TouchableOpacity>);
export const Input = (p) => <TextInput placeholderTextColor={colors.dim} autoCapitalize="none" {...p} style={[s.input, p.style]} />;
export const Loading = () => <ActivityIndicator color={colors.accent} style={{ margin: 20 }} />;
export const notify = (title, msg) => (Platform.OS === 'web' ? window.alert(`${title}${msg ? `\n${msg}` : ''}`) : Alert.alert(title, msg));
/** Runs an async action and shows API errors. */
export const guard = (fn) => async (...a) => { try { return await fn(...a); } catch (e) { notify('Error', e.message); } };

/** Theme switcher used on the login and profile screens. */
export const ThemePicker = ({ onChange }) => (
  <View style={[s.row, { marginBottom: 6 }]}>
    {Object.values(THEMES).map((t) => (
      <Btn key={t.name} small alt={colors.name !== t.name} title={`${t.logo} ${t.label}`} onPress={async () => onChange(await applyTheme(t.name))} />))}
  </View>);
