import React, { useState } from 'react';
import { 
  Modal, View, Text, TextInput, TouchableOpacity, 
  StyleSheet, Animated, Platform, ScrollView, Alert, KeyboardAvoidingView 
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { createRecurringExpense, getUsers, createUser } from '../services/api';
import { useSettings } from '../context/SettingsContext';

interface RecurringExpenseModalProps {
  visible: boolean;
  onClose: () => void;
  groupMembers: { id: number; name: string }[];
  groupId: number;
  currentUserId: number;
  onSuccess: () => void;
}

export default function RecurringExpenseModal({ 
  visible, onClose, groupMembers, groupId, currentUserId, onSuccess 
}: RecurringExpenseModalProps) {
  const { currencySymbol, theme } = useSettings();
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<string>('WIFI');
  const [customCategories, setCustomCategories] = useState<string[]>([]);
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [newCategoryText, setNewCategoryText] = useState('');
  const [frequency, setFrequency] = useState<'DAILY'|'WEEKLY'|'MONTHLY'>('MONTHLY');
  
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [hostelMembers, setHostelMembers] = useState<any[]>(groupMembers);
  const [isAddingMember, setIsAddingMember] = useState(false);
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [selectedMembers, setSelectedMembers] = useState<number[]>(groupMembers.map(m => m.id));

  const [isLoading, setIsLoading] = useState(false);

  React.useEffect(() => {
    if (visible) {
      getUsers().then(setAllUsers).catch(console.error);
    }
  }, [visible]);

  const handleCreateNewUser = async () => {
    if (!newUserName.trim() || !newUserEmail.trim()) {
      Alert.alert('Missing Fields', 'Please provide a name and email.');
      return;
    }
    setIsLoading(true);
    try {
      const newUser = await createUser({ name: newUserName.trim(), email: newUserEmail.trim() });
      setAllUsers([...allUsers, newUser]);
      setHostelMembers([...hostelMembers, newUser]);
      setSelectedMembers([...selectedMembers, newUser.id]);
      setIsCreatingUser(false);
      setIsAddingMember(false);
      setNewUserName('');
      setNewUserEmail('');
    } catch (e) {
      Alert.alert('Error', 'Failed to create user');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleMember = (id: number) => {
    setSelectedMembers(prev => 
      prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id]
    );
  };

  const handleSave = async () => {
    if (!description.trim() || !amount.trim()) {
      Alert.alert('Missing Fields', 'Please enter a description and amount.');
      return;
    }
    if (selectedMembers.length === 0) {
      Alert.alert('Select Members', 'Select at least one person to split this with.');
      return;
    }

    setIsLoading(true);
    try {
      const parsedAmount = parseFloat(amount);
      const splitAmount = parsedAmount / selectedMembers.length;
      
      const payload = {
        description,
        amount: parsedAmount,
        currency: 'INR',
        category: category.toLowerCase(),
        payer_id: currentUserId,
        group_id: groupId,
        split_type: 'equal',
        frequency: frequency.toLowerCase(),
        next_run_date: new Date().toISOString(), // Starts immediately
        is_active: true,
        splits: selectedMembers.map(id => ({
          user_id: id,
          amount_owed: splitAmount
        }))
      };

      await createRecurringExpense(payload);
      onSuccess();
      onClose();
      Alert.alert('Success', 'Hostel Mode subscription created! It has been processed for this cycle.');
      
      // Reset form
      setDescription('');
      setAmount('');
      
    } catch (e) {
      Alert.alert('Error', 'Failed to create recurring expense.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="slide">
      <BlurView intensity={20} style={StyleSheet.absoluteFill}>
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            <View style={[styles.modalContent, { backgroundColor: theme.background }]}>
              <View style={[styles.dragHandle, { backgroundColor: theme.border }]} />
              
              <Text style={[styles.title, { color: theme.text }]}>Hostel Mode</Text>
              <Text style={[styles.subtitle, { color: theme.textSecondary }]}>Automate recurring hostel expenses</Text>

              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
                
                <View style={styles.inputGroup}>
                  <Text style={[styles.label, { color: theme.primaryLight }]}>Description</Text>
                  <TextInput 
                    style={[styles.input, { backgroundColor: theme.inputBackground, color: theme.text, borderColor: theme.border }]}
                    placeholder="e.g. Jio Fiber Wi-Fi"
                    placeholderTextColor={theme.textSecondary}
                    value={description}
                    onChangeText={setDescription}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={[styles.label, { color: theme.primaryLight }]}>Amount ({currencySymbol})</Text>
                  <TextInput 
                    style={[styles.input, { backgroundColor: theme.inputBackground, color: theme.text, borderColor: theme.border }]}
                    placeholder="1000"
                    placeholderTextColor={theme.textSecondary}
                    keyboardType="numeric"
                    value={amount}
                    onChangeText={setAmount}
                  />
                </View>

                <Text style={[styles.label, { color: theme.primaryLight }]}>Category</Text>
                <View style={styles.chipRow}>
                  {['WIFI', 'RENT', 'MESS', 'ELECTRICITY', 'COOK', ...customCategories].map(cat => (
                    <TouchableOpacity 
                      key={cat}
                      style={[styles.chip, { backgroundColor: theme.surface, borderColor: theme.border }, category === cat && !isAddingCategory && [styles.chipActive, { backgroundColor: theme.primaryLight + '30', borderColor: theme.primary }]]}
                      onPress={() => { setCategory(cat); setIsAddingCategory(false); }}
                    >
                      <Text style={[styles.chipText, { color: theme.textSecondary }, category === cat && !isAddingCategory && [styles.chipTextActive, { color: theme.primaryLight }]]}>{cat}</Text>
                    </TouchableOpacity>
                  ))}
                  <TouchableOpacity 
                    style={[styles.chip, { backgroundColor: theme.surface, borderColor: theme.border }, isAddingCategory && [styles.chipActive, { backgroundColor: theme.primaryLight + '30', borderColor: theme.primary }]]}
                    onPress={() => { setIsAddingCategory(true); setCategory(''); }}
                  >
                    <Text style={[styles.chipText, { color: theme.textSecondary }, isAddingCategory && [styles.chipTextActive, { color: theme.primaryLight }]]}>+ Add New</Text>
                  </TouchableOpacity>
                </View>

                {isAddingCategory && (
                  <View style={[styles.inputGroup, { marginTop: -10, flexDirection: 'row', gap: 10 }]}>
                    <TextInput 
                      style={[styles.input, { flex: 1, backgroundColor: theme.inputBackground, color: theme.text, borderColor: theme.border }]}
                      placeholder="e.g. GYM"
                      placeholderTextColor={theme.textSecondary}
                      value={newCategoryText}
                      onChangeText={(val) => {
                        setNewCategoryText(val);
                        setCategory(val.toUpperCase());
                      }}
                      onSubmitEditing={() => {
                        const val = newCategoryText.trim().toUpperCase();
                        if (val) {
                          if (!['WIFI', 'RENT', 'MESS', 'ELECTRICITY', 'COOK', ...customCategories].includes(val)) {
                            setCustomCategories(prev => [...prev, val]);
                          }
                          setCategory(val);
                          setIsAddingCategory(false);
                          setNewCategoryText('');
                        }
                      }}
                      returnKeyType="done"
                      autoFocus
                    />
                    <TouchableOpacity 
                      style={{ backgroundColor: theme.primary, justifyContent: 'center', paddingHorizontal: 16, borderRadius: 12 }}
                      onPress={() => {
                        const val = newCategoryText.trim().toUpperCase();
                        if (val) {
                          if (!['WIFI', 'RENT', 'MESS', 'ELECTRICITY', 'COOK', ...customCategories].includes(val)) {
                            setCustomCategories(prev => [...prev, val]);
                          }
                          setCategory(val);
                          setIsAddingCategory(false);
                          setNewCategoryText('');
                        } else {
                          setIsAddingCategory(false);
                        }
                      }}
                    >
                      <Text style={{ color: '#FFF', fontFamily: 'Inter_600SemiBold' }}>Add</Text>
                    </TouchableOpacity>
                  </View>
                )}

                <Text style={[styles.label, { color: theme.primaryLight }]}>Frequency</Text>
                <View style={styles.chipRow}>
                  {['DAILY', 'WEEKLY', 'MONTHLY'].map(freq => (
                    <TouchableOpacity 
                      key={freq}
                      style={[styles.chip, { backgroundColor: theme.surface, borderColor: theme.border }, frequency === freq && [styles.chipActive, { backgroundColor: theme.primaryLight + '30', borderColor: theme.primary }]]}
                      onPress={() => setFrequency(freq as any)}
                    >
                      <Text style={[styles.chipText, { color: theme.textSecondary }, frequency === freq && [styles.chipTextActive, { color: theme.primaryLight }]]}>{freq}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, marginBottom: 8 }}>
                  <Text style={[styles.label, { marginTop: 0, marginBottom: 0, color: theme.primaryLight }]}>Hostel Members</Text>
                  <TouchableOpacity onPress={() => setIsAddingMember(!isAddingMember)}>
                    <Text style={{ color: theme.primaryLight, fontFamily: 'Inter_600SemiBold', fontSize: 14 }}>{isAddingMember ? 'Cancel' : '+ Add Person'}</Text>
                  </TouchableOpacity>
                </View>
                
                {isAddingMember && !isCreatingUser && (
                  <View style={{ backgroundColor: theme.surface, padding: 12, borderRadius: 12, marginBottom: 12 }}>
                    <Text style={{ color: theme.textSecondary, marginBottom: 8, fontSize: 12 }}>Select someone to add to Hostel Mode:</Text>
                    {allUsers.filter(u => !hostelMembers.find(m => m.id === u.id)).map(u => (
                      <TouchableOpacity 
                        key={u.id}
                        style={[styles.memberRow, { backgroundColor: 'transparent', paddingHorizontal: 0, borderBottomWidth: 0, marginBottom: 4 }]}
                        onPress={() => {
                          setHostelMembers([...hostelMembers, u]);
                          setSelectedMembers([...selectedMembers, u.id]);
                          setIsAddingMember(false);
                        }}
                      >
                        <View style={[styles.memberAvatar, { backgroundColor: theme.surface }]}><Text style={[styles.memberAvatarText, { color: theme.primaryLight }]}>{u.name[0]}</Text></View>
                        <Text style={[styles.memberName, { color: theme.text }]}>{u.name}</Text>
                        <Ionicons name="add-circle-outline" size={24} color={theme.success} />
                      </TouchableOpacity>
                    ))}
                    
                    <TouchableOpacity 
                      style={{ marginTop: 12, paddingVertical: 10, backgroundColor: theme.primaryLight + '20', borderRadius: 8, alignItems: 'center', borderWidth: 1, borderColor: theme.primary }}
                      onPress={() => setIsCreatingUser(true)}
                    >
                      <Text style={{ color: theme.primaryLight, fontFamily: 'Inter_600SemiBold' }}>+ Create New Contact</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {isCreatingUser && (
                  <View style={{ backgroundColor: theme.surface, padding: 16, borderRadius: 12, marginBottom: 12 }}>
                    <Text style={{ color: theme.text, fontFamily: 'Inter_600SemiBold', marginBottom: 12 }}>Create New Person</Text>
                    <TextInput 
                      style={[styles.input, { marginBottom: 12, backgroundColor: theme.inputBackground, color: theme.text, borderColor: theme.border }]}
                      placeholder="Name (e.g. Rahul)"
                      placeholderTextColor={theme.textSecondary}
                      value={newUserName}
                      onChangeText={setNewUserName}
                    />
                    <TextInput 
                      style={[styles.input, { marginBottom: 16, backgroundColor: theme.inputBackground, color: theme.text, borderColor: theme.border }]}
                      placeholder="Email"
                      placeholderTextColor={theme.textSecondary}
                      value={newUserEmail}
                      onChangeText={setNewUserEmail}
                      keyboardType="email-address"
                    />
                    <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 12 }}>
                      <TouchableOpacity onPress={() => setIsCreatingUser(false)} style={{ paddingVertical: 8, paddingHorizontal: 16 }}>
                        <Text style={{ color: theme.textSecondary }}>Cancel</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={handleCreateNewUser} style={{ backgroundColor: theme.primary, paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8 }} disabled={isLoading}>
                        <Text style={{ color: '#FFF', fontFamily: 'Inter_600SemiBold' }}>{isLoading ? 'Creating...' : 'Create & Add'}</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}

                <View style={[styles.membersList, { backgroundColor: theme.card, borderColor: theme.border }]}>
                  {hostelMembers.map(m => (
                    <View key={m.id} style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <TouchableOpacity 
                        style={[styles.memberRow, { flex: 1, borderBottomWidth: 0, marginBottom: 0 }]}
                        onPress={() => toggleMember(m.id)}
                      >
                        <View style={[styles.memberAvatar, { backgroundColor: theme.surface }]}><Text style={[styles.memberAvatarText, { color: theme.primaryLight }]}>{m.name[0]}</Text></View>
                        <Text style={[styles.memberName, { color: theme.text }]}>{m.name}</Text>
                        <View style={[styles.checkbox, { borderColor: theme.border }, selectedMembers.includes(m.id) && [styles.checkboxActive, { backgroundColor: theme.primary, borderColor: theme.primary }]]}>
                          {selectedMembers.includes(m.id) && <Ionicons name="checkmark" size={14} color="#FFF" />}
                        </View>
                      </TouchableOpacity>
                      
                      {m.id !== currentUserId && (
                        <TouchableOpacity 
                          style={{ padding: 8 }}
                          onPress={() => {
                            setHostelMembers(prev => prev.filter(hm => hm.id !== m.id));
                            setSelectedMembers(prev => prev.filter(id => id !== m.id));
                          }}
                        >
                          <Ionicons name="trash-outline" size={20} color={theme.danger} />
                        </TouchableOpacity>
                      )}
                    </View>
                  ))}
                </View>

              </ScrollView>

              <View style={styles.actions}>
                <TouchableOpacity style={[styles.cancelBtn, { backgroundColor: theme.surface }]} onPress={onClose}>
                  <Text style={[styles.cancelBtnText, { color: theme.text }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.confirmBtn} onPress={handleSave} disabled={isLoading}>
                  <LinearGradient colors={[theme.primary, theme.primaryLight]} style={styles.confirmBtnGradient}>
                    <Text style={styles.confirmBtnText}>{isLoading ? 'Saving...' : 'Start Automation'}</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>

            </View>
          </KeyboardAvoidingView>
        </View>
      </BlurView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' },
  modalContent: { borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 24, paddingBottom: Platform.OS === 'ios' ? 40 : 24, maxHeight: '90%' },
  dragHandle: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  title: { fontFamily: 'Inter_700Bold', fontSize: 24 },
  subtitle: { fontFamily: 'Inter_400Regular', fontSize: 14, marginBottom: 24, marginTop: 4 },
  
  inputGroup: { marginBottom: 20 },
  label: { fontFamily: 'Inter_600SemiBold', fontSize: 13, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 1 },
  input: { borderRadius: 12, padding: 16, fontFamily: 'Inter_400Regular', fontSize: 16, borderWidth: 1 },
  
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 24, gap: 10 },
  chip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  chipActive: { },
  chipText: { fontFamily: 'Inter_600SemiBold', fontSize: 12 },
  chipTextActive: { },

  membersList: { borderRadius: 16, padding: 12, marginBottom: 20, borderWidth: 1 },
  memberRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  memberAvatar: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  memberAvatarText: { fontFamily: 'Inter_600SemiBold' },
  memberName: { flex: 1, fontFamily: 'Inter_400Regular', fontSize: 15 },
  checkbox: { width: 20, height: 20, borderRadius: 6, borderWidth: 2, justifyContent: 'center', alignItems: 'center' },
  checkboxActive: { },

  actions: { flexDirection: 'row', gap: 12, marginTop: 10 },
  cancelBtn: { flex: 1, paddingVertical: 16, borderRadius: 16, alignItems: 'center' },
  cancelBtnText: { fontFamily: 'Inter_600SemiBold', fontSize: 16 },
  confirmBtn: { flex: 2 },
  confirmBtnGradient: { paddingVertical: 16, borderRadius: 16, alignItems: 'center' },
  confirmBtnText: { color: '#FFF', fontFamily: 'Inter_600SemiBold', fontSize: 16 },
});
