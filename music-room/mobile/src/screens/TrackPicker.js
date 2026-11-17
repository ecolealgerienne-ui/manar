import React, { useState } from 'react';
import { FlatList, Text, View } from 'react-native';
import { api } from '../api';
import { Btn, Input, s, guard } from '../ui';

/** Search tracks on the back-end catalog; calls onPick(track). */
export default function TrackPicker({ onPick, label = 'Add' }) {
  const [q, setQ] = useState(''), [res, setRes] = useState([]);
  const search = guard(async () => setRes(q.trim() ? await api('GET', `/tracks/search?q=${encodeURIComponent(q.trim())}`) : []));
  return (
    <View>
      <Input placeholder="Search a track or artist" value={q} onChangeText={setQ} onSubmitEditing={search} returnKeyType="search" />
      <Btn title="Search" onPress={search} small />
      <FlatList scrollEnabled={false} data={res} keyExtractor={(t) => t.id} renderItem={({ item }) => (
        <View style={[s.card, s.row]}>
          <View style={{ flex: 1 }}><Text style={s.text}>{item.title}</Text><Text style={s.dim}>{item.artist}</Text></View>
          <Btn small title={label} onPress={() => onPick(item)} />
        </View>)} />
    </View>
  );
}
