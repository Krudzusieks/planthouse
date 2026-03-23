// plant-batches.tsx
import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TextInput,
  Modal,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { useRouter, useFocusEffect } from 'expo-router';
import {
  ArrowLeft, Plus, MapPin, ChevronRight, Layers,
  CheckCircle, DollarSign, Wheat, Snowflake,
  Bug, Wrench, HelpCircle, Clock, Users,
} from 'lucide-react-native';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Plant {
  id: string;
  name: string;
}

interface Location {
  id: string;
  name: string;
}

interface Batch {
  id: string;
  plant_id: string;
  plant_name: string | null;
  original_quantity: number;
  current_quantity: number;
  location: string | null;
  status: 'active' | 'completed';
  completed_at: string | null;
  completion_reason: string | null;
}

type LucideIcon = React.ComponentType<{ size: number; color: string; strokeWidth?: number }>;

interface CompletionReasonDef {
  icon: LucideIcon;
  color: string;
}

const COMPLETION_REASON_META: Record<string, CompletionReasonDef> = {
  'Sold':         { icon: DollarSign, color: '#4CAF50' },
  'Harvested':    { icon: Wheat,      color: '#FFCA28' },
  'Frost damage': { icon: Snowflake,  color: '#29B6F6' },
  'Disease':      { icon: Bug,        color: '#EF5350' },
  'Damaged':      { icon: Wrench,     color: '#FFA726' },
  'Other':        { icon: HelpCircle, color: '#7FAE7A' },
};

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function PlantBatchesScreen() {
  const router = useRouter();
  const { profile, company } = useAuth();
  const isBoss = profile?.role === 'boss' || profile?.role === 'manager';

  const [plants, setPlants]       = useState<Plant[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [batches, setBatches]     = useState<Batch[]>([]);
  const [loading, setLoading]     = useState(true);
  const [batchFilter, setBatchFilter] = useState<'active' | 'completed'>('active');

  const [modalVisible, setModalVisible]                   = useState(false);
  const [batchPlantId, setBatchPlantId]                   = useState<string | null>(null);
  const [batchLocationId, setBatchLocationId]             = useState<string | null>(null);
  const [batchQuantity, setBatchQuantity]                 = useState('');
  const [batchLoading, setBatchLoading]                   = useState(false);

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const fetchData = async () => {
    setLoading(true);
    const companyId = company?.id;
    if (!companyId) { setLoading(false); return; }

    const [{ data: plantData }, { data: locData }] = await Promise.all([
      supabase.from('plants').select('id, name').eq('company_id', companyId).order('name'),
      supabase.from('locations').select('id, name').eq('company_id', companyId).order('name'),
    ]);
    if (plantData) setPlants(plantData);
    if (locData)   setLocations(locData);

    if (isBoss) {
      const { data: batchData } = await supabase
        .from('plant_batches')
        .select(`id, plant_id, original_quantity, current_quantity, location, status, completed_at, completion_reason, plants!plant_id (name)`)
        .eq('company_id', companyId)
        .eq('status', batchFilter)
        .order('created_at', { ascending: false });

      if (batchData) {
        setBatches(batchData.map((b: any) => ({
          id: b.id, plant_id: b.plant_id, plant_name: b.plants?.name || 'Unknown',
          original_quantity: b.original_quantity, current_quantity: b.current_quantity,
          location: b.location, status: b.status,
          completed_at: b.completed_at ?? null, completion_reason: b.completion_reason ?? null,
        })));
      }
    } else {
      const { data: jobData } = await supabase
        .from('jobs').select('batch_id')
        .eq('assigned_to', profile?.id)
        .in('status', ['not_started', 'in_progress'])
        .not('batch_id', 'is', null);

      const batchIds = [...new Set((jobData ?? []).map((j: any) => j.batch_id))];
      if (batchIds.length === 0) { setBatches([]); setLoading(false); return; }

      const { data: batchData } = await supabase
        .from('plant_batches')
        .select(`id, plant_id, original_quantity, current_quantity, location, status, completed_at, completion_reason, plants!plant_id (name)`)
        .in('id', batchIds)
        .eq('status', 'active');

      if (batchData) {
        setBatches(batchData.map((b: any) => ({
          id: b.id, plant_id: b.plant_id, plant_name: b.plants?.name || 'Unknown',
          original_quantity: b.original_quantity, current_quantity: b.current_quantity,
          location: b.location, status: b.status,
          completed_at: b.completed_at ?? null, completion_reason: b.completion_reason ?? null,
        })));
      }
    }

    setLoading(false);
  };

  useFocusEffect(useCallback(() => { fetchData(); }, [company?.id, profile?.id, isBoss, batchFilter]));

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleAddBatch = async () => {
    if (!batchPlantId) return Alert.alert('Required', 'Please select a plant type.');
    if (!batchQuantity.trim()) return Alert.alert('Required', 'Enter quantity.');

    const qty = parseInt(batchQuantity);
    if (isNaN(qty) || qty <= 0)
      return Alert.alert('Invalid', 'Quantity must be a positive number.');

    setBatchLoading(true);
    const selectedLocation = locations.find(l => l.id === batchLocationId)?.name || null;
    const { error } = await supabase.from('plant_batches').insert({
      company_id:        company?.id,
      plant_id:          batchPlantId,
      original_quantity: qty,
      current_quantity:  qty,   // always equal on creation
      location:          selectedLocation,
      status:            'active',
    });
    setBatchLoading(false);

    if (error) { Alert.alert('Error', error.message); return; }

    Alert.alert('Success', 'Plant batch created!');
    setBatchPlantId(null);
    setBatchLocationId(null);
    setBatchQuantity('');
    setModalVisible(false);
    fetchData();
  };

  const handleDeleteBatch = (batch: Batch) => {
    Alert.alert('Delete Batch', `Delete batch of "${batch.plant_name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.from('plant_batches').delete().eq('id', batch.id);
          if (error) Alert.alert('Error', error.message);
          else fetchData();
        },
      },
    ]);
  };

  const getFillColor = (current: number, original: number) => {
    const ratio = original > 0 ? current / original : 0;
    if (ratio > 0.6) return '#4CAF50';
    if (ratio > 0.3) return '#FFA726';
    return '#EF5350';
  };

  const formatCompletedDate = (iso: string) =>
    new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

  // ── Render ─────────────────────────────────────────────────────────────────

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

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
            <ArrowLeft size={20} color="#7FAE7A" strokeWidth={2.5} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Plant Batches</Text>
          {isBoss && (
            <TouchableOpacity onPress={() => setModalVisible(true)} style={styles.addBtn}>
              <Plus size={15} color="#fff" strokeWidth={2.5} />
              <Text style={styles.addBtnText}>Batch</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Locations shortcut */}
        {isBoss && (
          <TouchableOpacity style={styles.categoriesLink} onPress={() => router.push('/locations')}>
            <View style={styles.categoriesLinkIconBox}>
              <MapPin size={18} color="#29B6F6" strokeWidth={2} />
            </View>
            <Text style={styles.categoriesLinkText}>Manage Locations</Text>
            <ChevronRight size={16} color="#4CAF50" strokeWidth={2.5} />
          </TouchableOpacity>
        )}

        {/* Active / Completed filter */}
        {isBoss && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}
            style={{ maxHeight: 48 }} contentContainerStyle={styles.filterRow}>
            {([
              { key: 'active',    label: 'Active',    icon: Clock       },
              { key: 'completed', label: 'Completed', icon: CheckCircle },
            ] as const).map(f => {
              const IC = f.icon;
              const active = batchFilter === f.key;
              return (
                <TouchableOpacity key={f.key}
                  style={[styles.filterChip, active && styles.filterChipActive]}
                  onPress={() => setBatchFilter(f.key)}>
                  <IC size={13} color={active ? '#4CAF50' : '#7FAE7A'} strokeWidth={2} />
                  <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>{f.label}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}

        {/* Worker banner */}
        {!isBoss && (
          <View style={styles.workerBanner}>
            <Users size={14} color="#7FAE7A" strokeWidth={2} />
            <Text style={styles.workerBannerText}>Showing batches from your active jobs</Text>
          </View>
        )}

        {/* Batch list */}
        <ScrollView contentContainerStyle={styles.list}>
          {batches.length === 0 ? (
            <View style={styles.emptyState}>
              {batchFilter === 'completed'
                ? <CheckCircle size={52} color="#3D5C3A" strokeWidth={1.5} />
                : <Layers size={52} color="#3D5C3A" strokeWidth={1.5} />
              }
              <Text style={styles.emptyText}>
                {isBoss
                  ? batchFilter === 'completed' ? 'No completed batches yet' : 'No active batches'
                  : 'No batches assigned to you'}
              </Text>
              <Text style={styles.emptySubtext}>
                {isBoss
                  ? batchFilter === 'completed'
                    ? 'Completed batches will appear here'
                    : 'Tap "+ Batch" to add your first plant batch'
                  : 'Batches appear here when a boss assigns you a job on a batch'}
              </Text>
            </View>
          ) : (
            batches.map(batch => {
              const fillColor   = getFillColor(batch.current_quantity, batch.original_quantity);
              const fillRatio   = batch.original_quantity > 0 ? batch.current_quantity / batch.original_quantity : 0;
              const isCompleted = batch.status === 'completed';
              const reasonMeta  = batch.completion_reason
                ? (COMPLETION_REASON_META[batch.completion_reason] ?? { icon: CheckCircle, color: '#4CAF50' })
                : null;

              return (
                <TouchableOpacity
                  key={batch.id}
                  style={[styles.batchCard, isCompleted && styles.batchCardCompleted]}
                  onPress={() => router.push(`/batch-show?id=${batch.id}`)}
                  onLongPress={() => isBoss && handleDeleteBatch(batch)}
                  activeOpacity={0.75}
                >
                  <View style={styles.batchCardTop}>
                    <View style={styles.batchCardLeft}>
                      <View style={[styles.batchIconBox, { backgroundColor: isCompleted ? 'rgba(76,175,80,0.1)' : 'rgba(102,187,106,0.15)' }]}>
                        <Layers size={22} color={isCompleted ? '#4CAF50' : '#66BB6A'} strokeWidth={1.75} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.batchName}>{batch.plant_name}</Text>
                        {batch.location && (
                          <View style={styles.batchLocationRow}>
                            <MapPin size={11} color="#7FAE7A" strokeWidth={2} />
                            <Text style={styles.batchLocation}>{batch.location}</Text>
                          </View>
                        )}
                        {isCompleted && batch.completion_reason && reasonMeta && (
                          <View style={styles.batchCompletedReasonRow}>
                            {React.createElement(reasonMeta.icon, { size: 11, color: reasonMeta.color, strokeWidth: 2 })}
                            <Text style={[styles.batchCompletedReason, { color: reasonMeta.color }]}>
                              {batch.completion_reason}
                              {batch.completed_at ? `  ·  ${formatCompletedDate(batch.completed_at)}` : ''}
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>

                    {isCompleted ? (
                      <View style={styles.completedBadge}>
                        <CheckCircle size={12} color="#4CAF50" strokeWidth={2.5} />
                        <Text style={styles.completedBadgeText}>Done</Text>
                      </View>
                    ) : (
                      <ChevronRight size={18} color="#4CAF50" strokeWidth={2.5} />
                    )}
                  </View>

                  <View style={styles.quantityRow}>
                    <View style={styles.quantityItem}>
                      <Text style={styles.quantityLabel}>ORIGINAL</Text>
                      <Text style={styles.quantityValue}>{batch.original_quantity}</Text>
                    </View>
                    <View style={styles.quantityDivider} />
                    <View style={styles.quantityItem}>
                      <Text style={styles.quantityLabel}>CURRENT</Text>
                      <Text style={[styles.quantityValue, { color: fillColor }]}>{batch.current_quantity}</Text>
                    </View>
                    <View style={styles.quantityDivider} />
                    <View style={styles.quantityItem}>
                      <Text style={styles.quantityLabel}>REMOVED</Text>
                      <Text style={[styles.quantityValue, { color: '#EF5350' }]}>
                        {batch.original_quantity - batch.current_quantity}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.progressTrack}>
                    <View style={[
                      styles.progressFill,
                      { width: `${Math.round(fillRatio * 100)}%` as any, backgroundColor: isCompleted ? '#3D5C3A' : fillColor },
                    ]} />
                  </View>

                  {isBoss && <Text style={styles.longPressHint}>Long press to delete</Text>}
                </TouchableOpacity>
              );
            })
          )}
        </ScrollView>

        {/* Add Batch Modal */}
        <Modal visible={modalVisible} animationType="slide" transparent>
          <View style={styles.modalOverlay}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ width: '100%' }}>
              <ScrollView keyboardShouldPersistTaps="handled">
                <View style={styles.modalBox}>
                  <View style={styles.modalTitleRow}>
                    <Layers size={20} color="#66BB6A" strokeWidth={2} />
                    <Text style={styles.modalTitle}>New Plant Batch</Text>
                  </View>

                  <Text style={styles.modalLabel}>PLANT TYPE *</Text>
                  <Picker
                    selectedValue={batchPlantId}
                    onValueChange={v => setBatchPlantId(v)}
                    style={styles.picker}
                  >
                    <Picker.Item label="Select plant..." value={null} />
                    {plants.sort((a, b) => a.name.localeCompare(b.name)).map(p => (
                      <Picker.Item key={p.id} label={p.name} value={p.id} />
                    ))}
                  </Picker>

                  <Text style={styles.modalLabel}>QUANTITY *</Text>
                  <TextInput
                    style={styles.modalInput}
                    placeholder="e.g. 40"
                    placeholderTextColor="#3D5C3A"
                    value={batchQuantity}
                    onChangeText={setBatchQuantity}
                    keyboardType="numeric"
                  />

                  <Text style={styles.modalLabel}>LOCATION (optional)</Text>
                  <Picker
                    selectedValue={batchLocationId}
                    onValueChange={v => setBatchLocationId(v)}
                    style={styles.picker}
                  >
                    <Picker.Item label="No location" value={null} />
                    {locations.map(l => (
                      <Picker.Item key={l.id} label={l.name} value={l.id} />
                    ))}
                  </Picker>

                  <View style={styles.modalButtons}>
                    <TouchableOpacity style={styles.modalCancel} onPress={() => {
                      setModalVisible(false);
                      setBatchPlantId(null);
                      setBatchLocationId(null);
                      setBatchQuantity('');
                    }}>
                      <Text style={styles.modalCancelText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.modalConfirm} onPress={handleAddBatch} disabled={batchLoading}>
                      {batchLoading
                        ? <ActivityIndicator color="#fff" />
                        : <Text style={styles.modalConfirmText}>Add Batch</Text>
                      }
                    </TouchableOpacity>
                  </View>
                </View>
              </ScrollView>
            </KeyboardAvoidingView>
          </View>
        </Modal>

      </SafeAreaView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0E1A12' },
  blob:  { position: 'absolute', borderRadius: 999, opacity: 0.1 },
  blob1: { width: 350, height: 350, backgroundColor: '#3D8B37', top: -100, right: -120 },

  header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12 },
  headerBtn:   { padding: 4 },
  headerTitle: { color: '#E8F5E0', fontSize: 20, fontWeight: '800' },
  addBtn:      { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#4CAF50', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 },
  addBtnText:  { color: '#fff', fontWeight: '700', fontSize: 14 },

  categoriesLink:        { flexDirection: 'row', alignItems: 'center', backgroundColor: '#162018', borderWidth: 1, borderColor: '#243524', borderRadius: 14, padding: 16, marginHorizontal: 20, marginBottom: 12, gap: 12 },
  categoriesLinkIconBox: { width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(41,182,246,0.1)', alignItems: 'center', justifyContent: 'center' },
  categoriesLinkText:    { flex: 1, color: '#E8F5E0', fontSize: 15, fontWeight: '600' },

  filterRow:            { paddingHorizontal: 20, gap: 8, paddingBottom: 8, paddingTop: 2 },
  filterChip:           { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: '#243524', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8 },
  filterChipActive:     { borderColor: '#4CAF50', backgroundColor: 'rgba(76,175,80,0.15)' },
  filterChipText:       { color: '#7FAE7A', fontSize: 13 },
  filterChipTextActive: { color: '#4CAF50', fontWeight: '700' },

  workerBanner:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: 'rgba(76,175,80,0.1)', borderWidth: 1, borderColor: 'rgba(76,175,80,0.3)', borderRadius: 12, marginHorizontal: 20, marginBottom: 12, padding: 12 },
  workerBannerText: { color: '#7FAE7A', fontSize: 13 },

  list:         { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 40 },
  emptyState:   { alignItems: 'center', paddingTop: 80, gap: 12 },
  emptyText:    { color: '#7FAE7A', fontSize: 18, fontWeight: '700' },
  emptySubtext: { color: '#3D5C3A', fontSize: 14, textAlign: 'center', paddingHorizontal: 20 },

  batchCard:          { backgroundColor: '#162018', borderRadius: 16, borderWidth: 1, borderColor: '#243524', padding: 16, marginBottom: 12 },
  batchCardCompleted: { borderColor: 'rgba(76,175,80,0.25)', opacity: 0.85 },
  batchCardTop:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  batchCardLeft:      { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },

  batchIconBox: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  batchName:    { color: '#E8F5E0', fontSize: 17, fontWeight: '700' },

  batchLocationRow:        { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  batchLocation:           { color: '#7FAE7A', fontSize: 12 },
  batchCompletedReasonRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 },
  batchCompletedReason:    { fontSize: 12, fontWeight: '600' },

  completedBadge:     { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(76,175,80,0.15)', borderWidth: 1, borderColor: '#4CAF50', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  completedBadgeText: { color: '#4CAF50', fontSize: 11, fontWeight: '700' },

  quantityRow:     { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 12, backgroundColor: '#0E1A12', borderRadius: 12, borderWidth: 1, borderColor: '#243524', paddingVertical: 10 },
  quantityItem:    { alignItems: 'center', flex: 1 },
  quantityLabel:   { color: '#3D5C3A', fontSize: 9, fontWeight: '700', letterSpacing: 1, marginBottom: 3 },
  quantityValue:   { color: '#E8F5E0', fontSize: 18, fontWeight: '800' },
  quantityDivider: { width: 1, backgroundColor: '#243524' },

  progressTrack: { height: 4, backgroundColor: '#243524', borderRadius: 2, overflow: 'hidden', marginBottom: 6 },
  progressFill:  { height: '100%', borderRadius: 2 },
  longPressHint: { color: '#243524', fontSize: 10, textAlign: 'right' },

  modalOverlay:  { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalBox:      { backgroundColor: '#162018', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 },
  modalTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 20 },
  modalTitle:    { color: '#E8F5E0', fontSize: 20, fontWeight: '800' },
  modalLabel:    { color: '#3D5C3A', fontSize: 11, fontWeight: '700', letterSpacing: 1.5, marginBottom: 8 },
  modalInput:    { backgroundColor: '#0E1A12', borderWidth: 1.5, borderColor: '#243524', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 14, color: '#E8F5E0', fontSize: 15, marginBottom: 16 },
  picker:        { backgroundColor: '#0E1A12', borderWidth: 1.5, borderColor: '#243524', borderRadius: 12, color: '#E8F5E0', marginBottom: 16, padding: 12 },
  modalButtons:  { flexDirection: 'row', gap: 12, marginTop: 8 },
  modalCancel:   { flex: 1, borderWidth: 1.5, borderColor: '#243524', borderRadius: 12, paddingVertical: 16, alignItems: 'center' },
  modalCancelText:  { color: '#7FAE7A', fontWeight: '600' },
  modalConfirm:     { flex: 1, backgroundColor: '#4CAF50', borderRadius: 12, paddingVertical: 16, alignItems: 'center' },
  modalConfirmText: { color: '#fff', fontWeight: '700' },
});