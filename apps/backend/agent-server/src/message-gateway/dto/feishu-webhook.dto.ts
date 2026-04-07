export class FeishuWebhookHeaderDto {
  token?: string;
}

export class FeishuWebhookSenderIdDto {
  open_id?: string;
}

export class FeishuWebhookSenderDto {
  id?: string;
  sender_id?: FeishuWebhookSenderIdDto;
  sender_type?: string;
}

export class FeishuWebhookMessageDto {
  chat_id?: string;
  chatId?: string;
  message_id?: string;
  messageId?: string;
  content?: string;
}

export class FeishuWebhookEventDto {
  sender?: FeishuWebhookSenderDto;
  message?: FeishuWebhookMessageDto;
}

export class FeishuWebhookDto {
  type?: string;
  challenge?: string;
  token?: string;
  header?: FeishuWebhookHeaderDto;
  event?: FeishuWebhookEventDto;
  message?: FeishuWebhookMessageDto;
}
