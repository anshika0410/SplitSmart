import React, { useState, useRef, useEffect } from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { sendChatMessage } from '../services/api';
import { useSettings } from '../context/SettingsContext';

interface Message {
  role: 'user' | 'model';
  content: string;
}

const SUGGESTED_QUESTIONS = [
  "How does Smart Split work?",
  "How to use Bill Scan?",
  "What is Hostel Mode?",
  "How do I settle balances via UPI?",
];

export default function HelpBotModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { theme } = useSettings();
  const [messages, setMessages] = useState<Message[]>([
    { role: 'model', content: "Hi! I'm the SplitSmart AI Assistant. How can I help you with the app today?" }
  ]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (visible && scrollViewRef.current) {
      setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [visible, messages]);

  const handleSend = async (text: string = inputText) => {
    if (!text.trim()) return;
    
    const userMsg: Message = { role: 'user', content: text };
    const currentHistory = [...messages];
    
    setMessages([...currentHistory, userMsg]);
    setInputText('');
    setIsTyping(true);

    try {
      const response = await sendChatMessage(text, currentHistory);
      setMessages([...currentHistory, userMsg, { role: 'model', content: response.reply }]);
    } catch (error) {
      setMessages([...currentHistory, userMsg, { role: 'model', content: "Sorry, I'm having trouble connecting to the server right now." }]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleClearChat = () => {
    setMessages([{ role: 'model', content: "Hi! I'm the SplitSmart AI Assistant. How can I help you with the app today?" }]);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={[styles.modalContainer, { backgroundColor: theme.background }]}>
          <LinearGradient colors={[theme.card, theme.surface]} style={[styles.header, { borderBottomColor: theme.border }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="chatbubbles-outline" size={24} color={theme.primaryLight} style={{ marginRight: 8 }} />
              <Text style={[styles.title, { color: theme.text }]}>AI Help Assistant</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <TouchableOpacity onPress={handleClearChat} style={{ marginRight: 16 }}>
                <Ionicons name="trash-outline" size={22} color={theme.danger} />
              </TouchableOpacity>
              <TouchableOpacity onPress={onClose} style={[styles.closeBtn, { backgroundColor: theme.surface }]}>
                <Ionicons name="close" size={24} color={theme.text} />
              </TouchableOpacity>
            </View>
          </LinearGradient>

          <KeyboardAvoidingView 
            style={{ flex: 1 }} 
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            <ScrollView 
              ref={scrollViewRef}
              style={[styles.chatArea, { backgroundColor: theme.background }]}
              contentContainerStyle={{ padding: 16, paddingBottom: 20 }}
            >
              {messages.length === 1 && (
                <View style={styles.suggestionsContainer}>
                  <Text style={[styles.suggestionsTitle, { color: theme.textSecondary }]}>Suggested Questions:</Text>
                  {SUGGESTED_QUESTIONS.map((q, idx) => (
                    <TouchableOpacity key={idx} style={[styles.suggestionBadge, { backgroundColor: theme.primaryLight + '20', borderColor: theme.primaryLight + '50' }]} onPress={() => handleSend(q)}>
                      <Text style={[styles.suggestionText, { color: theme.primaryLight }]}>{q}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {messages.map((m, idx) => (
                <View key={idx} style={[styles.messageBubble, m.role === 'user' ? [styles.userBubble, { backgroundColor: theme.primary }] : [styles.modelBubble, { backgroundColor: theme.card }]]}>
                  <Text style={[styles.messageText, { color: m.role === 'user' ? '#FFF' : theme.text }]}>{m.content}</Text>
                </View>
              ))}
              
              {isTyping && (
                <View style={[styles.messageBubble, styles.modelBubble, { backgroundColor: theme.card, width: 60 }]}>
                  <ActivityIndicator size="small" color={theme.primaryLight} />
                </View>
              )}
            </ScrollView>

            <View style={[styles.inputArea, { backgroundColor: theme.card, borderTopColor: theme.border }]}>
              <TextInput
                style={[styles.input, { backgroundColor: theme.inputBackground, color: theme.text }]}
                placeholder="Ask about SplitSmart features..."
                placeholderTextColor={theme.textSecondary}
                value={inputText}
                onChangeText={setInputText}
                onSubmitEditing={() => handleSend()}
              />
              <TouchableOpacity 
                style={[styles.sendBtn, { backgroundColor: theme.primaryLight }, !inputText.trim() && { opacity: 0.5 }]} 
                onPress={() => handleSend()}
                disabled={!inputText.trim()}
              >
                <Ionicons name="send" size={20} color="#FFF" />
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContainer: { height: '90%', borderTopLeftRadius: 20, borderTopRightRadius: 20, overflow: 'hidden' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, paddingTop: 24, borderBottomWidth: 1 },
  title: { fontSize: 18, fontFamily: 'Inter_600SemiBold' },
  closeBtn: { padding: 4, borderRadius: 16 },
  chatArea: { flex: 1 },
  messageBubble: { maxWidth: '80%', padding: 12, borderRadius: 16, marginBottom: 12 },
  userBubble: { alignSelf: 'flex-end', borderBottomRightRadius: 4 },
  modelBubble: { alignSelf: 'flex-start', borderBottomLeftRadius: 4 },
  messageText: { fontSize: 15, fontFamily: 'Inter_400Regular', lineHeight: 22 },
  inputArea: { flexDirection: 'row', padding: 16, alignItems: 'center', borderTopWidth: 1 },
  input: { flex: 1, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, fontSize: 15, fontFamily: 'Inter_400Regular' },
  sendBtn: { marginLeft: 12, width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  suggestionsContainer: { marginBottom: 20, marginTop: 10 },
  suggestionsTitle: { fontSize: 13, fontFamily: 'Inter_500Medium', marginBottom: 12, marginLeft: 4 },
  suggestionBadge: { borderWidth: 1, borderRadius: 20, paddingVertical: 8, paddingHorizontal: 16, marginBottom: 8, alignSelf: 'flex-start' },
  suggestionText: { fontSize: 14, fontFamily: 'Inter_500Medium' }
});
