import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet, Text, View, TouchableOpacity, ScrollView,
  SafeAreaView, StatusBar, Animated, TextInput, Alert, ActivityIndicator, Linking,
  KeyboardAvoidingView, Platform, Keyboard, Image, RefreshControl, AppState
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { useFonts, Inter_400Regular, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import NLParseModal from './components/NLParseModal';
import BillParseModal from './components/BillParseModal';
import RecurringExpenseModal from './components/RecurringExpenseModal';
import ProfileModal from './components/ProfileModal';
import GroupManagementModal from './components/GroupManagementModal';
import AppSettingsModal from './components/AppSettingsModal';
import HelpBotModal from './components/HelpBotModal';
import AnalysisModal from './components/AnalysisModal';
import BalanceMenuModal from './components/BalanceMenuModal';
import LoginScreen from './components/LoginScreen';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  parseNaturalLanguage, parseBillImage, ParsedNLExpense, ParsedBill,
  getUserBalances, settleBalance, triggerRecurringProcessing, generateUpiLink, Balance, parseAudioExpense, createExpense, getUserActivities, getUsers, getUserGroups, getGroupMembers, Group,
  downloadGroupCsv, downloadGroupPdf, BASE_URL
} from './services/api';
import { SettingsProvider, useSettings } from './context/SettingsContext';
import * as LocalAuthentication from 'expo-local-authentication';

interface Activity {
  id: string;
  icon: string;
  iconColor: string;
  iconBg: string;
  title: string;
  subtitle: string;
  amount: string;
  positive: boolean;
}

