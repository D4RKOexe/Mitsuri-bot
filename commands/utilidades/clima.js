import axios from "axios";
import { reply } from "../../utils.js";

const FRASES = {
  soleado: [
    "☀️ ¡Día perfecto para salir y conquistar el mundo!",
    "😎 Con este sol hasta los problemas se evaporan.",
    "🌞 El sol salió a darte energía, ¡aprovéchalo!",
    "🕶️ Ponte los lentes, que el sol no perdona.",
    "🌻 Día de sol, día de buena vibra.",
    "☀️ Hasta las plantas están felices hoy.",
    "😄 Con este clima hasta trabajar se siente bien.",
    "🌞 El universo te manda rayos de buena suerte hoy.",
    "🏖️ Si no estás en la playa, deberías estarlo.",
    "✨ Brillas más que el sol hoy, y eso es mucho decir.",
  ],
  nublado: [
    "☁️ Las nubes también tienen su encanto, como tú.",
    "😌 Día nublado, perfecto para pensar cosas profundas.",
    "☁️ El cielo está de mood reflexivo hoy.",
    "🎵 Pon música y disfruta este cielo gris tan aesthetic.",
    "😏 Nublado pero sin lluvia, el clima indeciso de siempre.",
    "☁️ El cielo se tapó pero tu actitud no tiene que hacerlo.",
    "🌥️ Perfecto para una peli y algo caliente.",
    "😴 Las nubes invitan a dormir, seré honesto.",
    "☁️ Ni sol ni lluvia, el clima en modo neutro.",
    "🧸 Día nublado = día de cobija obligatoria.",
  ],
  lluvia: [
    "🌧️ La lluvia limpia todo, incluso los malos momentos.",
    "☔ Agarra el paraguas o date un baño gratis.",
    "🌧️ Día de lluvia, día de café y tranquilidad.",
    "💧 Las plantas están felices, tú también puedes estarlo.",
    "🌧️ Si la lluvia pudiera lavar los problemas, hoy sería tu día.",
    "😅 La lluvia llegó sin avisar, como todos los lunes.",
    "☔ Perfecto para quedarse en casa sin culpa.",
    "🌧️ El cielo llora pero tú no tienes que hacerlo.",
    "💧 Lluvia = excusa perfecta para cancelar planes.",
    "🌂 Si no tienes paraguas, hoy aprendes a correr.",
  ],
  tormenta: [
    "⛈️ La tormenta es temporal, tu actitud no.",
    "🌩️ Truenos y relámpagos, el cielo está molesto hoy.",
    "⛈️ Quédate en casa, la naturaleza está en modo beast.",
    "🌪️ Ni para afuera ni para pensar en salir.",
    "⛈️ El cielo hoy está más dramático que una novela.",
    "🌩️ Zeus está de mal humor, mejor no provocarlo.",
    "⚡ Tormenta eléctrica: Netflix y cobija, sin negociación.",
    "⛈️ El clima está más intenso que tus conversaciones pendientes.",
    "🌧️ Cuando truene así, hasta los valientes se quedan en casa.",
    "⛈️ Modo supervivencia activado, agarra lo necesario.",
  ],
  nieve: [
    "❄️ El mundo se volvió blanco y hermoso hoy.",
    "⛄ Momento de hacer muñecos de nieve o morir en el intento.",
    "❄️ La nieve llegó a recordarte que el invierno existe.",
    "🌨️ Todo parece más tranquilo cuando nieva, hasta tú.",
    "⛄ Perfecto para una guerra de bolas de nieve.",
    "❄️ El frío llegó a quedarse, abrígate bien.",
    "🌨️ Nieve afuera, calorcito adentro, equilibrio perfecto.",
    "⛄ El invierno llegó y el café sube de categoría.",
    "❄️ Cuidado al caminar, el hielo no avisa.",
    "🌨️ Todo se ve más bonito con nieve, incluso los lunes.",
  ],
  niebla: [
    "🌫️ Día de misterio, no sabes qué hay al frente.",
    "😶‍🌫️ La neblina llegó a darle drama a tu vida.",
    "🌫️ Visibilidad baja, intuición alta.",
    "🕵️ Con esta niebla hasta tú te sientes personaje de película.",
    "🌫️ El mundo desapareció esta mañana, tranquilo vuelve.",
    "😌 Niebla espesa, perfecta para perderse en los pensamientos.",
    "🌫️ Maneja despacio, la neblina no juega.",
    "👻 Con esta niebla hasta los fantasmas se pierden.",
    "🌫️ El ambiente está tan misterioso que hasta da miedo salir.",
    "🕯️ Parece escena de película de terror, pero es solo martes.",
  ],
  viento: [
    "💨 El viento llegó a desordenarte el pelo y la vida.",
    "🌬️ Agarra bien el paraguas o vuela con él.",
    "💨 El viento hoy está más activo que tú.",
    "🌬️ Perfecto para volar cometas o perder el sombrero.",
    "💨 El viento te da energía gratis, úsala bien.",
    "🌬️ Con este viento hasta las hojas trabajan más que algunos.",
    "💨 El pelo hoy hace lo que quiere, acéptalo.",
    "🌬️ Viento fuerte: el universo te empuja hacia adelante.",
    "💨 Si el viento te lleva, al menos va a algún lado.",
    "🌬️ Día ventoso, perfecto para airear la mente.",
  ],
  calor: [
    "🔥 Hace tanto calor que el termómetro pidió vacaciones.",
    "🥵 Con este calor hasta el aire acondicionado suda.",
    "🌡️ Hidratación nivel: cada 5 minutos.",
    "🔥 El sol no está jugando hoy, quédate fresquito.",
    "😤 Hace tanto calor que hasta la sombra da calor.",
    "🥤 Día de limonada, hielo y no hacer nada.",
    "🔥 El asfalto podría freír un huevo hoy.",
    "😅 Con este calor ser perezoso es una decisión inteligente.",
    "🌡️ Temperatura extrema: el cuerpo en modo economía.",
    "🔥 Si sientes que te derritas, es normal, todos lo hacemos.",
  ],
  frio: [
    "🥶 El frío llegó a recordarte que debes comprar cobijas.",
    "❄️ Temperatura bajo cero: el café es obligatorio.",
    "🧥 Día de capas, mientras más mejor.",
    "🥶 Con este frío hasta los pensamientos se congelan.",
    "☕ El frío es la excusa perfecta para tomar algo caliente.",
    "🧤 Guantes, bufanda, gorro: el outfit del día.",
    "🥶 El invierno llegó sin avisar como siempre.",
    "❄️ Frío extremo: modo hibernación activado.",
    "🧣 Abrígate bien, que el frío no perdona a nadie.",
    "🥶 Día de sopa, cobija y no salir para nada.",
  ],
};

