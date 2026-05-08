import { describe, expect, it } from 'vitest';
import { clearGatewayRefreshToken, readGatewayRefreshToken, writeGatewayRefreshToken } from '../src/auth/auth-storage';
class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();
  get length() {
    return this.values.size;
  }
  clear() {
    this.values.clear();
  }
  getItem(key: string) {
    return this.values.get(key) ?? null;
  }
  key(index: number) {
    return Array.from(this.values.keys())[index] ?? null;
  }
  removeItem(key: string) {
    this.values.delete(key);
  }
  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}
describe('agent gateway auth storage', () => {
  it('stores refresh tokens only in localStorage', () => {
    const storage = new MemoryStorage();
    writeGatewayRefreshToken('refresh', storage);
    expect(readGatewayRefreshToken(storage)).toBe('refresh');
    clearGatewayRefreshToken(storage);
    expect(readGatewayRefreshToken(storage)).toBeNull();
  });
});
