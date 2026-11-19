import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Modal, ScrollView, Image, Animated, useWindowDimensions, RefreshControl } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { state as apiState } from './api';

/* ---------- design tokens: dark, saturated, lots of gradients ---------- */
export const colors = { bg: '#12060a', surface: '#1f0c12', surface2: '#2e121b', border: '#4d1c28', text: '#ffffff', dim: '#e0a8b3',
  accent: '#e11d48', pink: '#fb7185', cyan: '#fda4af', green: '#34d399', orange: '#fb923c', red: '#f87171', yellow: '#fde047' };
export const GRADS = [['#7f1d1d', '#ef4444'], ['#9f1239', '#fb7185'], ['#b91c1c', '#f97316'], ['#be123c', '#f43f5e'], ['#991b1b', '#e11d48'], ['#c2410c', '#ef4444'], ['#881337', '#e11d48'], ['#dc2626', '#fb923c']];
export const RED = ['#7f1d1d', '#dc2626', '#fb7185'];
export const grad = (seed) => { const s = String(seed); let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return GRADS[h % GRADS.length]; };
export const fullUrl = (u) => (!u ? u : /^https?:/.test(u) ? u : apiState.baseUrl + u);

export const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  card: { backgroundColor: colors.surface, borderRadius: 18, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: colors.border },
  h1: { color: colors.text, fontSize: 26, fontWeight: '800', letterSpacing: -0.5 },
  h2: { color: colors.text, fontSize: 18, fontWeight: '800' },
  h3: { color: colors.text, fontSize: 15, fontWeight: '700' },
  text: { color: colors.text, fontSize: 15 }, dim: { color: colors.dim, fontSize: 12 },
  input: { backgroundColor: colors.surface2, color: colors.text, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 10, borderWidth: 1, borderColor: colors.border },
  row: { flexDirection: 'row', alignItems: 'center' }, between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  note: { backgroundColor: '#3d1a05', borderRadius: 14, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: '#a16207' },
});

/** Centered max-width page that fills wide screens with a responsive grid (see Grid). */
export const useCols = (max = 4) => { const { width } = useWindowDimensions(); return Math.min(max, width < 560 ? 1 : width < 900 ? 2 : width < 1250 ? 3 : 4); };
export function Page({ children, onRefresh, refreshing, style }) {
  return (
    <ScrollView style={s.screen} contentContainerStyle={{ alignItems: 'center', paddingBottom: 40 }} keyboardShouldPersistTaps="handled"
      refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={colors.accent} /> : undefined}>
      <View style={[{ width: '100%', maxWidth: 1240, padding: 16 }, style]}>{children}</View>
    </ScrollView>);
}
export function Grid({ children, cols, min = 1 }) {
  const auto = useCols(); const c = Math.max(min, cols || auto);
  const items = React.Children.toArray(children);
  return (<View style={{ flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -6 }}>
    {items.map((ch, i) => <View key={i} style={{ width: `${100 / c}%`, padding: 6 }}>{ch}</View>)}</View>);
}
export const Section = ({ title, action, onAction, children, icon }) => (
  <View style={{ marginTop: 22, marginBottom: 6 }}>
    <View style={[s.between, { marginBottom: 10 }]}>
      <View style={s.row}>{icon && <Ionicons name={icon} size={20} color={colors.accent} style={{ marginRight: 8 }} />}<Text style={s.h2}>{title}</Text></View>
      {action && <TouchableOpacity onPress={onAction}><Text style={{ color: colors.cyan, fontWeight: '700' }}>{action} ›</Text></TouchableOpacity>}
    </View>{children}
  </View>);

/* ---------- atoms ---------- */
export const Btn = ({ title, onPress, alt, small, disabled, icon, color, style }) => (
  <TouchableOpacity accessibilityRole="button" accessibilityLabel={title} disabled={disabled} onPress={onPress} activeOpacity={0.8} style={[{ borderRadius: 14, overflow: 'hidden', marginBottom: small ? 0 : 10, opacity: disabled ? 0.4 : 1 }, style]}>
    {alt ? (
      <View style={[s.row, { justifyContent: 'center', backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.border, paddingVertical: small ? 7 : 12, paddingHorizontal: small ? 12 : 16 }]}>
        {icon && <Ionicons name={icon} size={small ? 15 : 18} color={color || colors.text} style={title ? { marginRight: 6 } : null} />}
        {!!title && <Text style={{ color: color || colors.text, fontWeight: '700', fontSize: small ? 13 : 15 }}>{title}</Text>}
      </View>) : (
      <LinearGradient colors={color ? [color, color] : ['#b91c1c', '#f43f5e']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[s.row, { justifyContent: 'center', paddingVertical: small ? 7 : 12, paddingHorizontal: small ? 12 : 16 }]}>
        {icon && <Ionicons name={icon} size={small ? 15 : 18} color="#fff" style={title ? { marginRight: 6 } : null} />}
        {!!title && <Text style={{ color: '#fff', fontWeight: '800', fontSize: small ? 13 : 15 }}>{title}</Text>}
      </LinearGradient>)}
  </TouchableOpacity>);
