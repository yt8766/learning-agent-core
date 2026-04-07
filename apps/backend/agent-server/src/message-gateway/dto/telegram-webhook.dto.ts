export class TelegramWebhookUserDto {
  id?: number | string;
  username?: string;
}

export class TelegramWebhookChatDto {
  id?: number | string;
}

export class TelegramWebhookMessageDto {
  message_id?: number | string;
  text?: string;
  from?: TelegramWebhookUserDto;
  chat?: TelegramWebhookChatDto;
}

export class TelegramWebhookDto {
  update_id?: number | string;
  message?: TelegramWebhookMessageDto;
  edited_message?: TelegramWebhookMessageDto;
}
