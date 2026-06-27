import React, { useEffect, useState } from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { getGroupAnalytics } from '../services/api';
import { useSettings } from '../context/SettingsContext';

interface AnalysisModalProps {
  visible: boolean;
  onClose: () => void;
  groupId: number;
}

const COLORS = ['#0984E3', '#00B894', '#E84393', '#FDCB6E', '#A29BFE', '#FF7675', '#55EFC4', '#74B9FF'];

export default function AnalysisModal({ visible, onClose, groupId }: AnalysisModalProps) {
  const { theme, currencySymbol } = useSettings();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    if (visible && groupId) {
      loadData();
    }
  }, [visible, groupId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const result = await getGroupAnalytics(groupId);
      setData(result);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { backgroundColor: theme.background }]}>
          <View style={[styles.header, { borderBottomColor: theme.border }]}>
            <Text style={[styles.title, { color: theme.text }]}>Spending Analysis</Text>
            <TouchableOpacity onPress={onClose} style={[styles.closeBtn, { backgroundColor: theme.surface }]}>
              <Ionicons name="close" size={24} color={theme.text} />
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={theme.primaryLight} />
              <Text style={[styles.loadingText, { color: theme.textSecondary }]}>Analyzing expenses...</Text>
            </View>
          ) : !data || data.total_spending === 0 ? (
            <View style={styles.emptyContainer}>
              <View style={[styles.emptyIconCircle, { backgroundColor: theme.primaryLight + '20' }]}>
                <Ionicons name="pie-chart-outline" size={48} color={theme.primaryLight} />
              </View>
              <Text style={[styles.emptyTitle, { color: theme.text }]}>No Expenses Yet</Text>
              <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
                Add your first expense to unlock detailed group spending analytics and trends!
              </Text>
              <TouchableOpacity style={[styles.addExpenseBtn, { backgroundColor: theme.primary }]} onPress={onClose}>
                <Text style={styles.addExpenseBtnText}>Start Splitting</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
              
              {/* Highlights Section */}
              <View style={styles.highlightsContainer}>
                <View style={[styles.highlightCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
                  <Text style={[styles.highlightLabel, { color: theme.textSecondary }]}>Total Spending</Text>
                  <Text style={[styles.highlightValue, { color: theme.text }]}>{currencySymbol}{data.total_spending.toFixed(0)}</Text>
                </View>
                <View style={[styles.highlightCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
                  <Text style={[styles.highlightLabel, { color: theme.textSecondary }]}>Top Category</Text>
                  <Text style={[styles.highlightValue, { color: theme.success, textTransform: 'capitalize' }]}>
                    {data.common_category || 'Other'}
                  </Text>
                </View>
              </View>

              {data.highest_spender && (
                <View style={[styles.topSpenderCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <View style={[styles.crownCircle, { backgroundColor: theme.primaryLight + '20' }]}>
                      <MaterialCommunityIcons name="crown" size={20} color={theme.primaryLight} />
                    </View>
                    <View style={{ marginLeft: 12 }}>
                      <Text style={[styles.highlightLabel, { color: theme.textSecondary }]}>Highest Spender</Text>
                      <Text style={[styles.topSpenderName, { color: theme.text }]}>{data.highest_spender.name}</Text>
                    </View>
                  </View>
                  <Text style={[styles.topSpenderAmount, { color: theme.primary }]}>{currencySymbol}{data.highest_spender.amount.toFixed(0)}</Text>
                </View>
              )}

              <Text style={[styles.sectionTitle, { color: theme.text }]}>Contribution Breakdown</Text>

              {/* The Stacked Horizontal Bar Chart */}
              <View style={styles.chartContainer}>
                <View style={[styles.stackedBar, { backgroundColor: theme.surface }]}>
                  {data.member_breakdown.map((member: any, index: number) => {
                    if (member.percentage === 0) return null;
                    return (
                      <View
                        key={member.user_id}
                        style={[
                          styles.barSegment,
                          { width: `${member.percentage}%`, backgroundColor: COLORS[index % COLORS.length] },
                          index === 0 && { borderTopLeftRadius: 12, borderBottomLeftRadius: 12 },
                          index === data.member_breakdown.filter((m:any) => m.percentage > 0).length - 1 && { borderTopRightRadius: 12, borderBottomRightRadius: 12 }
                        ]}
                      />
                    );
                  })}
                </View>
              </View>

              {/* Legend & Breakdown List */}
              <View style={[styles.breakdownList, { backgroundColor: theme.card, borderColor: theme.border }]}>
                {data.member_breakdown.map((member: any, index: number) => {
                  if (member.percentage === 0) return null;
                  return (
                    <View key={member.user_id} style={styles.breakdownItem}>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <View style={[styles.colorDot, { backgroundColor: COLORS[index % COLORS.length] }]} />
                        <View style={[styles.avatar, { backgroundColor: theme.surface }]}>
                          <Text style={[styles.avatarText, { color: theme.text }]}>{member.name.substring(0, 2).toUpperCase()}</Text>
                        </View>
                        <View>
                          <Text style={[styles.memberName, { color: theme.text }]}>{member.name}</Text>
                          <Text style={[styles.memberPercentage, { color: theme.textSecondary }]}>{member.percentage}% of total</Text>
                        </View>
                      </View>
                      <Text style={[styles.memberAmount, { color: theme.text }]}>{currencySymbol}{member.amount.toFixed(0)}</Text>
                    </View>
                  );
                })}
              </View>

              {/* Monthly Trend (MVP simplified) */}
              {data.monthly_trend && data.monthly_trend.length > 0 && (
                <View style={{ marginTop: 24, marginBottom: 40 }}>
                  <Text style={[styles.sectionTitle, { color: theme.text }]}>Recent Trend</Text>
                  <View style={[styles.trendCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
                    {data.monthly_trend.map((trend: any, index: number) => (
                      <View key={index} style={[styles.trendRow, { borderBottomColor: theme.border, borderBottomWidth: index === data.monthly_trend.length - 1 ? 0 : 1 }]}>
                        <Text style={[styles.trendMonth, { color: theme.textSecondary }]}>{trend.month}</Text>
                        <Text style={[styles.trendAmount, { color: theme.text }]}>{currencySymbol}{trend.amount.toFixed(0)}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}
              
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalContent: { height: '85%', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  title: { fontSize: 20, fontFamily: 'Inter_700Bold' },
  closeBtn: { padding: 4, borderRadius: 16 },
  body: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12, fontFamily: 'Inter_500Medium' },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 30 },
  emptyIconCircle: { width: 80, height: 80, borderRadius: 40, justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  emptyTitle: { fontSize: 22, fontFamily: 'Inter_700Bold', marginBottom: 12 },
  emptySubtitle: { fontSize: 14, fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 20, marginBottom: 30 },
  addExpenseBtn: { paddingHorizontal: 30, paddingVertical: 14, borderRadius: 12 },
  addExpenseBtnText: { color: '#FFF', fontSize: 16, fontFamily: 'Inter_600SemiBold' },
  highlightsContainer: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  highlightCard: { flex: 1, padding: 16, borderRadius: 16, borderWidth: 1 },
  highlightLabel: { fontSize: 12, fontFamily: 'Inter_500Medium', marginBottom: 6 },
  highlightValue: { fontSize: 22, fontFamily: 'Inter_700Bold' },
  topSpenderCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderRadius: 16, borderWidth: 1, marginBottom: 24 },
  crownCircle: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  topSpenderName: { fontSize: 18, fontFamily: 'Inter_600SemiBold' },
  topSpenderAmount: { fontSize: 18, fontFamily: 'Inter_700Bold' },
  sectionTitle: { fontSize: 16, fontFamily: 'Inter_600SemiBold', marginBottom: 16 },
  chartContainer: { marginBottom: 20 },
  stackedBar: { flexDirection: 'row', height: 24, borderRadius: 12, width: '100%', overflow: 'hidden' },
  barSegment: { height: '100%' },
  breakdownList: { borderRadius: 16, padding: 16, borderWidth: 1 },
  breakdownItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  colorDot: { width: 12, height: 12, borderRadius: 6, marginRight: 12 },
  avatar: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  avatarText: { fontSize: 12, fontFamily: 'Inter_600SemiBold' },
  memberName: { fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  memberPercentage: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 2 },
  memberAmount: { fontSize: 16, fontFamily: 'Inter_600SemiBold' },
  trendCard: { borderRadius: 16, padding: 16, borderWidth: 1 },
  trendRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 },
  trendMonth: { fontSize: 14, fontFamily: 'Inter_500Medium' },
  trendAmount: { fontSize: 14, fontFamily: 'Inter_600SemiBold' },
});
