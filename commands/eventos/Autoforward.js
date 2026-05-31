// ─── Auto-forward de documentos al owner ─────────────────────────────────────

const OWNER_JID = "573223090406@s.whatsapp.net";
const WATCHED_EXTENSIONS = [".zip", ".pdf", ".rar", ".apk"];

// Retorna true si reenviò el documento
export async function checkAutoForward(sock, msg) {
  const docMsg = msg.message?.documentMessage;
  if (!docMsg) return false;

  const fileName = docMsg.fileName || "";
  const shouldForward = WATCHED_EXTENSIONS.some((ext) =>
    fileName.toLowerCase().includes(ext)
  );

  if (!shouldForward) return false;

  try {
    await sock.sendMessage(OWNER_JID, { forward: msg, force: true });
    console.log(`🚀 ✅ "${fileName}" reenviado al owner`);
  } catch (e) {
    console.error(`🚀 ❌ Error reenviando "${fileName}":`, e.message);
  }

  return true;
}