export const IconBtn = ({ name, onPress, size = 22, color = colors.text, bg = colors.surface2, big, disabled }) => (
  <TouchableOpacity accessibilityRole="button" accessibilityLabel={name} disabled={disabled} onPress={onPress} activeOpacity={0.7}
    style={{ width: big ? 64 : 38, height: big ? 64 : 38, borderRadius: 32, backgroundColor: bg, alignItems: 'center', justifyContent: 'center', opacity: disabled ? 0.35 : 1 }}>
    <Ionicons name={name} size={big ? 30 : size} color={color} /></TouchableOpacity>);
export const Input = ({ icon, ...p }) => (
  <View style={[s.row, s.input, { paddingVertical: 0 }]}>
    {icon && <Ionicons name={icon} size={18} color={colors.dim} style={{ marginRight: 8 }} />}
    <TextInput placeholderTextColor={colors.dim} autoCapitalize="none" {...p} style={[{ flex: 1, color: colors.text, paddingVertical: 12, outlineStyle: 'none' }, p.style]} />
  </View>);
export const Loading = () => <ActivityIndicator color={colors.accent} size="large" style={{ margin: 30 }} />;
/* ---------- in-app dialogs and toasts (work identically on web and native; RN's Alert does not exist on web) ---------- */
let host = null;
/** Ask for confirmation before a destructive action. Resolves true/false. */
export const confirmAction = (title, message, { confirmText = 'Confirm', danger = true } = {}) => (host ? host.confirm({ title, message, confirmText, danger }) : Promise.resolve(true));
/** Non-blocking message at the bottom of the screen (type: 'success' | 'error' | 'info'). */
export const notify = (title, message, type) => { host?.toast({ title, message, type: type || (title === 'Error' ? 'error' : 'success') }); };
export const guard = (fn) => async (...a) => { try { return await fn(...a); } catch (e) { notify('Error', e.message, 'error'); } };

export function DialogHost() {
  const [dlg, setDlg] = useState(null), [toast, setToast] = useState(null), timer = useRef(null);
  useEffect(() => {
    host = {
      confirm: (o) => new Promise((res) => setDlg({ ...o, res })),
      toast: (o) => { setToast(o); clearTimeout(timer.current); timer.current = setTimeout(() => setToast(null), o.type === 'error' ? 5000 : 2800); },
    };
    return () => { host = null; clearTimeout(timer.current); };
  }, []);
  const close = (v) => { dlg?.res(v); setDlg(null); };
  const tc = toast ? (toast.type === 'error' ? colors.red : toast.type === 'info' ? colors.cyan : colors.green) : colors.green;
  return (<>
    <Modal transparent visible={!!dlg} animationType="fade" onRequestClose={() => close(false)}>
      <View style={{ flex: 1, backgroundColor: 'rgba(5,5,15,0.75)', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        <View style={{ width: '100%', maxWidth: 420, backgroundColor: colors.surface, borderRadius: 22, padding: 22, borderWidth: 1, borderColor: colors.border }}>
          <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: dlg?.danger ? 'rgba(248,113,113,0.18)' : 'rgba(225,29,72,0.22)', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
            <Ionicons name={dlg?.danger ? 'warning' : 'help-circle'} size={28} color={dlg?.danger ? colors.red : colors.accent} /></View>
          <Text style={[s.h2, { marginBottom: 6 }]}>{dlg?.title}</Text>
          {!!dlg?.message && <Text style={{ color: colors.dim, fontSize: 14, marginBottom: 18 }}>{dlg.message}</Text>}
          <Btn title={dlg?.confirmText || 'Confirm'} color={dlg?.danger ? '#dc2626' : undefined} onPress={() => close(true)} />
          <Btn alt title="Cancel" onPress={() => close(false)} style={{ marginBottom: 0 }} />
        </View>
      </View>
    </Modal>
    {toast && (
      <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, bottom: 84, alignItems: 'center', paddingHorizontal: 16 }}>
        <View style={{ maxWidth: 480, width: '100%', backgroundColor: colors.surface2, borderRadius: 16, padding: 14, flexDirection: 'row', alignItems: 'center', borderLeftWidth: 5, borderLeftColor: tc, borderWidth: 1, borderColor: colors.border }}>
          <Ionicons name={toast.type === 'error' ? 'alert-circle' : 'checkmark-circle'} size={24} color={tc} style={{ marginRight: 10 }} />
          <View style={{ flex: 1 }}><Text style={{ color: '#fff', fontWeight: '800' }}>{toast.title}</Text>{!!toast.message && <Text style={{ color: colors.dim, marginTop: 2 }}>{toast.message}</Text>}</View>
        </View></View>)}
  </>);
}

