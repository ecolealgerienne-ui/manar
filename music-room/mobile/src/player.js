import { useEffect, useState } from 'react';
import { Audio } from 'expo-av';
import { fullUrl } from './ui';

/* One-off preview (tap ▶ on a track) */
let sound = null, current = null;
const listeners = new Set();
const emit = () => listeners.forEach((f) => f(current));
export async function stopPreview() { const s = sound; sound = null; current = null; emit(); if (s) { try { await s.stopAsync(); await s.unloadAsync(); } catch { /* ignore */ } } }
export async function togglePreview(track) {
  if (!track?.preview_url) throw new Error('No audio preview for this track');
  if (current === track.track_id || current === track.id) return stopPreview();
  await stopPreview();
  const { sound: s } = await Audio.Sound.createAsync({ uri: fullUrl(track.preview_url) }, { shouldPlay: true });
  sound = s; current = track.track_id || track.id; emit();
  s.setOnPlaybackStatusUpdate((st) => { if (st.didJustFinish) stopPreview(); });
}
export function usePreviewId() { const [id, setId] = useState(current); useEffect(() => { listeners.add(setId); return () => listeners.delete(setId); }, []); return id; }

/* "This device is the speaker": plays what the (remote-controlled) device state says */
let dev = null, devTrack = null;
export async function stopDevice() { const d = dev; dev = null; devTrack = null; if (d) { try { await d.stopAsync(); await d.unloadAsync(); } catch { /* ignore */ } } }
export async function applyDeviceState(st, onEnded) {
  const cur = st.queue?.[st.index ?? 0];
  if (!cur?.preview_url) { await stopDevice(); return; }
  if (!dev || devTrack !== cur.id) {
    await stopDevice();
    const { sound: s } = await Audio.Sound.createAsync({ uri: fullUrl(cur.preview_url) }, { shouldPlay: !!st.playing, volume: (st.volume ?? 50) / 100, positionMillis: st.positionMs || 0 });
    dev = s; devTrack = cur.id;
    s.setOnPlaybackStatusUpdate((x) => { if (x.didJustFinish && onEnded) onEnded(); });
    return;
  }
  await dev.setVolumeAsync((st.volume ?? 50) / 100);
  if (st.playing) await dev.playAsync(); else await dev.pauseAsync();
}
