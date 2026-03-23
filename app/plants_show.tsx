import React, { useState, useEffect } from 'react';
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
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

export default function PlantShowScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { profile } = useAuth();
  const isBoss = profile?.role === 'boss';

  const [plant, setPlant] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showFullCare, setShowFullCare] = useState(false);
  const [showFullNotes, setShowFullNotes] = useState(false);

  // Edit modal states
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editName, setEditName] = useState('');
  const [editCategory, setEditCategory] = useState<string | null>(null);
  const [editCareManual, setEditCareManual] = useState('');
  const [editGrowDays, setEditGrowDays] = useState('');
  const [editWaterDays, setEditWaterDays] = useState('');
  const [editWaterMl, setEditWaterMl] = useState('');
  const [editFertDays, setEditFertDays] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editLoading, setEditLoading] = useState(false);
  const [categories, setCategories] = useState<any[]>([]);

  useEffect(() => {
    if (!id) {
      Alert.alert('Error', 'No plant ID provided');
      router.back();
      return;
    }
    fetchPlant();
    fetchCategories();
  }, [id]);

  const fetchPlant = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('plants')
      .select(`
        *,
        plant_categories(
          name,
          icon
        )
      `)
      .eq('id', id)
      .single();

    if (error || !data) {
      Alert.alert('Error', 'Plant not found');
      router.back();
    } else {
      setPlant(data);
      // Pre-fill edit fields
      setEditName(data.name);
      setEditCategory(data.category_id);
      setEditCareManual(data.care_manual || '');
      setEditGrowDays(data.grow_duration_days?.toString() || '');
      setEditWaterDays(data.watering_interval_days?.toString() || '');
      setEditWaterMl(data.watering_amount_ml?.toString() || '');
      setEditFertDays(data.fertilizing_interval_days?.toString() || '');
      setEditNotes(data.notes || '');
    }
    setLoading(false);
  };

  const fetchCategories = async () => {
    const { data } = await supabase
      .from('plant_categories')
      .select('*')
      .order('name');
    if (data) setCategories(data);
  };

  const handleUpdate = async () => {
    if (!editName.trim()) {
      return Alert.alert('Required', 'Enter a plant name.');
    }

    setEditLoading(true);

    const { error } = await supabase
      .from('plants')
      .update({
        name: editName.trim(),
        category_id: editCategory || null,
        care_manual: editCareManual.trim() || null,
        grow_duration_days: editGrowDays ? parseInt(editGrowDays) : null,
        watering_interval_days: editWaterDays ? parseInt(editWaterDays) : null,
        watering_amount_ml: editWaterMl ? parseInt(editWaterMl) : null,
        fertilizing_interval_days: editFertDays ? parseInt(editFertDays) : null,
        notes: editNotes.trim() || null,
      })
      .eq('id', id);

    setEditLoading(false);

    if (error) {
      Alert.alert('Error', error.message);
      return;
    }

    Alert.alert('Success', 'Plant updated!');
    setEditModalVisible(false);
    fetchPlant(); // Refresh the detail view with new data
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator color="#4CAF50" size="large" />
      </View>
    );
  }

  if (!plant) return null;

  const truncateText = (text: string | null, maxChars = 80) => {
    if (!text || text.trim() === '') return 'None';
    if (text.length <= maxChars) return text;
    return text.substring(0, maxChars).trim() + '...';
  };

  const hasMoreCare = plant.care_manual && plant.care_manual.length > 80;
  const hasMoreNotes = plant.notes && plant.notes.length > 80;

  return (
    <View style={styles.container}>
      <SafeAreaView style={{ flex: 1 }}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{plant.name}</Text>
          {isBoss && (
            <TouchableOpacity onPress={() => setEditModalVisible(true)}>
              <Text style={styles.editText}>Edit</Text>
            </TouchableOpacity>
          )}
        </View>

        <ScrollView style={styles.scroll}>
          <View style={styles.infoCard}>
            <Text style={styles.label}>Category</Text>
            <Text style={styles.value}>
              {plant.plant_categories?.icon || '🌿'} {plant.plant_categories?.name || 'Uncategorized'}
            </Text>

            <Text style={styles.label}>Grow Duration</Text>
            <Text style={styles.value}>
              {plant.grow_duration_days ? `${plant.grow_duration_days} days` : 'N/A'}
            </Text>

            <Text style={styles.label}>Watering</Text>
            <Text style={styles.value}>
              {plant.watering_interval_days
                ? `Every ${plant.watering_interval_days} days, ${plant.watering_amount_ml || '?'} ml`
                : 'N/A'}
            </Text>

            <Text style={styles.label}>Fertilizing</Text>
            <Text style={styles.value}>
              {plant.fertilizing_interval_days ? `Every ${plant.fertilizing_interval_days} days` : 'N/A'}
            </Text>

            <Text style={styles.label}>Care Manual</Text>
            <Text style={styles.text}>
              {showFullCare
                ? (plant.care_manual || 'None')
                : truncateText(plant.care_manual, 80)}
            </Text>
            {hasMoreCare && (
              <TouchableOpacity onPress={() => setShowFullCare(!showFullCare)}>
                <Text style={styles.seeMore}>
                  {showFullCare ? 'Show less' : 'See more'}
                </Text>
              </TouchableOpacity>
            )}

            <Text style={styles.label}>Notes</Text>
            <Text style={styles.text}>
              {showFullNotes
                ? (plant.notes || 'None')
                : truncateText(plant.notes, 80)}
            </Text>
            {hasMoreNotes && (
              <TouchableOpacity onPress={() => setShowFullNotes(!showFullNotes)}>
                <Text style={styles.seeMore}>
                  {showFullNotes ? 'Show less' : 'See more'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>

      {/* Edit Modal */}
      <Modal visible={editModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ width: '100%' }}>
            <ScrollView>
              <View style={styles.modalBox}>
                <Text style={styles.modalTitle}>Edit Plant</Text>

                <Text style={styles.modalLabel}>Plant Name *</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="e.g. Rose, Oak..."
                  placeholderTextColor="#3D5C3A"
                  value={editName}
                  onChangeText={setEditName}
                />

                <Text style={styles.modalLabel}>Category</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                  <TouchableOpacity
                    style={[styles.filterChip, !editCategory && styles.filterChipActive]}
                    onPress={() => setEditCategory(null)}
                  >
                    <Text style={[styles.filterChipText, !editCategory && styles.filterChipTextActive]}>
                      None
                    </Text>
                  </TouchableOpacity>
                  {categories.map((cat) => (
                    <TouchableOpacity
                      key={cat.id}
                      style={[styles.filterChip, editCategory === cat.id && styles.filterChipActive]}
                      onPress={() => setEditCategory(cat.id)}
                    >
                      <Text
                        style={[
                          styles.filterChipText,
                          editCategory === cat.id && styles.filterChipTextActive,
                        ]}
                      >
                        {cat.icon} {cat.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={styles.modalLabel}>Care Manual</Text>
                <TextInput
                  style={[styles.modalInput, { height: 100, textAlignVertical: 'top' }]}
                  placeholder="Describe how to care for this plant..."
                  placeholderTextColor="#3D5C3A"
                  value={editCareManual}
                  onChangeText={setEditCareManual}
                  multiline
                />

                <Text style={styles.modalLabel}>Grow Duration (days)</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="e.g. 90"
                  placeholderTextColor="#3D5C3A"
                  value={editGrowDays}
                  onChangeText={setEditGrowDays}
                  keyboardType="numeric"
                />

                <Text style={styles.modalLabel}>Watering Every (days)</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="e.g. 3"
                  placeholderTextColor="#3D5C3A"
                  value={editWaterDays}
                  onChangeText={setEditWaterDays}
                  keyboardType="numeric"
                />

                <Text style={styles.modalLabel}>Watering Amount (ml)</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="e.g. 500"
                  placeholderTextColor="#3D5C3A"
                  value={editWaterMl}
                  onChangeText={setEditWaterMl}
                  keyboardType="numeric"
                />

                <Text style={styles.modalLabel}>Fertilizing Every (days)</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="e.g. 14"
                  placeholderTextColor="#3D5C3A"
                  value={editFertDays}
                  onChangeText={setEditFertDays}
                  keyboardType="numeric"
                />

                <Text style={styles.modalLabel}>Notes</Text>
                <TextInput
                  style={[styles.modalInput, { height: 80, textAlignVertical: 'top' }]}
                  placeholder="Any extra notes..."
                  placeholderTextColor="#3D5C3A"
                  value={editNotes}
                  onChangeText={setEditNotes}
                  multiline
                />

                <View style={styles.modalButtons}>
                  <TouchableOpacity style={styles.modalCancel} onPress={() => setEditModalVisible(false)}>
                    <Text style={styles.modalCancelText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.modalConfirm}
                    onPress={handleUpdate}
                    disabled={editLoading}
                  >
                    {editLoading ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.modalConfirmText}>Update Plant</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0E1A12' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    paddingTop: 16,
  },
  backText: { color: '#7FAE7A', fontSize: 16 },
  headerTitle: { color: '#E8F5E0', fontSize: 20, fontWeight: '800' },
  editText: { color: '#4CAF50', fontSize: 16, fontWeight: '600' },
  scroll: { flex: 1 },
  infoCard: {
    backgroundColor: '#162018',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#243524',
    padding: 20,
    margin: 20,
  },
  label: { color: '#7FAE7A', fontSize: 14, fontWeight: '600', marginBottom: 4 },
  value: { color: '#E8F5E0', fontSize: 16, marginBottom: 16 },
  text: { color: '#E8F5E0', fontSize: 16, lineHeight: 24, marginBottom: 8 },
  seeMore: { 
    color: '#4CAF50', 
    fontSize: 14, 
    marginTop: 8, 
    fontWeight: '500' 
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  modalBox: {
    backgroundColor: '#162018',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    width: '100%',
  },
  modalTitle: { color: '#E8F5E0', fontSize: 20, fontWeight: '800', marginBottom: 20 },
  modalLabel: { color: '#7FAE7A', fontSize: 12, fontWeight: '600', letterSpacing: 0.5, marginBottom: 6 },
  modalInput: {
    backgroundColor: '#0E1A12',
    borderWidth: 1.5,
    borderColor: '#243524',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    color: '#E8F5E0',
    fontSize: 15,
    marginBottom: 16,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#243524',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginRight: 8,
  },
  filterChipActive: { borderColor: '#4CAF50', backgroundColor: 'rgba(76,175,80,0.15)' },
  filterChipText: { color: '#7FAE7A', fontSize: 13 },
  filterChipTextActive: { color: '#4CAF50', fontWeight: '700' },
  modalButtons: { flexDirection: 'row', gap: 12, marginTop: 8 },
  modalCancel: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: '#243524',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  modalCancelText: { color: '#7FAE7A', fontWeight: '600' },
  modalConfirm: {
    flex: 1,
    backgroundColor: '#4CAF50',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  modalConfirmText: { color: '#fff', fontWeight: '700' },
});