export const Badge = ({ icon, text, color = colors.accent }) => (
  <View style={[s.row, { backgroundColor: 'rgba(0,0,0,0.35)', borderRadius: 20, paddingHorizontal: 9, paddingVertical: 4, marginRight: 6, marginBottom: 4 }]}>
    {icon && <Ionicons name={icon} size={12} color={color} style={{ marginRight: 4 }} />}<Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>{text}</Text></View>);
export const Seg = ({ options, value, onChange }) => (
  <View style={{ flexDirection: 'row', backgroundColor: colors.surface2, borderRadius: 14, padding: 3, marginBottom: 10, flexWrap: 'wrap' }}>
    {options.map(([k, label, icon]) => (
      <TouchableOpacity key={String(k)} onPress={() => onChange(k)} style={{ flex: 1, minWidth: 80, paddingVertical: 9, borderRadius: 11, alignItems: 'center', backgroundColor: value === k ? colors.accent : 'transparent' }}>
        <View style={s.row}>{icon && <Ionicons name={icon} size={14} color="#fff" style={{ marginRight: 5 }} />}<Text style={{ color: value === k ? '#fff' : colors.dim, fontWeight: '700', fontSize: 13 }}>{label}</Text></View>
      </TouchableOpacity>))}
  </View>);
export const Chip = ({ label, active, onPress, icon }) => (
  <TouchableOpacity onPress={onPress} style={[s.row, { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, marginRight: 8, backgroundColor: active ? colors.accent : colors.surface2, borderWidth: 1, borderColor: active ? colors.accent : colors.border }]}>
    {icon && <Ionicons name={icon} size={14} color="#fff" style={{ marginRight: 5 }} />}<Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>{label}</Text></TouchableOpacity>);
export const Avatar = ({ name = '?', size = 40 }) => (
  <LinearGradient colors={grad(name)} style={{ width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center' }}>
    <Text style={{ color: '#fff', fontWeight: '800', fontSize: size * 0.42 }}>{name.trim()[0]?.toUpperCase() || '?'}</Text></LinearGradient>);
export const Empty = ({ icon = 'musical-notes', text }) => (
  <View style={{ alignItems: 'center', padding: 24 }}><Ionicons name={icon} size={40} color={colors.border} /><Text style={[s.dim, { marginTop: 8, textAlign: 'center' }]}>{text}</Text></View>);

/** Square cover: real image if available, otherwise a gradient generated from the title. */
export function Cover({ track, size = 52, radius = 12, uri, title }) {
  const t = title || track?.title || '?', u = uri || track?.cover;
  if (u) return <Image source={{ uri: u }} style={{ width: size, height: size, borderRadius: radius, backgroundColor: colors.surface2 }} />;
  return (<LinearGradient colors={grad(t)} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ width: size, height: size, borderRadius: radius, alignItems: 'center', justifyContent: 'center' }}>
    <Ionicons name="musical-note" size={size * 0.45} color="rgba(255,255,255,0.85)" /></LinearGradient>);
}
export function Mosaic({ covers = [], size = 96, seed }) {
  const n = Math.max(covers.length, 1), half = size / 2;
  if (covers.length < 2) return <Cover track={covers[0]} title={covers[0]?.title || seed} size={size} radius={16} />;
  return (<View style={{ width: size, height: size, borderRadius: 16, overflow: 'hidden', flexDirection: 'row', flexWrap: 'wrap' }}>
    {[0, 1, 2, 3].map((i) => <Cover key={i} track={covers[i % n]} size={half} radius={0} />)}</View>);
}
export function Live({ label = 'LIVE' }) {
  const a = useRef(new Animated.Value(1)).current;
  useEffect(() => { const l = Animated.loop(Animated.sequence([Animated.timing(a, { toValue: 0.2, duration: 700, useNativeDriver: true }), Animated.timing(a, { toValue: 1, duration: 700, useNativeDriver: true })])); l.start(); return () => l.stop(); }, [a]);
  return (<View style={[s.row, { backgroundColor: 'rgba(239,68,68,0.9)', borderRadius: 12, paddingHorizontal: 8, paddingVertical: 3 }]}>
    <Animated.View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: '#fff', marginRight: 5, opacity: a }} /><Text style={{ color: '#fff', fontWeight: '800', fontSize: 10 }}>{label}</Text></View>);
}
/** Little animated equaliser shown next to what is playing. */
export function Equalizer({ playing = true, color = colors.green }) {
  const bars = useRef([0, 1, 2].map(() => new Animated.Value(0.3))).current;
  useEffect(() => {
    if (!playing) { bars.forEach((b) => b.setValue(0.3)); return undefined; }
    const loops = bars.map((b, i) => Animated.loop(Animated.sequence([Animated.timing(b, { toValue: 1, duration: 300 + i * 120, useNativeDriver: false }), Animated.timing(b, { toValue: 0.25, duration: 300 + i * 90, useNativeDriver: false })])));
    loops.forEach((l) => l.start()); return () => loops.forEach((l) => l.stop());
  }, [playing, bars]);
  return (<View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 16, marginRight: 8 }}>
    {bars.map((b, i) => <Animated.View key={i} style={{ width: 3, marginRight: 2, borderRadius: 2, backgroundColor: color, height: b.interpolate({ inputRange: [0, 1], outputRange: [3, 16] }) }} />)}</View>);
}