function MainApp() {
  const { currencySymbol, appLockEnabled, theme } = useSettings();
  const [fontsLoaded] = useFonts({ Inter_400Regular, Inter_600SemiBold, Inter_700Bold });
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  const [nlModalVisible, setNlModalVisible] = useState(false);
  const [nlModalMode, setNlModalMode] = useState<'text' | 'voice'>('text');
  const [billModalVisible, setBillModalVisible] = useState(false);
  const [recurringModalVisible, setRecurringModalVisible] = useState(false);
  const [profileModalVisible, setProfileModalVisible] = useState(false);
  const [profilePicUri, setProfilePicUri] = useState<string | null>(null);
  const [nlInput, setNlInput] = useState('');
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [isLoginLoading, setIsLoginLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [balances, setBalances] = useState<Balance[]>([]);
  const [totalOwed, setTotalOwed] = useState(0);
  const [totalAreOwed, setTotalAreOwed] = useState(0);
  const [netBalance, setNetBalance] = useState(0);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [groupMembers, setGroupMembers] = useState<{ id: number, name: string }[]>([]);

  // Group State
  const [userGroups, setUserGroups] = useState<Group[]>([]);
  const [activeGroup, setActiveGroup] = useState<Group | null>(null);
  const [groupManagementModalVisible, setGroupManagementModalVisible] = useState(false);
  const [appSettingsModalVisible, setAppSettingsModalVisible] = useState(false);
  const [appSettingsInitialScreen, setAppSettingsInitialScreen] = useState('main');
  const [helpBotModalVisible, setHelpBotModalVisible] = useState(false);
  const [analysisModalVisible, setAnalysisModalVisible] = useState(false);
  const [balanceMenuVisible, setBalanceMenuVisible] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  // App Lock State
  const [isUnlocked, setIsUnlocked] = useState(false);
  const appState = useRef(AppState.currentState);

  const authenticate = async () => {
    if (!appLockEnabled) {
      setIsUnlocked(true);
      return;
    }

    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const isEnrolled = await LocalAuthentication.isEnrolledAsync();

    if (!hasHardware || !isEnrolled) {
      setIsUnlocked(true); // Fallback if no biometrics
      return;
    }

    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Unlock SplitSmart',
      fallbackLabel: 'Use Passcode',
    });

    if (result.success) {
      setIsUnlocked(true);
    }
  };

  useEffect(() => {
    const loadSession = async () => {
      try {
        const storedUser = await AsyncStorage.getItem('@currentUser');
        if (storedUser) {
          setCurrentUser(JSON.parse(storedUser));
        }
      } catch (e) {
        console.error('Failed to load session', e);
      } finally {
        setIsAuthLoading(false);
      }
    };
    loadSession();
    authenticate();

    const subscription = AppState.addEventListener('change', nextAppState => {
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        // App has come to the foreground!
        if (appLockEnabled) {
          setIsUnlocked(false);
          authenticate();
        }
      }
      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, [appLockEnabled]);

  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => setKeyboardHeight(e.endCoordinates.height)
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setKeyboardHeight(0)
    );
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const loadData = async (forceGroupId?: number) => {
    if (!currentUser) return;
    try {
      await triggerRecurringProcessing();

      const groups = await getUserGroups(currentUser.id, false);
      setUserGroups(groups);

      let currentGroupId = forceGroupId || activeGroup?.id;
      if (!currentGroupId && groups.length > 0) {
        currentGroupId = groups[0].id;
        setActiveGroup(groups[0]);
      }

      if (!currentGroupId) {
        setGroupMembers([]);
        setBalances([]);
        setTotalOwed(0);
        setTotalAreOwed(0);
        setNetBalance(0);
        setActivities([]);
        return;
      }

      const members = await getGroupMembers(currentGroupId);
      setGroupMembers(members.map((u: any) => ({ id: u.id, name: u.name })));

      const userBalances = await getUserBalances(currentUser.id, currentGroupId);
      const validBalances = userBalances.filter(b => b.amount > 0);

      setBalances(validBalances.filter(b => b.user_id === currentUser.id));

      const sumYouOwe = userBalances.filter(b => b.user_id === currentUser.id).reduce((sum, b) => sum + b.amount, 0);
      const sumYouAreOwed = userBalances.filter(b => b.owes_to_user_id === currentUser.id).reduce((sum, b) => sum + b.amount, 0);

      setTotalOwed(sumYouOwe);
      setTotalAreOwed(sumYouAreOwed);
      setNetBalance(sumYouAreOwed - sumYouOwe);

      const acts = await getUserActivities(currentUser.id, currentGroupId);
      const mappedActivities = acts.map((a: any) => {
        let shareMsg = '';
        if (a.split_type === 'EQUAL') shareMsg = 'Split Equally';
        else if (a.split_type === 'PERCENTAGE') shareMsg = 'Split by %';
        else if (a.split_type === 'SHARES') shareMsg = 'Split by Shares';
        else shareMsg = 'Split Exact';

        return {
          id: a.id.toString(),
          icon: a.is_payer ? 'arrow-up-circle' : 'arrow-down-circle',
          iconColor: a.is_payer ? '#55efc4' : '#FF7675',
          iconBg: a.is_payer ? 'rgba(85, 239, 196, 0.15)' : 'rgba(255, 118, 117, 0.15)',
          title: a.description,
          subtitle: a.is_payer ? `You paid ${currencySymbol}${a.amount}` : `${a.payer_name} paid ${currencySymbol}${a.amount}`,
          amount: a.is_payer ? `+ ${currencySymbol}${a.amount - a.user_share}` : `- ${currencySymbol}${a.user_share}`,
          positive: a.is_payer,
        };
      });
      setActivities(mappedActivities);
    } catch (e) {
      console.warn("Failed to load data:", e);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (isUnlocked) {
      loadData();
    }
  }, [isUnlocked, activeGroup]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  useEffect(() => {
    loadData();
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 800, useNativeDriver: true }),
    ]).start();
  }, []);

  if (!fontsLoaded) return null;

  // Called when NLP expense is confirmed
  const handleNLConfirm = async (expense: ParsedNLExpense) => {
    try {
      const payload = {
        description: expense.description,
        amount: expense.amount,
        currency: 'INR',
        payer_id: expense.payer_id,
        group_id: activeGroup?.id || 0,
        split_type: expense.split_type,
        splits: expense.split_among_ids.map(id => ({
          user_id: id,
          amount_owed: expense.amount / expense.split_among_ids.length
        }))
      };
      await createExpense(payload);

      setNlModalVisible(false);
      setNlInput(''); // Clear the input bar
      const share = (expense.amount / expense.split_among_ids.length).toFixed(2);
      Alert.alert('✅ Expense Added!', `${expense.description} • ${currencySymbol}${expense.amount}\nEach person owes ${currencySymbol}${share}`);
      loadData();
    } catch (e) {
      Alert.alert('Error', 'Failed to save expense to database.');
    }
  };

  // Called when bill scan is confirmed
  const handleBillConfirm = (bill: ParsedBill) => {
    setBillModalVisible(false);
    loadData(); // Refresh balances and activities
    Alert.alert('✅ Bill Scanned!', `${bill.restaurant_name ?? 'Bill'} — ${currencySymbol}${bill.grand_total.toFixed(2)}`);
  };

  const handlePayUpi = async (balance: Balance) => {
    if (!balance.owes_to?.upi_vpa) {
      Alert.alert('Missing UPI ID', `${balance.owes_to?.name ?? 'This user'} hasn't added a UPI ID yet.`);
      return;
    }
    const link = generateUpiLink(balance.owes_to.upi_vpa, balance.owes_to.name, balance.amount);

    try {
      await Linking.openURL(link);

      // Prompt user if they want to mark it as settled
      setTimeout(() => {
        Alert.alert(
          'Payment Initiated',
          `Did you successfully pay ${currencySymbol}${balance.amount} to ${balance.owes_to.name}?`,
          [
            { text: 'No', style: 'cancel' },
            {
              text: 'Yes, Mark Settled',
              onPress: async () => {
                await settleBalance(currentUser.id, balance.owes_to_user_id);
                loadData();
              }
            }
          ]
        );
      }, 1500);

    } catch (e) {
      Alert.alert('Error', 'Could not open UPI app. Ensure you have one installed.');
    }
  };

  const handleDownload = async (type: 'pdf' | 'csv') => {
    const groupId = activeGroup?.id || 0;
    const url = `${BASE_URL}/groups/${groupId}/export/${type}?currency=${encodeURIComponent(currencySymbol)}`;

    if (Platform.OS === 'web') {
      try {
        window.open(url, '_blank');
      } catch (e: any) {
        Alert.alert('Error', `Web Download failed: ${e.message || 'Unknown Error'}`);
      }
    } else {
      // Mobile Flow (iOS / Android)
      try {
        const fileUri = `${FileSystem.documentDirectory}export_${groupId}_${Date.now()}.${type}`;
        const { uri, status } = await FileSystem.downloadAsync(url, fileUri);

        if (status !== 200) {
          Alert.alert('Error', 'Failed to download report from server.');
          return;
        }

        try {
          if (await Sharing.isAvailableAsync()) {
            await Sharing.shareAsync(uri);
          } else {
            Alert.alert('Downloaded', `File saved to ${uri}`);
          }
        } catch (shareError) {
          console.log('Sharing failed (likely emulator without share targets):', shareError);
          Alert.alert('Downloaded', `Report successfully saved!`);
        }
      } catch (e: any) {
        Alert.alert('Error', `Mobile Flow failed: ${e.message}`);
      }
    }
  };

  const handleBalanceMenu = () => {
    setBalanceMenuVisible(true);
  };

  const handleSettleCash = (balance: Balance) => {
    Alert.alert(
      'Settle in Cash',
      `Did you hand ${currencySymbol}${balance.amount} in cash to ${balance.owes_to.name}?`,
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes, Mark Settled',
          onPress: async () => {
            try {
              await settleBalance(currentUser.id, balance.owes_to_user_id);
              loadData();
              Alert.alert('✅ Settled', `Your balance with ${balance.owes_to.name} has been settled.`);
            } catch (e) {
              Alert.alert('Error', 'Failed to settle balance.');
            }
          }
        }
      ]
    );
  };

  // Handles tapping send in the floating bar
  const handleNLSend = () => {
    setNlModalMode('text');
    setNlModalVisible(true);
  };

  if (isAuthLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.background, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  const handleLogin = async (email: string, name: string, photoUrl?: string) => {
    setIsLoginLoading(true);
    try {
      const res = await fetch(`${BASE_URL}/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, name, photo_url: photoUrl })
      });
      if (res.ok) {
        const user = await res.json();
        await AsyncStorage.setItem('@currentUser', JSON.stringify(user));
        setCurrentUser(user);
      } else {
        Alert.alert('Error', 'Failed to log in with backend.');
      }
    } catch (e) {
      Alert.alert('Error', 'Failed to connect to backend.');
    } finally {
      setIsLoginLoading(false);
    }
  };

  const handleLogout = async () => {
    await AsyncStorage.removeItem('@currentUser');
    setCurrentUser(null);
  };

  if (!currentUser) {
    return <LoginScreen onLogin={handleLogin} isLoading={isLoginLoading} />;
  }

  const RootView = Platform.OS === 'ios' ? KeyboardAvoidingView : View;
  const rootProps = Platform.OS === 'ios' ? { behavior: 'padding', style: [styles.container, { backgroundColor: theme.background }] } : { style: [styles.container, { backgroundColor: theme.background }] };

  if (userGroups.length === 0) {
    return (
      <RootView {...(rootProps as any)}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          <Ionicons name="people-circle-outline" size={100} color={theme.textSecondary} />
          <Text style={{ fontFamily: 'Inter_700Bold', fontSize: 24, color: theme.text, marginTop: 20 }}>Welcome to SplitSmart!</Text>
          <Text style={{ fontFamily: 'Inter_400Regular', fontSize: 16, color: theme.textSecondary, textAlign: 'center', marginTop: 10, marginBottom: 30 }}>
            You aren't in any groups yet. Create a new group or join an existing one to get started.
          </Text>
          <TouchableOpacity 
            style={{ backgroundColor: theme.primary, paddingHorizontal: 30, paddingVertical: 15, borderRadius: 12, marginBottom: 15, width: '100%', alignItems: 'center' }}
            onPress={() => setGroupManagementModalVisible(true)}
          >
            <Text style={{ color: '#FFF', fontFamily: 'Inter_600SemiBold', fontSize: 16 }}>Manage Groups</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={{ paddingHorizontal: 30, paddingVertical: 15, borderRadius: 12, width: '100%', alignItems: 'center' }}
            onPress={handleLogout}
          >
            <Text style={{ color: theme.danger, fontFamily: 'Inter_600SemiBold', fontSize: 16 }}>Log Out</Text>
          </TouchableOpacity>
        </View>

        <GroupManagementModal
          visible={groupManagementModalVisible}
          onClose={() => setGroupManagementModalVisible(false)}
          currentUserId={currentUser.id}
          userGroups={userGroups}
          activeGroupId={activeGroup?.id}
          onSelectGroup={(g) => {
            setActiveGroup(g);
            setGroupManagementModalVisible(false);
            loadData(g.id);
          }}
          onGroupCreated={() => loadData()}
        />
      </RootView>
    );
  }

  if (!isUnlocked) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
        <StatusBar barStyle="light-content" />
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Ionicons name="lock-closed" size={64} color={theme.primary} />
          <Text style={{ color: theme.text, fontSize: 20, marginTop: 16, fontFamily: 'Inter_600SemiBold' }}>App Locked</Text>
          <TouchableOpacity onPress={authenticate} style={{ marginTop: 24, backgroundColor: theme.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 }}>
            <Text style={{ color: '#FFF', fontSize: 16, fontFamily: 'Inter_600SemiBold' }}>Unlock</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <RootView {...(rootProps as any)}>
      <View style={{ flex: 1, paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight || 30 : 0 }}>
        <StatusBar barStyle="light-content" backgroundColor={theme.background} />

        {/* Header */}
        <View style={styles.header}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <TouchableOpacity onPress={() => setProfileModalVisible(true)} style={{ marginRight: 12 }}>
              {profilePicUri ? (
                <Image source={{ uri: profilePicUri }} style={{ width: 44, height: 44, borderRadius: 22 }} />
              ) : (
                <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: theme.primary, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ color: '#FFF', fontSize: 18, fontFamily: 'Inter_600SemiBold' }}>{currentUser.name[0]}</Text>
                </View>
              )}
            </TouchableOpacity>
            <View>
              <Text style={[styles.greeting, { color: theme.textSecondary }]}>Welcome back,</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={[styles.userName, { color: theme.text }]}>{currentUser.name} 👋</Text>
              </View>
            </View>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <TouchableOpacity
              style={[styles.groupSelector, { borderColor: theme.border }]}
              onPress={() => setGroupManagementModalVisible(true)}
            >
              <Ionicons name="people" size={22} color={theme.primary} />
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} colors={[theme.primary]} />}
        >

          {/* Balance Card */}
          <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
            <LinearGradient colors={[theme.primary, theme.primaryLight]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.balanceCard}>
              <View style={styles.balanceHeader}>
                <Text style={styles.balanceLabel}>Net Balance</Text>
                <TouchableOpacity onPress={handleBalanceMenu} style={{ padding: 4, zIndex: 10 }}>
                  <MaterialCommunityIcons name="dots-horizontal" size={24} color="#FFF" />
                </TouchableOpacity>
              </View>
              <Text style={styles.balanceAmount}>
                {netBalance < 0 ? '-' : ''}{currencySymbol} {Math.abs(netBalance).toFixed(0)}<Text style={styles.decimals}>.00</Text>
              </Text>

              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 16, marginBottom: balances.length > 0 ? 16 : 0, backgroundColor: 'rgba(255,255,255,0.15)', padding: 12, borderRadius: 12 }}>
                <View>
                  <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12, fontFamily: 'Inter_400Regular' }}>You Owe</Text>
                  <Text style={{ color: '#FFF', fontSize: 16, fontFamily: 'Inter_600SemiBold', marginTop: 4 }}>{currencySymbol} {totalOwed.toFixed(0)}</Text>
                </View>
                <View style={{ width: 1, backgroundColor: 'rgba(255,255,255,0.3)' }} />
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12, fontFamily: 'Inter_400Regular' }}>You are Owed</Text>
                  <Text style={{ color: '#FFF', fontSize: 16, fontFamily: 'Inter_600SemiBold', marginTop: 4 }}>{currencySymbol} {totalAreOwed.toFixed(0)}</Text>
                </View>
              </View>

              {balances.length > 0 ? (
                <View style={styles.balanceActionsColumn}>
                  {balances.map(b => (
                    <View key={b.id} style={[styles.balanceActionItem, { flexDirection: 'column', alignItems: 'stretch', paddingVertical: 12, marginRight: 0 }]}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                        <View style={styles.iconCircleDown}>
                          <Ionicons name="arrow-down" size={16} color="#FF7675" />
                        </View>
                        <View>
                          <Text style={styles.actionLabel}>To {b.owes_to?.name ?? 'User'}</Text>
                          <Text style={[styles.actionAmount, { fontSize: 20, color: '#FFF' }]}>{currencySymbol} {b.amount.toFixed(0)}</Text>
                        </View>
                      </View>
                      <View style={{ flexDirection: 'row', gap: 8, width: '100%' }}>
                        <TouchableOpacity style={[styles.upiButton, { flex: 1, justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.15)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' }]} onPress={() => handleSettleCash(b)}>
                          <Ionicons name="cash-outline" size={16} color="#FFF" style={{ marginRight: 6 }} />
                          <Text style={[styles.upiButtonText, { color: '#FFF' }]}>Settle Cash</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.upiButton, { flex: 1, justifyContent: 'center', borderWidth: 1, borderColor: '#00B894' }]} onPress={() => handlePayUpi(b)}>
                          <Ionicons name="scan-outline" size={16} color="#FFF" style={{ marginRight: 6 }} />
                          <Text style={styles.upiButtonText}>Pay via UPI</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))}
                </View>
              ) : (
                <View style={[styles.balanceActionItem, { marginTop: 24, width: '100%', justifyContent: 'center' }]}>
                  <Text style={[styles.actionAmount, { color: '#FFF' }]}>All settled up! 🎉</Text>
                </View>
              )}
            </LinearGradient>
          </Animated.View>

          {/* AI Quick Actions */}
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Split with AI</Text>
          <View style={styles.quickActionsContainer}>
            <TouchableOpacity style={styles.quickActionCard} onPress={() => setBillModalVisible(true)}>
              <LinearGradient colors={[theme.card, theme.background]} style={[styles.quickActionGradient, { borderColor: theme.border }]}>
                <Ionicons name="camera-outline" size={28} color="#0984E3" />
                <Text style={[styles.quickActionText, { color: theme.text }]}>Scan Bill</Text>
              </LinearGradient>
            </TouchableOpacity>
            <TouchableOpacity style={styles.quickActionCard} onPress={() => { setNlModalMode('voice'); setNlModalVisible(true); }}>
              <LinearGradient colors={[theme.card, theme.background]} style={[styles.quickActionGradient, { borderColor: theme.border }]}>
                <Ionicons name="mic-outline" size={28} color="#E84393" />
                <Text style={[styles.quickActionText, { color: theme.text }]}>Voice Split</Text>
              </LinearGradient>
            </TouchableOpacity>
            <TouchableOpacity style={styles.quickActionCard} onPress={() => setRecurringModalVisible(true)}>
              <LinearGradient colors={[theme.card, theme.background]} style={[styles.quickActionGradient, { borderColor: theme.border }]}>
                <MaterialCommunityIcons name="home-city-outline" size={28} color="#FDCB6E" />
                <Text style={[styles.quickActionText, { color: theme.text }]}>Hostel Mode</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>

          {/* Recent Activity */}
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Recent Activity</Text>
            <TouchableOpacity>
              <Text style={[styles.seeAllText, { color: theme.primary }]}>See All</Text>
            </TouchableOpacity>
          </View>

          <View style={[styles.activityList, { backgroundColor: theme.card, borderColor: theme.border }]}>
            {activities.map((item, index) => (
              <View key={item.id} style={[styles.activityItem, index === activities.length - 1 && { marginBottom: 0 }]}>
                <View style={[styles.activityIcon, { backgroundColor: item.iconBg }]}>
                  <MaterialCommunityIcons name={item.icon as any} size={22} color={item.iconColor} />
                </View>
                <View style={styles.activityInfo}>
                  <Text style={[styles.activityTitle, { color: theme.text }]}>{item.title}</Text>
                  <Text style={styles.activitySubtitle}>{item.subtitle}</Text>
                </View>
                <Text style={[styles.activityAmount, { color: item.positive ? '#00B894' : '#FF7675' }]}>
                  {item.amount}
                </Text>
              </View>
            ))}
          </View>

        </ScrollView>

        {/* Floating NL Input Bar - WhatsApp Style */}
        <View style={[styles.fabContainerRelative, {
          backgroundColor: theme.card,
          borderColor: theme.border,
          transform: [{ translateY: -keyboardHeight }]
        }]}>
          <View style={styles.inputBar}>
            <Ionicons name="sparkles" size={18} color={theme.primary} style={{ marginRight: 8 }} />
            <TextInput
              style={[styles.inputField, { color: theme.text }]}
              value={nlInput}
              onChangeText={setNlInput}
              placeholder={`e.g. "Paid ${currencySymbol}400 for Uber with Aman"`}
              placeholderTextColor={theme.textSecondary}
              onSubmitEditing={handleNLSend}
              returnKeyType="send"
            />
            <TouchableOpacity style={styles.sendButton} onPress={handleNLSend}>
              <Ionicons name="send" size={16} color="#FFF" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Modals */}
        <ProfileModal
          visible={profileModalVisible}
          onClose={() => setProfileModalVisible(false)}
          user={currentUser as any}
          onUpdateUser={(updatedUser) => setCurrentUser(updatedUser)}
          profilePicUri={profilePicUri}
          setProfilePicUri={setProfilePicUri}
          onOpenSettings={() => {
            setProfileModalVisible(false);
            setAppSettingsModalVisible(true);
          }}
          onOpenHelp={() => {
            setProfileModalVisible(false);
            setHelpBotModalVisible(true);
          }}
          onLogout={handleLogout}
        />
        <GroupManagementModal
          visible={groupManagementModalVisible}
          onClose={() => setGroupManagementModalVisible(false)}
          currentUserId={currentUser.id}
          userGroups={userGroups}
          activeGroupId={activeGroup?.id}
          onSelectGroup={(g) => {
            setActiveGroup(g);
            setGroupManagementModalVisible(false);
            loadData(g.id);
            setAppSettingsInitialScreen('activeGroup');
            setTimeout(() => setAppSettingsModalVisible(true), 350);
          }}
          onGroupCreated={() => loadData()}
        />
        <AppSettingsModal
          visible={appSettingsModalVisible}
          onClose={() => setAppSettingsModalVisible(false)}
          group={activeGroup}
          currentUserId={currentUser.id}
          onGroupDeleted={() => {
            setAppSettingsModalVisible(false);
            setActiveGroup(null);
            loadData();
          }}
          onGroupUpdated={() => loadData()}
        />

        <HelpBotModal
          visible={helpBotModalVisible}
          onClose={() => setHelpBotModalVisible(false)}
        />

        <NLParseModal
          visible={nlModalVisible}
          mode={nlModalMode}
          onClose={() => setNlModalVisible(false)}
          onConfirm={handleNLConfirm}
          parseExpense={(text) => parseNaturalLanguage(text, activeGroup?.id || 0, currentUser.id)}
          parseAudio={(uri, mime) => parseAudioExpense(uri, mime, activeGroup?.id || 0, currentUser.id)}
          groupMembers={groupMembers}
          initialText={nlInput}
        />
        <BillParseModal
          visible={billModalVisible}
          onClose={() => setBillModalVisible(false)}
          onConfirm={handleBillConfirm}
          parseBill={(uri, mime) => parseBillImage(uri, mime)}
          groupMembers={groupMembers}
        />
        <RecurringExpenseModal
          visible={recurringModalVisible}
          onClose={() => setRecurringModalVisible(false)}
          onSuccess={() => loadData()}
          groupMembers={groupMembers}
          currentUserId={currentUser.id}
          groupId={activeGroup?.id || 0}
        />
        <AnalysisModal
          visible={analysisModalVisible}
          onClose={() => setAnalysisModalVisible(false)}
          groupId={activeGroup?.id || 0}
        />
        <BalanceMenuModal
          visible={balanceMenuVisible}
          onClose={() => setBalanceMenuVisible(false)}
          onAction={(action) => {
            if (action === 'pdf') handleDownload('pdf');
            if (action === 'csv') handleDownload('csv');
            if (action === 'analysis') setAnalysisModalVisible(true);
            if (action === 'reminders') Alert.alert('Reminders Sent', 'We have nudged everyone who owes you money!');
          }}
        />
      </View>
    </RootView>
  );
}

export default function App() {
  return (
    <SettingsProvider>
      <MainApp />
    </SettingsProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 110 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 15 },
  greeting: { fontFamily: 'Inter_400Regular', fontSize: 14 },
  userName: { fontFamily: 'Inter_700Bold', fontSize: 22, marginTop: 2 },
  groupSelector: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', borderWidth: 1 },
  groupSelectorText: { fontFamily: 'Inter_600SemiBold', fontSize: 14 },
  profileAvatar: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', borderWidth: 1 },
  avatarText: { fontFamily: 'Inter_600SemiBold', fontSize: 16 },
  balanceCard: { borderRadius: 24, padding: 24, marginTop: 10, shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 15, elevation: 10 },
  balanceHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  balanceLabel: { fontFamily: 'Inter_400Regular', fontSize: 14, color: '#FFF' },
  balanceAmount: { fontFamily: 'Inter_700Bold', fontSize: 36, marginTop: 8, color: '#FFF' },
  decimals: { fontSize: 24 },
  balanceActionsColumn: { marginTop: 16, flexDirection: 'column', gap: 10 },
  balanceActionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  balanceActionItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, flex: 1, marginRight: 10 },
  upiButton: { flexDirection: 'row', backgroundColor: '#00B894', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, alignItems: 'center' },
  upiButtonText: { fontFamily: 'Inter_600SemiBold', fontSize: 12, color: '#FFF' },
  iconCircleUp: { width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  iconCircleDown: { width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  actionLabel: { fontFamily: 'Inter_400Regular', fontSize: 11, color: '#FFF' },
  actionAmount: { fontFamily: 'Inter_600SemiBold', fontSize: 14, marginTop: 2, color: '#FFF' },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 0 },
  sectionTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 18, marginTop: 28, marginBottom: 16 },
  seeAllText: { fontFamily: 'Inter_400Regular', fontSize: 14, marginTop: 12 },
  quickActionsContainer: { flexDirection: 'row', justifyContent: 'space-between' },
  quickActionCard: { width: '31%', borderRadius: 16, overflow: 'hidden' },
  quickActionGradient: { paddingVertical: 20, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderRadius: 16 },
  quickActionText: { fontFamily: 'Inter_600SemiBold', fontSize: 12, marginTop: 8 },
  activityList: { borderRadius: 20, padding: 16, borderWidth: 1 },
  activityItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  activityIcon: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', marginRight: 14 },
  activityInfo: { flex: 1 },
  activityTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 15 },
  activitySubtitle: { fontFamily: 'Inter_400Regular', fontSize: 13, color: '#8A8A8A', marginTop: 2 },
  activityAmount: { fontFamily: 'Inter_600SemiBold', fontSize: 15 },
  fabContainerRelative: { borderRadius: 30, padding: 6, borderWidth: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.5, shadowRadius: 10, elevation: 8, marginHorizontal: 20, marginBottom: 16, marginTop: 4 },
  inputBar: { flexDirection: 'row', alignItems: 'center', paddingLeft: 12, paddingRight: 6, height: 48 },
  inputField: { flex: 1, fontFamily: 'Inter_400Regular', fontSize: 14 },
  sendButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#6C5CE7', justifyContent: 'center', alignItems: 'center' },
});
