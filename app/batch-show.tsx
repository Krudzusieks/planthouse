// batch-show.tsx
import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Modal,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ArrowLeft, QrCode, CheckCircle, ClipboardList, MapPin,
  Droplets, FlaskConical, Scissors, Package, Search,
  Truck, Pill, Wheat, Zap, Trash2, ChevronRight,
  Calendar, Leaf, Download, DollarSign, Snowflake,
  Bug, Wrench, HelpCircle, Check, X, Eye, Info, BookOpen, Minus, Share2,
} from 'lucide-react-native';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import QRCode from 'react-native-qrcode-svg';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import ViewShot from 'react-native-view-shot';

// ─── Types ────────────────────────────────────────────────────────────────────

interface BatchDetail {
  id: string;
  plant_id: string;
  original_quantity: number;
  current_quantity: number;
  location: string | null;
  status: 'active' | 'completed';
  completed_at: string | null;
  completion_reason: string | null;
  completion_notes: string | null;
  plants: {
    name: string;
    care_manual: string | null;
    grow_duration_days: number | null;
    watering_interval_days: number | null;
    watering_amount_ml: number | null;
    fertilizing_interval_days: number | null;
    notes: string | null;
    plant_categories: { name: string; icon: string } | null;
  } | null;
}

interface Removal {
  id: string;
  amount: number;
  reason: string | null;
  removed_by_name: string;
  created_at: string;
}

interface WateringLog {
  id: string;
  amount_ml: number;
  logged_by_name: string;
  created_at: string;
}

interface FertilizingLog {
  id: string;
  amount_ml: number;
  logged_by_name: string;
  created_at: string;
}

interface ActionLog {
  id: string;
  action_type: string;
  notes: string | null;
  new_location: string | null;
  logged_by_name: string;
  created_at: string;
}

interface Location {
  id: string;
  name: string;
}

interface LinkedJob {
  id: string;
  job_type: string;
  status: 'not_started' | 'in_progress' | 'completed';
  notes: string | null;
  target_location: string | null;
  remove_amount: number | null;
}

type TabKey = 'info' | 'watering' | 'fertilizer' | 'actions' | 'history';
type LucideIcon = React.ComponentType<{ size: number; color: string; strokeWidth?: number }>;

// ─── Constants ────────────────────────────────────────────────────────────────

const WATER_AMOUNTS_ML      = [100, 200, 300, 500, 750, 1000, 1500, 2000, 3000, 5000];
const FERTILIZER_AMOUNTS_ML = [5, 10, 15, 20, 25, 30, 50, 75, 100, 150];

const ACTION_TO_JOB_TYPE: Record<string, string> = {
  'Pruned':    'Prune',
  'Repotted':  'Repot',
  'Inspected': 'Inspect',
  'Relocated': 'Relocate',
  'Treated':   'Treat',
  'Harvested': 'Harvest',
  'Water':     'Water',
  'Fertilize': 'Fertilize',
  'Remove':    'Remove Plants',
};

interface ActionDef {
  type: string;
  icon: LucideIcon;
  color: string;
  hasNotes: boolean;
  hasLocation: boolean;
}

const ACTIONS: ActionDef[] = [
  { type: 'Pruned',    icon: Scissors, color: '#26A69A', hasNotes: true,  hasLocation: false },
  { type: 'Repotted',  icon: Package,  color: '#FFA726', hasNotes: true,  hasLocation: false },
  { type: 'Inspected', icon: Search,   color: '#66BB6A', hasNotes: true,  hasLocation: false },
  { type: 'Relocated', icon: Truck,    color: '#EF5350', hasNotes: true,  hasLocation: true  },
  { type: 'Treated',   icon: Pill,     color: '#EC407A', hasNotes: true,  hasLocation: false },
  { type: 'Harvested', icon: Wheat,    color: '#FFCA28', hasNotes: true,  hasLocation: false },
];

interface CompletionReasonDef {
  label: string;
  icon: LucideIcon;
  color: string;
}

const COMPLETION_REASONS: CompletionReasonDef[] = [
  { label: 'Sold',         icon: DollarSign, color: '#4CAF50' },
  { label: 'Harvested',    icon: Wheat,      color: '#FFCA28' },
  { label: 'Frost damage', icon: Snowflake,  color: '#29B6F6' },
  { label: 'Disease',      icon: Bug,        color: '#EF5350' },
  { label: 'Damaged',      icon: Wrench,     color: '#FFA726' },
  { label: 'Other',        icon: HelpCircle, color: '#7FAE7A' },
];

const TABS: { key: TabKey; label: string; icon: LucideIcon }[] = [
  { key: 'info',       label: 'Plant Info', icon: Leaf         },
  { key: 'watering',   label: 'Watering',   icon: Droplets     },
  { key: 'fertilizer', label: 'Fertilizer', icon: FlaskConical },
  { key: 'actions',    label: 'Actions',    icon: Zap          },
  { key: 'history',    label: 'History',    icon: BookOpen     },
];

const formatMl   = (ml: number) => ml >= 1000 ? `${ml / 1000}L` : `${ml}ml`;
const formatDate = (iso: string) => new Date(iso).toLocaleDateString('en-GB', {
  day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
});
const timeAgo = (iso: string) => {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000), h = Math.floor(diff / 3600000), d = Math.floor(diff / 86400000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  if (h < 24) return `${h}h ago`;
  return `${d}d ago`;
};