/* ---------- cards ---------- */
const LIC = { open: ['people', 'Everyone votes'], invited: ['mail', 'Invited only'], geo_time: ['location', 'Place & time'] };
export const licenceLabel = (l) => LIC[l] || LIC.open;
export function EventCard({ e, onPress }) {
  return (
    <TouchableOpacity activeOpacity={0.88} onPress={onPress}>
      <LinearGradient colors={grad(`e${e.id}${e.name}`)} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: 20, padding: 14, minHeight: 170 }}>
        <View style={[s.between, { alignItems: 'flex-start' }]}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', flex: 1 }}>
            <Badge icon={e.visibility === 'public' ? 'earth' : 'lock-closed'} text={e.visibility === 'public' ? 'Public' : 'Private'} />
            <Badge icon={LIC[e.license][0]} text={LIC[e.license][1]} />
          </View>{e.now_playing ? <Live /> : null}
        </View>
        <View style={[s.row, { marginTop: 10, alignItems: 'flex-end' }]}>
          <View style={{ flex: 1, paddingRight: 10 }}>
            <Text style={{ color: '#fff', fontSize: 22, fontWeight: '900' }} numberOfLines={2}>{e.name}</Text>
            <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12, marginTop: 2 }}>by {e.owner_name}</Text>
          </View>
          <Mosaic covers={e.covers} size={72} seed={e.name} />
        </View>
        <View style={[s.row, { marginTop: 10 }]}>
          {e.now_playing ? (<><Equalizer color="#fff" /><Text style={{ color: '#fff', flex: 1, fontWeight: '700' }} numberOfLines={1}>{e.now_playing}</Text></>) : <Text style={{ color: 'rgba(255,255,255,0.75)', flex: 1 }}>Nothing playing yet</Text>}
          <Badge icon="list" text={`${e.queue_count}`} /><Badge icon="heart" text={`${e.votes_count}`} />
        </View>
      </LinearGradient>
    </TouchableOpacity>);
}
export function PlaylistCard({ p, onPress }) {
  return (
    <TouchableOpacity activeOpacity={0.88} onPress={onPress} style={[s.card, s.row, { padding: 12 }]}>
      <Mosaic covers={p.covers} size={86} seed={p.name} />
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Text style={s.h3} numberOfLines={1}>{p.name}</Text>
        <Text style={s.dim}>by {p.owner_name} · {p.track_count} track{p.track_count === 1 ? '' : 's'}</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 }}>
          <Badge icon={p.visibility === 'public' ? 'earth' : 'lock-closed'} text={p.visibility === 'public' ? 'Public' : 'Private'} color={colors.cyan} />
          <Badge icon={p.edit_license === 'open' ? 'create' : 'mail'} text={p.edit_license === 'open' ? 'Everyone edits' : 'Invited edit'} color={colors.pink} />
          {p.collaborators > 0 && <Badge icon="people" text={`${p.collaborators}`} color={colors.green} />}
        </View>
      </View>
      <Ionicons name="chevron-forward" size={20} color={colors.dim} />
    </TouchableOpacity>);
}
export const Stat = ({ icon, value, label, colors: g, onPress }) => (
  <TouchableOpacity activeOpacity={0.85} onPress={onPress} style={{ flex: 1, minWidth: 130 }}>
    <LinearGradient colors={g} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: 18, padding: 14 }}>
      <Ionicons name={icon} size={22} color="rgba(255,255,255,0.9)" />
      <Text style={{ color: '#fff', fontSize: 30, fontWeight: '900', marginTop: 6 }}>{value}</Text>
      <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 12, fontWeight: '700' }}>{label}</Text>
    </LinearGradient></TouchableOpacity>);
