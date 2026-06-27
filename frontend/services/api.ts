import axios from 'axios';
import { Platform } from 'react-native';

// Get backend URL from environment variables, fallback to localhost for development
export const BASE_URL = process.env.EXPO_PUBLIC_BASE_URL || 'http://127.0.0.1:8000';

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Types
export interface User {
  id: number;
  name: string;
  email: string;
  phone_number?: string;
  upi_vpa?: string;
}

export interface Group {
  id: number;
  name: string;
  description?: string;
}

export interface ParsedNLExpense {
  amount: number;
  description: string;
  payer_id: number;
  split_among_ids: number[];
  split_type: 'equal' | 'exact' | 'percentage';
}

export interface BillItem {
  name: string;
  quantity: number;
  price: number;
}

export interface ParsedBill {
  items: BillItem[];
  taxes_and_charges: number;
  grand_total: number;
  restaurant_name?: string;
}

// --- User API ---
export const createUser = (data: { name: string; email: string; phone_number?: string; upi_vpa?: string }) =>
  api.post<User>('/users', data).then(r => r.data);

export const getUsers = () =>
  api.get<User[]>('/users').then(r => r.data || []);

// --- Group API ---
export const createGroup = (data: { name: string; description?: string }, currentUserId: number) =>
  api.post<Group>(`/groups/?current_user_id=${currentUserId}`, data).then(r => r.data);

export const getGroups = () =>
  api.get<Group[]>('/groups/').then(r => r.data || []);

export const joinGroupByInviteCode = (inviteCode: string, userId: number) =>
  api.post(`/groups/join/${inviteCode}?user_id=${userId}`).then(r => r.data);

export const addGroupMember = (groupId: number, userId: number, isAdmin: boolean = false) =>
  api.post(`/groups/${groupId}/members?user_id=${userId}&is_admin=${isAdmin}`).then(r => r.data);

export const getGroupMembers = (groupId: number) =>
  api.get<User[]>(`/groups/${groupId}/members`).then(r => r.data || []);

export const getGroupMembersDetailed = (groupId: number) =>
  api.get<{ id: number; name: string; email: string; is_admin: boolean }[]>(`/groups/${groupId}/members_detailed`).then(r => r.data || []);

export const getGroupAnalytics = (groupId: number) =>
  api.get<any>(`/groups/${groupId}/analytics`).then(r => r.data);

export const downloadGroupCsv = (groupId: number, currency: string) =>
  api.get(`/groups/${groupId}/export/csv?currency=${currency}`, { responseType: 'blob' });

export const downloadGroupPdf = (groupId: number, currency: string) =>
  api.get(`/groups/${groupId}/export/pdf?currency=${currency}`, { responseType: 'blob' });

export const deleteGroup = (groupId: number, requesterId: number) =>
  api.delete(`/groups/${groupId}?requester_id=${requesterId}`).then(r => r.data);

export const updateGroup = (groupId: number, requesterId: number, data: { name: string; description?: string }) =>
  api.patch(`/groups/${groupId}?requester_id=${requesterId}`, data).then(r => r.data);

export const archiveGroup = (groupId: number, requesterId: number) =>
  api.post(`/groups/${groupId}/archive?requester_id=${requesterId}`).then(r => r.data);

export const unarchiveGroup = (groupId: number, requesterId: number) =>
  api.post(`/groups/${groupId}/unarchive?requester_id=${requesterId}`).then(r => r.data);

export const removeGroupMember = (groupId: number, userId: number, requesterId: number) =>
  api.delete(`/groups/${groupId}/members/${userId}?requester_id=${requesterId}`).then(r => r.data);

export const joinGroupByInvite = (inviteCode: string, userId: number) =>
  api.post(`/groups/join/${inviteCode}?user_id=${userId}`).then(r => r.data);

export const getUserGroups = (userId: number, archived: boolean = false) =>
  api.get<any[]>(`/groups/user/${userId}?archived=${archived}`).then(r => r.data || []);


export const createExpense = (data: any) =>
  api.post('/expenses/', data).then(r => r.data);

// --- AI API ---
export const parseNaturalLanguage = (text: string, groupId: number, currentUserId: number) =>
  api.post<ParsedNLExpense>('/ai/parse-nl', {
    text,
    group_id: groupId,
    current_user_id: currentUserId,
  }).then(r => r.data);

export const parseBillImage = async (imageUri: string, mimeType: string = 'image/jpeg'): Promise<ParsedBill> => {
  const formData = new FormData();

  if (Platform.OS === 'web' && imageUri.startsWith('data:')) {
    const res = await fetch(imageUri);
    const blob = await res.blob();
    formData.append('file', blob, 'bill.jpg');
  } else {
    formData.append('file', {
      uri: imageUri,
      type: mimeType,
      name: 'bill.jpg',
    } as any);
  }

  const response = await api.post<ParsedBill>('/ai/parse-bill', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data;
};

export const parseAudioExpense = async (audioUri: string, mimeType: string, groupId: number, currentUserId: number) => {
  const formData = new FormData();
  formData.append('group_id', groupId.toString());
  formData.append('current_user_id', currentUserId.toString());

  if (Platform.OS === 'web' && audioUri.startsWith('data:')) {
    const res = await fetch(audioUri);
    const blob = await res.blob();
    formData.append('file', blob, 'audio_expense.' + (mimeType.includes('m4a') ? 'm4a' : 'wav'));
  } else {
    formData.append('file', {
      uri: audioUri,
      type: mimeType,
      name: 'audio_expense.' + (mimeType.includes('m4a') ? 'm4a' : 'wav'),
    } as any);
  }

  const response = await api.post<ParsedNLExpense>('/ai/parse-audio', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data;
};

// --- Balance & Settlement API ---
export interface Balance {
  id: number;
  user_id: number;
  owes_to_user_id: number;
  amount: number;
  group_id?: number;
  updated_at: string;
  user: User;
  owes_to: User;
}

export const getUserBalances = (userId: number, groupId?: number) => {
  const url = groupId ? `/users/${userId}/balances?group_id=${groupId}` : `/users/${userId}/balances`;
  return api.get<Balance[]>(url).then(r => r.data);
};

export const getUserActivities = (userId: number, groupId?: number) => {
  const url = groupId ? `/users/${userId}/activities?group_id=${groupId}` : `/users/${userId}/activities`;
  return api.get<any[]>(url).then(r => r.data || []);
};


export const settleBalance = (userId: number, owesToUserId: number) =>
  api.post<{ message: string }>(`/users/${userId}/settle/${owesToUserId}`).then(r => r.data);

// --- Recurring Expense API ---
export const triggerRecurringProcessing = () =>
  api.post('/expenses/recurring/process').then(r => r.data);

export const createRecurringExpense = (data: any) =>
  api.post('/expenses/recurring', data).then(r => r.data);

// --- UPI Deep Link Generator ---
export const generateUpiLink = (vpa: string, name: string, amount: number, description: string = 'SplitSmart Settlement') => {
  const encodedName = encodeURIComponent(name);
  const encodedDesc = encodeURIComponent(description);
  return `upi://pay?pa=${vpa}&pn=${encodedName}&am=${amount}&cu=INR&tn=${encodedDesc}`;
};

// --- AI Chat API ---
export const sendChatMessage = (message: string, history: any[] = []) =>
  api.post<{ reply: string }>('/chat/help', { message, history }).then(r => r.data);

export default api;
