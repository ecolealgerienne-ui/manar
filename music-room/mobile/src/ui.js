import React from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, Platform } from 'react-native';

export const colors = { bg: '#0f0f14', card: '#1b1b25', text: '#f2f2f7', dim: '#9a9aaf', accent: '#8b5cf6', ok: '#22c55e', bad: '#ef4444' };
export const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, padding: 16 },
  card: { backgroundColor: colors.card, borderRadius: 12, padding: 12, marginBottom: 10 },
  h1: { color: colors.text, fontSize: 22, fontWeight: '700', marginBottom: 12 },
  h2: { color: colors.text, fontSize: 16, fontWeight: '600', marginVertical: 8 },
  text: { color: colors.text }, dim: { color: colors.dim, fontSize: 12 },
  input: { backgroundColor: colors.card, color: colors.text, borderRadius: 10, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: '#2b2b3a' },
  btn: { backgroundColor: colors.accent, borderRadius: 10, padding: 12, alignItems: 'center', marginBottom: 10 },
  btnAlt: { backgroundColor: '#2b2b3a' }, btnText: { color: '#fff', fontWeight: '600' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  err: { color: colors.bad, marginBottom: 8 },
});
export const Btn = ({ title, onPress, alt, small, disabled }) => (
  <TouchableOpacity accessibilityRole="button" disabled={disabled} onPress={onPress} style={[s.btn, alt && s.btnAlt, small && { padding: 8, marginBottom: 0, paddingHorizontal: 14 }, disabled && { opacity: 0.4 }]}>
    <Text style={s.btnText}>{title}</Text>
  </TouchableOpacity>);
export const Input = (p) => <TextInput placeholderTextColor={colors.dim} autoCapitalize="none" {...p} style={[s.input, p.style]} />;
export const Loading = () => <ActivityIndicator color={colors.accent} style={{ margin: 20 }} />;
export const notify = (title, msg) => (Platform.OS === 'web' ? window.alert(`${title}${msg ? `\n${msg}` : ''}`) : Alert.alert(title, msg));
/** Runs an async action and shows API errors. */
export const guard = (fn) => async (...a) => { try { return await fn(...a); } catch (e) { notify('Error', e.message); } };
