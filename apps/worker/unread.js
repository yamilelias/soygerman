const READ_STATUS = 4;
const PLAYED_STATUS = 5;
const PREVIEW_LIMIT = 500;

function unixSeconds(value) {
  if (value == null || value === "") return null;
  let n;
  if (typeof value === "number") n = value;
  else if (typeof value === "bigint") n = Number(value);
  else if (typeof value === "object" && typeof value.toNumber === "function") {
    n = value.toNumber();
  } else n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  if (n > 1e12) n = Math.floor(n / 1000);
  return Math.floor(n);
}

function blankChat(id, isGroup) {
  return {
    waId: id,
    name: id,
    isGroup,
    unreadCount: 0,
    markedUnread: false,
    unreadKnown: false,
    archived: false,
    archivedKnown: false,
    unreadSince: null,
    lastMessageAt: null,
    lastMessagePreview: null,
    lastMessageFromMe: null,
    lastMessageId: null,
    lastMessageParticipant: null,
    dirty: false,
  };
}

function snapshot(state) {
  return [
    state.name,
    state.isGroup,
    state.unreadCount,
    state.markedUnread,
    state.unreadKnown,
    state.archived,
    state.archivedKnown,
    state.unreadSince,
    state.lastMessageAt,
    state.lastMessagePreview,
    state.lastMessageFromMe,
    state.lastMessageId,
    state.lastMessageParticipant,
  ].join("\u0001");
}

function applyReadSnapshot(state, update) {
  if (!state || !update) return false;
  const before = snapshot(state);
  if (update.archived != null) {
    state.archivedKnown = true;
    state.archived = Boolean(update.archived);
  }
  if (!Object.prototype.hasOwnProperty.call(update, "unreadCount")) {
    const changed = snapshot(state) !== before;
    if (changed) state.dirty = true;
    return changed;
  }
  const count = update.unreadCount;
  if (typeof count === "number" && count < 0) {
    state.unreadKnown = true;
    state.markedUnread = true;
  } else if (count == null || count === 0) {
    const cursor = update.cursorSeconds;
    const newerIncoming =
      typeof cursor === "number" &&
      state.lastMessageFromMe === false &&
      state.lastMessageAt != null &&
      state.lastMessageAt > cursor;
    state.unreadKnown = true;
    state.markedUnread = false;
    state.unreadCount = newerIncoming ? 1 : 0;
    state.unreadSince = newerIncoming ? state.lastMessageAt : null;
  } else if (typeof count === "number") {
    state.unreadKnown = true;
    state.unreadCount = count;
    if (count === 0) state.markedUnread = false;
  }
  const changed = snapshot(state) !== before;
  if (changed) state.dirty = true;
  return changed;
}

function cursorFromConditional(conditional, id) {
  if (typeof conditional !== "function" || !id) return null;
  const probe = (ts) =>
    conditional({
      historySets: { chats: { [id]: { lastMessageRecvTimestamp: ts } } },
      chatUpserts: {},
    });
  let atZero;
  try {
    atZero = probe(0);
  } catch {
    return undefined;
  }
  if (atZero == null) return undefined;
  let atFuture;
  try {
    atFuture = probe(4_000_000_000);
  } catch {
    return undefined;
  }
  if (atZero === true && atFuture === true) return null;
  if (atZero !== true) return 0;
  let lo = 0;
  let hi = 4_000_000_000;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    let ok = false;
    try {
      ok = probe(mid) === true;
    } catch {
      ok = false;
    }
    if (ok) lo = mid;
    else hi = mid - 1;
  }
  if (lo > 1e12) return Math.floor(lo / 1000);
  return lo;
}

function clearRepliedChats(chats) {
  let changed = 0;
  for (const state of chats.values()) {
    if (!state.lastMessageFromMe || state.markedUnread) continue;
    if (state.unreadCount === 0 && state.unreadSince == null) continue;
    state.unreadKnown = true;
    state.unreadCount = 0;
    state.unreadSince = null;
    state.dirty = true;
    changed += 1;
  }
  return changed;
}

function reconcileUnread(state) {
  const unread = state.unreadCount > 0;
  if (state.unreadKnown && !unread && !state.markedUnread) {
    state.unreadSince = null;
    return;
  }
  if (!unread) {
    state.unreadSince = null;
    return;
  }
  if (
    state.unreadSince == null &&
    state.unreadCount === 1 &&
    state.lastMessageAt &&
    state.lastMessageFromMe === false
  ) {
    state.unreadSince = state.lastMessageAt;
  }
}

function absorbChat(previous, chat, isGroup) {
  const state = previous ?? blankChat(chat.id, isGroup);
  const before = snapshot(state);
  state.waId = chat.id;
  state.isGroup = Boolean(isGroup);
  const name = String(chat.name || "")
    .replaceAll("\u0000", "")
    .trim();
  if (name) state.name = name;
  else if (!state.name) state.name = chat.id;

  const hasCount = chat.unreadCount != null && chat.unreadCount !== "";
  const hasMarked = chat.markedAsUnread != null;
  if (chat.unreadCount === null) {
    state.unreadKnown = true;
    state.unreadCount = 0;
    state.unreadSince = null;
    if (!hasMarked) state.markedUnread = false;
  }
  if (hasCount || hasMarked) {
    state.unreadKnown = true;
    if (hasCount) {
      const count = Math.trunc(Number(chat.unreadCount));
      if (Number.isFinite(count)) {
        if (count < 0) state.markedUnread = true;
        else {
          state.unreadCount = count;
          if (count === 0) state.markedUnread = false;
        }
      }
    }
    if (hasMarked) state.markedUnread = Boolean(chat.markedAsUnread);
  }
  if (chat.archived != null) {
    state.archivedKnown = true;
    state.archived = Boolean(chat.archived);
  }

  reconcileUnread(state);
  const changed = snapshot(state) !== before;
  if (changed) state.dirty = true;
  return { state, changed };
}

