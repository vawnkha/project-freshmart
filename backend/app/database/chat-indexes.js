const pending = new WeakMap();
const CHAT_INDEXES = {
  chat_conversations: [
    [{ customerId: 1 }, { unique: true, name: 'chat_customer_unique' }],
    [{ updatedAt: -1, _id: -1 }, { name: 'chat_inbox_recent' }],
    [{ status: 1, updatedAt: -1, _id: -1 }, { name: 'chat_inbox_status' }],
    [{ assignedAdminId: 1 }, { name: 'chat_assignee' }],
  ],
  chat_messages: [
    [{ senderId: 1, clientMessageId: 1 }, { unique: true, name: 'chat_send_idempotent' }],
    [{ conversationId: 1, seq: 1 }, { unique: true, name: 'chat_message_sequence' }],
    [{ conversationId: 1, createdAt: 1, _id: 1 }, { name: 'chat_history' }],
  ],
  chat_reads: [[{ conversationId: 1, userId: 1 }, { unique: true, name: 'chat_reader_unique' }]],
  chat_rate_limits: [[{ expiresAt: 1 }, { expireAfterSeconds: 0, name: 'chat_rate_expiry' }]],
};
function ensureChatIndexes(client) {
  if (!pending.has(client)) pending.set(client, (async () => {
    for (const [name, indexes] of Object.entries(CHAT_INDEXES)) for (const [keys, options] of indexes) await client.db().collection(name).createIndex(keys, options);
  })().catch(error => { pending.delete(client); throw error; }));
  return pending.get(client);
}
module.exports = { CHAT_INDEXES, ensureChatIndexes };