function getFrase(descripcion = "", tempC = 20) {
  const d = descripcion.toLowerCase();
  const temp = Number(tempC);

  if (d.includes("tormenta") || d.includes("thunder")) return FRASES.tormenta;
  if (d.includes("nieve") || d.includes("snow") || d.includes("blizzard")) return FRASES.nieve;
  if (d.includes("niebla") || d.includes("neblina") || d.includes("fog") || d.includes("mist")) return FRASES.niebla;
  if (d.includes("lluvia") || d.includes("llovizna") || d.includes("rain") || d.includes("drizzle")) return FRASES.lluvia;
  if (d.includes("viento") || d.includes("wind")) return FRASES.viento;
  if (d.includes("sol") || d.includes("despejado") || d.includes("sunny") || d.includes("clear")) return FRASES.soleado;
  if (d.includes("nube") || d.includes("nublado") || d.includes("cloud") || d.includes("overcast")) return FRASES.nublado;
  if (temp >= 35) return FRASES.calor;
  if (temp <= 5)  return FRASES.frio;
  return FRASES.soleado;
}

function getEmoji(desc = "") {
  const d = desc.toLowerCase();
  if (d.includes("tormenta") || d.includes("thunder")) return "⛈️";
  if (d.includes("nieve") || d.includes("snow"))       return "❄️";
  if (d.includes("niebla") || d.includes("fog"))       return "🌫️";
  if (d.includes("lluvia") || d.includes("rain"))      return "🌧️";
  if (d.includes("llovizna") || d.includes("drizzle")) return "🌦️";
  if (d.includes("nube") || d.includes("cloud"))       return "☁️";
  if (d.includes("sol") || d.includes("sunny"))        return "☀️";
  if (d.includes("despejado") || d.includes("clear"))  return "🌤️";
  if (d.includes("viento") || d.includes("wind"))      return "💨";
  return "🌡️";
}