async function promptJobCompletion(
  linkedJob: LinkedJob | null,
  actionJobType: string,
  onConfirm: () => Promise<void>
) {
  if (!linkedJob || linkedJob.status === 'completed' || linkedJob.job_type !== actionJobType) return;
  Alert.alert(
    'Complete your job?',
    `You have an active "${linkedJob.job_type}" job for this batch.\n\nMark it as completed now?`,
    [{ text: 'Not yet', style: 'cancel' }, { text: 'Yes, complete it', onPress: onConfirm }]
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function BatchShowScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router  = useRouter();
  const { profile, company } = useAuth();
  const isBoss = profile?.role === 'boss';

  const [batch, setBatch]                             = useState<BatchDetail | null>(null);
  const [removals, setRemovals]                       = useState<Removal[]>([]);
  const [wateringLogs, setWateringLogs]               = useState<WateringLog[]>([]);
  const [fertilizingLogs, setFertilizingLogs]         = useState<FertilizingLog[]>([]);
  const [loading, setLoading]                         = useState(true);
  const [activeTab, setActiveTab]                     = useState<TabKey>('info');
  const [linkedJob, setLinkedJob]                     = useState<LinkedJob | null>(null);

  const [removeAmount, setRemoveAmount]               = useState('');
  const [removeReason, setRemoveReason]               = useState('');
  const [removeLoading, setRemoveLoading]             = useState(false);

  // Watering
  const [selectedWaterAmount, setSelectedWaterAmount] = useState<number | null>(null);
  const [customWaterInput, setCustomWaterInput]       = useState('');
  const [waterLoading, setWaterLoading]               = useState(false);

  // Fertilizer
  const [selectedFertAmount, setSelectedFertAmount]   = useState<number | null>(null);
  const [customFertInput, setCustomFertInput]         = useState('');
  const [fertLoading, setFertLoading]                 = useState(false);

  const [actionLogs, setActionLogs]                   = useState<ActionLog[]>([]);
  const [actionModalVisible, setActionModalVisible]   = useState(false);
  const [selectedAction, setSelectedAction]           = useState<ActionDef | null>(null);
  const [actionNotes, setActionNotes]                 = useState('');
  const [actionNewLocation, setActionNewLocation]     = useState('');
  const [actionLoading, setActionLoading]             = useState(false);

  const [locations, setLocations]                     = useState<Location[]>([]);
  const [qrModalVisible, setQrModalVisible]           = useState(false);
  const qrRef = useRef<any>(null);

  const [completeModalVisible, setCompleteModalVisible] = useState(false);
  const [selectedReason, setSelectedReason]           = useState<string | null>(null);
  const [completeNotes, setCompleteNotes]             = useState('');
  const [completing, setCompleting]                   = useState(false);

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const fetchBatch = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    const { data, error } = await supabase.from('plant_batches').select(`
      id, plant_id, original_quantity, current_quantity, location,
      status, completed_at, completion_reason, completion_notes,
      plants!plant_id (
        name, care_manual, grow_duration_days, watering_interval_days,
        watering_amount_ml, fertilizing_interval_days, notes,
        plant_categories ( name, icon )
      )
    `).eq('id', id).single();
    if (error || !data) { Alert.alert('Error', 'Batch not found'); router.back(); return; }
    setBatch(data as any);
    setLoading(false);
  }, [id]);

  const fetchRemovals     = useCallback(async () => {
    if (!id) return;
    const { data } = await supabase.from('batch_removals')
      .select('id, amount, reason, removed_by_name, created_at')
      .eq('batch_id', id).order('created_at', { ascending: false });
    if (data) setRemovals(data);
  }, [id]);

  const fetchWaterings    = useCallback(async () => {
    if (!id) return;
    const { data } = await supabase.from('batch_waterings')
      .select('id, amount_ml, logged_by_name, created_at')
      .eq('batch_id', id).order('created_at', { ascending: false });
    if (data) setWateringLogs(data);
  }, [id]);

  const fetchFertilizings = useCallback(async () => {
    if (!id) return;
    const { data } = await supabase.from('batch_fertilizings')
      .select('id, amount_ml, logged_by_name, created_at')
      .eq('batch_id', id).order('created_at', { ascending: false });
    if (data) setFertilizingLogs(data);
  }, [id]);

  const fetchActions      = useCallback(async () => {
    if (!id) return;
    const { data } = await supabase.from('batch_actions')
      .select('id, action_type, notes, new_location, logged_by_name, created_at')
      .eq('batch_id', id).order('created_at', { ascending: false });
    if (data) setActionLogs(data);
  }, [id]);

  const fetchLocations    = useCallback(async () => {
    if (!company?.id) return;
    const { data } = await supabase.from('locations')
      .select('id, name').eq('company_id', company.id).order('name');
    if (data) setLocations(data);
  }, [company?.id]);

  const fetchLinkedJob    = useCallback(async () => {
    if (!id || !profile?.id) return;
    const { data } = await supabase.from('jobs')
      .select('id, job_type, status, notes, target_location, remove_amount')
      .eq('batch_id', id).eq('assigned_to', profile.id)
      .in('status', ['not_started', 'in_progress'])
      .order('created_at', { ascending: false }).limit(1).maybeSingle();
    setLinkedJob(data as LinkedJob | null);
  }, [id, profile?.id]);

  useEffect(() => {
    fetchBatch(); fetchRemovals(); fetchWaterings();
    fetchFertilizings(); fetchActions(); fetchLocations(); fetchLinkedJob();
  }, [id]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const completeLinkedJob = async () => {
    if (!linkedJob) return;
    await supabase.from('jobs')
      .update({ status: 'completed', completed_at: new Date().toISOString() })
      .eq('id', linkedJob.id);
    setLinkedJob(null);
  };

  const handleCompleteBatch = async () => {
    if (!selectedReason) return Alert.alert('Required', 'Select a reason.');
    setCompleting(true);
    const { error } = await supabase.from('plant_batches').update({
      status: 'completed', completed_at: new Date().toISOString(),
      completion_reason: selectedReason, completion_notes: completeNotes.trim() || null,
    }).eq('id', id);
    setCompleting(false);
    if (error) { Alert.alert('Error', error.message); return; }
    setCompleteModalVisible(false);
    Alert.alert('Batch Completed', `Marked as completed.\nReason: ${selectedReason}`,
      [{ text: 'OK', onPress: () => router.back() }]);
  };

  const handleLogWatering = async () => {
    if (!selectedWaterAmount) return Alert.alert('Select amount', 'Please select or enter how much water was used per plant.');
    Alert.alert('Confirm Watering', `Log ${formatMl(selectedWaterAmount)} of water per plant?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Confirm', onPress: async () => {
        setWaterLoading(true);
        const { error } = await supabase.from('batch_waterings').insert({
          batch_id: id, company_id: company?.id,
          amount_ml: selectedWaterAmount,
          logged_by: profile?.id, logged_by_name: profile?.full_name ?? 'Unknown',
        });
        setWaterLoading(false);
        if (error) return Alert.alert('Error', error.message);
        setSelectedWaterAmount(null);
        setCustomWaterInput('');
        fetchWaterings();
        promptJobCompletion(linkedJob, 'Water', completeLinkedJob);
      }},
    ]);
  };

  const handleLogFertilizing = async () => {
    if (!selectedFertAmount) return Alert.alert('Select amount', 'Please select or enter how much fertilizer was used per plant.');
    Alert.alert('Confirm Fertilizing', `Log ${formatMl(selectedFertAmount)} of fertilizer per plant?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Confirm', onPress: async () => {
        setFertLoading(true);
        const { error } = await supabase.from('batch_fertilizings').insert({
          batch_id: id, company_id: company?.id,
          amount_ml: selectedFertAmount,
          logged_by: profile?.id, logged_by_name: profile?.full_name ?? 'Unknown',
        });
        setFertLoading(false);
        if (error) return Alert.alert('Error', error.message);
        setSelectedFertAmount(null);
        setCustomFertInput('');
        fetchFertilizings();
        promptJobCompletion(linkedJob, 'Fertilize', completeLinkedJob);
      }},
    ]);
  };

  const handleLogAction = async () => {
    if (!selectedAction || !batch) return;
    setActionLoading(true);
    const { error } = await supabase.from('batch_actions').insert({
      batch_id: id, company_id: company?.id, action_type: selectedAction.type,
      notes: actionNotes.trim() || null,
      new_location: selectedAction.hasLocation && actionNewLocation.trim() ? actionNewLocation.trim() : null,
      logged_by: profile?.id, logged_by_name: profile?.full_name ?? 'Unknown',
    });
    if (!error && selectedAction.type === 'Relocated' && actionNewLocation.trim()) {
      await supabase.from('plant_batches').update({ location: actionNewLocation.trim() }).eq('id', id);
      await fetchBatch();
    }
    setActionLoading(false);
    if (error) { Alert.alert('Error', error.message); return; }
    const capturedAction = { ...selectedAction };
    const capturedLocation = actionNewLocation;
    setActionModalVisible(false); setSelectedAction(null); setActionNotes(''); setActionNewLocation('');
    fetchActions();
    if (capturedAction.type === 'Relocated' && linkedJob?.job_type === 'Relocate') {
      const target = linkedJob.target_location?.trim().toLowerCase() ?? '';
      const actual = capturedLocation.trim().toLowerCase();
      if (target && actual !== target) {
        Alert.alert('Wrong Location',
          `Your job requires moving to "${linkedJob.target_location}", but you logged "${capturedLocation}".\n\nJob NOT marked complete.`,
          [{ text: 'OK' }]);
        return;
      }
      promptJobCompletion(linkedJob, 'Relocate', completeLinkedJob); return;
    }
    promptJobCompletion(linkedJob, ACTION_TO_JOB_TYPE[capturedAction.type] ?? capturedAction.type, completeLinkedJob);
  };

  const handleRemove = async () => {
    const amount = parseInt(removeAmount);
    if (!removeAmount.trim() || isNaN(amount) || amount <= 0) return Alert.alert('Invalid', 'Enter a valid amount.');
    if (!batch) return;
    if (amount > batch.current_quantity) return Alert.alert('Too many', `Max ${batch.current_quantity}.`);
    Alert.alert('Confirm Removal', `Remove ${amount} plant(s)?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: async () => {
        setRemoveLoading(true);
        const newQty = batch.current_quantity - amount;
        const { error: ue } = await supabase.from('plant_batches').update({ current_quantity: newQty }).eq('id', id);
        if (ue) { setRemoveLoading(false); return Alert.alert('Error', ue.message); }
        const { error: ie } = await supabase.from('batch_removals').insert({
          batch_id: id, company_id: company?.id, amount,
          reason: removeReason.trim() || null,
          removed_by: profile?.id, removed_by_name: profile?.full_name ?? 'Unknown',
        });
        setRemoveLoading(false);
        if (ie) return Alert.alert('Error', ie.message);
        setRemoveAmount(''); setRemoveReason('');
        await fetchBatch(); await fetchRemovals();
        promptJobCompletion(linkedJob, 'Remove Plants', completeLinkedJob);
      }},
    ]);
  };

  const handleDeleteRemoval = (removal: Removal) => {
    Alert.alert('Delete Record', 'Delete this removal record? This will NOT restore the plant count.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        await supabase.from('batch_removals').delete().eq('id', removal.id);
        fetchRemovals();
      }},
    ]);
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading || !batch) return <View style={styles.centered}><ActivityIndicator color="#4CAF50" size="large" /></View>;

  const plant      = batch.plants;
  const category   = plant?.plant_categories;
  const fillRatio  = batch.original_quantity > 0 ? batch.current_quantity / batch.original_quantity : 0;
  const fillColor  = fillRatio > 0.6 ? '#4CAF50' : fillRatio > 0.3 ? '#FFA726' : '#EF5350';
  const lastWatered    = wateringLogs[0] ?? null;
  const lastFertilized = fertilizingLogs[0] ?? null;
  const isCompleted    = batch.status === 'completed';

  return (
    <View style={styles.container}>
      <View style={[styles.blob, styles.blob1]} />
      <SafeAreaView style={{ flex: 1 }}>

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.headerBtn}>
            <ArrowLeft size={20} color="#7FAE7A" strokeWidth={2.5} />
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>{plant?.name ?? 'Batch'}</Text>
          <TouchableOpacity style={styles.qrBtn} onPress={() => setQrModalVisible(true)}>
            <QrCode size={15} color="#4CAF50" strokeWidth={2} />
            <Text style={styles.qrBtnText}>QR</Text>
          </TouchableOpacity>
        </View>

        {/* Completed banner */}
        {isCompleted && (
          <View style={styles.completedTopBanner}>
            <CheckCircle size={22} color="#4CAF50" strokeWidth={2} />
            <View style={{ flex: 1 }}>
              <Text style={styles.completedTopBannerTitle}>Batch Completed</Text>
              <Text style={styles.completedTopBannerSub}>
                {batch.completion_reason}{batch.completed_at ? `  ·  ${formatDate(batch.completed_at)}` : ''}
              </Text>
              {batch.completion_notes ? <Text style={styles.completedTopBannerNotes}>{batch.completion_notes}</Text> : null}
            </View>
          </View>
        )}

        {/* Active job banner */}
        {linkedJob && !isCompleted && (
          <TouchableOpacity style={styles.jobBanner} onPress={() => router.push('/jobs')} activeOpacity={0.8}>
            <ClipboardList size={20} color="#4CAF50" strokeWidth={2} />
            <View style={{ flex: 1 }}>
              <Text style={styles.jobBannerTitle}>Active job: {linkedJob.job_type}</Text>
              {linkedJob.target_location && <Text style={styles.jobBannerSub}>Move to: {linkedJob.target_location}</Text>}
              {linkedJob.remove_amount != null && <Text style={styles.jobBannerSub}>Remove: {linkedJob.remove_amount} plants</Text>}
              {linkedJob.notes && <Text style={styles.jobBannerSub}>{linkedJob.notes}</Text>}
            </View>
            <ChevronRight size={18} color="#4CAF50" strokeWidth={2.5} />
          </TouchableOpacity>
        )}

        {/* Summary Card */}
        <View style={[styles.summaryCard, isCompleted && styles.summaryCardCompleted]}>
          <View style={styles.summaryRow}>
            {(['ORIGINAL', 'CURRENT', 'REMOVED'] as const).map((label, i) => {
              const values = [batch.original_quantity, batch.current_quantity, batch.original_quantity - batch.current_quantity];
              const colors = ['#E8F5E0', fillColor, '#EF5350'];
              return (
                <React.Fragment key={label}>
                  {i > 0 && <View style={styles.summaryDivider} />}
                  <View style={styles.summaryItem}>
                    <Text style={styles.summaryLabel}>{label}</Text>
                    <Text style={[styles.summaryValue, { color: colors[i] }]}>{values[i]}</Text>
                  </View>
                </React.Fragment>
              );
            })}
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${Math.round(fillRatio * 100)}%` as any, backgroundColor: fillColor }]} />
          </View>
          <Text style={styles.progressLabel}>{Math.round(fillRatio * 100)}% remaining</Text>
          <View style={styles.statusRow}>
            <View style={styles.statusPill}>
              <Droplets size={13} color="#29B6F6" strokeWidth={2} />
              <Text style={styles.statusText}>{lastWatered ? timeAgo(lastWatered.created_at) : 'Never watered'}</Text>
            </View>
            <View style={styles.statusPill}>
              <FlaskConical size={13} color="#AB47BC" strokeWidth={2} />
              <Text style={styles.statusText}>{lastFertilized ? timeAgo(lastFertilized.created_at) : 'Never fertilized'}</Text>
            </View>
          </View>
          {batch.location && (
            <View style={styles.locationRow}>
              <MapPin size={13} color="#7FAE7A" strokeWidth={2} />
              <Text style={styles.locationText}>{batch.location}</Text>
            </View>
          )}
        </View>

        {/* Tabs */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabBar} contentContainerStyle={styles.tabBarContent}>
          {TABS.map(tab => {
            const IC = tab.icon;
            const active = activeTab === tab.key;
            return (
              <TouchableOpacity key={tab.key} style={[styles.tab, active && styles.tabActive]} onPress={() => setActiveTab(tab.key)}>
                <IC size={14} color={active ? '#4CAF50' : '#7FAE7A'} strokeWidth={2} />
                <Text style={[styles.tabText, active && styles.tabTextActive]}>{tab.label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Tab Content */}
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={styles.tabContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

            {/* ══════ PLANT INFO ══════ */}
            {activeTab === 'info' && (
              <View>
                <View style={styles.infoCard}>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Plant Type</Text>
                    <Text style={styles.infoValue}>{category?.icon ?? '🌿'} {plant?.name ?? '—'}</Text>
                  </View>
                  <View style={styles.infoDivider} />
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Category</Text>
                    <Text style={styles.infoValue}>{category?.name ?? 'Uncategorized'}</Text>
                  </View>
                  <View style={styles.infoDivider} />
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Grow Duration</Text>
                    <Text style={styles.infoValue}>{plant?.grow_duration_days ? `${plant.grow_duration_days} days` : 'N/A'}</Text>
                  </View>
                </View>

                {plant?.care_manual && (
                  <View style={styles.textCard}>
                    <View style={styles.textCardHeader}><ClipboardList size={14} color="#7FAE7A" strokeWidth={2} /><Text style={styles.textCardTitle}>Care Manual</Text></View>
                    <Text style={styles.textCardBody}>{plant.care_manual}</Text>
                  </View>
                )}
                {plant?.notes && (
                  <View style={styles.textCard}>
                    <View style={styles.textCardHeader}><Info size={14} color="#7FAE7A" strokeWidth={2} /><Text style={styles.textCardTitle}>Notes</Text></View>
                    <Text style={styles.textCardBody}>{plant.notes}</Text>
                  </View>
                )}

                {isBoss && !isCompleted && (
                  <>
                    <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>COMPLETE BATCH</Text></View>
                    <TouchableOpacity style={styles.completeBatchBtn} onPress={() => setCompleteModalVisible(true)}>
                      <CheckCircle size={17} color="#4CAF50" strokeWidth={2.5} />
                      <Text style={styles.completeBatchBtnText}>Mark Batch as Completed</Text>
                    </TouchableOpacity>
                  </>
                )}

                {!isCompleted && (
                  <>
                    <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>REMOVE FROM BATCH</Text></View>
                    <View style={styles.removeCard}>
                      <Text style={styles.removeLabel}>Amount to remove</Text>
                      <TextInput style={styles.removeInput} placeholder="0" placeholderTextColor="#3D5C3A" value={removeAmount} onChangeText={setRemoveAmount} keyboardType="numeric" />
                      <Text style={styles.removeLabel}>Reason for removal</Text>
                      <TextInput style={[styles.removeInput, { height: 80, textAlignVertical: 'top' }]} placeholder="e.g. Fell ill, Sold, Frozen..." placeholderTextColor="#3D5C3A" value={removeReason} onChangeText={setRemoveReason} multiline />
                      <TouchableOpacity style={[styles.removeBtn, removeLoading && { opacity: 0.6 }]} onPress={handleRemove} disabled={removeLoading}>
                        {removeLoading ? <ActivityIndicator color="#fff" /> : <><Trash2 size={15} color="#fff" strokeWidth={2.5} /><Text style={styles.removeBtnText}>Remove Plants</Text></>}
                      </TouchableOpacity>
                    </View>
                  </>
                )}

                <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>REMOVAL HISTORY {removals.length > 0 ? `(${removals.length})` : ''}</Text></View>
                {removals.length === 0 ? (
                  <View style={styles.emptyState}><Text style={styles.emptyText}>No removals recorded yet</Text></View>
                ) : removals.map(r => (
                  <View key={r.id} style={styles.removalCard}>
                    <View style={styles.removalTop}>
                      <View style={styles.removalAmountBadge}><Text style={styles.removalAmountText}>−{r.amount}</Text></View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.removalReason}>{r.reason || 'No reason given'}</Text>
                        <Text style={styles.removalMeta}>by {r.removed_by_name} · {formatDate(r.created_at)}</Text>
                      </View>
                      {isBoss && (
                        <TouchableOpacity style={styles.removalDeleteBtn} onPress={() => handleDeleteRemoval(r)}>
                          <X size={13} color="#3D5C3A" strokeWidth={2.5} />
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* ══════ WATERING ══════ */}
            {activeTab === 'watering' && (
              <View>
                {(!!plant?.watering_interval_days || !!plant?.watering_amount_ml) && (
                  <View style={styles.scheduleInfoCard}>
                    <View style={styles.scheduleInfoHeader}><Calendar size={14} color="#7FAE7A" strokeWidth={2} /><Text style={styles.scheduleInfoTitle}>Recommended Schedule</Text></View>
                    <View style={styles.scheduleInfoRow}>
                      {!!plant?.watering_interval_days && (
                        <View style={styles.scheduleInfoItem}>
                          <Text style={styles.scheduleInfoLabel}>Frequency</Text>
                          <Text style={styles.scheduleInfoValue}>Every {plant.watering_interval_days}d</Text>
                        </View>
                      )}
                      {!!plant?.watering_amount_ml && (
                        <View style={styles.scheduleInfoItem}>
                          <Text style={styles.scheduleInfoLabel}>Per plant</Text>
                          <Text style={styles.scheduleInfoValue}>{formatMl(plant.watering_amount_ml)}</Text>
                        </View>
                      )}
                      {!!plant?.watering_amount_ml && (
                        <View style={styles.scheduleInfoItem}>
                          <Text style={styles.scheduleInfoLabel}>Total batch</Text>
                          <Text style={[styles.scheduleInfoValue, { color: '#29B6F6' }]}>
                            {formatMl(plant.watering_amount_ml * batch.current_quantity)}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>
                )}

                <View style={styles.lastActionCard}>
                  <View style={styles.lastActionIconBox}><Droplets size={24} color="#29B6F6" strokeWidth={1.75} /></View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.lastActionTitle}>{lastWatered ? `Last watered ${timeAgo(lastWatered.created_at)}` : 'Never been watered'}</Text>
                    {lastWatered && <Text style={styles.lastActionSub}>{formatMl(lastWatered.amount_ml)} per plant · by {lastWatered.logged_by_name} · {formatDate(lastWatered.created_at)}</Text>}
                  </View>
                </View>

                {!isCompleted && (
                  <>
                    <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>SELECT AMOUNT PER PLANT</Text></View>

                    {/* Preset buttons */}
                    <View style={styles.amountGrid}>
                      {WATER_AMOUNTS_ML.map(ml => (
                        <TouchableOpacity
                          key={ml}
                          style={[styles.amountBtn, selectedWaterAmount === ml && styles.amountBtnActive]}
                          onPress={() => {
                            if (selectedWaterAmount === ml) {
                              setSelectedWaterAmount(null);
                            } else {
                              setSelectedWaterAmount(ml);
                              setCustomWaterInput('');
                            }
                          }}
                        >
                          <Text style={[styles.amountBtnText, selectedWaterAmount === ml && styles.amountBtnTextActive]}>
                            {formatMl(ml)}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    {/* Custom amount input */}
                    <View style={styles.customAmountRow}>
                      <TextInput
                        style={styles.customAmountInput}
                        placeholder="Custom amount..."
                        placeholderTextColor="#3D5C3A"
                        keyboardType="numeric"
                        value={customWaterInput}
                        onChangeText={val => {
                          setCustomWaterInput(val);
                          const n = parseInt(val);
                          if (!val.trim()) {
                            setSelectedWaterAmount(null);
                          } else if (!isNaN(n) && n > 0) {
                            setSelectedWaterAmount(n);
                          }
                        }}
                      />
                      <Text style={styles.customAmountUnit}>ml</Text>
                    </View>

                    {selectedWaterAmount != null && (
                      <View style={styles.confirmBox}>
                        <Droplets size={14} color="#7FD4F5" strokeWidth={2} />
                        <Text style={styles.confirmText}>
                          {formatMl(selectedWaterAmount)} × {batch.current_quantity} plants = {formatMl(selectedWaterAmount * batch.current_quantity)} total
                        </Text>
                      </View>
                    )}

                    <TouchableOpacity
                      style={[styles.logBtn, styles.logBtnWater, (selectedWaterAmount == null || waterLoading) && styles.logBtnDisabled]}
                      onPress={handleLogWatering}
                      disabled={selectedWaterAmount == null || waterLoading}
                    >
                      {waterLoading ? <ActivityIndicator color="#fff" /> : <><Check size={16} color="#fff" strokeWidth={3} /><Text style={styles.logBtnText}>Log Watering</Text></>}
                    </TouchableOpacity>
                  </>
                )}

                {wateringLogs.length > 0 && (
                  <>
                    <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>WATERING HISTORY ({wateringLogs.length})</Text></View>
                    {wateringLogs.map(w => (
                      <View key={w.id} style={[styles.logHistoryCard, { borderLeftColor: '#29B6F6' }]}>
                        <Droplets size={20} color="#29B6F6" strokeWidth={1.75} />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.logHistoryAmount}>{formatMl(w.amount_ml)} per plant</Text>
                          <Text style={styles.logHistoryMeta}>by {w.logged_by_name} · {formatDate(w.created_at)}</Text>
                        </View>
                        <Text style={styles.logHistoryAgo}>{timeAgo(w.created_at)}</Text>
                      </View>
                    ))}
                  </>
                )}
              </View>
            )}

            {/* ══════ FERTILIZER ══════ */}
            {activeTab === 'fertilizer' && (
              <View>
                {!!plant?.fertilizing_interval_days && (
                  <View style={styles.scheduleInfoCard}>
                    <View style={styles.scheduleInfoHeader}><Calendar size={14} color="#7FAE7A" strokeWidth={2} /><Text style={styles.scheduleInfoTitle}>Recommended Schedule</Text></View>
                    <View style={styles.scheduleInfoRow}>
                      <View style={styles.scheduleInfoItem}>
                        <Text style={styles.scheduleInfoLabel}>Frequency</Text>
                        <Text style={styles.scheduleInfoValue}>Every {plant.fertilizing_interval_days}d</Text>
                      </View>
                    </View>
                  </View>
                )}

                <View style={styles.lastActionCard}>
                  <View style={styles.lastActionIconBox}><FlaskConical size={24} color="#AB47BC" strokeWidth={1.75} /></View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.lastActionTitle}>{lastFertilized ? `Last fertilized ${timeAgo(lastFertilized.created_at)}` : 'Never been fertilized'}</Text>
                    {lastFertilized && <Text style={styles.lastActionSub}>{formatMl(lastFertilized.amount_ml)} per plant · by {lastFertilized.logged_by_name} · {formatDate(lastFertilized.created_at)}</Text>}
                  </View>
                </View>

                {!isCompleted && (
                  <>
                    <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>SELECT AMOUNT PER PLANT</Text></View>

                    {/* Preset buttons */}
                    <View style={styles.amountGrid}>
                      {FERTILIZER_AMOUNTS_ML.map(ml => (
                        <TouchableOpacity
                          key={ml}
                          style={[styles.amountBtn, styles.amountBtnFert, selectedFertAmount === ml && styles.amountBtnActiveFert]}
                          onPress={() => {
                            if (selectedFertAmount === ml) {
                              setSelectedFertAmount(null);
                            } else {
                              setSelectedFertAmount(ml);
                              setCustomFertInput('');
                            }
                          }}
                        >
                          <Text style={[styles.amountBtnText, selectedFertAmount === ml && styles.amountBtnTextActiveFert]}>
                            {formatMl(ml)}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    {/* Custom amount input */}
                    <View style={[styles.customAmountRow, styles.customAmountRowFert]}>
                      <TextInput
                        style={styles.customAmountInput}
                        placeholder="Custom amount..."
                        placeholderTextColor="#3D5C3A"
                        keyboardType="numeric"
                        value={customFertInput}
                        onChangeText={val => {
                          setCustomFertInput(val);
                          const n = parseInt(val);
                          if (!val.trim()) {
                            setSelectedFertAmount(null);
                          } else if (!isNaN(n) && n > 0) {
                            setSelectedFertAmount(n);
                          }
                        }}
                      />
                      <Text style={styles.customAmountUnit}>ml</Text>
                    </View>

                    {selectedFertAmount != null && (
                      <View style={[styles.confirmBox, { borderColor: 'rgba(171,71,188,0.3)', backgroundColor: 'rgba(171,71,188,0.08)' }]}>
                        <FlaskConical size={14} color="#CE93D8" strokeWidth={2} />
                        <Text style={[styles.confirmText, { color: '#CE93D8' }]}>
                          {formatMl(selectedFertAmount)} × {batch.current_quantity} plants = {formatMl(selectedFertAmount * batch.current_quantity)} total
                        </Text>
                      </View>
                    )}

                    <TouchableOpacity
                      style={[styles.logBtn, styles.logBtnFert, (selectedFertAmount == null || fertLoading) && styles.logBtnDisabled]}
                      onPress={handleLogFertilizing}
                      disabled={selectedFertAmount == null || fertLoading}
                    >
                      {fertLoading ? <ActivityIndicator color="#fff" /> : <><Check size={16} color="#fff" strokeWidth={3} /><Text style={styles.logBtnText}>Log Fertilizing</Text></>}
                    </TouchableOpacity>
                  </>
                )}

                {fertilizingLogs.length > 0 && (
                  <>
                    <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>FERTILIZING HISTORY ({fertilizingLogs.length})</Text></View>
                    {fertilizingLogs.map(f => (
                      <View key={f.id} style={[styles.logHistoryCard, { borderLeftColor: '#AB47BC' }]}>
                        <FlaskConical size={20} color="#AB47BC" strokeWidth={1.75} />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.logHistoryAmount}>{formatMl(f.amount_ml)} per plant</Text>
                          <Text style={styles.logHistoryMeta}>by {f.logged_by_name} · {formatDate(f.created_at)}</Text>
                        </View>
                        <Text style={styles.logHistoryAgo}>{timeAgo(f.created_at)}</Text>
                      </View>
                    ))}
                  </>
                )}
              </View>
            )}

            {/* ══════ ACTIONS ══════ */}
            {activeTab === 'actions' && (
              <View>
                {!isCompleted && <Text style={styles.actionsNote}>Tap an action to log what was done to this batch.</Text>}
                {isCompleted && (
                  <View style={styles.completedActionsNote}>
                    <Eye size={14} color="#7FAE7A" strokeWidth={2} />
                    <Text style={styles.completedActionsNoteText}>This batch is completed — actions are read-only.</Text>
                  </View>
                )}

                {!isCompleted && ACTIONS.map(action => {
                  const IC = action.icon;
                  return (
                    <TouchableOpacity key={action.type} style={styles.actionCard}
                      onPress={() => {
                        setSelectedAction(action); setActionNotes('');
                        setActionNewLocation(
                          action.type === 'Relocated' && linkedJob?.job_type === 'Relocate' && linkedJob?.target_location
                            ? linkedJob.target_location : ''
                        );
                        setActionModalVisible(true);
                      }}
                      activeOpacity={0.7}>
                      <View style={[styles.actionIconBox, { backgroundColor: action.color + '22', borderColor: action.color + '55' }]}>
                        <IC size={20} color={action.color} strokeWidth={2} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.actionLabel}>{action.type}</Text>
                        {action.hasLocation && <Text style={styles.actionSub}>Updates batch location</Text>}
                      </View>
                      {linkedJob && ACTION_TO_JOB_TYPE[action.type] === linkedJob.job_type && (
                        <View style={styles.jobMatchBadge}><Text style={styles.jobMatchBadgeText}>Your job</Text></View>
                      )}
                      <ChevronRight size={18} color={action.color} strokeWidth={2.5} />
                    </TouchableOpacity>
                  );
                })}

                {actionLogs.length > 0 && (
                  <>
                    <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>ACTION HISTORY ({actionLogs.length})</Text></View>
                    {actionLogs.map(a => {
                      const def = ACTIONS.find(x => x.type === a.action_type);
                      const color = def?.color ?? '#7FAE7A';
                      const IC = def?.icon ?? Zap;
                      return (
                        <View key={a.id} style={[styles.logHistoryCard, { borderLeftColor: color }]}>
                          <IC size={18} color={color} strokeWidth={2} />
                          <View style={{ flex: 1 }}>
                            <Text style={styles.logHistoryAmount}>{a.action_type}</Text>
                            {a.notes ? <Text style={styles.actionHistoryNotes}>{a.notes}</Text> : null}
                            {a.new_location ? (
                              <View style={styles.actionHistoryLocationRow}>
                                <MapPin size={11} color="#3D5C3A" strokeWidth={2} />
                                <Text style={styles.actionHistoryNotes}>{a.new_location}</Text>
                              </View>
                            ) : null}
                            <Text style={styles.logHistoryMeta}>by {a.logged_by_name} · {formatDate(a.created_at)}</Text>
                          </View>
                          <Text style={styles.logHistoryAgo}>{timeAgo(a.created_at)}</Text>
                        </View>
                      );
                    })}
                  </>
                )}
              </View>
            )}

            {/* ══════ HISTORY ══════ */}
            {activeTab === 'history' && (() => {
              // Merge all event types into one chronological list
              type HistoryEntry =
                | { kind: 'watering';    id: string; created_at: string; amount_ml: number; logged_by_name: string }
                | { kind: 'fertilizing'; id: string; created_at: string; amount_ml: number; logged_by_name: string }
                | { kind: 'removal';     id: string; created_at: string; amount: number; reason: string | null; removed_by_name: string }
                | { kind: 'action';      id: string; created_at: string; action_type: string; notes: string | null; new_location: string | null; logged_by_name: string };

              const entries: HistoryEntry[] = [
                ...wateringLogs.map(w => ({ kind: 'watering' as const, ...w })),
                ...fertilizingLogs.map(f => ({ kind: 'fertilizing' as const, ...f })),
                ...removals.map(r => ({ kind: 'removal' as const, ...r })),
                ...actionLogs.map(a => ({ kind: 'action' as const, ...a })),
              ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

              if (entries.length === 0) {
                return (
                  <View style={styles.emptyState}>
                    <BookOpen size={44} color="#3D5C3A" strokeWidth={1.5} />
                    <Text style={styles.emptyText}>No activity yet</Text>
                  </View>
                );
              }

              return (
                <View>
                  <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>ALL ACTIVITY · {entries.length} EVENTS</Text>
                  </View>
                  {entries.map((entry, idx) => {
                    if (entry.kind === 'watering') {
                      return (
                        <View key={`w-${entry.id}`} style={[styles.historyCard, { borderLeftColor: '#29B6F6' }]}>
                          <View style={[styles.historyIconBox, { backgroundColor: 'rgba(41,182,246,0.12)' }]}>
                            <Droplets size={16} color="#29B6F6" strokeWidth={2} />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.historyTitle}>Watered</Text>
                            <Text style={styles.historyDetail}>{formatMl(entry.amount_ml)} per plant</Text>
                            <Text style={styles.historyMeta}>by {entry.logged_by_name} · {formatDate(entry.created_at)}</Text>
                          </View>
                          <Text style={styles.historyAgo}>{timeAgo(entry.created_at)}</Text>
                        </View>
                      );
                    }
                    if (entry.kind === 'fertilizing') {
                      return (
                        <View key={`f-${entry.id}`} style={[styles.historyCard, { borderLeftColor: '#AB47BC' }]}>
                          <View style={[styles.historyIconBox, { backgroundColor: 'rgba(171,71,188,0.12)' }]}>
                            <FlaskConical size={16} color="#AB47BC" strokeWidth={2} />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.historyTitle}>Fertilized</Text>
                            <Text style={styles.historyDetail}>{formatMl(entry.amount_ml)} per plant</Text>
                            <Text style={styles.historyMeta}>by {entry.logged_by_name} · {formatDate(entry.created_at)}</Text>
                          </View>
                          <Text style={styles.historyAgo}>{timeAgo(entry.created_at)}</Text>
                        </View>
                      );
                    }
                    if (entry.kind === 'removal') {
                      return (
                        <View key={`r-${entry.id}`} style={[styles.historyCard, { borderLeftColor: '#EF5350' }]}>
                          <View style={[styles.historyIconBox, { backgroundColor: 'rgba(239,83,80,0.12)' }]}>
                            <Minus size={16} color="#EF5350" strokeWidth={2.5} />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.historyTitle}>Removed {entry.amount} plants</Text>
                            {entry.reason ? <Text style={styles.historyDetail}>{entry.reason}</Text> : null}
                            <Text style={styles.historyMeta}>by {entry.removed_by_name} · {formatDate(entry.created_at)}</Text>
                          </View>
                          <Text style={styles.historyAgo}>{timeAgo(entry.created_at)}</Text>
                        </View>
                      );
                    }
                    if (entry.kind === 'action') {
                      const def   = ACTIONS.find(x => x.type === entry.action_type);
                      const color = def?.color ?? '#7FAE7A';
                      const IC    = def?.icon ?? Zap;
                      return (
                        <View key={`a-${entry.id}`} style={[styles.historyCard, { borderLeftColor: color }]}>
                          <View style={[styles.historyIconBox, { backgroundColor: color + '22' }]}>
                            <IC size={16} color={color} strokeWidth={2} />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.historyTitle}>{entry.action_type}</Text>
                            {entry.notes ? <Text style={styles.historyDetail}>{entry.notes}</Text> : null}
                            {entry.new_location ? (
                              <View style={styles.actionHistoryLocationRow}>
                                <MapPin size={11} color="#3D5C3A" strokeWidth={2} />
                                <Text style={styles.historyDetail}>{entry.new_location}</Text>
                              </View>
                            ) : null}
                            <Text style={styles.historyMeta}>by {entry.logged_by_name} · {formatDate(entry.created_at)}</Text>
                          </View>
                          <Text style={styles.historyAgo}>{timeAgo(entry.created_at)}</Text>
                        </View>
                      );
                    }
                    return null;
                  })}
                </View>
              );
            })()}

          </ScrollView>
        </KeyboardAvoidingView>

        {/* QR Modal */}
        <Modal visible={qrModalVisible} animationType="fade" transparent>
          <View style={styles.qrModalOverlay}>
            <View style={styles.qrModalBox}>
              <View style={styles.qrModalTitleRow}>
                <QrCode size={18} color="#E8F5E0" strokeWidth={2} />
                <Text style={styles.qrModalTitle}>Batch QR Code</Text>
              </View>
              <Text style={styles.qrModalSubtitle}>{plant?.name}</Text>
              {batch.location ? (
                <View style={styles.qrModalLocationRow}>
                  <MapPin size={12} color="#3D5C3A" strokeWidth={2} />
                  <Text style={styles.qrModalLocation}>{batch.location}</Text>
                </View>
              ) : null}
              <ViewShot ref={qrRef} options={{ format: 'png', quality: 1.0 }} style={styles.qrWrapper}>
                <View style={styles.qrInner}>
                  <QRCode value={`PLANTHOUSE_BATCH:${batch.id}`} size={220} color="#0E1A12" backgroundColor="#F0F7EE" />
                  <Text style={styles.qrLabel}>{plant?.name}</Text>
                  {batch.location ? <Text style={styles.qrSublabel}>{batch.location}</Text> : null}
                </View>
              </ViewShot>
              <Text style={styles.qrHint}>Scan this code to open this batch directly in the app.</Text>
              <View style={styles.qrButtons}>
                <TouchableOpacity style={styles.qrSaveBtn} onPress={async () => {
                  try {
                    const { status } = await MediaLibrary.requestPermissionsAsync();
                    if (status !== 'granted') { Alert.alert('Permission needed', 'Allow photo library access.'); return; }
                    if (qrRef.current) {
                      const uri = await qrRef.current.capture();
                      await MediaLibrary.saveToLibraryAsync(uri);
                      Alert.alert('Saved!', 'QR code saved to your photo library.');
                    }
                  } catch (e: any) { Alert.alert('Error', e.message); }
                }}>
                  <Download size={15} color="#fff" strokeWidth={2.5} />
                  <Text style={styles.qrSaveBtnText}>Save</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.qrShareBtn} onPress={async () => {
                  try {
                    if (qrRef.current) {
                      const uri = await qrRef.current.capture();
                      const canShare = await Sharing.isAvailableAsync();
                      if (!canShare) { Alert.alert('Not available', 'Sharing is not available on this device.'); return; }
                      await Sharing.shareAsync(uri, {
                        mimeType: 'image/png',
                        dialogTitle: `QR Code — ${plant?.name ?? 'Batch'}`,
                      });
                    }
                  } catch (e: any) { Alert.alert('Error', e.message); }
                }}>
                  <Share2 size={15} color="#4CAF50" strokeWidth={2.5} />
                  <Text style={styles.qrShareBtnText}>Share</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.qrCloseBtn} onPress={() => setQrModalVisible(false)}>
                  <Text style={styles.qrCloseBtnText}>Close</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Action Log Modal */}
        {selectedAction && (
          <View style={actionModalVisible ? styles.modalOverlay : { display: 'none' }}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ width: '100%' }}>
              <View style={styles.modalBox}>
                <View style={styles.modalHeader}>
                  <View style={[styles.modalActionIcon, { backgroundColor: selectedAction.color + '22', borderColor: selectedAction.color + '55' }]}>
                    {React.createElement(selectedAction.icon, { size: 24, color: selectedAction.color, strokeWidth: 2 })}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.modalTitle}>Log: {selectedAction.type}</Text>
                    <Text style={styles.modalSubtitle}>Batch · {batch?.plants?.name}</Text>
                  </View>
                </View>
                {selectedAction.hasLocation ? (
                  <>
                    <Text style={styles.modalLabel}>New Location (optional)</Text>
                    {locations.length > 0 ? (
                      <View style={styles.locationGrid}>
                        {locations.map(loc => (
                          <TouchableOpacity key={loc.id}
                            style={[styles.locationChip, actionNewLocation === loc.name && styles.locationChipActive]}
                            onPress={() => setActionNewLocation(actionNewLocation === loc.name ? '' : loc.name)}>
                            <MapPin size={12} color={actionNewLocation === loc.name ? '#EF5350' : '#7FAE7A'} strokeWidth={2} />
                            <Text style={[styles.locationChipText, actionNewLocation === loc.name && styles.locationChipTextActive]}>{loc.name}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    ) : (
                      <TextInput style={styles.modalInput} placeholder="No locations set up yet — type manually" placeholderTextColor="#3D5C3A" value={actionNewLocation} onChangeText={setActionNewLocation} />
                    )}
                  </>
                ) : null}
                <Text style={styles.modalLabel}>Notes (optional)</Text>
                <TextInput style={[styles.modalInput, { height: 90, textAlignVertical: 'top' }]} placeholder="Any details about this action..." placeholderTextColor="#3D5C3A" value={actionNotes} onChangeText={setActionNotes} multiline />
                <Text style={styles.modalWhoText}>Logged as: {profile?.full_name}</Text>
                <View style={styles.modalButtons}>
                  <TouchableOpacity style={styles.modalCancel} onPress={() => { setActionModalVisible(false); setSelectedAction(null); }}>
                    <Text style={styles.modalCancelText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.modalConfirm, { backgroundColor: selectedAction.color }, actionLoading && { opacity: 0.6 }]} onPress={handleLogAction} disabled={actionLoading}>
                    {actionLoading ? <ActivityIndicator color="#fff" /> : <><Check size={15} color="#fff" strokeWidth={3} /><Text style={styles.modalConfirmText}>Confirm</Text></>}
                  </TouchableOpacity>
                </View>
              </View>
            </KeyboardAvoidingView>
          </View>
        )}

        {/* Complete Batch Modal */}
        <Modal visible={completeModalVisible} animationType="slide" transparent>
          <View style={styles.modalOverlay}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ width: '100%' }}>
              <ScrollView keyboardShouldPersistTaps="handled">
                <View style={styles.modalBox}>
                  <View style={styles.modalHeader}>
                    <View style={styles.completeModalIcon}>
                      <CheckCircle size={28} color="#4CAF50" strokeWidth={2} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.modalTitle}>Complete Batch</Text>
                      <Text style={styles.modalSubtitle}>{batch?.plants?.name}</Text>
                    </View>
                  </View>
                  <Text style={styles.modalLabel}>REASON *</Text>
                  <View style={styles.reasonGrid}>
                    {COMPLETION_REASONS.map(r => {
                      const IC = r.icon;
                      return (
                        <TouchableOpacity key={r.label}
                          style={[styles.reasonChip, selectedReason === r.label && { borderColor: r.color, backgroundColor: r.color + '22' }]}
                          onPress={() => setSelectedReason(r.label === selectedReason ? null : r.label)}>
                          <IC size={15} color={selectedReason === r.label ? r.color : '#7FAE7A'} strokeWidth={2} />
                          <Text style={[styles.reasonLabel, selectedReason === r.label && { color: r.color, fontWeight: '700' }]}>{r.label}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                  <Text style={styles.modalLabel}>NOTES (optional)</Text>
                  <TextInput style={[styles.modalInput, { height: 80, textAlignVertical: 'top' }]} placeholder="e.g. Sold to Garden Center Riga, all 30 pots..." placeholderTextColor="#3D5C3A" value={completeNotes} onChangeText={setCompleteNotes} multiline />
                  <View style={styles.modalButtons}>
                    <TouchableOpacity style={styles.modalCancel} onPress={() => { setCompleteModalVisible(false); setSelectedReason(null); setCompleteNotes(''); }}>
                      <Text style={styles.modalCancelText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.modalConfirm, { backgroundColor: '#4CAF50' }, (!selectedReason || completing) && { opacity: 0.4 }]} onPress={handleCompleteBatch} disabled={!selectedReason || completing}>
                      {completing ? <ActivityIndicator color="#fff" /> : <><Check size={15} color="#fff" strokeWidth={3} /><Text style={styles.modalConfirmText}>Complete Batch</Text></>}
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
  centered:  { flex: 1, backgroundColor: '#0E1A12', alignItems: 'center', justifyContent: 'center' },
  blob:  { position: 'absolute', borderRadius: 999, opacity: 0.1 },
  blob1: { width: 350, height: 350, backgroundColor: '#3D8B37', top: -100, right: -120 },

  header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12 },
  headerBtn:   { padding: 4 },
  headerTitle: { color: '#E8F5E0', fontSize: 20, fontWeight: '800', flex: 1, textAlign: 'center' },
  qrBtn:       { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(76,175,80,0.15)', borderWidth: 1.5, borderColor: '#4CAF50', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  qrBtnText:   { color: '#4CAF50', fontWeight: '800', fontSize: 13 },

  completedTopBanner:      { flexDirection: 'row', alignItems: 'flex-start', gap: 12, backgroundColor: 'rgba(76,175,80,0.1)', borderWidth: 1.5, borderColor: 'rgba(76,175,80,0.4)', borderRadius: 14, marginHorizontal: 20, marginBottom: 12, padding: 14 },
  completedTopBannerTitle: { color: '#4CAF50', fontSize: 14, fontWeight: '700', marginBottom: 2 },
  completedTopBannerSub:   { color: '#7FAE7A', fontSize: 12 },
  completedTopBannerNotes: { color: '#3D5C3A', fontSize: 12, marginTop: 3 },

  jobBanner:      { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: 'rgba(76,175,80,0.12)', borderWidth: 1.5, borderColor: 'rgba(76,175,80,0.4)', borderRadius: 14, marginHorizontal: 20, marginBottom: 12, padding: 14 },
  jobBannerTitle: { color: '#4CAF50', fontSize: 14, fontWeight: '700', marginBottom: 2 },
  jobBannerSub:   { color: '#7FAE7A', fontSize: 12 },
  jobMatchBadge:  { backgroundColor: 'rgba(76,175,80,0.15)', borderWidth: 1, borderColor: '#4CAF50', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, marginRight: 8 },
  jobMatchBadgeText: { color: '#4CAF50', fontSize: 10, fontWeight: '700' },

  summaryCard:          { backgroundColor: '#162018', borderWidth: 1, borderColor: '#243524', borderRadius: 18, marginHorizontal: 20, marginBottom: 16, padding: 16 },
  summaryCardCompleted: { borderColor: 'rgba(76,175,80,0.3)', opacity: 0.85 },
  summaryRow:     { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 14 },
  summaryItem:    { alignItems: 'center', flex: 1 },
  summaryLabel:   { color: '#3D5C3A', fontSize: 10, fontWeight: '700', letterSpacing: 1, marginBottom: 4 },
  summaryValue:   { color: '#E8F5E0', fontSize: 26, fontWeight: '800' },
  summaryDivider: { width: 1, backgroundColor: '#243524' },
  progressTrack:  { height: 6, backgroundColor: '#243524', borderRadius: 3, marginBottom: 6, overflow: 'hidden' },
  progressFill:   { height: '100%', borderRadius: 3 },
  progressLabel:  { color: '#3D5C3A', fontSize: 11, textAlign: 'right', marginBottom: 10 },

  statusRow:    { flexDirection: 'row', gap: 8, marginBottom: 8 },
  statusPill:   { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#0E1A12', borderRadius: 10, borderWidth: 1, borderColor: '#243524', paddingHorizontal: 10, paddingVertical: 6 },
  statusText:   { color: '#7FAE7A', fontSize: 12, fontWeight: '600' },
  locationRow:  { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 },
  locationText: { color: '#7FAE7A', fontSize: 13 },

  tabBar:        { maxHeight: 52, marginBottom: 4 },
  tabBarContent: { paddingHorizontal: 20, gap: 8 },
  tab:           { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20, borderWidth: 1, borderColor: '#243524' },
  tabActive:     { borderColor: '#4CAF50', backgroundColor: 'rgba(76,175,80,0.15)' },
  tabText:       { color: '#7FAE7A', fontSize: 13, fontWeight: '600' },
  tabTextActive: { color: '#4CAF50', fontWeight: '700' },
  tabContent:    { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 60 },

  infoCard:    { backgroundColor: '#162018', borderRadius: 16, borderWidth: 1, borderColor: '#243524', padding: 16, marginBottom: 16 },
  infoRow:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10 },
  infoDivider: { height: 1, backgroundColor: '#1E2E1E' },
  infoLabel:   { color: '#3D5C3A', fontSize: 13, fontWeight: '600' },
  infoValue:   { color: '#E8F5E0', fontSize: 14, fontWeight: '600', textAlign: 'right', flex: 1, marginLeft: 16 },

  textCard:       { backgroundColor: '#162018', borderRadius: 16, borderWidth: 1, borderColor: '#243524', padding: 16, marginBottom: 16 },
  textCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 8 },
  textCardTitle:  { color: '#7FAE7A', fontSize: 13, fontWeight: '700' },
  textCardBody:   { color: '#E8F5E0', fontSize: 14, lineHeight: 22 },

  sectionHeader: { marginBottom: 10, marginTop: 8 },
  sectionTitle:  { color: '#3D5C3A', fontSize: 11, fontWeight: '700', letterSpacing: 1.5 },

  completeBatchBtn:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1.5, borderColor: '#4CAF50', borderRadius: 14, paddingVertical: 16, marginBottom: 20, backgroundColor: 'rgba(76,175,80,0.08)' },
  completeBatchBtnText: { color: '#4CAF50', fontWeight: '700', fontSize: 15 },

  completedActionsNote:     { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(76,175,80,0.08)', borderWidth: 1, borderColor: 'rgba(76,175,80,0.2)', borderRadius: 12, padding: 14, marginBottom: 16 },
  completedActionsNoteText: { color: '#7FAE7A', fontSize: 13 },

  removeCard:    { backgroundColor: '#162018', borderRadius: 16, borderWidth: 1, borderColor: '#243524', padding: 16, marginBottom: 16 },
  removeLabel:   { color: '#7FAE7A', fontSize: 12, fontWeight: '600', letterSpacing: 0.5, marginBottom: 8 },
  removeInput:   { backgroundColor: '#0E1A12', borderWidth: 1.5, borderColor: '#243524', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, color: '#E8F5E0', fontSize: 15, marginBottom: 14 },
  removeBtn:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#EF5350', borderRadius: 12, paddingVertical: 14, shadowColor: '#EF5350', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  removeBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  removalCard:        { backgroundColor: '#162018', borderRadius: 14, borderWidth: 1, borderColor: '#243524', borderLeftWidth: 3, borderLeftColor: '#EF5350', padding: 14, marginBottom: 10 },
  removalTop:         { flexDirection: 'row', alignItems: 'center', gap: 12 },
  removalAmountBadge: { backgroundColor: 'rgba(239,83,80,0.15)', borderWidth: 1, borderColor: '#EF5350', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, minWidth: 44, alignItems: 'center' },
  removalAmountText:  { color: '#EF5350', fontSize: 15, fontWeight: '800' },
  removalReason:      { color: '#E8F5E0', fontSize: 14, fontWeight: '600', marginBottom: 3 },
  removalMeta:        { color: '#3D5C3A', fontSize: 11 },
  removalDeleteBtn:   { padding: 6, borderRadius: 8, borderWidth: 1, borderColor: '#243524' },

  scheduleInfoCard:   { backgroundColor: '#162018', borderRadius: 16, borderWidth: 1, borderColor: '#243524', padding: 16, marginBottom: 16 },
  scheduleInfoHeader: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 12 },
  scheduleInfoTitle:  { color: '#7FAE7A', fontSize: 13, fontWeight: '700' },
  scheduleInfoRow:    { flexDirection: 'row', gap: 12 },
  scheduleInfoItem:   { flex: 1 },
  scheduleInfoLabel:  { color: '#3D5C3A', fontSize: 11, fontWeight: '600', marginBottom: 4 },
  scheduleInfoValue:  { color: '#E8F5E0', fontSize: 16, fontWeight: '800' },

  lastActionCard:    { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#162018', borderRadius: 14, borderWidth: 1, borderColor: '#243524', padding: 14, marginBottom: 16 },
  lastActionIconBox: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#0E1A12', alignItems: 'center', justifyContent: 'center' },
  lastActionTitle:   { color: '#E8F5E0', fontSize: 15, fontWeight: '700', marginBottom: 3 },
  lastActionSub:     { color: '#3D5C3A', fontSize: 12, lineHeight: 18 },

  // Amount grid
  amountGrid:              { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 12 },
  amountBtn:               { minWidth: '28%', flex: 1, paddingVertical: 14, paddingHorizontal: 8, borderRadius: 12, borderWidth: 1.5, borderColor: '#243524', backgroundColor: '#162018', alignItems: 'center' },
  amountBtnFert:           { borderColor: '#2D1F3D' },
  amountBtnActive:         { borderColor: '#29B6F6', backgroundColor: 'rgba(41,182,246,0.15)' },
  amountBtnActiveFert:     { borderColor: '#AB47BC', backgroundColor: 'rgba(171,71,188,0.15)' },
  amountBtnText:           { color: '#7FAE7A', fontSize: 14, fontWeight: '700' },
  amountBtnTextActive:     { color: '#29B6F6' },
  amountBtnTextActiveFert: { color: '#CE93D8' },

  // Custom amount input
  customAmountRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#162018', borderWidth: 1.5, borderColor: '#243524',
    borderRadius: 12, paddingHorizontal: 14, marginBottom: 16,
  },
  customAmountRowFert: {
    borderColor: '#2D1F3D',
  },
  customAmountInput: {
    flex: 1, color: '#E8F5E0', fontSize: 15, paddingVertical: 12,
  },
  customAmountUnit: {
    color: '#3D5C3A', fontSize: 14, fontWeight: '600',
  },

  confirmBox:  { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(41,182,246,0.3)', backgroundColor: 'rgba(41,182,246,0.08)', padding: 12, marginBottom: 16 },
  confirmText: { color: '#7FD4F5', fontSize: 14, fontWeight: '700' },

  logBtn:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 12, paddingVertical: 16, marginBottom: 24, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  logBtnWater:    { backgroundColor: '#0288D1', shadowColor: '#0288D1' },
  logBtnFert:     { backgroundColor: '#7B1FA2', shadowColor: '#7B1FA2' },
  logBtnDisabled: { opacity: 0.4 },
  logBtnText:     { color: '#fff', fontWeight: '800', fontSize: 16 },

  logHistoryCard:           { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#162018', borderRadius: 14, borderWidth: 1, borderColor: '#243524', borderLeftWidth: 3, padding: 14, marginBottom: 10 },
  logHistoryAmount:         { color: '#E8F5E0', fontSize: 14, fontWeight: '700', marginBottom: 3 },
  logHistoryMeta:           { color: '#3D5C3A', fontSize: 11 },
  logHistoryAgo:            { color: '#7FAE7A', fontSize: 12, fontWeight: '600' },

  actionsNote:              { color: '#3D5C3A', fontSize: 13, marginBottom: 16 },
  actionCard:               { backgroundColor: '#162018', borderRadius: 14, borderWidth: 1, borderColor: '#243524', padding: 16, marginBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 14 },
  actionIconBox:            { width: 44, height: 44, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  actionLabel:              { color: '#E8F5E0', fontSize: 16, fontWeight: '600', marginBottom: 2 },
  actionSub:                { color: '#3D5C3A', fontSize: 11 },
  actionHistoryNotes:       { color: '#7FAE7A', fontSize: 12, marginTop: 2, marginBottom: 2 },
  actionHistoryLocationRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2, marginBottom: 2 },

  modalOverlay:    { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' },
  modalBox:        { backgroundColor: '#162018', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 },
  modalHeader:     { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 20 },
  modalActionIcon: { width: 56, height: 56, borderRadius: 16, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  completeModalIcon: { width: 56, height: 56, borderRadius: 16, backgroundColor: 'rgba(76,175,80,0.15)', borderWidth: 1, borderColor: 'rgba(76,175,80,0.4)', alignItems: 'center', justifyContent: 'center' },
  modalTitle:      { color: '#E8F5E0', fontSize: 18, fontWeight: '800' },
  modalSubtitle:   { color: '#3D5C3A', fontSize: 12, marginTop: 2 },
  modalLabel:      { color: '#7FAE7A', fontSize: 12, fontWeight: '600', letterSpacing: 0.5, marginBottom: 8 },
  modalInput:      { backgroundColor: '#0E1A12', borderWidth: 1.5, borderColor: '#243524', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, color: '#E8F5E0', fontSize: 15, marginBottom: 16 },
  modalWhoText:    { color: '#3D5C3A', fontSize: 12, textAlign: 'center', marginBottom: 16 },
  locationGrid:    { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  locationChip:    { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20, borderWidth: 1.5, borderColor: '#243524', backgroundColor: '#162018' },
  locationChipActive:     { borderColor: '#EF5350', backgroundColor: 'rgba(239,83,80,0.12)' },
  locationChipText:       { color: '#7FAE7A', fontSize: 13, fontWeight: '600' },
  locationChipTextActive: { color: '#EF5350', fontWeight: '700' },
  modalButtons:    { flexDirection: 'row', gap: 12 },
  modalCancel:     { flex: 1, borderWidth: 1.5, borderColor: '#243524', borderRadius: 12, paddingVertical: 16, alignItems: 'center' },
  modalCancelText: { color: '#7FAE7A', fontWeight: '600' },
  modalConfirm:    { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 12, paddingVertical: 16 },
  modalConfirmText:{ color: '#fff', fontWeight: '700', fontSize: 15 },

  reasonGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  reasonChip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1.5, borderColor: '#243524', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: '#0E1A12' },
  reasonLabel:{ color: '#7FAE7A', fontSize: 13 },

  qrModalOverlay:     { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  qrModalBox:         { backgroundColor: '#162018', borderRadius: 24, borderWidth: 1, borderColor: '#243524', padding: 24, alignItems: 'center', width: '100%' },
  qrModalTitleRow:    { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  qrModalTitle:       { color: '#E8F5E0', fontSize: 20, fontWeight: '800' },
  qrModalSubtitle:    { color: '#7FAE7A', fontSize: 15, fontWeight: '600', marginBottom: 4 },
  qrModalLocationRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 20 },
  qrModalLocation:    { color: '#3D5C3A', fontSize: 13 },
  qrWrapper:          { borderRadius: 16, overflow: 'hidden', marginBottom: 16 },
  qrInner:            { backgroundColor: '#F0F7EE', borderRadius: 16, padding: 20, alignItems: 'center' },
  qrLabel:            { color: '#0E1A12', fontSize: 14, fontWeight: '800', marginTop: 12 },
  qrSublabel:         { color: '#3D5C3A', fontSize: 12, marginTop: 4 },
  qrHint:             { color: '#3D5C3A', fontSize: 12, textAlign: 'center', marginBottom: 20 },
  qrButtons:          { flexDirection: 'row', flexWrap: 'wrap', gap: 10, width: '100%' },
  qrSaveBtn:          { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#4CAF50', borderRadius: 12, paddingVertical: 14 },
  qrSaveBtnText:      { color: '#fff', fontWeight: '700', fontSize: 14 },
  qrShareBtn:         { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1.5, borderColor: '#4CAF50', borderRadius: 12, paddingVertical: 14 },
  qrShareBtnText:     { color: '#4CAF50', fontWeight: '700', fontSize: 14 },
  qrCloseBtn:         { width: '100%', borderWidth: 1.5, borderColor: '#243524', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  qrCloseBtnText:     { color: '#7FAE7A', fontWeight: '600', fontSize: 14 },

  emptyState: { alignItems: 'center', paddingVertical: 30 },
  emptyText:  { color: '#7FAE7A', fontSize: 15, fontWeight: '600' },

  // History tab
  historyCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#162018', borderRadius: 14, borderWidth: 1,
    borderColor: '#243524', borderLeftWidth: 3, padding: 14, marginBottom: 10,
  },
  historyIconBox: {
    width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center',
  },
  historyTitle:  { color: '#E8F5E0', fontSize: 14, fontWeight: '700', marginBottom: 2 },
  historyDetail: { color: '#7FAE7A', fontSize: 12, marginBottom: 2 },
  historyMeta:   { color: '#3D5C3A', fontSize: 11 },
  historyAgo:    { color: '#7FAE7A', fontSize: 11, fontWeight: '600' },
});