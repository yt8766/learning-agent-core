import { beforeEach, describe, expect, it } from 'vitest';

import { useAccountProfileStore } from '../src/pages/account/account-store';

describe('account-store', () => {
  beforeEach(() => {
    useAccountProfileStore.setState({
      avatar: useAccountProfileStore.getInitialState().avatar,
      displayName: 'ProUser'
    });
  });

  it('has default avatar and display name', () => {
    const state = useAccountProfileStore.getState();

    expect(state.avatar).toContain('data:image/svg+xml');
    expect(state.displayName).toBe('ProUser');
  });

  it('updates avatar', () => {
    useAccountProfileStore.getState().updateAvatar('https://example.com/avatar.png');

    expect(useAccountProfileStore.getState().avatar).toBe('https://example.com/avatar.png');
  });

  it('updates display name', () => {
    useAccountProfileStore.getState().updateDisplayName('New Name');

    expect(useAccountProfileStore.getState().displayName).toBe('New Name');
  });

  it('trims display name', () => {
    useAccountProfileStore.getState().updateDisplayName('  Spaced Name  ');

    expect(useAccountProfileStore.getState().displayName).toBe('Spaced Name');
  });

  it('falls back to default when display name is empty after trim', () => {
    useAccountProfileStore.getState().updateDisplayName('   ');

    expect(useAccountProfileStore.getState().displayName).toBe('ProUser');
  });

  it('falls back to default when display name is empty string', () => {
    useAccountProfileStore.getState().updateDisplayName('');

    expect(useAccountProfileStore.getState().displayName).toBe('ProUser');
  });
});
