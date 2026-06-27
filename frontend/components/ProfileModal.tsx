import React, { useState, useEffect } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, Alert, Image, TextInput } from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useSettings } from '../context/SettingsContext';

interface ProfileModalProps {
  visible: boolean;
  onClose: () => void;
  user: { id: number; name: string; email?: string; phone_number?: string; upi_vpa?: string };
  onUpdateUser: (user: any) => void;
  profilePicUri: string | null;
  setProfilePicUri: (uri: string | null) => void;
  onOpenSettings: () => void;
  onOpenHelp: () => void;
  onLogout?: () => void;
}

export default function ProfileModal({ visible, onClose, user, onUpdateUser, profilePicUri, setProfilePicUri, onOpenSettings, onOpenHelp, onLogout }: ProfileModalProps) {
  const { theme } = useSettings();
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(user.name);
  const [editPhone, setEditPhone] = useState(user.phone_number || '');
  const [editUpi, setEditUpi] = useState(user.upi_vpa || '');

  useEffect(() => {
    if (visible) {
      setIsEditing(false);
      setEditName(user.name);
      setEditPhone(user.phone_number || '');
      setEditUpi(user.upi_vpa || '');
    }
  }, [visible, user]);

  const handleSave = () => {
    onUpdateUser({ ...user, name: editName, phone_number: editPhone, upi_vpa: editUpi });
    setIsEditing(false);
  };

  const handleEditAvatar = () => {
    Alert.alert('Change Profile Picture', 'Choose an option', [
      {
        text: 'Take Photo',
        onPress: async () => {
          const perm = await ImagePicker.requestCameraPermissionsAsync();
          if (perm.granted) {
            const result = await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [1, 1], quality: 0.5 });
            if (!result.canceled && result.assets && result.assets.length > 0) {
              setProfilePicUri(result.assets[0].uri);
            }
          } else {
            Alert.alert('Permission Denied', 'Camera access is required.');
          }
        }
      },
      {
        text: 'Choose from Gallery',
        onPress: async () => {
          const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (perm.granted) {
            const result = await ImagePicker.launchImageLibraryAsync({ allowsEditing: true, aspect: [1, 1], quality: 0.5, mediaTypes: ['images'] });
            if (!result.canceled && result.assets && result.assets.length > 0) {
              setProfilePicUri(result.assets[0].uri);
            }
          } else {
            Alert.alert('Permission Denied', 'Gallery access is required.');
          }
        }
      },
      { text: 'Cancel', style: 'cancel' }
    ]);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <BlurView intensity={20} style={StyleSheet.absoluteFill}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.background, borderColor: theme.border }]}>
            <View style={styles.header}>
              <Text style={[styles.title, { color: theme.text }]}>Profile</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                {isEditing ? (
                  <TouchableOpacity onPress={handleSave} style={{ marginRight: 16 }}>
                    <Text style={{ color: theme.success, fontFamily: 'Inter_600SemiBold', fontSize: 16 }}>Save</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity onPress={() => setIsEditing(true)} style={{ marginRight: 16 }}>
                    <Text style={{ color: theme.primary, fontFamily: 'Inter_600SemiBold', fontSize: 16 }}>Edit</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                  <Ionicons name="close" size={24} color={theme.textSecondary} />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.avatarContainer}>
              <TouchableOpacity style={styles.profileAvatarContainer} onPress={handleEditAvatar}>
                {profilePicUri ? (
                  <Image source={{ uri: profilePicUri }} style={styles.profileAvatarImage} />
                ) : (
                  <View style={[styles.profileAvatar, { backgroundColor: theme.primary }]}>
                    <Text style={styles.avatarText}>{user.name.split(' ').map(n => n[0]).join('')}</Text>
                  </View>
                )}
                <View style={[styles.editIconBadge, { backgroundColor: theme.surface, borderColor: theme.background }]}>
                  <Ionicons name="camera" size={14} color={theme.text} />
                </View>
              </TouchableOpacity>
              {isEditing ? (
                <TextInput style={[styles.userName, styles.inputField, { textAlign: 'center', backgroundColor: theme.inputBackground, color: theme.text }]} value={editName} onChangeText={setEditName} placeholder="Your Name" placeholderTextColor={theme.textSecondary} />
              ) : (
                <Text style={[styles.userName, { color: theme.text }]}>{user.name}</Text>
              )}
              <Text style={[styles.userEmail, { color: theme.textSecondary }]}>{user.email || 'rohan@example.com'} (Fixed)</Text>
            </View>

            <View style={[styles.infoSection, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <View style={[styles.infoRow, { borderBottomColor: theme.border }]}>
                <Ionicons name="call-outline" size={20} color={theme.primaryLight} />
                {isEditing ? (
                  <TextInput style={[styles.infoText, styles.inputField, { backgroundColor: theme.inputBackground, color: theme.text }]} value={editPhone} onChangeText={setEditPhone} placeholder="Phone Number" placeholderTextColor={theme.textSecondary} keyboardType="phone-pad" />
                ) : (
                  <Text style={[styles.infoText, { color: theme.text }]}>{user.phone_number || '+91 98765 43210'}</Text>
                )}
              </View>
              <View style={[styles.infoRow, { borderBottomWidth: 0 }]}>
                <Ionicons name="scan-outline" size={20} color={theme.primaryLight} />
                {isEditing ? (
                  <TextInput style={[styles.infoText, styles.inputField, { backgroundColor: theme.inputBackground, color: theme.text }]} value={editUpi} onChangeText={setEditUpi} placeholder="UPI VPA" placeholderTextColor={theme.textSecondary} autoCapitalize="none" />
                ) : (
                  <Text style={[styles.infoText, { color: theme.text }]}>{user.upi_vpa || 'rohan@upi'}</Text>
                )}
              </View>

              <View style={styles.settingsSection}>
                <TouchableOpacity style={[styles.settingsRow, { borderTopColor: theme.border }]} onPress={onOpenSettings}>
                  <View style={styles.settingsRowLeft}>
                    <Ionicons name="settings-outline" size={20} color={theme.primaryLight} />
                    <Text style={[styles.settingsRowText, { color: theme.text }]}>App Settings</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
                </TouchableOpacity>
                <TouchableOpacity style={[styles.settingsRow, { borderTopColor: theme.border }]} onPress={onOpenHelp}>
                  <View style={styles.settingsRowLeft}>
                    <Ionicons name="help-circle-outline" size={20} color={theme.primaryLight} />
                    <Text style={[styles.settingsRowText, { color: theme.text }]}>Help & Support</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
                </TouchableOpacity>
              </View>
            </View>

            {!isEditing && (
              <TouchableOpacity 
                style={[styles.logoutBtn, { backgroundColor: theme.dangerLight + '20' }]} 
                onPress={() => {
                  onClose();
                  if (onLogout) onLogout();
                }}
              >
                <Ionicons name="log-out-outline" size={20} color={theme.danger} />
                <Text style={[styles.logoutBtnText, { color: theme.danger }]}>Log Out</Text>
              </TouchableOpacity>
            )}

          </View>
        </View>
      </BlurView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: 'rgba(0,0,0,0.6)' },
  modalContent: { borderRadius: 24, padding: 24, borderWidth: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  title: { fontFamily: 'Inter_700Bold', fontSize: 24 },
  closeBtn: { padding: 4 },
  avatarContainer: { alignItems: 'center', marginBottom: 32 },
  profileAvatarContainer: { position: 'relative', marginBottom: 16 },
  profileAvatar: { width: 80, height: 80, borderRadius: 40, justifyContent: 'center', alignItems: 'center' },
  profileAvatarImage: { width: 80, height: 80, borderRadius: 40 },
  editIconBadge: { position: 'absolute', bottom: 0, right: 0, width: 24, height: 24, borderRadius: 12, justifyContent: 'center', alignItems: 'center', borderWidth: 2 },
  avatarText: { color: '#FFF', fontSize: 32, fontFamily: 'Inter_700Bold' },
  userName: { fontSize: 20, fontFamily: 'Inter_600SemiBold', marginBottom: 4 },
  userEmail: { fontSize: 14, fontFamily: 'Inter_400Regular' },
  infoSection: { borderRadius: 16, padding: 16, marginBottom: 24, borderWidth: 1 },
  infoRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1 },
  infoText: { fontSize: 16, fontFamily: 'Inter_400Regular', marginLeft: 16 },
  inputField: { borderRadius: 8, paddingHorizontal: 12, paddingVertical: 4, minWidth: 150 },
  settingsSection: { marginTop: 16 },
  settingsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 16, borderTopWidth: 1 },
  settingsRowLeft: { flexDirection: 'row', alignItems: 'center' },
  settingsRowText: { fontSize: 16, fontFamily: 'Inter_500Medium', marginLeft: 16 },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 16, borderRadius: 16 },
  logoutBtnText: { fontSize: 16, fontFamily: 'Inter_600SemiBold', marginLeft: 8 },
});
