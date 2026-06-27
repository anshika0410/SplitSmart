import React, { useState } from 'react';
import {
  Modal, View, Text, StyleSheet, TouchableOpacity,
  ActivityIndicator, TextInput, ScrollView, Animated, Alert, Platform
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import { ParsedNLExpense } from '../services/api';
import { useSettings } from '../context/SettingsContext';

interface NLParseModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: (expense: ParsedNLExpense) => void;
  parseExpense: (text: string) => Promise<ParsedNLExpense>;
  parseAudio?: (uri: string, mime: string) => Promise<ParsedNLExpense>;
  groupMembers: { id: number; name: string }[];
  initialText?: string;
  mode?: 'text' | 'voice';
}

export default function NLParseModal({ visible, mode = 'text', onClose, onConfirm, parseExpense, parseAudio, groupMembers, initialText = '' }: NLParseModalProps) {
  const { currencySymbol, theme } = useSettings();
  const [text, setText] = useState(initialText);
  const [loading, setLoading] = useState(false);
  const [parsed, setParsed] = useState<ParsedNLExpense | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);

  const [isPreparing, setIsPreparing] = useState(false);

  const startRecording = async () => {
    if (isRecording || isPreparing) return;
    setIsPreparing(true);
    try {
      const perm = await Audio.requestPermissionsAsync();
      if (perm.status === 'granted') {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
        });
        const { recording: newRecording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
        setRecording(newRecording);
        setIsRecording(true);
      } else {
        Alert.alert('Permission Denied', 'Please grant microphone access to use Voice Split.');
      }
    } catch (err) {
      console.error('Failed to start recording', err);
      Alert.alert('Error', 'Failed to start recording. Please restart the app if this persists.');
    } finally {
      setIsPreparing(false);
    }
  };

  const stopRecording = async () => {
    if (!recording) return;
    setIsRecording(false);
    
    try {
      await recording.stopAndUnloadAsync();
    } catch (err: any) {
      setRecording(null);
      if (err.message?.includes('no valid audio data')) {
        Alert.alert('Too Short', 'Please hold the microphone button a bit longer.');
        return;
      }
      console.error('Failed to stop recording', err);
      return;
    }

    const uri = recording.getURI();
    setRecording(null);

    if (uri && parseAudio) {
      setLoading(true);
      setError(null);
      setParsed(null);
      try {
        const mime = Platform.OS === 'ios' ? 'audio/m4a' : 'audio/m4a';
        const result = await parseAudio(uri, mime);
        setParsed(result);
      } catch (e: any) {
        setError(e?.response?.data?.detail || 'Failed to parse audio. Please try again.');
      } finally {
        setLoading(false);
      }
    }
  };

  React.useEffect(() => {
    if (visible && initialText) {
      setText(initialText);

      // Automatically trigger parsing if initialText was passed in
      const autoParse = async () => {
        setLoading(true);
        setError(null);
        setParsed(null);
        try {
          const result = await parseExpense(initialText.trim());
          setParsed(result);
        } catch (e: any) {
          setError(e?.response?.data?.detail || 'Failed to parse expense. Please try again.');
        } finally {
          setLoading(false);
        }
      };
      autoParse();
    }
  }, [visible, initialText]);

  const handleParse = async () => {
    if (!text.trim()) return;
    setLoading(true);
    setError(null);
    setParsed(null);
    try {
      const result = await parseExpense(text.trim());
      setParsed(result);
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Failed to parse expense. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const getUserName = (id: number) => groupMembers.find(m => m.id === id)?.name ?? `User #${id}`;

  const handleConfirm = () => {
    if (parsed) {
      onConfirm(parsed);
      setText('');
      setParsed(null);
    }
  };

  const handleClose = () => {
    setText('');
    setParsed(null);
    setError(null);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <View style={styles.overlay}>
        <View style={[styles.sheet, { backgroundColor: theme.background, borderColor: theme.border }]}>

          {/* Handle */}
          <View style={[styles.handle, { backgroundColor: theme.border }]} />

          <Text style={[styles.title, { color: theme.text }]}>{mode === 'voice' ? 'Voice Expense Parser' : 'AI Expense Parser'}</Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>{mode === 'voice' ? 'Hold the microphone to describe your expense' : 'Describe your expense in plain language'}</Text>

          {mode === 'text' && (
            <>
              {/* Input Area */}
              <View style={[styles.inputContainer, { backgroundColor: theme.inputBackground, borderColor: theme.border }]}>
                <TextInput
                  style={[styles.input, { color: theme.text }]}
                  value={text}
                  onChangeText={setText}
                  placeholder={`e.g. "I paid ${currencySymbol}480 for pizza, split with Rahul and Aman"`}
                  placeholderTextColor={theme.textSecondary}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                />
              </View>

              {/* Example chips */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll}>
                {[
                  `I paid ${currencySymbol}350 for Swiggy, split equally`,
                  `Rahul paid ${currencySymbol}600 for movies with Aman`,
                  `Split ${currencySymbol}1200 Wi-Fi bill with everyone`,
                ].map((example) => (
                  <TouchableOpacity key={example} style={[styles.chip, { backgroundColor: theme.surface }]} onPress={() => setText(example)}>
                    <Text style={[styles.chipText, { color: theme.primaryLight }]}>{example}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Parse Button */}
              <TouchableOpacity style={styles.parseBtn} onPress={handleParse} disabled={loading || !text.trim()}>
                <LinearGradient colors={[theme.primary, theme.primaryLight]} style={styles.parseBtnGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                  {loading ? (
                    <ActivityIndicator color="#FFF" />
                  ) : (
                    <>
                      <Ionicons name="sparkles" size={18} color="#FFF" style={{ marginRight: 8 }} />
                      <Text style={styles.parseBtnText}>Parse Text</Text>
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </>
          )}

          {mode === 'voice' && (
            <View style={{ alignItems: 'center', marginVertical: 30 }}>
              <TouchableOpacity
                style={{ width: 100, height: 100, borderRadius: 50, overflow: 'hidden' }}
                onPressIn={startRecording}
                onPressOut={stopRecording}
                disabled={loading}
              >
                <LinearGradient colors={isRecording ? [theme.dangerLight, theme.danger] : [theme.surface, theme.surface]} style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                  {loading && !isRecording ? (
                    <ActivityIndicator color="#FFF" size="large" />
                  ) : (
                    <Ionicons name="mic" size={48} color={isRecording ? "#FFF" : theme.primaryLight} />
                  )}
                </LinearGradient>
              </TouchableOpacity>
              <Text style={{ color: isRecording ? theme.danger : theme.textSecondary, marginTop: 16, fontSize: 14, fontFamily: 'Inter_400Regular' }}>
                {isRecording ? 'Recording... Release to Parse' : 'Hold to Speak'}
              </Text>
            </View>
          )}

          {/* Error */}
          {error && (
            <View style={[styles.errorBox, { backgroundColor: theme.dangerLight + '20', borderColor: theme.dangerLight }]}>
              <Ionicons name="alert-circle-outline" size={16} color={theme.danger} />
              <Text style={[styles.errorText, { color: theme.danger }]}>{error}</Text>
            </View>
          )}

          {/* Parsed Result */}
          {parsed && (
            <View style={[styles.resultCard, { backgroundColor: theme.card, borderColor: theme.primaryLight }]}>
              <Text style={[styles.resultTitle, { color: theme.primaryLight }]}>✅ AI Detected</Text>
              <View style={styles.resultRow}>
                <Text style={[styles.resultLabel, { color: theme.textSecondary }]}>Amount ({currencySymbol})</Text>
                <TextInput
                  style={[styles.resultValue, styles.editableInput, { backgroundColor: theme.surface, color: theme.text }]}
                  value={parsed.amount.toString()}
                  keyboardType="numeric"
                  onChangeText={(val) => setParsed({ ...parsed, amount: parseFloat(val) || 0 })}
                />
              </View>
              <View style={styles.resultRow}>
                <Text style={[styles.resultLabel, { color: theme.textSecondary }]}>Description</Text>
                <TextInput
                  style={[styles.resultValue, styles.editableInput, { backgroundColor: theme.surface, color: theme.text }]}
                  value={parsed.description}
                  onChangeText={(val) => setParsed({ ...parsed, description: val })}
                />
              </View>
              <View style={styles.resultRow}>
                <Text style={[styles.resultLabel, { color: theme.textSecondary }]}>Paid by</Text>
                <Text style={[styles.resultValue, { color: theme.text }]}>{getUserName(parsed.payer_id)}</Text>
              </View>
              <View style={styles.resultRow}>
                <Text style={[styles.resultLabel, { color: theme.textSecondary }]}>Split among</Text>
                <Text style={[styles.resultValue, { color: theme.text }]}>{parsed.split_among_ids.map(getUserName).join(', ')}</Text>
              </View>
              <View style={styles.resultRow}>
                <Text style={[styles.resultLabel, { color: theme.textSecondary }]}>Each pays</Text>
                <Text style={[styles.resultValue, { color: theme.primaryLight }]}>
                  {currencySymbol} {(parsed.amount / parsed.split_among_ids.length).toFixed(2)}
                </Text>
              </View>

              <TouchableOpacity style={[styles.confirmBtn, { backgroundColor: theme.primary }]} onPress={handleConfirm}>
                <Text style={styles.confirmBtnText}>Confirm & Add Expense</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    maxHeight: '90%',
    borderWidth: 1,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
  },
  title: {
    fontFamily: 'Inter_700Bold',
    fontSize: 22,
    marginBottom: 4,
  },
  subtitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    marginBottom: 20,
  },
  inputContainer: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    marginBottom: 12,
  },
  input: {
    fontFamily: 'Inter_400Regular',
    fontSize: 15,
    minHeight: 72,
  },
  chipsScroll: {
    marginBottom: 16,
  },
  chip: {
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginRight: 8,
  },
  chipText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
  },
  parseBtn: {
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 16,
  },
  parseBtnGradient: {
    flexDirection: 'row',
    paddingVertical: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 16,
  },
  parseBtnText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 16,
    color: '#FFF',
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
  },
  errorText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    marginLeft: 8,
    flex: 1,
  },
  resultCard: {
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
  },
  resultTitle: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 15,
    marginBottom: 14,
  },
  resultRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  resultLabel: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
  },
  resultValue: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    maxWidth: '60%',
    textAlign: 'right',
  },
  editableInput: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    minWidth: 80,
    textAlign: 'right',
  },
  confirmBtn: {
    marginTop: 16,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  confirmBtnText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 15,
    color: '#FFF',
  },
});
