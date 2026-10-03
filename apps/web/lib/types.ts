export type WhatsAppSessionStatus =
  | "disconnected"
  | "connecting"
  | "qr_ready"
  | "authenticating"
  | "connected"
  | "interrupted";

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
  unread_count?: number;
  marked_unread?: boolean;
  unread_since?: string | null;
  last_message_at?: string | null;
  last_message_preview?: string | null;
  last_message_from_me?: boolean | null;
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
  chat_id: string | null;
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
