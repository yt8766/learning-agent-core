export interface SendLarkDigestParams {
  content: string;
  title: string;
  card?: Record<string, unknown>;
  renderMode?: 'markdown-summary' | 'interactive-card' | 'dual';
  buttons?: Array<{
    text: string;
    url: string;
    type?: 'default' | 'primary' | 'danger';
  }>;
  webhookUrl?: string;
  fetchImpl?: typeof fetch;
}

export async function sendLarkDigestMessage({
  content,
  title,
  card,
  renderMode = 'dual',
  buttons,
  webhookUrl,
  fetchImpl
}: SendLarkDigestParams): Promise<{ success: true } | { skipped: true; reason: string }> {
  const targetUrl = webhookUrl;
  if (!targetUrl) {
    const reason = 'Lark Webhook URL 未配置，已跳过发送。';
    return { skipped: true, reason };
  }

  const markdownCard = buildMarkdownCard(title, content, buttons);
  const interactiveCard = card ?? markdownCard;

  const trySend = async (payloadCard: Record<string, unknown>) =>
    (fetchImpl ?? fetch)(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        msg_type: 'interactive',
        card: payloadCard
      })
    });

  const parseResponse = async (response: Response) => {
    const responseText = await response.text();
    let payload: { code?: number; msg?: string } = {};
    try {
      payload = JSON.parse(responseText) as { code?: number; msg?: string };
    } catch {
      throw new Error(`Lark 响应解析失败: ${responseText}`);
    }
    return { responseText, payload };
  };

  let response = renderMode === 'markdown-summary' ? await trySend(markdownCard) : await trySend(interactiveCard);

  if (!response.ok && renderMode === 'dual' && interactiveCard !== markdownCard) {
    response = await trySend(markdownCard);
  }

  let { responseText, payload } = await parseResponse(response);

  if (
    response.ok &&
    payload.code != null &&
    payload.code !== 0 &&
    renderMode === 'dual' &&
    interactiveCard !== markdownCard
  ) {
    response = await trySend(markdownCard);
    ({ responseText, payload } = await parseResponse(response));
  }

  if (!response.ok) {
    throw new Error(`Lark 发送失败: HTTP ${response.status} - ${payload.msg ?? responseText}`);
  }
  if (payload.code != null && payload.code !== 0) {
    throw new Error(`Lark 接口错误: code=${payload.code} msg=${payload.msg ?? '未知错误'}`);
  }
  return { success: true };
}

function buildMarkdownCard(
  title: string,
  content: string,
  buttons?: Array<{
    text: string;
    url: string;
    type?: 'default' | 'primary' | 'danger';
  }>
) {
  const elements: Array<Record<string, unknown>> = [
    {
      tag: 'markdown',
      content: convertToLarkMarkdown(content)
    }
  ];

  if (buttons?.length) {
    elements.push({
      tag: 'action',
      actions: buttons.map(button => ({
        tag: 'button',
        text: {
          tag: 'plain_text',
          content: button.text
        },
        type: button.type ?? 'default',
        url: button.url
      }))
    });
  }

  return {
    config: {
      wide_screen_mode: true
    },
    header: {
      template: 'blue',
      title: {
        tag: 'plain_text',
        content: title
      }
    },
    elements
  };
}

function convertToLarkMarkdown(content: string): string {
  return content
    .replace(/<[^>]+>/g, '')
    .replace(/^#+\s+(.+)$/gm, '**$1**\n')
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '[图片: $1]($2)');
}
