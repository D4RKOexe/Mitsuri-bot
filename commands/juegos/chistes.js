import { reply } from "../../utils.js";

const CHISTES = [
  // --- Clásicos ---
  "¿Por qué el libro de matemáticas estaba triste?\nPorque tenía demasiados problemas. 😅",
  "¿Qué le dice un techo a otro techo?\nTecho de menos. 🏠",
  "¿Cómo se despiden los químicos?\nÁcido un placer. 🧪",
  "¿Qué hace una abeja en el gimnasio?\n¡Zum-ba! 🐝",
  "¿Por qué el sol no fue a la universidad?\nPorque ya tenía mil grados. ☀️",
  "¿Qué le dijo el semáforo al carro?\nNo me mires que me pongo rojo. 🚦",
  "¿Qué le dijo el cero al ocho?\nBonito cinturón. 🤣",
  "¿Por qué el esqueleto no fue a la fiesta?\nPorque no tenía cuerpo para ir. 💀",
  "¿Cómo llamas a un perro sin patas?\nNo importa, de todas formas no va a venir. 🐶",
  "¿Qué le dijo el mar a la playa?\nNada. 🌊",

  // --- Tecnología ---
  "¿Por qué el programador dejó su trabajo?\nPorque no encontraba el escape. ⌨️",
  "¿Cuántos programadores se necesitan para cambiar un foco?\nNinguno, es un problema de hardware. 💡",
  "Mi contraseña es 'incorrecto'.\nAsí cuando la olvido me dice: 'Tu contraseña es incorrecta'. 😂",
  "¿Por qué los robots nunca mienten?\nPorque no tienen cara de palo. 🤖",
  "Le pregunté a Google si era Dios.\nMe respondió: '¿Quisiste decir: sí?' 😅",

  // --- Animales ---
  "¿Qué le dice un jaguar a otro?\nJaguar you doing? 🐆",
  "¿Qué hace un pez cuando está aburrido?\nNada. 🐟",
  "¿Por qué el pájaro fue al médico?\nPorque tenía pico de fiebre. 🐦",
  "¿Qué le dijo el gato al árbol?\nMe tienes hasta las narices. 🐱",
  "¿Cómo sabe un elefante que está de moda?\nPorque tiene trompa. 🐘",

  // --- Comida ---
  "¿Por qué el tomate se puso rojo?\nPorque vio la ensalada sin ropa. 🍅",
  "¿Qué le dice un café a otro?\nEspresso tus sentimientos. ☕",
  "¿Por qué el pan de molde va al psicólogo?\nPorque tiene muchos traumas rebanados. 🍞",
  "¿Qué hace el queso cuando se mira al espejo?\nEdam. 🧀",
  "¿Por qué la sopa nunca miente?\nPorque siempre está en caldo de honestidad. 🍲",

  // --- Cotidianos ---
  "Me robaron la agenda.\nPerdí todos mis contactos... bueno, al menos tengo los ojos. 📒",
  "Fui al médico y me dijo que tenía que perder peso.\nLe respondí: 'Doctor, vine a que me ayudara, no a que me insultara.' 😂",
  "Mi jefe me dijo que tenía un gran futuro.\nLástima que hablaba de la empresa, no de mí. 😅",
  "Le pregunté al Wifi si era feliz.\nMe dijo: 'Tengo señal, ¿qué más quieres?' 📶",
  "Intenté hacer una dieta.\nDuró hasta que abrí el refrigerador. 🍕",

  // --- Oscuros pero inocentes ---
  "¿Qué tiene cuatro ruedas y vuela?\nUn camión de basura. 🚛",
  "¿Por qué el vampiro se hizo vegetariano?\nPorque le estaba chupando la vida a todos. 🧛",
  "¿Cómo se suicida un sordo?\nNo sé, tampoco escucho. 🙉",
  "¿Por qué el muerto no fue al entierro?\nPorque no se sentía bien. ⚰️",
  "¿Qué hace un pez eléctrico?\nEle-ctricidad. ⚡🐟",

  // --- Dobles sentidos inocentes ---
  "¿Cuál es el colmo de un electricista?\nQue su hijo sea un foco de atención. 💡",
  "¿Cuál es el colmo de un jardinero?\nQue sus hijos le salgan plantas. 🌿",
  "¿Cuál es el colmo de un fotógrafo?\nTener un hijo que no sale en las fotos. 📸",
  "¿Cuál es el colmo de un relojero?\nLlegar tarde a todas partes. ⏰",
  "¿Cuál es el colmo de un dentista?\nQue le duela la muela del juicio. 🦷",
  // --- Humor Negro y Ácido ---
"Mi terapeuta dice que necesito abrirme más. Así que le enseñé mi historial de búsqueda. Ahora está en terapia también. 📱",
"¿Cuál es la diferencia entre una pizza y mi opinión?\nLa pizza alimenta a una familia. 🍕",
"Le dije a mi esposa que estaba tan delgada que podía ser modelo de pasarela.\nAhora está en el hospital por desnutrición. 👗",
"¿Por qué los fantasmas son tan malos mintiendo?\nPorque se les ve a través de todo. 👻",
"Mi abuela siempre decía: 'No te acuestes con la rabia'.\nAhora está en prisión por asesinato. 😴",
"¿Qué le dice un esqueleto a otro en la playa?\n¿Te bañas o solo vienes a hacerte los huesos? 🏖️💀",
"Entré en una tienda de tatuajes y dije: 'Quiero un león rugiendo'.\nEl artista me dijo: 'Perfecto, ¿dónde quieres que ponga el gatito?' 🦁",
"Mi novia me dijo que quería un futuro brillante.\nAsí que le compré una bombilla. 💡",
"¿Por qué los suicidas no les gustan los saltos de altura?\nPorque siempre terminan en lo mismo. 🏃‍♂️",
"El médico me dijo que tenía que dejar de beber.\nLe dije que primero necesitaba terminar lo que empecé. 🍺",
"¿Qué es más rápido, un coche o un mosquito?\nEl mosquito, porque el coche tiene que frenar en los semáforos. 🚗🦟",
"¿Cómo se llama el cementerio más famoso de Estados Unidos?\nEl cementerio de los famosos. ⚰️",
"¿Por qué el muerto no fue al cine?\nPorque ya estaba enterrado en su casa. 🎬",
"¿Qué le dice un zombi a su novia?\nTe quiero con todo mi estómago... y un poco más. 🧟‍♂️❤️",
"¿Por qué los vampiros no usan Facebook?\nPorque no les gusta que les 'des' like. 🧛‍♂️📱",
"Mi esposa me dijo que quería un diamante.\nLe dije que no había problema, que ya tenía uno. 💍",
"¿Qué le dice un ciego a otro?\n¿Viste aquello? 👀",
"¿Por qué los pájaros no usan Instagram?\nPorque no tienen 'fotos' para subir. 🐦📸",
"¿Qué le dice un pez a otro?\n¿Nada? 🐟",
"¿Por qué los gatos no usan WhatsApp?\nPorque no tienen 'gatos' para enviar. 🐱📱",
"¿Qué le dice un perro a otro?\n¿Guau? 🐶",
"¿Por qué los elefantes no usan TikTok?\nPorque no tienen 'trompas' para bailar. 🐘🕺",
"¿Qué le dice un caballo a otro?\n¿Hay algo de 'heno'? 🐴",
"¿Por qué los monos no usan Twitter?\nPorque no tienen 'plátanos' para publicar. 🐵🍌",
"¿Qué le dice un león a otro?\n¿Hay algo de 'rugido'? 🦁",
"¿Por qué los tigres no usan Snapchat?\nPorque no tienen 'rayas' para enviar. 🐅",
"¿Qué le dice un oso a otro?\n¿Hay algo de 'miel'? 🐻",
"¿Por qué los pingüinos no usan Facebook?\nPorque no tienen 'hielos' para publicar. 🐧",
"¿Qué le dice un tiburón a otro?\n¿Hay algo de 'sangre'? 🦈",
"¿Por qué las ballenas no usan Instagram?\nPorque no tienen 'aguas' para subir. 🐋",
"¿Qué le dice un delfín a otro?\n¿Hay algo de 'salto'? 🐬",
"¿Por qué los pulpos no usan TikTok?\nPorque no tienen 'tentáculos' para bailar. 🐙",
"¿Qué le dice una medusa a otra?\n¿Hay algo de 'picar'? 🎐",
"¿Por qué las tortugas no usan WhatsApp?\nPorque no tienen 'caparazón' para enviar. 🐢",
"¿Qué le dice un cangrejo a otro?\n¿Hay algo de 'pinzas'? 🦀",
"¿Por qué los camarones no usan Twitter?\nPorque no tienen 'colas' para publicar. 🦐",
"¿Qué le dice un langostino a otro?\n¿Hay algo de 'saltar'? 🦞",
"¿Por qué los cangrejos no usan Facebook?\nPorque no tienen 'pinzas' para publicar. 🦀",
"¿Qué le dice una langosta a otra?\n¿Hay algo de 'pinzas'? 🦞",
"¿Por qué los pulpos no usan Instagram?\nPorque no tienen 'tentáculos' para subir. 🐙",
"¿Qué le dice un calamar a otro?\n¿Hay algo de 'tinta'? 🦑",
"¿Por qué las medusas no usan TikTok?\nPorque no tienen 'picar' para bailar. 🎐",
"¿Qué le dice una anémona a otra?\n¿Hay algo de 'tentáculos'? 🪼",
"¿Por qué los erizos de mar no usan WhatsApp?\nPorque no tienen 'púas' para enviar. 🦔",
"¿Qué le dice una estrella de mar a otra?\n¿Hay algo de 'brazos'? ⭐",
"¿Por qué los caracoles no usan Twitter?\nPorque no tienen 'conchas' para publicar. 🐌",
"¿Qué le dice un caracol a otro?\n¿Hay algo de 'lento'? 🐌",
"¿Por qué los babosos no usan Facebook?\nPorque no tienen 'baba' para publicar. 🐌",
"¿Qué le dice una lombriz a otra?\n¿Hay algo de 'tierra'? 🪱",
"¿Por qué los gusanos no usan Instagram?\nPorque no tienen 'tierra' para subir. 🪱",
"¿Qué le dice una sanguijuela a otra?\n¿Hay algo de 'sangre'? 🩸",
"¿Por qué las pulgas no usan TikTok?\nPorque no tienen 'saltar' para bailar. 🦟",
"¿Qué le dice una garrapata a otra?\n¿Hay algo de 'picar'? 🐕",
"¿Por qué los piojos no usan WhatsApp?\nPorque no tienen 'cabeza' para enviar. 👨",
"¿Qué le dice un chinche a otro?\n¿Hay algo de 'picar'? 🐛",
"¿Por qué las cucarachas no usan Twitter?\nPorque no tienen 'antenas' para publicar. 🪳",
"¿Qué le dice una araña a otra?\n¿Hay algo de 'telaraña'? 🕷️",
"¿Por qué los escorpiones no usan Facebook?\nPorque no tienen 'aguijón' para publicar. 🦂",
"¿Qué le dice un ciempiés a otro?\n¿Hay algo de 'patas'? 🐛",
"¿Por qué los milpiés no usan Instagram?\nPorque no tienen 'patas' para subir. 🐛",
"¿Qué le dice una mariposa a otra?\n¿Hay algo de 'alas'? 🦋",
"¿Por qué las abejas no usan TikTok?\nPorque no tienen 'miel' para bailar. 🐝",
"¿Qué le dice una avispa a otra?\n¿Hay algo de 'picar'? 🐝",
"¿Por qué los mosquitos no usan WhatsApp?\nPorque no tienen 'sangre' para enviar. 🦟",
"¿Qué le dice una mosca a otra?\n¿Hay algo de 'volar'? 🪰",
"¿Por qué los tábanos no usan Twitter?\nPorque no tienen 'picar' para publicar. 🐴",
"¿Qué le dice un mosquito a otro?\n¿Hay algo de 'sangre'? 🦟",
"¿Por qué las libélulas no usan Facebook?\nPorque no tienen 'alas' para publicar. 🦟",
"¿Qué le dice un grillo a otro?\n¿Hay algo de 'cantar'? 🦗",
"¿Por qué los saltamontes no usan Instagram?\nPorque no tienen 'saltar' para subir. 🦗",
];

export default {
  name: "chiste",
  aliases: ["joke", "broma", "humor"],
  run: async (sock, msg, args, jid) => {
    const chiste = CHISTES[Math.floor(Math.random() * CHISTES.length)];
    const numero = CHISTES.indexOf(chiste) + 1;

    const texto =
      `╭━━━〔 😂 CHISTE DEL DÍA 〕━━━⬣\n` +
      `┃\n` +
      `┃ ${chiste}\n` +
      `┃\n` +
      `┃ 📦 Chiste #${numero} de ${CHISTES.length}\n` +
      `┃ 💡 _Usa .chiste para otro diferente_\n` +
      `┃\n` +
      `╰━━━━━━━━━━━━━━━━⬣`;

    await reply(sock, jid, texto, msg);
  },
};