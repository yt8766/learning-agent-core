import { create } from 'zustand';

const defaultAvatar =
  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120"><rect width="120" height="120" rx="60" fill="%231677ff"/><circle cx="60" cy="46" r="22" fill="white" opacity="0.95"/><path d="M25 101c7-22 20-34 35-34s28 12 35 34" fill="white" opacity="0.95"/></svg>';

interface AccountProfileState {
  avatar: string;
  displayName: string;
  updateAvatar: (avatar: string) => void;
  updateDisplayName: (displayName: string) => void;
}

export const useAccountProfileStore = create<AccountProfileState>(set => ({
  avatar: defaultAvatar,
  displayName: 'ProUser',
  updateAvatar: avatar => set({ avatar }),
  updateDisplayName: displayName => set({ displayName: displayName.trim() || 'ProUser' })
}));
