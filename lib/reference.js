export function buildReference(chatId, invoiceCode = "") {
  return `WHALE::${chatId}::${Date.now()}::${invoiceCode}`;
}

export function parseReference(ref) {
  if (typeof ref !== "string" || !ref.startsWith("WHALE::")) return null;
  const parts = ref.split("::");
  if (parts.length < 3) return null;
  return {
    chatId: parts[1],
    timestamp: parts[2],
    invoiceCode: parts[3] || null,
  };
}
