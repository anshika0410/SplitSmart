import React from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, TouchableWithoutFeedback } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSettings } from '../context/SettingsContext';

interface BalanceMenuModalProps {
  visible: boolean;
  onClose: () => void;
  onAction: (action: 'pdf' | 'csv' | 'analysis' | 'reminders') => void;
}

export default function BalanceMenuModal({ visible, onClose, onAction }: BalanceMenuModalProps) {
  const { theme } = useSettings();

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="fade" transparent>
      <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={onClose}>
        <TouchableWithoutFeedback>
          <View style={[styles.menuContainer, { backgroundColor: theme.background, borderColor: theme.border }]}>
            <Text style={[styles.menuTitle, { color: theme.text }]}>Balance Options</Text>
            
            <TouchableOpacity style={[styles.menuItem, { borderBottomColor: theme.border }]} onPress={() => { onAction('pdf'); onClose(); }}>
              <MaterialCommunityIcons name="file-pdf-box" size={24} color="#FF7675" />
              <Text style={[styles.menuText, { color: theme.text }]}>Export PDF Report</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={[styles.menuItem, { borderBottomColor: theme.border }]} onPress={() => { onAction('csv'); onClose(); }}>
              <MaterialCommunityIcons name="file-excel-box" size={24} color="#00B894" />
              <Text style={[styles.menuText, { color: theme.text }]}>Export CSV Report</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.menuItem, { borderBottomColor: theme.border }]} onPress={() => { onAction('analysis'); onClose(); }}>
              <Ionicons name="pie-chart" size={24} color="#0984E3" />
              <Text style={[styles.menuText, { color: theme.text }]}>View Spending Analysis</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={[styles.menuItem, { borderBottomColor: theme.border }]} onPress={() => { onAction('reminders'); onClose(); }}>
              <Ionicons name="notifications" size={24} color="#FDCB6E" />
              <Text style={[styles.menuText, { color: theme.text }]}>Send Payment Reminders</Text>
            </TouchableOpacity>
          </View>
        </TouchableWithoutFeedback>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuContainer: {
    width: '80%',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
  },
  menuTitle: {
    fontSize: 18,
    fontFamily: 'Inter_700Bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  menuText: {
    fontSize: 16,
    fontFamily: 'Inter_500Medium',
    marginLeft: 16,
  }
});
