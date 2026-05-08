const key = 'agent-gateway.refresh-token';
export function readGatewayRefreshToken(storage: Storage = localStorage): string | null {
  return storage.getItem(key);
}
export function writeGatewayRefreshToken(refreshToken: string, storage: Storage = localStorage): void {
  storage.setItem(key, refreshToken);
}
export function clearGatewayRefreshToken(storage: Storage = localStorage): void {
  storage.removeItem(key);
}
