import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, SafeAreaView,
  ScrollView, TextInput, Modal, Alert, ActivityIndicator,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

interface Location { id: string; name: string; }

export default function LocationsScreen() {
  const router = useRouter();
  const { profile, company } = useAuth();
  const isBoss = profile?.role === 'boss' || profile?.role === 'manager';

  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [locName, setLocName] = useState('');
  const [locLoading, setLocLoading] = useState(false);

  const fetchLocations = async () => {
    setLoading(true);
    const companyId = company?.id;
    if (!companyId) { setLoading(false); return; }
    const { data, error } = await supabase
      .from('locations').select('*').eq('company_id', companyId).order('name');
    if (error) Alert.alert('Error', error.message);
    else if (data) setLocations(data);
    setLoading(false);
  };

  useFocusEffect(useCallback(() => { fetchLocations(); }, [company?.id]));

  const handleAddLocation = async () => {
    if (!locName.trim()) return Alert.alert('Required', 'Enter a location name.');
    setLocLoading(true);
    const { error } = await supabase.from('locations').insert({
      company_id: company?.id, name: locName.trim(),
    });
    setLocLoading(false);
    if (error) { Alert.alert('Error', error.message); return; }
    Alert.alert('Success', 'Location added!');
    setLocName(''); setModalVisible(false); fetchLocations();
  };

  const handleDeleteLocation = (loc: Location) => {
    Alert.alert('Delete Location', `Delete "${loc.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.from('locations').delete().eq('id', loc.id);
          if (error) Alert.alert('Error', error.message);
          else fetchLocations();
        },
      },
    ]);
  };

  if (!isBoss) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0E1A12', alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: '#7FAE7A', fontSize: 16 }}>Access denied</Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0E1A12', alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color="#4CAF50" size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.blob, styles.blob1]} />
      <SafeAreaView style={{ flex: 1 }}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Locations 🗺️</Text>
        </View>

        <ScrollView contentContainerStyle={styles.list}>
          {locations.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>🗺️</Text>
              <Text style={styles.emptyText}>No locations yet</Text>
              <Text style={styles.emptySubtext}>Tap "+" to create your first location (e.g., Sector 1)</Text>
            </View>
          ) : (
            locations.map(loc => (
              <View key={loc.id} style={styles.locCard}>
                <Text style={styles.locName}>{loc.name}</Text>
                <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDeleteLocation(loc)}>
                  <Text style={styles.deleteBtnText}>Delete</Text>
                </TouchableOpacity>
              </View>
            ))
          )}
        </ScrollView>

        <TouchableOpacity style={styles.fab} onPress={() => setModalVisible(true)}>
          <Text style={styles.fabText}>+</Text>
        </TouchableOpacity>

        <Modal visible={modalVisible} animationType="slide" transparent>
          <View style={styles.modalOverlay}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
              <View style={styles.modalBox}>
                <Text style={styles.modalTitle}>New Location</Text>
                <Text style={styles.modalLabel}>Name *</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="e.g. Sector 1, Greenhouse A, Storage..."
                  placeholderTextColor="#3D5C3A"
                  value={locName}
                  onChangeText={setLocName}
                  autoFocus
                />
                <View style={styles.modalButtons}>
                  <TouchableOpacity style={styles.modalCancel} onPress={() => setModalVisible(false)}>
                    <Text style={styles.modalCancelText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.modalConfirm} onPress={handleAddLocation} disabled={locLoading}>
                    {locLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.modalConfirmText}>Add Location</Text>}
                  </TouchableOpacity>
                </View>
              </View>
            </KeyboardAvoidingView>
          </View>
        </Modal>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0E1A12' },
  blob: { position: 'absolute', borderRadius: 999, opacity: 0.1 },
  blob1: { width: 350, height: 350, backgroundColor: '#3D8B37', top: -100, right: -120 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12 },
  backText: { color: '#7FAE7A', fontSize: 16 },
  headerTitle: { color: '#E8F5E0', fontSize: 20, fontWeight: '800' },
  list: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 40 },
  emptyState: { alignItems: 'center', paddingTop: 80 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { color: '#7FAE7A', fontSize: 18, fontWeight: '700', marginBottom: 6 },
  emptySubtext: { color: '#3D5C3A', fontSize: 14, textAlign: 'center' },
  locCard: { backgroundColor: '#162018', borderRadius: 16, borderWidth: 1, borderColor: '#243524', padding: 16, marginBottom: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  locName: { color: '#E8F5E0', fontSize: 17, fontWeight: '700' },
  deleteBtn: { borderWidth: 1, borderColor: '#ff4444', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  deleteBtnText: { color: '#ff4444', fontSize: 13, fontWeight: '600' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalBox: { backgroundColor: '#162018', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 },
  modalTitle: { color: '#E8F5E0', fontSize: 20, fontWeight: '800', marginBottom: 20 },
  modalLabel: { color: '#7FAE7A', fontSize: 12, fontWeight: '600', letterSpacing: 0.5, marginBottom: 6 },
  modalInput: { backgroundColor: '#0E1A12', borderWidth: 1.5, borderColor: '#243524', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 14, color: '#E8F5E0', fontSize: 15, marginBottom: 16 },
  modalButtons: { flexDirection: 'row', gap: 12, marginTop: 8 },
  modalCancel: { flex: 1, borderWidth: 1.5, borderColor: '#243524', borderRadius: 12, paddingVertical: 16, alignItems: 'center' },
  modalCancelText: { color: '#7FAE7A', fontWeight: '600' },
  modalConfirm: { flex: 1, backgroundColor: '#4CAF50', borderRadius: 12, paddingVertical: 16, alignItems: 'center' },
  modalConfirmText: { color: '#fff', fontWeight: '700' },
  fab: { position: 'absolute', right: 20, bottom: 20, backgroundColor: '#4CAF50', width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center', elevation: 6, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 3 },
  fabText: { color: '#fff', fontSize: 28, fontWeight: 'bold' },
});