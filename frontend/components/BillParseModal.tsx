import React, { useState } from 'react';
import {
  Modal, View, Text, StyleSheet, TouchableOpacity,
  ActivityIndicator, ScrollView, Image
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { BillItem, ParsedBill } from '../services/api';
import { useSettings } from '../context/SettingsContext';

interface BillParseModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: (bill: ParsedBill, assignedItems: Record<string, number[]>) => void;
  parseBill: (uri: string, mimeType: string) => Promise<ParsedBill>;
  groupMembers: { id: number; name: string }[];
}

export default function BillParseModal({ visible, onClose, onConfirm, parseBill, groupMembers }: BillParseModalProps) {
  const { currencySymbol, theme } = useSettings();
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [parsedBill, setParsedBill] = useState<ParsedBill | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [assignedItems, setAssignedItems] = useState<Record<number, number[]>>({}); // itemIndex -> [userId, ...]

  const pickImage = async (fromCamera: boolean) => {
    const result = fromCamera
      ? await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8 })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8 });

    if (!result.canceled && result.assets.length > 0) {
      setImageUri(result.assets[0].uri);
      setParsedBill(null);
      setError(null);
      setAssignedItems({});
    }
  };

  const handleParseBill = async () => {
    if (!imageUri) return;
    setLoading(true);
    setError(null);
    try {
      const result = await parseBill(imageUri, 'image/jpeg');
      setParsedBill(result);
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Failed to scan the bill. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const toggleAssignment = (itemIndex: number, userId: number) => {
    setAssignedItems(prev => {
      const current = prev[itemIndex] ?? [];
      const updated = current.includes(userId)
        ? current.filter(id => id !== userId)
        : [...current, userId];
      return { ...prev, [itemIndex]: updated };
    });
  };

  const handleClose = () => {
    setImageUri(null);
    setParsedBill(null);
    setError(null);
    setAssignedItems({});
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <View style={styles.overlay}>
        <View style={[styles.sheet, { backgroundColor: theme.background, borderColor: theme.border }]}>
          <View style={[styles.handle, { backgroundColor: theme.border }]} />
          <Text style={[styles.title, { color: theme.text }]}>📸 Scan Bill</Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>Zomato, Swiggy, or any physical receipt</Text>

          {/* Image picker buttons */}
          {!imageUri && (
            <View style={styles.pickButtons}>
              <TouchableOpacity style={styles.pickBtn} onPress={() => pickImage(true)}>
                <LinearGradient colors={[theme.card, theme.surface]} style={[styles.pickBtnGradient, { borderColor: theme.border }]}>
                  <Ionicons name="camera" size={32} color={theme.primary} />
                  <Text style={[styles.pickBtnText, { color: theme.text }]}>Take Photo</Text>
                </LinearGradient>
              </TouchableOpacity>
              <TouchableOpacity style={styles.pickBtn} onPress={() => pickImage(false)}>
                <LinearGradient colors={[theme.card, theme.surface]} style={[styles.pickBtnGradient, { borderColor: theme.border }]}>
                  <Ionicons name="images" size={32} color={theme.primaryLight} />
                  <Text style={[styles.pickBtnText, { color: theme.text }]}>Gallery</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          )}

          {/* Preview image + re-pick */}
          {imageUri && (
            <View style={styles.previewContainer}>
              <Image source={{ uri: imageUri }} style={styles.preview} resizeMode="cover" />
              <TouchableOpacity style={styles.changeImageBtn} onPress={() => setImageUri(null)}>
                <Text style={[styles.changeImageText, { color: theme.primaryLight }]}>Change Image</Text>
              </TouchableOpacity>
              {!parsedBill && (
                <TouchableOpacity style={styles.parseBtn} onPress={handleParseBill} disabled={loading}>
                  <LinearGradient colors={[theme.primary, theme.primaryLight]} style={styles.parseBtnGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                    {loading
                      ? <ActivityIndicator color="#FFF" />
                      : <><Ionicons name="sparkles" size={18} color="#FFF" style={{ marginRight: 8 }} /><Text style={styles.parseBtnText}>Scan with Gemini Vision</Text></>}
                  </LinearGradient>
                </TouchableOpacity>
              )}
            </View>
          )}

          {error && (
            <View style={[styles.errorBox, { backgroundColor: theme.dangerLight, borderColor: theme.danger }]}>
              <Ionicons name="alert-circle-outline" size={16} color={theme.danger} />
              <Text style={[styles.errorText, { color: theme.danger }]}>{error}</Text>
            </View>
          )}

          {/* Parsed Bill Items */}
          {parsedBill && (
            <ScrollView showsVerticalScrollIndicator={false} style={{ marginTop: 12, maxHeight: 380 }}>
              <Text style={[styles.restaurantName, { color: theme.text }]}>{parsedBill.restaurant_name ?? 'Bill Items'}</Text>
              <Text style={[styles.assignHint, { color: theme.textSecondary }]}>Tap member names to assign each item</Text>

              {parsedBill.items.map((item, index) => (
                <View key={index} style={[styles.itemCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
                  <View style={[styles.itemHeader, { borderBottomColor: theme.border }]}>
                    <Text style={[styles.itemName, { color: theme.text }]}>{item.name}</Text>
                    <Text style={[styles.itemPrice, { color: theme.text }]}>{currencySymbol}{item.price.toFixed(2)}</Text>
                  </View>
                  <View style={styles.membersRow}>
                    {groupMembers.map(member => {
                      const assigned = (assignedItems[index] ?? []).includes(member.id);
                      return (
                        <TouchableOpacity
                          key={member.id}
                          style={[styles.memberTag, { borderColor: theme.border, backgroundColor: theme.surface }, assigned && { backgroundColor: theme.primaryLight + '30', borderColor: theme.primary }]}
                          onPress={() => toggleAssignment(index, member.id)}
                        >
                          <Text style={[styles.memberTagText, { color: theme.textSecondary }, assigned && { color: theme.primary }]}>
                            {member.name}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              ))}

              {/* Summary row */}
              <View style={styles.summaryRow}>
                <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>Taxes & Charges</Text>
                <Text style={[styles.summaryValue, { color: theme.text }]}>{currencySymbol}{parsedBill.taxes_and_charges.toFixed(2)}</Text>
              </View>
              <View style={[styles.summaryRow, { marginBottom: 4 }]}>
                <Text style={[styles.summaryLabel, { color: theme.text, fontFamily: 'Inter_600SemiBold' }]}>Grand Total</Text>
                <Text style={[styles.summaryValue, { color: theme.primary, fontFamily: 'Inter_700Bold', fontSize: 16 }]}>
                  {currencySymbol}{parsedBill.grand_total.toFixed(2)}
                </Text>
              </View>

              <TouchableOpacity style={[styles.confirmBtn, { backgroundColor: theme.primary }]} onPress={() => onConfirm(parsedBill, assignedItems)}>
                <Text style={styles.confirmBtnText}>Confirm Bill Split</Text>
              </TouchableOpacity>
            </ScrollView>
          )}

        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, maxHeight: '95%', borderWidth: 1 },
  handle: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  title: { fontFamily: 'Inter_700Bold', fontSize: 22, marginBottom: 4 },
  subtitle: { fontFamily: 'Inter_400Regular', fontSize: 14, marginBottom: 20 },
  pickButtons: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  pickBtn: { width: '48%', borderRadius: 16, overflow: 'hidden' },
  pickBtnGradient: { paddingVertical: 28, alignItems: 'center', borderRadius: 16, borderWidth: 1 },
  pickBtnText: { fontFamily: 'Inter_600SemiBold', fontSize: 13, marginTop: 10 },
  previewContainer: { marginBottom: 16 },
  preview: { width: '100%', height: 180, borderRadius: 16, marginBottom: 12 },
  changeImageBtn: { alignSelf: 'flex-end', marginBottom: 8 },
  changeImageText: { fontFamily: 'Inter_400Regular', fontSize: 13 },
  parseBtn: { borderRadius: 16, overflow: 'hidden' },
  parseBtnGradient: { flexDirection: 'row', paddingVertical: 16, justifyContent: 'center', alignItems: 'center', borderRadius: 16 },
  parseBtnText: { fontFamily: 'Inter_600SemiBold', fontSize: 16 },
  errorBox: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 12, marginBottom: 12, borderWidth: 1 },
  errorText: { fontFamily: 'Inter_400Regular', fontSize: 13, marginLeft: 8, flex: 1 },
  restaurantName: { fontFamily: 'Inter_700Bold', fontSize: 18, marginBottom: 4 },
  assignHint: { fontFamily: 'Inter_400Regular', fontSize: 13, marginBottom: 14 },
  itemCard: { borderRadius: 16, marginBottom: 12, overflow: 'hidden', borderWidth: 1 },
  itemHeader: { flexDirection: 'row', justifyContent: 'space-between', padding: 14, borderBottomWidth: 1 },
  itemName: { fontFamily: 'Inter_600SemiBold', fontSize: 15, flex: 1 },
  itemPrice: { fontFamily: 'Inter_700Bold', fontSize: 15 },
  membersRow: { flexDirection: 'row', flexWrap: 'wrap', padding: 14, paddingTop: 10, gap: 8 },
  memberTag: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
  memberTagText: { fontFamily: 'Inter_500Medium', fontSize: 12 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8, paddingHorizontal: 4 },
  summaryLabel: { fontFamily: 'Inter_400Regular', fontSize: 14 },
  summaryValue: { fontFamily: 'Inter_600SemiBold', fontSize: 14 },
  confirmBtn: { paddingVertical: 16, borderRadius: 16, alignItems: 'center', marginTop: 12, marginBottom: 20 },
  confirmBtnText: { fontFamily: 'Inter_600SemiBold', fontSize: 16 }
});
