export type WhatsAppSessionStatus = "disconnected" | "qr_ready" | "connected";

export type WhatsAppSession = {
  id: string;
  user_id: string;
  status: WhatsAppSessionStatus;
  qr_code_base64: string | null;
  updated_at: string;
};

export type Chat = {
  id: string;
  user_id: string;
  wa_id: string;
  name: string;
  is_group: boolean;
  updated_at: string;
};

export type MessageStatus =
  | "pending"
  | "processing"
  | "sent"
  | "cancelled"
  | "failed";

export type ScheduledMessage = {
  id: string;
  user_id: string;
  chat_id: string;
  message_body: string;
  scheduled_at: string;
  status: MessageStatus;
  error_message: string | null;
  created_at: string;
  chats: {
    name: string;
    is_group: boolean;
  } | null;
};
