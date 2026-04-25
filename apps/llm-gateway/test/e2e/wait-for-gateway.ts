import { gatewayBaseUrl } from './fixtures';

export async function waitForGateway(timeoutMs = 30_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let lastError: unknown;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${gatewayBaseUrl()}/api/v1/models`);
      if (response.status === 401) {
        return;
      }
      lastError = new Error(`Unexpected readiness status ${response.status}`);
    } catch (error) {
      lastError = error;
    }

    await new Promise(resolve => setTimeout(resolve, 500));
  }

  throw lastError instanceof Error ? lastError : new Error('llm-gateway E2E app did not become ready');
}
