import React, { useState, useEffect } from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet, Alert, ScrollView, TextInput, Share, Switch } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { getGroupMembersDetailed, removeGroupMember, deleteGroup, getUsers, addGroupMember, updateGroup, archiveGroup, getUserGroups, unarchiveGroup, createUser } from '../services/api';
import { useSettings } from '../context/SettingsContext';
import * as LocalAuthentication from 'expo-local-authentication';

export default function AppSettingsModal({ visible, onClose, group, currentUserId, onGroupDeleted, onGroupUpdated }: any) {
  const [members, setMembers] = useState<any[]>([]);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [archivedGroups, setArchivedGroups] = useState<any[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [newName, setNewName] = useState(group?.name || '');
  const [addingMembers, setAddingMembers] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState<number[]>([]);
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const { isDarkMode, setIsDarkMode, pushEnabled, setPushEnabled, appLockEnabled, setAppLockEnabled, currency, setCurrency, theme } = useSettings();
  const [currentScreen, setCurrentScreen] = useState<'main' | 'appearance' | 'activeGroup' | 'archived' | 'notifications' | 'security' | 'currency'>('main');

  useEffect(() => {
    if (visible) {
      setCurrentScreen('main');
      loadArchivedGroups();
      if (group) {
        loadDetails();
        setNewName(group.name);
        setEditingName(false);
        setAddingMembers(false);
        setSelectedUsers([]);
      }
    }
  }, [visible, group]);

  const loadArchivedGroups = async () => {
    try {
      const arch = await getUserGroups(currentUserId, true);
      setArchivedGroups(arch);
    } catch (e) {
      console.error(e);
    }
  };

  const loadDetails = async () => {
    try {
      const detailedMembers = await getGroupMembersDetailed(group.id);
      setMembers(detailedMembers);
      const me = detailedMembers.find((m: any) => m.id === currentUserId);
      if (me && me.is_admin) {
        setIsAdmin(true);
      } else {
        setIsAdmin(false);
      }

      const users = await getUsers();
      setAllUsers(users);
    } catch (e) {
      console.error(e);
    }
  };

  const handleSaveName = async () => {
    if (!newName.trim()) return;
    try {
      const updated = await updateGroup(group.id, currentUserId, { name: newName });
      onGroupUpdated(updated);
      setEditingName(false);
    } catch (e) {
      Alert.alert('Error', 'Failed to update group name');
    }
  };

  const handleRemoveMember = (userId: number, name: string) => {
    Alert.alert('Remove Member', `Are you sure you want to remove ${name} from ${group.name}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive', onPress: async () => {
          try {
            await removeGroupMember(group.id, userId, currentUserId);
            loadDetails();
          } catch (e) {
            Alert.alert('Error', 'Failed to remove member');
          }
        }
      }
    ]);
  };

  const handleLeaveGroup = () => {
    Alert.alert('Leave Group', `Are you sure you want to leave ${group.name}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Leave', style: 'destructive', onPress: async () => {
          try {
            await removeGroupMember(group.id, currentUserId, currentUserId);
            onGroupDeleted();
            onClose();
          } catch (e) {
            Alert.alert('Error', 'Failed to leave group');
          }
        }
      }
    ]);
  };

  const handleArchiveGroup = () => {
    Alert.alert(
      'Archive Group?',
      'Archiving will hide this group from your active dashboard but keep all historical expenses safe. You can unarchive it later from Settings.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Archive', onPress: async () => {
            try {
              await archiveGroup(group.id, currentUserId);
              onGroupDeleted();
              onClose();
            } catch (e) {
              Alert.alert('Error', 'Failed to archive group');
            }
          }
        }
      ]
    );
  };

  const handleDeleteGroup = () => {
    Alert.alert(
      'Delete Group permanently?',
      'This will permanently delete this group, all its members, and all recorded expenses and balances. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive', onPress: async () => {
            try {
              await deleteGroup(group.id, currentUserId);
              onGroupDeleted();
              onClose();
            } catch (e) {
              Alert.alert('Error', 'Failed to delete group');
            }
          }
        }
      ]
    );
  };

  const handleAddMembersSubmit = async () => {
    if (selectedUsers.length === 0) {
      Alert.alert('Error', 'Please select users to add');
      return;
    }
    try {
      for (const uid of selectedUsers) {
        await addGroupMember(group.id, uid, false);
      }
      setAddingMembers(false);
      setSelectedUsers([]);
      loadDetails();
    } catch (e) {
      Alert.alert('Error', 'Failed to add members');
    }
  };

  const handleCreateAndAddUser = async () => {
    if (!newMemberName.trim()) {
      Alert.alert('Error', 'Please enter a name for the new member');
      return;
    }
    try {
      const randomSuffix = Math.floor(Math.random() * 100000);
      const emailToUse = newMemberEmail.trim() || `${newMemberName.toLowerCase().replace(/\s+/g, '')}${randomSuffix}@example.com`;
      const newUser = await createUser({ name: newMemberName.trim(), email: emailToUse });
      await addGroupMember(group.id, newUser.id, false);
      setNewMemberName('');
      setNewMemberEmail('');
      setAddingMembers(false);
      loadDetails();
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Failed to create and add user');
    }
  };

  const handleUnarchive = async (archivedGroupId: number) => {
    try {
      await unarchiveGroup(archivedGroupId, currentUserId);
      loadArchivedGroups();
      onGroupUpdated();
    } catch (e) {
      Alert.alert('Error', 'Failed to unarchive group');
    }
  };

  const handleToggleAppLock = async () => {
    if (appLockEnabled) {
      // Trying to disable it - prompt for auth
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();

      if (!hasHardware || !isEnrolled) {
        setAppLockEnabled(false);
        return;
      }

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Authenticate to disable App Lock',
        fallbackLabel: 'Use Passcode',
      });

      if (result.success) {
        setAppLockEnabled(false);
      }
    } else {
      // Trying to enable it - just enable it
      setAppLockEnabled(true);
    }
  };

  const nonMembers = allUsers.filter(u => !members.find((m: any) => m.id === u.id));

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { backgroundColor: theme.background }]}>
          <View style={[styles.header, { borderBottomColor: theme.border }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
              {currentScreen !== 'main' && (
                <TouchableOpacity onPress={() => setCurrentScreen('main')} style={{ marginRight: 16 }}>
                  <Ionicons name="arrow-back" size={24} color={theme.text} />
                </TouchableOpacity>
              )}
              <Text style={[styles.headerTitle, { color: theme.text }]}>
                {currentScreen === 'main' ? 'Settings' :
                  currentScreen === 'appearance' ? 'Appearance' :
                    currentScreen === 'activeGroup' ? 'Group Settings' :
                      currentScreen === 'notifications' ? 'Notifications' :
                        currentScreen === 'security' ? 'Privacy & Security' :
                          currentScreen === 'currency' ? 'Currency' : 'Archived Groups'}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.body}>

            {currentScreen === 'main' && (
              <View>
                <TouchableOpacity style={[styles.settingRow, { borderBottomColor: theme.border }]} onPress={() => setCurrentScreen('appearance')}>
                  <View style={styles.settingRowLeft}>
                    <Ionicons name="color-palette-outline" size={24} color={theme.primary} style={{ marginRight: 15 }} />
                    <Text style={[styles.settingText, { color: theme.text }]}>Appearance</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
                </TouchableOpacity>

                {group && (
                  <TouchableOpacity style={[styles.settingRow, { borderBottomColor: theme.border }]} onPress={() => setCurrentScreen('activeGroup')}>
                    <View style={styles.settingRowLeft}>
                      <Ionicons name="people-outline" size={24} color={theme.primary} style={{ marginRight: 15 }} />
                      <Text style={[styles.settingText, { color: theme.text }]}>Active Group Settings</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
                  </TouchableOpacity>
                )}

                <TouchableOpacity style={[styles.settingRow, { borderBottomColor: theme.border }]} onPress={() => setCurrentScreen('archived')}>
                  <View style={styles.settingRowLeft}>
                    <Ionicons name="archive-outline" size={24} color={theme.primary} style={{ marginRight: 15 }} />
                    <Text style={[styles.settingText, { color: theme.text }]}>Archived Groups</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
                </TouchableOpacity>

                <TouchableOpacity style={[styles.settingRow, { borderBottomColor: theme.border }]} onPress={() => setCurrentScreen('notifications')}>
                  <View style={styles.settingRowLeft}>
                    <Ionicons name="notifications-outline" size={24} color={theme.primary} style={{ marginRight: 15 }} />
                    <Text style={[styles.settingText, { color: theme.text }]}>Notifications</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
                </TouchableOpacity>

                <TouchableOpacity style={[styles.settingRow, { borderBottomColor: theme.border }]} onPress={() => setCurrentScreen('security')}>
                  <View style={styles.settingRowLeft}>
                    <Ionicons name="lock-closed-outline" size={24} color={theme.primary} style={{ marginRight: 15 }} />
                    <Text style={[styles.settingText, { color: theme.text }]}>Privacy & Security</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
                </TouchableOpacity>

                <TouchableOpacity style={[styles.settingRow, { borderBottomWidth: 0 }]} onPress={() => setCurrentScreen('currency')}>
                  <View style={styles.settingRowLeft}>
                    <Ionicons name="cash-outline" size={24} color={theme.primary} style={{ marginRight: 15 }} />
                    <Text style={[styles.settingText, { color: theme.text }]}>Default Currency</Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={{ color: theme.textSecondary, marginRight: 8, fontFamily: 'Inter_500Medium' }}>{currency}</Text>
                    <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
                  </View>
                </TouchableOpacity>
              </View>
            )}

            {currentScreen === 'appearance' && (
              <View style={[styles.themeRow, { borderBottomColor: theme.border }]}>
                <Text style={[styles.themeLabel, { color: theme.text }]}>Dark Mode</Text>
                <Switch 
                  value={isDarkMode} 
                  onValueChange={setIsDarkMode} 
                  trackColor={{ false: theme.border, true: theme.primary }}
                  thumbColor={isDarkMode ? theme.text : theme.textSecondary}
                />
              </View>
            )}

            {currentScreen === 'notifications' && (
              <View>
                <View style={[styles.themeRow, { borderBottomColor: theme.border }]}>
                  <Text style={[styles.themeLabel, { color: theme.text }]}>Push Notifications</Text>
                  <Switch 
                    value={pushEnabled} 
                    onValueChange={setPushEnabled} 
                    trackColor={{ false: theme.border, true: theme.primary }}
                    thumbColor={pushEnabled ? theme.text : theme.textSecondary}
                  />
                </View>
                <Text style={[styles.infoText, { color: theme.textSecondary }]}>Get notified when expenses are added or settled.</Text>
              </View>
            )}

            {currentScreen === 'security' && (
              <View>
                <View style={[styles.themeRow, { borderBottomColor: theme.border }]}>
                  <Text style={[styles.themeLabel, { color: theme.text }]}>App Lock (Biometrics)</Text>
                  <Switch 
                    value={appLockEnabled} 
                    onValueChange={handleToggleAppLock} 
                    trackColor={{ false: theme.border, true: theme.primary }}
                    thumbColor={appLockEnabled ? theme.text : theme.textSecondary}
                  />
                </View>
                <Text style={[styles.infoText, { color: theme.textSecondary }]}>Require Face ID or Fingerprint to open the app.</Text>
              </View>
            )}

            {currentScreen === 'currency' && (
              <View>
                {['INR (₹)', 'USD ($)', 'EUR (€)', 'GBP (£)'].map(c => (
                  <TouchableOpacity
                    key={c}
                    style={[styles.currencyRow, { borderBottomColor: theme.border }]}
                    onPress={() => setCurrency(c)}
                  >
                    <Text style={[styles.currencyText, { color: theme.text }]}>{c}</Text>
                    {currency === c && <Ionicons name="checkmark-circle" size={24} color={theme.primary} />}
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {currentScreen === 'activeGroup' && group && (
              <View>
                <View style={[styles.sectionHeaderRow, { marginBottom: 16 }]}>
                  <Text style={[styles.subSectionTitle, { color: theme.text }]}>{group.name}</Text>
                  {isAdmin && (
                    <TouchableOpacity onPress={() => setEditingName(!editingName)}>
                      <Ionicons name="pencil" size={20} color={theme.primary} />
                    </TouchableOpacity>
                  )}
                </View>

                {editingName && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
                    <TextInput
                      style={[styles.nameInput, { flex: 1, color: theme.text, borderColor: theme.primary }]}
                      value={newName}
                      onChangeText={setNewName}
                    />
                    <TouchableOpacity onPress={handleSaveName} style={{ marginLeft: 12 }}>
                      <Ionicons name="checkmark-circle" size={28} color={theme.primary} />
                    </TouchableOpacity>
                  </View>
                )}

                <View style={[styles.codeContainer, { backgroundColor: theme.surface }]}>
                  <View>
                    <Text style={[styles.codeLabel, { color: theme.textSecondary }]}>Invite Code</Text>
                    <Text style={[styles.codeValue, { color: theme.text }]}>{group.invite_code}</Text>
                  </View>
                  <TouchableOpacity 
                    style={{ backgroundColor: theme.primary, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, flexDirection: 'row', alignItems: 'center' }}
                    onPress={async () => {
                      try {
                        await Share.share({
                          message: `Join my SplitSmart group '${group.name}'!\n\nClick this link to join: https://splitsmart.app/invite/${group.invite_code}`
                        });
                      } catch (error) {
                        console.error(error);
                      }
                    }}
                  >
                    <Ionicons name="share-social" size={18} color="#FFF" style={{ marginRight: 6 }} />
                    <Text style={{ color: '#FFF', fontFamily: 'Inter_600SemiBold' }}>Share</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.sectionHeaderRow}>
                  <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>Members ({members.length})</Text>
                  {!addingMembers && (
                    <TouchableOpacity onPress={() => setAddingMembers(true)}>
                      <Text style={[styles.addBtnText, { color: theme.primary }]}>+ Add</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {addingMembers ? (
                  <View style={[styles.addMembersBox, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                    <Text style={[styles.subtitle, { marginBottom: 12, color: theme.text }]}>Create a New Member:</Text>
                    <View style={{ marginBottom: 16 }}>
                      <TextInput
                        style={[styles.nameInput, { borderColor: theme.border, color: theme.text }]}
                        placeholder="Member Name"
                        placeholderTextColor={theme.textSecondary}
                        value={newMemberName}
                        onChangeText={setNewMemberName}
                      />
                      <TouchableOpacity 
                        style={[styles.saveBtn, { marginTop: 8, backgroundColor: theme.primary }]} 
                        onPress={handleCreateAndAddUser}
                      >
                        <Text style={styles.saveBtnText}>Create & Add</Text>
                      </TouchableOpacity>
                    </View>

                    {nonMembers.length > 0 && (
                      <>
                        <View style={{ height: 1, backgroundColor: theme.border, marginVertical: 12 }} />
                        <Text style={[styles.subtitle, { color: theme.text }]}>Or select existing users:</Text>
                        {nonMembers.map(u => {
                          const isSel = selectedUsers.includes(u.id);
                          return (
                            <TouchableOpacity
                              key={u.id}
                              style={[styles.userRow, isSel && { backgroundColor: theme.surface }, { borderBottomColor: theme.border }]}
                              onPress={() => {
                                if (isSel) setSelectedUsers(prev => prev.filter(id => id !== u.id));
                                else setSelectedUsers(prev => [...prev, u.id]);
                              }}
                            >
                              <Ionicons name={isSel ? "checkbox" : "square-outline"} size={20} color={isSel ? theme.primary : theme.textSecondary} style={{ marginRight: 10 }} />
                              <Text style={[styles.userName, { color: theme.text }]}>{u.name}</Text>
                            </TouchableOpacity>
                          );
                        })}
                        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 10 }}>
                          <TouchableOpacity style={[styles.saveBtn, { backgroundColor: theme.primary }]} onPress={handleAddMembersSubmit}>
                            <Text style={styles.saveBtnText}>Add Selected</Text>
                          </TouchableOpacity>
                        </View>
                      </>
                    )}
                    
                    <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 10 }}>
                      <TouchableOpacity onPress={() => setAddingMembers(false)} style={{ padding: 8 }}>
                        <Text style={{ color: theme.textSecondary }}>Cancel</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  members.map(m => (
                    <View key={m.id} style={[styles.memberRow, { borderBottomColor: theme.border }]}>
                      <View style={styles.memberInfo}>
                        <View style={[styles.avatarCircle, { backgroundColor: theme.surface }]}>
                          <Text style={[styles.avatarText, { color: theme.primary }]}>{m.name.charAt(0)}</Text>
                        </View>
                        <View>
                          <Text style={[styles.memberName, { color: theme.text }]}>{m.name} {m.id === currentUserId && '(You)'}</Text>
                          {m.is_admin && <Text style={{ color: theme.primary, fontSize: 12 }}>Admin</Text>}
                        </View>
                      </View>
                      {(m.id !== currentUserId) && (
                        <TouchableOpacity onPress={() => handleRemoveMember(m.id, m.name)}>
                          <Ionicons name="person-remove" size={20} color={theme.danger} />
                        </TouchableOpacity>
                      )}
                    </View>
                  ))
                )}

                <View style={styles.dangerZone}>
                  {isAdmin ? (
                    <>
                      <TouchableOpacity style={[styles.dangerBtn, { borderColor: theme.danger }]} onPress={handleArchiveGroup}>
                        <Ionicons name="archive-outline" size={20} color={theme.danger} style={{ marginRight: 8 }} />
                        <Text style={[styles.dangerText, { color: theme.danger }]}>Archive Group</Text>
                      </TouchableOpacity>

                      <TouchableOpacity style={[styles.dangerBtn, { marginTop: 16, borderColor: theme.danger }]} onPress={handleDeleteGroup}>
                        <Ionicons name="trash" size={20} color={theme.danger} style={{ marginRight: 8 }} />
                        <Text style={[styles.dangerText, { color: theme.danger }]}>Delete Group</Text>
                      </TouchableOpacity>
                    </>
                  ) : (
                    <TouchableOpacity style={[styles.dangerBtn, { borderColor: theme.danger }]} onPress={handleLeaveGroup}>
                      <Ionicons name="exit-outline" size={20} color={theme.danger} style={{ marginRight: 8 }} />
                      <Text style={[styles.dangerText, { color: theme.danger }]}>Leave Group</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            )}

            {currentScreen === 'archived' && (
              <View>
                {archivedGroups.length === 0 ? (
                  <Text style={{ color: theme.textSecondary, fontStyle: 'italic', marginTop: 8 }}>No archived groups.</Text>
                ) : (
                  archivedGroups.map(ag => (
                    <View key={ag.id} style={[styles.memberRow, { borderBottomColor: theme.border }]}>
                      <Text style={[styles.memberName, { color: theme.text }]}>{ag.name}</Text>
                      <TouchableOpacity style={[styles.saveBtn, { backgroundColor: theme.primary }]} onPress={() => handleUnarchive(ag.id)}>
                        <Text style={styles.saveBtnText}>Unarchive</Text>
                      </TouchableOpacity>
                    </View>
                  ))
                )}
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalContent: { borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 24, minHeight: '60%', maxHeight: '90%' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 20, borderBottomWidth: 1 },
  headerTitle: { fontSize: 20, fontFamily: 'Inter_700Bold' },
  body: { paddingVertical: 20 },
  settingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 18, borderBottomWidth: 1 },
  settingRowLeft: { flexDirection: 'row', alignItems: 'center' },
  settingText: { fontSize: 16, fontFamily: 'Inter_500Medium' },
  themeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 18, borderBottomWidth: 1 },
  themeLabel: { fontSize: 16, fontFamily: 'Inter_500Medium' },
  infoText: { fontSize: 13, fontFamily: 'Inter_400Regular', marginTop: 8 },
  currencyRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 18, borderBottomWidth: 1 },
  currencyText: { fontSize: 16, fontFamily: 'Inter_500Medium' },
  nameInput: { fontSize: 20, fontFamily: 'Inter_700Bold', borderBottomWidth: 1, paddingVertical: 5 },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 24, marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontFamily: 'Inter_600SemiBold' },
  subSectionTitle: { fontSize: 18, fontFamily: 'Inter_700Bold' },
  addBtnText: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  codeContainer: { padding: 16, borderRadius: 12, alignItems: 'center', marginBottom: 24, borderWidth: 1 },
  codeLabel: { fontSize: 12, fontFamily: 'Inter_600SemiBold', marginBottom: 4 },
  codeValue: { fontSize: 24, fontFamily: 'Inter_700Bold', letterSpacing: 2 },
  memberRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1 },
  memberInfo: { flexDirection: 'row', alignItems: 'center' },
  avatarCircle: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  avatarText: { fontSize: 16, fontFamily: 'Inter_600SemiBold' },
  memberName: { fontSize: 16, fontFamily: 'Inter_500Medium' },
  addMembersBox: { padding: 16, borderRadius: 12, marginTop: 12, borderWidth: 1 },
  subtitle: { fontSize: 16, fontFamily: 'Inter_500Medium' },
  userRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1 },
  userName: { fontSize: 16, fontFamily: 'Inter_400Regular' },
  saveBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
  saveBtnText: { color: '#FFF', fontFamily: 'Inter_600SemiBold' },
  dangerZone: { marginTop: 30, marginBottom: 10, alignItems: 'center' },
  archiveText: { color: '#FDCB6E', fontSize: 16, fontFamily: 'Inter_600SemiBold' },
  sectionContainer: { marginBottom: 32 },
  themeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, backgroundColor: 'rgba(255,255,255,0.05)', padding: 16, borderRadius: 12 },
  themeLabel: { color: '#FFF', fontSize: 16, fontFamily: 'Inter_500Medium' },
  infoText: { color: '#888', fontSize: 13, fontFamily: 'Inter_400Regular', marginTop: 8, marginLeft: 4 },
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.1)', marginVertical: 8 },
  currencyRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  currencyText: { color: '#FFF', fontSize: 16, fontFamily: 'Inter_500Medium' },
  archivedRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.1)' },
  archivedName: { color: '#FFF', fontSize: 16, fontFamily: 'Inter_500Medium' },
  unarchiveBtn: { backgroundColor: 'rgba(108, 92, 231, 0.2)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  unarchiveText: { color: '#A29BFE', fontFamily: 'Inter_600SemiBold', fontSize: 14 }
});
