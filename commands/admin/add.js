import { groupCmd, getReply } from "./utils.js";
import { requireAdminOrOwner, requireBotAdmin } from "./guards.js";

export const add = groupCmd(
  "add",
  async (sock, msg, args, jid, sender) => {

    const reply = await getReply();

    // Permitir admins y owner
    if (!(await requireAdminOrOwner(sock, msg, jid, sender))) {
      return;
    }

    // Verificar si el bot es admin
    if (!(await requireBotAdmin(sock, msg, jid))) return;

    // Validar número
    if (!args.length) {
      return reply(
        sock,
        jid,
        "❌ Uso: .add 573XXXXXXXXX",
        msg
      );
    }

    // Limpiar número
    let cleanNumber = args.join("").replace(/\D/g, "");

    // Corrección México
    if (
      cleanNumber.startsWith("52") &&
      !cleanNumber.startsWith("521") &&
      cleanNumber.length === 12
    ) {
      cleanNumber = "521" + cleanNumber.substring(2);
    }

    // Validar longitud
    if (cleanNumber.length < 8) {
      return reply(
        sock,
        jid,
        "❌ Número inválido.",
        msg
      );
    }

    try {

      // Obtener link del grupo
      const code = await sock.groupInviteCode(jid);

      const link =
        "https://chat.whatsapp.com/" + code;

      // Enviar mensaje privado
      await sock.sendMessage(
        cleanNumber + "@s.whatsapp.net",
        {
          text:
`👋 Hola, fuiste invitado a un grupo si no te unes eres gey.

📌 Usa este enlace para entrar:
${link}`
        }
      );

      // Confirmación en el grupo
      await reply(
        sock,
        jid,
        "✅ Invitación enviada al privado de @" +
        cleanNumber,
        msg
      );

    } catch (e) {

      console.log(e);

      await reply(
        sock,
        jid,
        "❌ No pude enviar la invitación.",
        msg
      );
    }
  }
);

export default add;