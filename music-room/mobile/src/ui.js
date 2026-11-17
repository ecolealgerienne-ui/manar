import React from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, Platform } from 'react-native';

// Plain, basic look: white background, system font, one blue accent.
export const colors = { bg: '#ffffff', card: '#f4f5f7', border: '#d9dce1', text: '#111827', dim: '#6b7280', accent: '#2563eb', bad: '#dc2626' };
export const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, padding: 16 },
  card: { backgroundColor: colors.card, borderRadius: 8, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: colors.border },
  h1: { color: colors.text, fontSize: 22, fontWeight: '700', marginBottom: 10 },
  h2: { color: colors.text, fontSize: 15, fontWeight: '600', marginTop: 14, marginBottom: 6 },
  text: { color: colors.text, fontSize: 15 }, dim: { color: colors.dim, fontSize: 12 },
  input: { backgroundColor: '#fff', color: colors.text, borderRadius: 8, padding: 10, marginBottom: 8, borderWidth: 1, borderColor: colors.border },
  btn: { backgroundColor: colors.accent, borderRadius: 8, padding: 11, alignItems: 'center', marginBottom: 8 },
  btnAlt: { backgroundColor: '#e5e7eb' }, btnText: { color: '#fff', fontWeight: '600' }, btnTextAlt: { color: colors.text },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  note: { backgroundColor: '#fef9c3', borderRadius: 8, padding: 10, marginBottom: 8, borderWidth: 1, borderColor: '#fde047' },
});
export const Btn = ({ title, onPress, alt, small, disabled }) => (
  <TouchableOpacity accessibilityRole="button" disabled={disabled} onPress={onPress} style={[s.btn, alt && s.btnAlt, small && { padding: 7, marginBottom: 0, paddingHorizontal: 12 }, disabled && { opacity: 0.4 }]}>
    <Text style={[s.btnText, alt && s.btnTextAlt]}>{title}</Text>
  </TouchableOpacity>);
export const Input = (p) => <TextInput placeholderTextColor={colors.dim} autoCapitalize="none" {...p} style={[s.input, p.style]} />;
export const Loading = () => <ActivityIndicator color={colors.accent} style={{ margin: 20 }} />;
export const notify = (title, msg) => (Platform.OS === 'web' ? window.alert(`${title}${msg ? `\n${msg}` : ''}`) : Alert.alert(title, msg));
/** Runs an async action and shows API errors. */
export const guard = (fn) => async (...a) => { try { return await fn(...a); } catch (e) { notify('Error', e.message); } };
