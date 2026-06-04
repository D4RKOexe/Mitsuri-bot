export default {
  name: "anime",

  async run(sock, msg, args, chatId) {

    if (!args.length) {
      return sock.sendMessage(chatId, {
        text: "❌ Ejemplo:\n.anime naruto"
      });
    }

    const query = encodeURIComponent(args.join(" "));

    try {

      const res = await fetch(
        `https://api.jikan.moe/v4/anime?q=${query}&limit=1`
      );

      const json = await res.json();

      if (!json.data?.length) {
        return sock.sendMessage(chatId, {
          text: "❌ Anime no encontrado."
        });
      }

      const anime = json.data[0];

      await sock.sendMessage(chatId, {
        image: { url: anime.images.jpg.large_image_url },
        caption:
`🌸 ${anime.title}

⭐ Score: ${anime.score || "N/A"}

📺 Episodios: ${anime.episodes || "?"}

🎬 Estado: ${anime.status}

📖 Sinopsis:

${anime.synopsis?.slice(0, 700) || "Sin descripción"}`
      });

    } catch (e) {

      sock.sendMessage(chatId, {
        text: `❌ Error:\n${e.message}`
      });

    }
  }
};