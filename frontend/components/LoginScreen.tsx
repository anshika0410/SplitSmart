import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSettings } from '../context/SettingsContext';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';

WebBrowser.maybeCompleteAuthSession();

interface LoginScreenProps {
  onLogin: (email: string, name: string, photoUrl?: string) => Promise<void>;
  isLoading: boolean;
}

export default function LoginScreen({ onLogin, isLoading }: LoginScreenProps) {
  const { theme } = useSettings();

  const [request, response, promptAsync] = Google.useAuthRequest({
    androidClientId: process.env.EXPO_PUBLIC_ANDROID_CLIENT_ID || 'YOUR_ANDROID_CLIENT_ID',
    iosClientId: process.env.EXPO_PUBLIC_IOS_CLIENT_ID || 'YOUR_IOS_CLIENT_ID',
    webClientId: process.env.EXPO_PUBLIC_WEB_CLIENT_ID || 'YOUR_WEB_CLIENT_ID',
  });

  React.useEffect(() => {
    if (response?.type === 'success') {
      const { authentication } = response;
      fetchUserInfo(authentication?.accessToken);
    }
  }, [response]);

  const fetchUserInfo = async (token?: string) => {
    if (!token) return;
    try {
      const res = await fetch('https://www.googleapis.com/userinfo/v2/me', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const user = await res.json();
      await onLogin(user.email, user.name, user.picture);
    } catch (e) {
      Alert.alert('Error', 'Failed to fetch Google user info');
    }
  };

  const handleGoogleLogin = async () => {
    promptAsync();
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.header}>
        <Ionicons name="pie-chart" size={64} color={theme.primary} />
        <Text style={[styles.title, { color: theme.text }]}>SplitSmart</Text>
        <Text style={[styles.subtitle, { color: theme.textSecondary }]}>The smartest way to split bills with friends.</Text>
      </View>

      <View style={styles.bottomSection}>
        <TouchableOpacity
          style={[styles.googleBtn, { backgroundColor: theme.surface, borderColor: theme.border }]}
          onPress={handleGoogleLogin}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color={theme.primary} />
          ) : (
            <>
              <Ionicons name="logo-google" size={24} color={theme.text} style={{ marginRight: 12 }} />
              <Text style={[styles.googleBtnText, { color: theme.text }]}>Sign in with Google</Text>
            </>
          )}
        </TouchableOpacity>

        <Text style={[styles.footerText, { color: theme.textSecondary }]}>
          By signing in, you agree to our Terms of Service and Privacy Policy.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  header: {
    flex: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontFamily: 'Inter_700Bold',
    fontSize: 42,
    marginTop: 20,
    marginBottom: 8,
  },
  subtitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 16,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  bottomSection: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingBottom: 40,
  },
  googleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 24,
  },
  googleBtnText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 18,
  },
  footerText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    textAlign: 'center',
    paddingHorizontal: 20,
  }
});
