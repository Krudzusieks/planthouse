import React, { useCallback, useState } from 'react';
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
import { useRouter } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

interface Category {
  id: string;
  name: string;
  icon: string;
}

interface Plant {
  id: string;
  name: string;
  category_id: string | null;
  grow_duration_days: number | null;
  watering_interval_days: number | null;
  watering_amount_ml: number | null;
  fertilizing_interval_days: number | null;
}

export default function PlantsScreen() {
  const router = useRouter();
  const { profile, company } = useAuth();
  const isBoss = profile?.role === 'boss' || profile?.role === 'manager';

  const [categories, setCategories] = useState<Category[]>([]);
  const [plants, setPlants] = useState<Plant[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const [modalVisible, setModalVisible] = useState(false);
  const [plantName, setPlantName] = useState('');
  const [plantCategory, setPlantCategory] = useState<string | null>(null);
  const [plantCareManual, setPlantCareManual] = useState('');
  const [plantGrowDays, setPlantGrowDays] = useState('');
  const [plantWaterDays, setPlantWaterDays] = useState('');
  const [plantWaterMl, setPlantWaterMl] = useState('');
  const [plantFertDays, setPlantFertDays] = useState('');
  const [plantNotes, setPlantNotes] = useState('');
  const [plantLoading, setPlantLoading] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    const companyId = company?.id;
    if (!companyId) { setLoading(false); return; }

    const [{ data: cats }, { data: ps }] = await Promise.all([
      supabase.from('plant_categories').select('*').eq('company_id', companyId).order('name'),
      supabase
        .from('plants')
        .select('id, name, category_id, grow_duration_days, watering_interval_days, watering_amount_ml, fertilizing_interval_days')
        .eq('company_id', companyId)
        .order('name'),
    ]);

    if (cats) setCategories(cats);
    if (ps) setPlants(ps);
    setLoading(false);
  };

  useFocusEffect(useCallback(() => { fetchData(); }, [company?.id]));

  const handleAddPlant = async () => {
    if (!plantName.trim()) return Alert.alert('Required', 'Enter a plant name.');
    setPlantLoading(true);
    const { error } = await supabase.from('plants').insert({
      company_id: company?.id,
      category_id: plantCategory || null,
      name: plantName.trim(),
      care_manual: plantCareManual.trim() || null,
      grow_duration_days: plantGrowDays ? parseInt(plantGrowDays) : null,
      watering_interval_days: plantWaterDays ? parseInt(plantWaterDays) : null,
      watering_amount_ml: plantWaterMl ? parseInt(plantWaterMl) : null,
      fertilizing_interval_days: plantFertDays ? parseInt(plantFertDays) : null,
      notes: plantNotes.trim() || null,
    });
    setPlantLoading(false);
    if (error) { Alert.alert('Error', error.message); return; }
    Alert.alert('Success', 'Plant added!');
    setPlantName(''); setPlantCategory(null); setPlantCareManual('');
    setPlantGrowDays(''); setPlantWaterDays(''); setPlantWaterMl('');
    setPlantFertDays(''); setPlantNotes('');
    setModalVisible(false);
    fetchData();
  };

  const handleDeletePlant = (plant: Plant) => {
    Alert.alert('Delete Plant', `Delete "${plant.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          await supabase.from('plants').delete().eq('id', plant.id);
          fetchData();
        },
      },
    ]);
  };

  const filteredPlants = selectedCategory
    ? plants.filter((p) => p.category_id === selectedCategory)
    : plants;

  const getCategoryName = (id: string | null) => {
    if (!id) return 'Uncategorized';
    return categories.find((c) => c.id === id)?.name ?? 'Uncategorized';
  };

  const getCategoryIcon = (id: string | null) => {
    if (!id) return '🌿';
    return categories.find((c) => c.id === id)?.icon ?? '🌿';
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
          <Text style={styles.headerTitle}>Plants 🌱</Text>
          <TouchableOpacity onPress={() => setModalVisible(true)} style={styles.addBtn}>
            <Text style={styles.addBtnText}>+ Plant</Text>
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false}>
          <TouchableOpacity style={styles.categoriesLink} onPress={() => router.push('/plant-categories')}>
            <Text style={styles.categoriesLinkIcon}>🗂️</Text>
            <Text style={styles.categoriesLinkText}>Manage Plant Categories</Text>
            <Text style={styles.categoriesLinkArrow}>→</Text>
          </TouchableOpacity>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>FILTER BY TYPE</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <TouchableOpacity
                style={[styles.filterChip, !selectedCategory && styles.filterChipActive]}
                onPress={() => setSelectedCategory(null)}
              >
                <Text style={[styles.filterChipText, !selectedCategory && styles.filterChipTextActive]}>All</Text>
              </TouchableOpacity>
              {categories.map((cat) => (
                <TouchableOpacity
                  key={cat.id}
                  style={[styles.filterChip, selectedCategory === cat.id && styles.filterChipActive]}
                  onPress={() => setSelectedCategory(selectedCategory === cat.id ? null : cat.id)}
                >
                  <Text style={[styles.filterChipText, selectedCategory === cat.id && styles.filterChipTextActive]}>
                    {cat.icon} {cat.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>PLANTS ({filteredPlants.length})</Text>
            {filteredPlants.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyIcon}>🪴</Text>
                <Text style={styles.emptyText}>No plants yet</Text>
                <Text style={styles.emptySubtext}>Tap "+ Plant" to add your first plant</Text>
              </View>
            ) : (
              filteredPlants.map((plant) => (
                <TouchableOpacity
                  key={plant.id}
                  style={styles.plantCard}
                  onPress={() => router.push(`/plants_show?id=${plant.id}`)}
                  onLongPress={() => handleDeletePlant(plant)}
                >
                  <View style={styles.plantCardTop}>
                    <View style={styles.plantCardLeft}>
                      <Text style={styles.plantIcon}>{getCategoryIcon(plant.category_id)}</Text>
                      <View>
                        <Text style={styles.plantName}>{plant.name}</Text>
                        <Text style={styles.plantCategoryLabel}>{getCategoryName(plant.category_id)}</Text>
                      </View>
                    </View>
                  </View>
                  <View style={styles.plantStats}>
                    {plant.grow_duration_days != null && (
                      <View style={styles.statPill}><Text style={styles.statText}>🌱 {plant.grow_duration_days}d grow</Text></View>
                    )}
                    {plant.watering_interval_days != null && (
                      <View style={styles.statPill}><Text style={styles.statText}>💧 every {plant.watering_interval_days}d</Text></View>
                    )}
                    {plant.watering_amount_ml != null && (
                      <View style={styles.statPill}><Text style={styles.statText}>🚿 {plant.watering_amount_ml}ml</Text></View>
                    )}
                    {plant.fertilizing_interval_days != null && (
                      <View style={styles.statPill}><Text style={styles.statText}>🧪 every {plant.fertilizing_interval_days}d</Text></View>
                    )}
                  </View>
                  <Text style={styles.longPressHint}>Long press to delete</Text>
                </TouchableOpacity>
              ))
            )}
          </View>
        </ScrollView>

        <Modal visible={modalVisible} animationType="slide" transparent>
          <View style={styles.modalOverlay}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ width: '100%' }}>
              <ScrollView>
                <View style={styles.modalBox}>
                  <Text style={styles.modalTitle}>New Plant</Text>

                  <Text style={styles.modalLabel}>Plant Name *</Text>
                  <TextInput style={styles.modalInput} placeholder="e.g. Rose, Oak..." placeholderTextColor="#3D5C3A" value={plantName} onChangeText={setPlantName} />

                  <Text style={styles.modalLabel}>Category</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                    <TouchableOpacity style={[styles.filterChip, !plantCategory && styles.filterChipActive]} onPress={() => setPlantCategory(null)}>
                      <Text style={[styles.filterChipText, !plantCategory && styles.filterChipTextActive]}>None</Text>
                    </TouchableOpacity>
                    {categories.map((cat) => (
                      <TouchableOpacity key={cat.id} style={[styles.filterChip, plantCategory === cat.id && styles.filterChipActive]} onPress={() => setPlantCategory(cat.id)}>
                        <Text style={[styles.filterChipText, plantCategory === cat.id && styles.filterChipTextActive]}>{cat.icon} {cat.name}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <Text style={styles.modalLabel}>Care Manual</Text>
                  <TextInput style={[styles.modalInput, { height: 100, textAlignVertical: 'top' }]} placeholder="Describe how to care for this plant..." placeholderTextColor="#3D5C3A" value={plantCareManual} onChangeText={setPlantCareManual} multiline />

                  <Text style={styles.modalLabel}>Grow Duration (days)</Text>
                  <TextInput style={styles.modalInput} placeholder="e.g. 90" placeholderTextColor="#3D5C3A" value={plantGrowDays} onChangeText={setPlantGrowDays} keyboardType="numeric" />

                  <Text style={styles.modalLabel}>Watering Every (days)</Text>
                  <TextInput style={styles.modalInput} placeholder="e.g. 3" placeholderTextColor="#3D5C3A" value={plantWaterDays} onChangeText={setPlantWaterDays} keyboardType="numeric" />

                  <Text style={styles.modalLabel}>Watering Amount (ml)</Text>
                  <TextInput style={styles.modalInput} placeholder="e.g. 500" placeholderTextColor="#3D5C3A" value={plantWaterMl} onChangeText={setPlantWaterMl} keyboardType="numeric" />

                  <Text style={styles.modalLabel}>Fertilizing Every (days)</Text>
                  <TextInput style={styles.modalInput} placeholder="e.g. 14" placeholderTextColor="#3D5C3A" value={plantFertDays} onChangeText={setPlantFertDays} keyboardType="numeric" />

                  <Text style={styles.modalLabel}>Notes</Text>
                  <TextInput style={[styles.modalInput, { height: 80, textAlignVertical: 'top' }]} placeholder="Any extra notes..." placeholderTextColor="#3D5C3A" value={plantNotes} onChangeText={setPlantNotes} multiline />

                  <View style={styles.modalButtons}>
                    <TouchableOpacity style={styles.modalCancel} onPress={() => setModalVisible(false)}>
                      <Text style={styles.modalCancelText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.modalConfirm} onPress={handleAddPlant} disabled={plantLoading}>
                      {plantLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.modalConfirmText}>Add Plant</Text>}
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0E1A12' },
  blob: { position: 'absolute', borderRadius: 999, opacity: 0.1 },
  blob1: { width: 350, height: 350, backgroundColor: '#3D8B37', top: -100, right: -120 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12 },
  backText: { color: '#7FAE7A', fontSize: 16 },
  headerTitle: { color: '#E8F5E0', fontSize: 20, fontWeight: '800' },
  addBtn: { backgroundColor: '#4CAF50', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  categoriesLink: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#162018', borderWidth: 1, borderColor: '#243524', borderRadius: 14, padding: 16, marginHorizontal: 20, marginBottom: 20, gap: 10 },
  categoriesLinkIcon: { fontSize: 20 },
  categoriesLinkText: { flex: 1, color: '#E8F5E0', fontSize: 15, fontWeight: '600' },
  categoriesLinkArrow: { color: '#4CAF50', fontSize: 16 },
  section: { paddingHorizontal: 20, marginBottom: 24 },
  sectionTitle: { color: '#3D5C3A', fontSize: 11, fontWeight: '700', letterSpacing: 1.5, marginBottom: 12 },
  filterChip: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#243524', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, marginRight: 8 },
  filterChipActive: { borderColor: '#4CAF50', backgroundColor: 'rgba(76,175,80,0.15)' },
  filterChipText: { color: '#7FAE7A', fontSize: 13 },
  filterChipTextActive: { color: '#4CAF50', fontWeight: '700' },
  emptyState: { alignItems: 'center', paddingVertical: 48 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { color: '#7FAE7A', fontSize: 18, fontWeight: '700', marginBottom: 6 },
  emptySubtext: { color: '#3D5C3A', fontSize: 14 },
  plantCard: { backgroundColor: '#162018', borderRadius: 16, borderWidth: 1, borderColor: '#243524', padding: 16, marginBottom: 12 },
  plantCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  plantCardLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  plantIcon: { fontSize: 32 },
  plantName: { color: '#E8F5E0', fontSize: 17, fontWeight: '700' },
  plantCategoryLabel: { color: '#3D5C3A', fontSize: 12, marginTop: 2 },
  plantStats: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  statPill: { backgroundColor: '#0E1A12', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: '#243524' },
  statText: { color: '#7FAE7A', fontSize: 12 },
  longPressHint: { color: '#243524', fontSize: 10, marginTop: 8, textAlign: 'right' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end', alignItems: 'center' },
  modalBox: { backgroundColor: '#162018', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, width: '100%' },
  modalTitle: { color: '#E8F5E0', fontSize: 20, fontWeight: '800', marginBottom: 20 },
  modalLabel: { color: '#7FAE7A', fontSize: 12, fontWeight: '600', letterSpacing: 0.5, marginBottom: 6 },
  modalInput: { backgroundColor: '#0E1A12', borderWidth: 1.5, borderColor: '#243524', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 14, color: '#E8F5E0', fontSize: 15, marginBottom: 16 },
  modalButtons: { flexDirection: 'row', gap: 12, marginTop: 8 },
  modalCancel: { flex: 1, borderWidth: 1.5, borderColor: '#243524', borderRadius: 12, paddingVertical: 16, alignItems: 'center' },
  modalCancelText: { color: '#7FAE7A', fontWeight: '600' },
  modalConfirm: { flex: 1, backgroundColor: '#4CAF50', borderRadius: 12, paddingVertical: 16, alignItems: 'center' },
  modalConfirmText: { color: '#fff', fontWeight: '700' },
});