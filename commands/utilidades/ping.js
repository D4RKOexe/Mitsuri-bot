export default {
  name: "ping",
  run: async (sock, msg, args, jid) => {
    const { reply } = await import("../../utils.js");
    const start = Date.now();
    await reply(sock, jid, "🏓 Calculando...", msg);
    await reply(sock, jid, `🏓 *Pong!* ${Date.now() - start}ms`, msg);
  }
};
