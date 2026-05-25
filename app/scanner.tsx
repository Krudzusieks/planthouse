import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';

export default function ScannerScreen() {
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);

  const handleBarCodeScanned = ({ data }: { data: string }) => {
    if (scanned) return;
    setScanned(true);

    if (data.startsWith('PLANTHOUSE_BATCH:')) {
      const batchId = data.replace('PLANTHOUSE_BATCH:', '').trim();
      if (batchId) {
        router.replace(`/batch-show?id=${batchId}`);
        return;
      }
    }
    Alert.alert(
      'Unknown QR Code',
      'This QR code is not a PlantHouse batch code.',
      [{ text: 'Scan Again', onPress: () => setScanned(false) }]
    );
  };

  if (!permission) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#4CAF50" size="large" />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.centered}>
        <Text style={styles.permissionIcon}>📷</Text>
        <Text style={styles.permissionTitle}>Camera Access Needed</Text>
        <Text style={styles.permissionText}>
          Allow camera access to scan batch QR codes.
        </Text>
        <TouchableOpacity style={styles.permissionBtn} onPress={requestPermission}>
          <Text style={styles.permissionBtnText}>Grant Permission</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.backLink} onPress={() => router.back()}>
          <Text style={styles.backLinkText}>← Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        style={StyleSheet.absoluteFillObject}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
      />

      <SafeAreaView style={styles.overlay}>
        {/* Top bar */}
        <View style={styles.topBar}>
          <TouchableOpacity style={styles.closeBtn} onPress={() => router.back()}>
            <Text style={styles.closeBtnText}>✕</Text>
          </TouchableOpacity>
          <Text style={styles.topTitle}>Scan Batch QR Code</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Scan box */}
        <View style={styles.scanArea}>
          <View style={[styles.corner, styles.cornerTL]} />
          <View style={[styles.corner, styles.cornerTR]} />
          <View style={[styles.corner, styles.cornerBL]} />
          <View style={[styles.corner, styles.cornerBR]} />
          {scanned ? (
            <View style={styles.processingBox}>
              <ActivityIndicator color="#4CAF50" size="large" />
              <Text style={styles.processingText}>Opening batch...</Text>
            </View>
          ) : null}
        </View>

        {/* Bottom */}
        <View style={styles.bottomBar}>
          <Text style={styles.hint}>
            Point camera at a PlantHouse batch QR code
          </Text>
          {scanned ? (
            <TouchableOpacity
              style={styles.rescanBtn}
              onPress={() => setScanned(false)}
            >
              <Text style={styles.rescanBtnText}>Scan Again</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </SafeAreaView>
    </View>
  );
}

const SCAN_SIZE = 260;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  centered: {
    flex: 1, backgroundColor: '#0E1A12',
    alignItems: 'center', justifyContent: 'center', padding: 32,
  },

  permissionIcon: { fontSize: 56, marginBottom: 16 },
  permissionTitle: { color: '#E8F5E0', fontSize: 22, fontWeight: '800', marginBottom: 10 },
  permissionText: {
    color: '#7FAE7A', fontSize: 15, textAlign: 'center',
    lineHeight: 22, marginBottom: 28,
  },
  permissionBtn: {
    backgroundColor: '#4CAF50', borderRadius: 14,
    paddingVertical: 16, paddingHorizontal: 32, marginBottom: 14,
  },
  permissionBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  backLink: { marginTop: 4 },
  backLinkText: { color: '#7FAE7A', fontSize: 15 },

  overlay: {
    flex: 1, alignItems: 'center', justifyContent: 'space-between',
  },

  topBar: {
    width: '100%', flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 12,
  },
  closeBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)', borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  closeBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  topTitle: { color: '#fff', fontSize: 16, fontWeight: '700' },

  scanArea: {
    width: SCAN_SIZE, height: SCAN_SIZE,
    alignItems: 'center', justifyContent: 'center',
  },
  corner: {
    position: 'absolute', width: 36, height: 36, borderColor: '#4CAF50', borderWidth: 3,
  },
  cornerTL: { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0, borderTopLeftRadius: 6 },
  cornerTR: { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0, borderTopRightRadius: 6 },
  cornerBL: { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0, borderBottomLeftRadius: 6 },
  cornerBR: { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0, borderBottomRightRadius: 6 },

  processingBox: { alignItems: 'center', gap: 12 },
  processingText: { color: '#4CAF50', fontWeight: '700', fontSize: 15 },

  bottomBar: {
    width: '100%', alignItems: 'center',
    paddingBottom: 52, paddingHorizontal: 32, gap: 16,
  },
  hint: { color: 'rgba(255,255,255,0.7)', fontSize: 14, textAlign: 'center' },
  rescanBtn: {
    backgroundColor: '#4CAF50', borderRadius: 12,
    paddingVertical: 14, paddingHorizontal: 40,
  },
  rescanBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});