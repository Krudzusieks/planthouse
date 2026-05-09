// plant-batches.tsx
import React, { useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, SafeAreaView,
  ScrollView, TextInput, Alert, ActivityIndicator,
  KeyboardAvoidingView, Platform, FlatList,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import {
  ArrowLeft, Plus, MapPin, ChevronRight, Layers, CheckCircle,
  DollarSign, Wheat, Snowflake, Bug, Wrench, HelpCircle,
  Clock, Users, Search, X, Check, Leaf,
} from 'lucide-react-native';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

interface Plant { id: string; name: string; category_name?: string; category_icon?: string; }
interface Location { id: string; name: string; }
interface Batch {
  id: string; plant_id: string; plant_name: string | null;
  original_quantity: number; current_quantity: number; location: string | null;
  status: 'active' | 'completed'; completed_at: string | null; completion_reason: string | null;
}
type LucideIcon = React.ComponentType<{ size: number; color: string; strokeWidth?: number }>;

const COMPLETION_REASON_META: Record<string, { icon: LucideIcon; color: string }> = {
  'Sold':         { icon: DollarSign, color: '#4CAF50' },
  'Harvested':    { icon: Wheat,      color: '#FFCA28' },
  'Frost damage': { icon: Snowflake,  color: '#29B6F6' },
  'Disease':      { icon: Bug,        color: '#EF5350' },
  'Damaged':      { icon: Wrench,     color: '#FFA726' },
  'Other':        { icon: HelpCircle, color: '#7FAE7A' },
};

interface PickerItem { id: string; label: string; sublabel?: string; icon?: LucideIcon; iconColor?: string; iconEmoji?: string; }

function SearchablePicker({ visible, title, items, selectedId, onConfirm, onClose, searchPlaceholder = 'Search...', noneOption = false, noneLabel = 'None' }:
  { visible: boolean; title: string; items: PickerItem[]; selectedId: string | null; onConfirm: (id: string | null) => void; onClose: () => void; searchPlaceholder?: string; noneOption?: boolean; noneLabel?: string; }) {
  const [query, setQuery] = useState('');
  const [draft, setDraft] = useState<string | null>(selectedId);

  React.useEffect(() => { if (visible) { setDraft(selectedId); setQuery(''); } }, [visible]);

  const filtered = items.filter(item =>
    item.label.toLowerCase().includes(query.toLowerCase()) ||
    (item.sublabel ?? '').toLowerCase().includes(query.toLowerCase())
  );

  if (!visible) return null;

  return (
    <View style={[pickerStyles.overlay, { zIndex: 30 }]}>
      <TouchableOpacity style={pickerStyles.backdrop} activeOpacity={1} onPress={onClose} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ width: '100%', maxHeight: '80%' }}>
        <View style={pickerStyles.box}>
          <View style={pickerStyles.header}><Text style={pickerStyles.title}>{title}</Text></View>
          <View style={pickerStyles.searchRow}>
            <Search size={15} color="#3D5C3A" strokeWidth={2} />
            <TextInput style={pickerStyles.searchInput} placeholder={searchPlaceholder} placeholderTextColor="#3D5C3A"
              value={query} onChangeText={setQuery} autoCorrect={false} autoCapitalize="none" />
            {query.length > 0 && (
              <TouchableOpacity onPress={() => setQuery('')} style={pickerStyles.clearBtn}>
                <X size={14} color="#3D5C3A" strokeWidth={2.5} />
              </TouchableOpacity>
            )}
          </View>
          {noneOption && (
            <TouchableOpacity style={[pickerStyles.item, draft === null && pickerStyles.itemSelected]} onPress={() => setDraft(null)}>
              <View style={pickerStyles.itemLeft}>
                <View style={[pickerStyles.itemIconBox, { backgroundColor: '#1E2E1E' }]}>
                  <Text style={{ color: '#3D5C3A', fontSize: 16, fontWeight: '700' }}>—</Text>
                </View>
                <Text style={[pickerStyles.itemLabel, draft === null && pickerStyles.itemLabelSelected]}>{noneLabel}</Text>
              </View>
              {draft === null && <Check size={16} color="#4CAF50" strokeWidth={3} />}
            </TouchableOpacity>
          )}
          <FlatList
            data={filtered} keyExtractor={item => item.id} style={pickerStyles.list}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={<View style={pickerStyles.emptyState}><Text style={pickerStyles.emptyText}>No results for "{query}"</Text></View>}
            renderItem={({ item }) => {
              const selected = draft === item.id;
              const IC = item.icon;
              return (
                <TouchableOpacity style={[pickerStyles.item, selected && pickerStyles.itemSelected]} onPress={() => setDraft(item.id)} activeOpacity={0.7}>
                  <View style={pickerStyles.itemLeft}>
                    {item.iconEmoji ? (
                      <View style={[pickerStyles.itemIconBox, selected && pickerStyles.itemIconBoxSelected]}>
                        <Text style={{ fontSize: 18 }}>{item.iconEmoji}</Text>
                      </View>
                    ) : IC ? (
                      <View style={[pickerStyles.itemIconBox, selected && pickerStyles.itemIconBoxSelected]}>
                        <IC size={18} color={selected ? '#4CAF50' : (item.iconColor ?? '#7FAE7A')} strokeWidth={2} />
                      </View>
                    ) : null}
                    <View style={{ flex: 1 }}>
                      <Text style={[pickerStyles.itemLabel, selected && pickerStyles.itemLabelSelected]}>{item.label}</Text>
                      {item.sublabel ? <Text style={pickerStyles.itemSublabel}>{item.sublabel}</Text> : null}
                    </View>
                  </View>
                  <View style={[pickerStyles.checkbox, selected && pickerStyles.checkboxSelected]}>
                    {selected && <Check size={13} color="#fff" strokeWidth={3} />}
                  </View>
                </TouchableOpacity>
              );
            }}
          />
          <View style={pickerStyles.buttons}>
            <TouchableOpacity style={pickerStyles.cancelBtn} onPress={onClose}>
              <Text style={pickerStyles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[pickerStyles.confirmBtn, (!noneOption && draft === null) && pickerStyles.confirmBtnDisabled]}
              onPress={() => onConfirm(draft)} disabled={!noneOption && draft === null}>
              <Text style={pickerStyles.confirmBtnText}>Confirm</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

export default function PlantBatchesScreen() {
  const router = useRouter();
  const { profile, company } = useAuth();
  const isBoss = profile?.role === 'boss' || profile?.role === 'manager';

  const [plants, setPlants]       = useState<Plant[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [batches, setBatches]     = useState<Batch[]>([]);
  const [loading, setLoading]     = useState(true);
  const [batchFilter, setBatchFilter] = useState<'active' | 'completed'>('active');

  const [createVisible, setCreateVisible]     = useState(false);
  const [batchPlantId, setBatchPlantId]       = useState<string | null>(null);
  const [batchLocationId, setBatchLocationId] = useState<string | null>(null);
  const [batchQuantity, setBatchQuantity]     = useState('');
  const [batchLoading, setBatchLoading]       = useState(false);

  const [plantPickerVisible, setPlantPickerVisible]       = useState(false);
  const [locationPickerVisible, setLocationPickerVisible] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const companyId = company?.id;
    if (!companyId) { setLoading(false); return; }

    const [{ data: plantData }, { data: locData }] = await Promise.all([
      supabase.from('plants').select('id, name, plant_categories(name, icon)').eq('company_id', companyId).order('name'),
      supabase.from('locations').select('id, name').eq('company_id', companyId).order('name'),
    ]);

    if (plantData) setPlants(plantData.map((p: any) => ({
      id: p.id, name: p.name,
      category_name: p.plant_categories?.name ?? null,
      category_icon: p.plant_categories?.icon ?? null,
    })));
    if (locData) setLocations(locData);

    if (isBoss) {
      const { data: batchData } = await supabase
        .from('plant_batches')
        .select('id, plant_id, original_quantity, current_quantity, location, status, completed_at, completion_reason, plants!plant_id (name)')
        .eq('company_id', companyId).eq('status', batchFilter).order('created_at', { ascending: false });
      if (batchData) setBatches(batchData.map((b: any) => ({
        id: b.id, plant_id: b.plant_id, plant_name: b.plants?.name || 'Unknown',
        original_quantity: b.original_quantity, current_quantity: b.current_quantity,
        location: b.location, status: b.status,
        completed_at: b.completed_at ?? null, completion_reason: b.completion_reason ?? null,
      })));
    } else {
      const { data: jobData } = await supabase.from('jobs').select('batch_id')
        .eq('assigned_to', profile?.id).in('status', ['not_started', 'in_progress']).not('batch_id', 'is', null);
      const batchIds = [...new Set((jobData ?? []).map((j: any) => j.batch_id))];
      if (batchIds.length === 0) { setBatches([]); setLoading(false); return; }
      const { data: batchData } = await supabase.from('plant_batches')
        .select('id, plant_id, original_quantity, current_quantity, location, status, completed_at, completion_reason, plants!plant_id (name)')
        .in('id', batchIds).eq('status', 'active');
      if (batchData) setBatches(batchData.map((b: any) => ({
        id: b.id, plant_id: b.plant_id, plant_name: b.plants?.name || 'Unknown',
        original_quantity: b.original_quantity, current_quantity: b.current_quantity,
        location: b.location, status: b.status,
        completed_at: b.completed_at ?? null, completion_reason: b.completion_reason ?? null,
      })));
    }
    setLoading(false);
  }, [company?.id, profile?.id, isBoss, batchFilter]);

  useFocusEffect(useCallback(() => { fetchData(); }, [fetchData]));

  const plantPickerItems: PickerItem[] = plants.map(p => ({
    id: p.id, label: p.name,
    sublabel: p.category_name ?? undefined,
    iconEmoji: p.category_icon ?? '🌿',
  }));

  const locationPickerItems: PickerItem[] = locations.map(l => ({
    id: l.id, label: l.name, icon: MapPin, iconColor: '#29B6F6',
  }));

  const selectedPlant    = plants.find(p => p.id === batchPlantId);
  const selectedLocation = locations.find(l => l.id === batchLocationId);

  const resetForm = () => { setBatchPlantId(null); setBatchLocationId(null); setBatchQuantity(''); };

  const handleAddBatch = async () => {
    if (!batchPlantId)           return Alert.alert('Required', 'Please select a plant type.');
    if (!batchQuantity.trim())   return Alert.alert('Required', 'Enter quantity.');
    const qty = parseInt(batchQuantity);
    if (isNaN(qty) || qty <= 0) return Alert.alert('Invalid', 'Quantity must be a positive number.');
    setBatchLoading(true);
    const { error } = await supabase.from('plant_batches').insert({
      company_id: company?.id, plant_id: batchPlantId,
      original_quantity: qty, current_quantity: qty,
      location: selectedLocation?.name ?? null, status: 'active',
    });
    setBatchLoading(false);
    if (error) { Alert.alert('Error', error.message); return; }
    Alert.alert('Success', 'Plant batch created!');
    resetForm(); setCreateVisible(false); fetchData();
  };

  const handleDeleteBatch = (batch: Batch) => {
    Alert.alert('Delete Batch', `Delete batch of "${batch.plant_name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        const { error } = await supabase.from('plant_batches').delete().eq('id', batch.id);
        if (error) Alert.alert('Error', error.message); else fetchData();
      }},
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

  if (loading) return (
    <View style={{ flex: 1, backgroundColor: '#0E1A12', alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator color="#4CAF50" size="large" />
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={[styles.blob, styles.blob1]} />
      <SafeAreaView style={{ flex: 1 }}>

        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
            <ArrowLeft size={20} color="#7FAE7A" strokeWidth={2.5} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Plant Batches</Text>
          {isBoss && (
            <TouchableOpacity onPress={() => setCreateVisible(true)} style={styles.addBtn}>
              <Plus size={15} color="#fff" strokeWidth={2.5} />
              <Text style={styles.addBtnText}>Batch</Text>
            </TouchableOpacity>
          )}
        </View>

        {isBoss && (
          <TouchableOpacity style={styles.categoriesLink} onPress={() => router.push('/locations')}>
            <View style={styles.categoriesLinkIconBox}><MapPin size={18} color="#29B6F6" strokeWidth={2} /></View>
            <Text style={styles.categoriesLinkText}>Manage Locations</Text>
            <ChevronRight size={16} color="#4CAF50" strokeWidth={2.5} />
          </TouchableOpacity>
        )}

        {isBoss && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}
            style={{ maxHeight: 48 }} contentContainerStyle={styles.filterRow}>
            {([
              { key: 'active', label: 'Active', icon: Clock },
              { key: 'completed', label: 'Completed', icon: CheckCircle },
            ] as const).map(f => {
              const IC = f.icon;
              const active = batchFilter === f.key;
              return (
                <TouchableOpacity key={f.key} style={[styles.filterChip, active && styles.filterChipActive]}
                  onPress={() => setBatchFilter(f.key)}>
                  <IC size={13} color={active ? '#4CAF50' : '#7FAE7A'} strokeWidth={2} />
                  <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>{f.label}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}

        {!isBoss && (
          <View style={styles.workerBanner}>
            <Users size={14} color="#7FAE7A" strokeWidth={2} />
            <Text style={styles.workerBannerText}>Showing batches from your active jobs</Text>
          </View>
        )}

        <ScrollView contentContainerStyle={styles.list}>
          {batches.length === 0 ? (
            <View style={styles.emptyState}>
              {batchFilter === 'completed'
                ? <CheckCircle size={52} color="#3D5C3A" strokeWidth={1.5} />
                : <Layers size={52} color="#3D5C3A" strokeWidth={1.5} />
              }
              <Text style={styles.emptyText}>
                {isBoss ? batchFilter === 'completed' ? 'No completed batches yet' : 'No active batches' : 'No batches assigned to you'}
              </Text>
              <Text style={styles.emptySubtext}>
                {isBoss
                  ? batchFilter === 'completed' ? 'Completed batches will appear here' : 'Tap "+ Batch" to add your first plant batch'
                  : 'Batches appear here when a boss assigns you a job on a batch'}
              </Text>
            </View>
          ) : batches.map(batch => {
            const fillColor   = getFillColor(batch.current_quantity, batch.original_quantity);
            const fillRatio   = batch.original_quantity > 0 ? batch.current_quantity / batch.original_quantity : 0;
            const isCompleted = batch.status === 'completed';
            const reasonMeta  = batch.completion_reason
              ? (COMPLETION_REASON_META[batch.completion_reason] ?? { icon: CheckCircle, color: '#4CAF50' }) : null;
            return (
              <TouchableOpacity key={batch.id}
                style={[styles.batchCard, isCompleted && styles.batchCardCompleted]}
                onPress={() => router.push(`/batch-show?id=${batch.id}`)}
                onLongPress={() => isBoss && handleDeleteBatch(batch)} activeOpacity={0.75}>
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
                            {batch.completion_reason}{batch.completed_at ? `  ·  ${formatCompletedDate(batch.completed_at)}` : ''}
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
                  {[['ORIGINAL', batch.original_quantity, '#E8F5E0'], ['CURRENT', batch.current_quantity, fillColor], ['REMOVED', batch.original_quantity - batch.current_quantity, '#EF5350']].map(([label, value, color], i) => (
                    <React.Fragment key={String(label)}>
                      {i > 0 && <View style={styles.quantityDivider} />}
                      <View style={styles.quantityItem}>
                        <Text style={styles.quantityLabel}>{String(label)}</Text>
                        <Text style={[styles.quantityValue, { color: String(color) }]}>{String(value)}</Text>
                      </View>
                    </React.Fragment>
                  ))}
                </View>
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: `${Math.round(fillRatio * 100)}%` as any, backgroundColor: isCompleted ? '#3D5C3A' : fillColor }]} />
                </View>
                {isBoss && <Text style={styles.longPressHint}>Long press to delete</Text>}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </SafeAreaView>

      {/* Create Panel — zIndex 10 */}
      {createVisible && (
        <View style={[sharedStyles.overlay, { zIndex: 10 }]}>
          <TouchableOpacity style={sharedStyles.backdrop} activeOpacity={1}
            onPress={() => { resetForm(); setCreateVisible(false); }} />
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ width: '100%' }}>
            <View style={sharedStyles.sheet}>
              <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 24, paddingBottom: 48 }}>

                <Text style={styles.panelTitle}>New Plant Batch</Text>

                {/* Plant selector */}
                <Text style={styles.panelLabel}>PLANT TYPE *</Text>
                <TouchableOpacity style={styles.selectorBtn} onPress={() => setPlantPickerVisible(true)}>
                  <View style={styles.selectorBtnLeft}>
                    <View style={styles.selectorBtnIconBox}>
                      {selectedPlant
                        ? <Text style={{ fontSize: 18 }}>{selectedPlant.category_icon ?? '🌿'}</Text>
                        : <Leaf size={18} color="#7FAE7A" strokeWidth={2} />
                      }
                    </View>
                    {!selectedPlant ? (
                      <Text style={styles.selectorBtnPlaceholder}>Tap to select a plant...</Text>
                    ) : (
                      <View style={{ flex: 1 }}>
                        <Text style={styles.selectorBtnValue}>{selectedPlant.name}</Text>
                        {selectedPlant.category_name && <Text style={styles.selectorBtnSub}>{selectedPlant.category_name}</Text>}
                      </View>
                    )}
                  </View>
                  <ChevronRight size={18} color="#4CAF50" strokeWidth={2.5} />
                </TouchableOpacity>

                {/* Quantity */}
                <Text style={styles.panelLabel}>QUANTITY *</Text>
                <TextInput style={styles.panelInput} placeholder="e.g. 40" placeholderTextColor="#3D5C3A"
                  value={batchQuantity} onChangeText={setBatchQuantity} keyboardType="numeric" />

                {/* Location selector */}
                <Text style={styles.panelLabel}>LOCATION (optional)</Text>
                <TouchableOpacity style={styles.selectorBtn} onPress={() => setLocationPickerVisible(true)}>
                  <View style={styles.selectorBtnLeft}>
                    <View style={styles.selectorBtnIconBox}>
                      <MapPin size={18} color={selectedLocation ? '#29B6F6' : '#7FAE7A'} strokeWidth={2} />
                    </View>
                    {!selectedLocation
                      ? <Text style={styles.selectorBtnPlaceholder}>Tap to select a location...</Text>
                      : <Text style={styles.selectorBtnValue}>{selectedLocation.name}</Text>
                    }
                  </View>
                  <ChevronRight size={18} color="#4CAF50" strokeWidth={2.5} />
                </TouchableOpacity>

                <View style={styles.panelButtons}>
                  <TouchableOpacity style={styles.panelCancel} onPress={() => { resetForm(); setCreateVisible(false); }}>
                    <Text style={styles.panelCancelText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.panelConfirm, batchLoading && styles.disabled]}
                    onPress={handleAddBatch} disabled={batchLoading}>
                    {batchLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.panelConfirmText}>Add Batch</Text>}
                  </TouchableOpacity>
                </View>

              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </View>
      )}

      {/* Plant Picker — zIndex 30 */}
      <SearchablePicker visible={plantPickerVisible} title="Select Plant"
        items={plantPickerItems} selectedId={batchPlantId}
        searchPlaceholder="Search by plant name or category..."
        onConfirm={id => { setBatchPlantId(id); setPlantPickerVisible(false); }}
        onClose={() => setPlantPickerVisible(false)} />

      {/* Location Picker — zIndex 30 */}
      <SearchablePicker visible={locationPickerVisible} title="Select Location"
        items={locationPickerItems} selectedId={batchLocationId}
        searchPlaceholder="Search locations..."
        noneOption noneLabel="No location"
        onConfirm={id => { setBatchLocationId(id); setLocationPickerVisible(false); }}
        onClose={() => setLocationPickerVisible(false)} />

    </View>
  );
}

const sharedStyles = StyleSheet.create({
  overlay:  { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' },
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  sheet:    { backgroundColor: '#162018', borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: '90%' },
});

const pickerStyles = StyleSheet.create({
  overlay:  { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' },
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  box:      { backgroundColor: '#162018', borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingTop: 24, paddingBottom: 32 },
  header:   { paddingHorizontal: 24, marginBottom: 16 },
  title:    { color: '#E8F5E0', fontSize: 20, fontWeight: '800' },
  searchRow:  { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#0E1A12', borderWidth: 1.5, borderColor: '#243524', borderRadius: 14, marginHorizontal: 20, marginBottom: 12, paddingHorizontal: 14, paddingVertical: 2 },
  searchInput:{ flex: 1, color: '#E8F5E0', fontSize: 15, paddingVertical: 12 },
  clearBtn:   { padding: 6 },
  list:       { maxHeight: 340 },
  emptyState: { alignItems: 'center', paddingVertical: 40 },
  emptyText:  { color: '#3D5C3A', fontSize: 14 },
  item:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#1A2A1A' },
  itemSelected: { backgroundColor: 'rgba(76,175,80,0.08)' },
  itemLeft:   { flexDirection: 'row', alignItems: 'center', gap: 14, flex: 1 },
  itemIconBox:{ width: 40, height: 40, borderRadius: 12, backgroundColor: '#0E1A12', alignItems: 'center', justifyContent: 'center' },
  itemIconBoxSelected: { backgroundColor: 'rgba(76,175,80,0.15)' },
  itemLabel:  { color: '#E8F5E0', fontSize: 15, fontWeight: '600' },
  itemLabelSelected: { color: '#4CAF50' },
  itemSublabel: { color: '#3D5C3A', fontSize: 12, marginTop: 2 },
  checkbox:   { width: 24, height: 24, borderRadius: 8, borderWidth: 1.5, borderColor: '#243524', alignItems: 'center', justifyContent: 'center' },
  checkboxSelected: { backgroundColor: '#4CAF50', borderColor: '#4CAF50' },
  buttons:    { flexDirection: 'row', gap: 12, paddingHorizontal: 20, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#1A2A1A', marginTop: 4 },
  cancelBtn:  { flex: 1, borderWidth: 1.5, borderColor: '#243524', borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  cancelBtnText: { color: '#7FAE7A', fontWeight: '600', fontSize: 15 },
  confirmBtn: { flex: 1, backgroundColor: '#4CAF50', borderRadius: 14, paddingVertical: 16, alignItems: 'center', shadowColor: '#4CAF50', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  confirmBtnDisabled: { opacity: 0.4 },
  confirmBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});

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
  batchIconBox:       { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  batchName:          { color: '#E8F5E0', fontSize: 17, fontWeight: '700' },
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
  panelTitle:       { color: '#E8F5E0', fontSize: 20, fontWeight: '800', marginBottom: 16 },
  panelLabel:       { color: '#3D5C3A', fontSize: 11, fontWeight: '700', letterSpacing: 1.5, marginBottom: 8 },
  panelInput:       { backgroundColor: '#0E1A12', borderWidth: 1.5, borderColor: '#243524', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 14, color: '#E8F5E0', fontSize: 15, marginBottom: 16 },
  panelButtons:     { flexDirection: 'row', gap: 12, marginTop: 8 },
  panelCancel:      { flex: 1, borderWidth: 1.5, borderColor: '#243524', borderRadius: 12, paddingVertical: 16, alignItems: 'center' },
  panelCancelText:  { color: '#7FAE7A', fontWeight: '600', fontSize: 15 },
  panelConfirm:     { flex: 1, backgroundColor: '#4CAF50', borderRadius: 12, paddingVertical: 16, alignItems: 'center' },
  panelConfirmText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  disabled:         { opacity: 0.5 },
  selectorBtn:            { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#0E1A12', borderWidth: 1.5, borderColor: '#243524', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, marginBottom: 16 },
  selectorBtnLeft:        { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  selectorBtnIconBox:     { width: 32, height: 32, borderRadius: 8, backgroundColor: '#162018', alignItems: 'center', justifyContent: 'center' },
  selectorBtnPlaceholder: { color: '#3D5C3A', fontSize: 15 },
  selectorBtnValue:       { color: '#E8F5E0', fontSize: 15, fontWeight: '600', flex: 1 },
  selectorBtnSub:         { color: '#7FAE7A', fontSize: 12, marginTop: 2 },
});