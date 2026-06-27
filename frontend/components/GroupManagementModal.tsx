import React, { useState, useEffect } from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { createGroup, addGroupMember, getUsers, getGroupMembersDetailed, User, Group, joinGroupByInvite } from '../services/api';
import { useSettings } from '../context/SettingsContext';

interface GroupManagementModalProps {
  visible: boolean;
  onClose: () => void;
  currentUserId: number;
  userGroups: Group[];
  activeGroupId?: number;
  onSelectGroup: (group: Group) => void;
  onGroupCreated: (group?: Group) => void;
}

export default function GroupManagementModal({ visible, onClose, currentUserId, userGroups, activeGroupId, onSelectGroup, onGroupCreated }: GroupManagementModalProps) {
  const { theme } = useSettings();
  const [groupName, setGroupName] = useState('');
  const [groupDesc, setGroupDesc] = useState('');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'select' | 'create' | 'add_members' | 'join'>('select');
  const [createdGroup, setCreatedGroup] = useState<Group | null>(null);

  const [inviteCodeInput, setInviteCodeInput] = useState('');

  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);

  const [expandedGroupId, setExpandedGroupId] = useState<number | null>(null);
  const [expandedMembers, setExpandedMembers] = useState<any[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);

  useEffect(() => {
    if (visible) {
      setStep('select');
      setInviteCodeInput('');
      setGroupName('');
      setGroupDesc('');
    }
  }, [visible]);

  useEffect(() => {
    if (visible && step === 'add_members') {
      fetchUsers();
    }
  }, [visible, step]);

  const fetchUsers = async () => {
    try {
      const users = await getUsers();
      setAllUsers(users.filter(u => u.id !== currentUserId));
    } catch (e) {
      console.error(e);
    }
  };

  const handleGroupPress = async (g: Group) => {
    if (expandedGroupId === g.id) {
      setExpandedGroupId(null);
    } else {
      setExpandedGroupId(g.id);
      setExpandedMembers([]);
      setLoadingMembers(true);
      try {
        const members = await getGroupMembersDetailed(g.id);
        setExpandedMembers(members);
      } catch (e) {
        console.error(e);
      } finally {
        setLoadingMembers(false);
      }
    }
  };

  const handleCreateGroup = async () => {
    if (!groupName.trim()) {
      Alert.alert('Error', 'Please enter a group name');
      return;
    }
    setLoading(true);
    try {
      const g = await createGroup({
        name: groupName.trim(),
        description: groupDesc.trim(),
      }, currentUserId);
      setCreatedGroup(g);
      setStep('add_members');
      onGroupCreated();
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Failed to create group');
    } finally {
      setLoading(false);
    }
  };

  const handleJoinGroup = async () => {
    if (!inviteCodeInput.trim()) {
      Alert.alert('Error', 'Please enter an invite code');
      return;
    }
    setLoading(true);
    try {
      await joinGroupByInvite(inviteCodeInput.trim().toLowerCase(), currentUserId);
      Alert.alert('Success', 'Successfully joined the group!');
      setStep('select');
      setInviteCodeInput('');
      onGroupCreated(); // Refresh the parent's list
    } catch (e: any) {
      console.error(e);
      Alert.alert('Error', e.response?.data?.detail || 'Failed to join group. Invalid code?');
    } finally {
      setLoading(false);
    }
  };

  const handleAddMembers = async () => {
    if (!createdGroup) return;
    setLoading(true);
    try {
      // Add each selected user to the group
      for (const userId of selectedUserIds) {
        await addGroupMember(createdGroup.id, userId);
      }
      onGroupCreated(createdGroup);
      handleClose();
    } catch (e) {
      Alert.alert('Error', 'Failed to add some members');
    } finally {
      setLoading(false);
    }
  };

  const toggleUser = (id: number) => {
    if (selectedUserIds.includes(id)) {
      setSelectedUserIds(selectedUserIds.filter(uid => uid !== id));
    } else {
      setSelectedUserIds([...selectedUserIds, id]);
    }
  };

  const handleClose = () => {
    setGroupName('');
    setGroupDesc('');
    setStep('select');
    setCreatedGroup(null);
    setSelectedUserIds([]);
    setExpandedGroupId(null);
    onClose();
  };

  const isExpanded = (id: number) => expandedGroupId === id;

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { backgroundColor: theme.background }]}>
          <View style={[styles.header, { borderBottomColor: theme.border }]}>
            {step !== 'select' && (
              <TouchableOpacity onPress={() => setStep('select')} style={styles.backBtn}>
                <Ionicons name="arrow-back" size={24} color={theme.text} />
              </TouchableOpacity>
            )}
            <Text style={[styles.title, { color: theme.text }]}>
              {step === 'select' ? 'Select Group' : step === 'create' ? 'New Group' : step === 'join' ? 'Join Group' : 'Add Members'}
            </Text>
            <TouchableOpacity onPress={handleClose} style={[styles.closeBtn, { backgroundColor: theme.surface }]}>
              <Ionicons name="close" size={24} color={theme.text} />
            </TouchableOpacity>
          </View>

          {step === 'select' && (
            <View style={styles.body}>
              <View style={styles.actionCards}>
                <TouchableOpacity style={[styles.actionCard, { backgroundColor: theme.card, borderColor: theme.border }]} onPress={() => setStep('create')}>
                  <View style={[styles.actionIcon, { backgroundColor: theme.primaryLight + '20' }]}>
                    <Ionicons name="add" size={24} color={theme.primary} />
                  </View>
                  <Text style={[styles.actionText, { color: theme.text }]}>Create Group</Text>
                </TouchableOpacity>

                <TouchableOpacity style={[styles.actionCard, { backgroundColor: theme.card, borderColor: theme.border }]} onPress={() => setStep('join')}>
                  <View style={[styles.actionIcon, { backgroundColor: theme.success + '20' }]}>
                    <Ionicons name="enter-outline" size={24} color={theme.success} />
                  </View>
                  <Text style={[styles.actionText, { color: theme.text }]}>Join via Code</Text>
                </TouchableOpacity>
              </View>

              <Text style={[styles.sectionTitle, { color: theme.text }]}>Your Groups</Text>
              <ScrollView style={{ flex: 1 }}>
                {userGroups.length === 0 ? (
                  <View style={styles.emptyContainer}>
                    <Text style={[styles.emptyText, { color: theme.textSecondary }]}>You are not in any active groups.</Text>
                  </View>
                ) : (
                  userGroups.map(g => {
                    const isActive = activeGroupId === g.id;
                    const isExpandedFlag = isExpanded(g.id);
                    return (
                      <View key={g.id} style={[styles.groupCardWrapper, { backgroundColor: theme.card, borderColor: theme.border }]}>
                        <TouchableOpacity
                          style={styles.groupCard}
                          onPress={() => {
                            onSelectGroup(g);
                            handleClose();
                          }}
                        >
                          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <View style={[styles.groupIcon, { backgroundColor: theme.primaryLight + '20' }]}>
                              <Text style={[styles.groupIconText, { color: theme.primary }]}>{g.name.substring(0, 2).toUpperCase()}</Text>
                            </View>
                            <View>
                              <Text style={[styles.groupName, { color: theme.text }]}>{g.name}</Text>
                              <Text style={[styles.groupDesc, { color: theme.textSecondary }]}>{g.description || 'No description'}</Text>
                            </View>
                          </View>
                          {isActive && <Ionicons name="checkmark-circle" size={24} color={theme.primary} />}
                        </TouchableOpacity>

                        <TouchableOpacity style={[styles.expandBtn, { borderTopColor: theme.border }]} onPress={() => handleGroupPress(g)}>
                          <Text style={[styles.expandText, { color: theme.primaryLight }]}>
                            {isExpandedFlag ? 'Hide Members' : 'View Members'}
                          </Text>
                          <Ionicons name={isExpandedFlag ? "chevron-up" : "chevron-down"} size={16} color={theme.primaryLight} />
                        </TouchableOpacity>

                        {isExpandedFlag && (
                          <View style={[styles.membersList, { backgroundColor: theme.surface }]}>
                            {loadingMembers ? (
                              <ActivityIndicator size="small" color={theme.primaryLight} />
                            ) : (
                              expandedMembers.map(m => (
                                <View key={m.id} style={styles.memberRowSmall}>
                                  <View style={[styles.memberAvatarSmall, { backgroundColor: theme.card }]}>
                                    <Text style={[styles.memberAvatarTextSmall, { color: theme.primary }]}>{m.name.charAt(0)}</Text>
                                  </View>
                                  <Text style={[styles.memberNameSmall, { color: theme.text }]}>{m.name}</Text>
                                </View>
                              ))
                            )}
                          </View>
                        )}
                      </View>
                    );
                  })
                )}
              </ScrollView>
            </View>
          )}

          {step === 'join' && (
            <View style={styles.body}>
              <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Invite Code</Text>
              <TextInput
                style={[styles.input, { borderColor: theme.border, color: theme.text, backgroundColor: theme.surface }]}
                value={inviteCodeInput}
                onChangeText={setInviteCodeInput}
                placeholder="e.g. a1b2c3d4"
                placeholderTextColor={theme.textSecondary}
                autoCapitalize="none"
              />
              <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: theme.primary }]} onPress={handleJoinGroup} disabled={loading}>
                {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.primaryBtnText}>Join Group</Text>}
              </TouchableOpacity>
            </View>
          )}

          {step === 'create' && (
            <View style={styles.body}>
              <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Group Name</Text>
              <TextInput
                style={[styles.input, { borderColor: theme.border, color: theme.text, backgroundColor: theme.surface }]}
                value={groupName}
                onChangeText={setGroupName}
                placeholder="e.g. Goa Trip 🌴"
                placeholderTextColor={theme.textSecondary}
              />

              <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Description (Optional)</Text>
              <TextInput
                style={[styles.input, { borderColor: theme.border, color: theme.text, backgroundColor: theme.surface }]}
                value={groupDesc}
                onChangeText={setGroupDesc}
                placeholder="What's this group for?"
                placeholderTextColor={theme.textSecondary}
              />

              <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: theme.primary }]} onPress={handleCreateGroup} disabled={loading}>
                {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.primaryBtnText}>Continue</Text>}
              </TouchableOpacity>
            </View>
          )}

          {step === 'add_members' && (
            <View style={styles.stepContainer}>
              <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>Select Users to Add</Text>
              <View style={[styles.userList, { backgroundColor: theme.card, borderColor: theme.border }]}>
                {allUsers.map(u => {
                  const isSelected = selectedUserIds.includes(u.id);
                  return (
                    <TouchableOpacity
                      key={u.id}
                      style={[styles.userRow, { borderBottomColor: theme.border }, isSelected && { backgroundColor: theme.primaryLight + '30' }]}
                      onPress={() => toggleUser(u.id)}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <View style={[styles.userAvatar, { backgroundColor: theme.surface }]}>
                          <Text style={[styles.userAvatarText, { color: theme.primary }]}>{u.name.charAt(0)}</Text>
                        </View>
                        <Text style={[styles.userName, { color: theme.text }]}>{u.name}</Text>
                      </View>
                      <Ionicons name={isSelected ? "checkmark-circle" : "ellipse-outline"} size={24} color={isSelected ? theme.primary : theme.textSecondary} />
                    </TouchableOpacity>
                  );
                })}
              </View>

              <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: theme.primary }]} onPress={handleAddMembers} disabled={loading}>
                {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.primaryBtnText}>Create & Finish</Text>}
              </TouchableOpacity>
              <TouchableOpacity style={styles.skipBtn} onPress={handleClose}>
                <Text style={[styles.skipBtnText, { color: theme.textSecondary }]}>Skip for now</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalContent: { height: '85%', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 20, paddingBottom: 16, borderBottomWidth: 1 },
  title: { fontSize: 20, fontFamily: 'Inter_700Bold', flex: 1 },
  backBtn: { marginRight: 16, padding: 4 },
  closeBtn: { padding: 4, borderRadius: 16 },
  body: { flex: 1 },
  
  actionCards: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24 },
  actionCard: { width: '48%', padding: 16, borderRadius: 16, alignItems: 'center', borderWidth: 1 },
  actionIcon: { width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  actionText: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  
  sectionTitle: { fontSize: 16, fontFamily: 'Inter_600SemiBold', marginBottom: 12 },
  emptyContainer: { padding: 20, alignItems: 'center', justifyContent: 'center' },
  emptyText: { fontSize: 14, fontFamily: 'Inter_400Regular', fontStyle: 'italic' },
  
  groupCardWrapper: { borderRadius: 16, marginBottom: 12, borderWidth: 1, overflow: 'hidden' },
  groupCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 },
  groupIcon: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  groupIconText: { fontSize: 16, fontFamily: 'Inter_700Bold' },
  groupName: { fontSize: 16, fontFamily: 'Inter_600SemiBold', marginBottom: 4 },
  groupDesc: { fontSize: 13, fontFamily: 'Inter_400Regular' },
  
  expandBtn: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingVertical: 10, borderTopWidth: 1 },
  expandText: { fontSize: 13, fontFamily: 'Inter_500Medium', marginRight: 4 },
  
  membersList: { padding: 12, borderTopWidth: 0 },
  memberRowSmall: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  memberAvatarSmall: { width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  memberAvatarTextSmall: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  memberNameSmall: { fontSize: 14, fontFamily: 'Inter_500Medium', flex: 1 },
  adminBadge: { fontSize: 10, fontFamily: 'Inter_700Bold' },
  
  stepContainer: { flex: 1, paddingTop: 10 },
  inputLabel: { fontSize: 14, fontFamily: 'Inter_500Medium', marginBottom: 8 },
  input: { borderWidth: 1, borderRadius: 12, padding: 16, fontSize: 16, fontFamily: 'Inter_400Regular', marginBottom: 16 },
  helperText: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: -8, marginBottom: 24 },
  
  primaryBtn: { padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 'auto' },
  primaryBtnText: { color: '#FFF', fontSize: 16, fontFamily: 'Inter_600SemiBold' },
  
  userList: { borderRadius: 12, borderWidth: 1, maxHeight: 300, marginBottom: 20 },
  userRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12, borderBottomWidth: 1 },
  userAvatar: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  userAvatarText: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
  userName: { fontSize: 15, fontFamily: 'Inter_500Medium' },
  
  skipBtn: { padding: 16, alignItems: 'center', marginTop: 8 },
  skipBtnText: { fontSize: 15, fontFamily: 'Inter_500Medium' }
});