function frase(descripcion, tempC) {
  const lista = getFrase(descripcion, tempC);
  return lista[Math.floor(Math.random() * lista.length)];
}

export default {
  name: "clima",
  aliases: ["weather", "tiempo"],
  run: async (sock, msg, args, jid) => {
    const ciudad = args.join(" ").trim();

    if (!ciudad) {
      return reply(sock, jid,
        "❌ Escribe una ciudad.\n📌 Ejemplo: *.clima Bogotá*",
        msg
      );
    }

    try {
      await reply(sock, jid, `🌍 *Consultando clima de:* ${ciudad}...`, msg);

      const { data } = await axios.get(
        `https://wttr.in/${encodeURIComponent(ciudad)}?format=j1&lang=es`,
        { timeout: 10000 }
      );

      const current = data.current_condition[0];
      const area    = data.nearest_area[0];
      const weather = data.weather[0];

      const ciudad_real = area.areaName[0].value;
      const pais        = area.country[0].value;
      const region      = area.region[0].value;

      const tempC       = current.temp_C;
      const tempF       = current.temp_F;
      const sensacion   = current.FeelsLikeC;
      const humedad     = current.humidity;
      const viento      = current.windspeedKmph;
      const visibilidad = current.visibility;
      const descripcion = current.lang_es?.[0]?.value || current.weatherDesc[0].value;
      const uvIndex     = current.uvIndex;
      const presion     = current.pressure;
      const nubes       = current.cloudcover;
      const maxTemp     = weather.maxtempC;
      const minTemp     = weather.mintempC;
      const lluvia      = weather.hourly.reduce((acc, h) =>
        acc + Number(h.chanceofrain || 0), 0) / weather.hourly.length;

      const emoji    = getEmoji(descripcion);
      const fraseRnd = frase(descripcion, tempC);

      const texto =
        `╭━━━〔 ${emoji} CLIMA 〕━━━⬣\n` +
        `┃\n` +
        `┃ 📍 *${ciudad_real}, ${region}*\n` +
        `┃ 🌐 *País:* ${pais}\n` +
        `┃\n` +
        `┃ 🌡️ *Temperatura:* ${tempC}°C / ${tempF}°F\n` +
        `┃ 🤔 *Sensación:* ${sensacion}°C\n` +
        `┃ 📈 *Máx:* ${maxTemp}°C | 📉 *Mín:* ${minTemp}°C\n` +
        `┃\n` +
        `┃ ${emoji} *Estado:* ${descripcion}\n` +
        `┃ 💧 *Humedad:* ${humedad}%\n` +
        `┃ 🌧️ *Prob. lluvia:* ${Math.round(lluvia)}%\n` +
        `┃ 💨 *Viento:* ${viento} km/h\n` +
        `┃ 👁️ *Visibilidad:* ${visibilidad} km\n` +
        `┃ ☁️ *Nubosidad:* ${nubes}%\n` +
        `┃ 🔆 *Índice UV:* ${uvIndex}\n` +
        `┃ 🔵 *Presión:* ${presion} hPa\n` +
        `┃\n` +
        `┃ 💬 _${fraseRnd}_\n` +
        `┃\n` +
        `╰━━━━━━━━━━━━━━━━⬣`;

      await reply(sock, jid, texto, msg);

    } catch (e) {
      console.error("[CLIMA ERROR]", e.message);
      await reply(sock, jid,
        `❌ No se pudo obtener el clima de *${ciudad}*.\n🔎 Verifica que el nombre sea correcto.`,
        msg
      );
    }
  },
};