function unwrapContent(message) {
  let current = message;
  for (let depth = 0; depth < 6 && current; depth += 1) {
    const inner =
      current.ephemeralMessage?.message ||
      current.viewOnceMessage?.message ||
      current.viewOnceMessageV2?.message ||
      current.viewOnceMessageV2Extension?.message ||
      current.documentWithCaptionMessage?.message ||
      current.editedMessage?.message;
    if (!inner) break;
    current = inner;
  }
  return current;
}

function messagePreview(message) {
  const content = unwrapContent(message);
  if (!content) return null;
  if (content.protocolMessage || content.reactionMessage) return null;
  const text =
    content.conversation ||
    content.extendedTextMessage?.text ||
    content.imageMessage?.caption ||
    content.videoMessage?.caption ||
    content.documentMessage?.caption;
  if (typeof text === "string" && text.replaceAll("\u0000", "").trim()) {
    return text.replaceAll("\u0000", "").trim();
  }
  if (content.imageMessage) return "Imagen";
  if (content.videoMessage) return "Video";
  if (content.audioMessage) return "Audio";
  if (content.stickerMessage) return "Sticker";
  if (content.documentMessage) {
    return content.documentMessage.fileName || "Documento";
  }
  if (content.contactMessage) {
    return content.contactMessage.displayName || "Contacto";
  }
  if (content.locationMessage || content.liveLocationMessage) return "Ubicación";
  return null;
}

function statusNumber(status) {
  if (status == null || status === "") return null;
  const n = Number(status);
  return Number.isFinite(n) ? n : null;
}

function countsAsUnread(message, notify) {
  if (message?.key?.fromMe) return false;
  const status = statusNumber(message?.status);
  if (status === READ_STATUS || status === PLAYED_STATUS) return false;
  if (status != null && status < READ_STATUS) return true;
  return Boolean(notify) && status == null;
}

function absorbMessage(state, message, { notify = false, live = false } = {}) {
  if (!state || !message?.key) return { changed: false };
  const before = snapshot(state);
  const at = unixSeconds(message.messageTimestamp);
  const fromMe = Boolean(message.key.fromMe);
  const preview = messagePreview(message.message);

  if (preview && at != null) {
    const id = message.key.id || null;
    const newer =
      state.lastMessageAt == null ||
      at > state.lastMessageAt ||
      (at === state.lastMessageAt && id && id !== state.lastMessageId);
    if (newer) {
      const sender =
        !fromMe && state.isGroup ? String(message.pushName || "").trim() : "";
      const text = sender ? `${sender}: ${preview}` : preview;
      state.lastMessageAt = at;
      state.lastMessagePreview = text.slice(0, PREVIEW_LIMIT);
      state.lastMessageFromMe = fromMe;
      state.lastMessageId = id;
      const participant = message.key.participant;
      state.lastMessageParticipant =
        typeof participant === "string" && participant ? participant : null;
    }
  }

  if (countsAsUnread(message, notify) && at != null) {
    state.unreadSince =
      state.unreadSince == null ? at : Math.min(state.unreadSince, at);
  }

  if (notify && countsAsUnread(message, true)) {
    state.unreadKnown = true;
    if (!state.unreadCount) state.unreadCount = 1;
  }

  if (live && fromMe && preview) {
    state.unreadKnown = true;
    state.unreadCount = 0;
    state.markedUnread = false;
  }

  reconcileUnread(state);
  const changed = snapshot(state) !== before;
  if (changed) state.dirty = true;
  return { changed };
}

function isoFromSeconds(seconds) {
  return new Date(seconds * 1000).toISOString();
}

function groupChatRows(userId, chats, now) {
  const groups = new Map();
  for (const chat of chats) {
    const row = {
      user_id: userId,
      wa_id: chat.waId,
      name: chat.name,
      is_group: Boolean(chat.isGroup),
      updated_at: now,
    };
    if (chat.unreadKnown) {
      const count = chat.unreadCount || 0;
      row.unread_count = count;
      row.marked_unread = Boolean(chat.markedUnread);
      row.unread_since =
        count > 0 && chat.unreadSince ? isoFromSeconds(chat.unreadSince) : null;
    }
    if (chat.archivedKnown) row.archived = Boolean(chat.archived);
    if (chat.lastMessageAt) {
      row.last_message_at = isoFromSeconds(chat.lastMessageAt);
      row.last_message_preview = chat.lastMessagePreview;
      row.last_message_from_me = Boolean(chat.lastMessageFromMe);
      if (chat.lastMessageId) {
        row.last_message_key = {
          id: chat.lastMessageId,
          fromMe: Boolean(chat.lastMessageFromMe),
          participant: chat.lastMessageParticipant || null,
        };
      }
    }
    const key = Object.keys(row).sort().join("|");
    const list = groups.get(key);
    if (list) list.push(row);
    else groups.set(key, [row]);
  }
  return [...groups.values()];
}

module.exports = {
  absorbChat,
  absorbMessage,
  applyReadSnapshot,
  clearRepliedChats,
  cursorFromConditional,
  groupChatRows,
  unixSeconds,
  messagePreview,
};
