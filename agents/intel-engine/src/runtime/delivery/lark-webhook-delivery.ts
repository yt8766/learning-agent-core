export type LarkWebhookDeliveryStatus = 'sent' | 'failed';
export type LarkWebhookDeliveryFailureReason = 'http_error' | 'network_error';

export interface LarkWebhookDeliveryRequest {
  webhookUrl: string;
  payload: unknown;
  fetchImpl?: typeof fetch;
}

export interface LarkWebhookDeliverySuccessResult {
  ok: true;
  status: 'sent';
  httpStatus: number;
  responseText: string;
  webhookUrl: string;
}

export interface LarkWebhookDeliveryFailureResult {
  ok: false;
  status: 'failed';
  reason: LarkWebhookDeliveryFailureReason;
  httpStatus?: number;
  responseText?: string;
  errorMessage: string;
  webhookUrl: string;
}

export type LarkWebhookDeliveryResult = LarkWebhookDeliverySuccessResult | LarkWebhookDeliveryFailureResult;

export async function sendLarkWebhookDelivery(request: LarkWebhookDeliveryRequest): Promise<LarkWebhookDeliveryResult> {
  const fetchImpl = request.fetchImpl ?? globalThis.fetch.bind(globalThis);

  try {
    const response = await fetchImpl(request.webhookUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json'
      },
      body: JSON.stringify(request.payload)
    });
    const responseText = await response.text();

    if (!response.ok) {
      return {
        ok: false,
        status: 'failed',
        reason: 'http_error',
        httpStatus: response.status,
        responseText,
        errorMessage: `Lark webhook request failed with HTTP ${response.status}`,
        webhookUrl: request.webhookUrl
      };
    }

    return {
      ok: true,
      status: 'sent',
      httpStatus: response.status,
      responseText,
      webhookUrl: request.webhookUrl
    };
  } catch (error) {
    return {
      ok: false,
      status: 'failed',
      reason: 'network_error',
      errorMessage: error instanceof Error ? error.message : 'Unknown Lark webhook transport failure',
      webhookUrl: request.webhookUrl
    };
  }
}
