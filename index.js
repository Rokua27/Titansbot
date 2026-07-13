const http = require("http")
const QRCode = require("qrcode")
const axios = require ("axios")
const {
    default: makeWASocket,
    useMultiFileAuthState,
    fetchLatestBaileysVersion,
    DisconnectReason
} = require("@whiskeysockets/baileys")

const pino = require("pino")
const fs = require("fs")

const PORT = process.env.PORT || 10000
const tiempoInicio = Date.now()
let qrImage = null

// ================= SERVIDOR HTTP =================

http.createServer((req, res) => {

    if (req.url === "/qr") {

        res.writeHead(200, {
            "Content-Type": "text/html"
        })

        if (qrImage) {
            res.end(`
                <html>
                    <head>
                        <title>TitansBot QR</title>
                    </head>
                    <body style="font-family:Arial;text-align:center;padding-top:40px;">
                        <h1>Escanea el QR con WhatsApp Business</h1>
                        <img src="${qrImage}" width="350"/>
                    </body>
                </html>
            `)
        } else {
            res.end(`
                <html>
                    <body style="font-family:Arial;text-align:center;padding-top:40px;">
                        <h2>✅ TitansBot ya está conectado a WhatsApp</h2>
                    </body>
                </html>
            `)
        }

        return
    }

    res.writeHead(200)
    res.end("TitansBot activo")

}).listen(PORT, () => {
    console.log(`🌐 Servidor HTTP iniciado en puerto ${PORT}`)
})

// ================= BOT =================

async function iniciarBot() {

    const { state, saveCreds } = await useMultiFileAuthState("./auth")

    const { version } = await fetchLatestBaileysVersion()

    const sock = makeWASocket({
        version,
        auth: state,
        logger: pino({ level: "silent" }),
        printQRInTerminal: false,
        browser: ["TitansBot", "Chrome", "1.0.0"]
    })

    sock.ev.on("creds.update", saveCreds)

    sock.ev.on("connection.update", async (update) => {

        const { connection, qr, lastDisconnect } = update

        if (qr) {
            qrImage = await QRCode.toDataURL(qr)

            console.log("")
            console.log("====================================")
            console.log("QR generado correctamente")
            console.log("Abre:")
            console.log("https://titansbot.onrender.com/qr")
            console.log("====================================")
            console.log("")
        }

        if (connection === "connecting") {
            console.log("🔄 Conectando a WhatsApp...")
        }

        if (connection === "open") {
            console.log("✅ TitansBot conectado correctamente a WhatsApp")
            qrImage = null
        }

        if (connection === "close") {

            const reason =
                lastDisconnect?.error?.output?.statusCode

            console.log(`❌ Conexión cerrada: ${reason}`)

            if (reason !== DisconnectReason.loggedOut) {
                setTimeout(() => {
                    iniciarBot()
                }, 5000)
            }
        }
    })

    // ================= COMANDOS =================

    const contadorSpam = {}
    let advertencias = {}

if (fs.existsSync("./advertencias.json")) {
    advertencias = JSON.parse(
        fs.readFileSync("./advertencias.json")
    )
}
let actividad = {}

if (fs.existsSync("./actividad.json")) {
    actividad = JSON.parse(
        fs.readFileSync("./actividad.json")
    )
}    
function guardarAdvertencias() {
    fs.writeFileSync(
        "./advertencias.json",
        JSON.stringify(advertencias, null, 2)
    )
    }
    function guardarActividad() {
    fs.writeFileSync(
        "./actividad.json",
        JSON.stringify(actividad, null, 2)
    )
    }
    sock.ev.on("messages.upsert", async ({ messages }) => {

        try {

            const mensaje = messages[0]

            if (!mensaje.message) return
            if (mensaje.key.fromMe) return
            const chat = mensaje.key.remoteJid

// Usuario que envió el mensaje
const usuario =
    mensaje.key.participant ||
    mensaje.key.remoteJid

// ==========================
// SISTEMA DE ACTIVIDAD
// ==========================
if (!actividad[usuario]) {
    actividad[usuario] = {
        mensajes: 0
    }
}

actividad[usuario].mensajes++

guardarActividad()

// ==========================
// VERIFICAR ADMINISTRADORES
// ==========================
let esAdmin = false

if (chat.endsWith("@g.us")) {
    const metadata = await sock.groupMetadata(chat)

    const admins = metadata.participants
        .filter(p => p.admin !== null)
        .map(p => p.id)

    esAdmin = admins.includes(usuario)
}
            const texto =
                mensaje.message.conversation ||
                mensaje.message.extendedTextMessage?.text ||
                ""

            const comando = texto.toLowerCase().trim()
            const comandoBase = comando.split(" ")[0]
// ==========================
   // SISTEMA ANTI-SPAM
// ==========================
console.log("Usuario:", usuario)
console.log("Mensajes:", contadorSpam[usuario]?.length || 0)
const ahora = Date.now()

if (!contadorSpam[usuario]) {
    contadorSpam[usuario] = []
}

contadorSpam[usuario] = contadorSpam[usuario].filter(
    tiempo => ahora - tiempo < 10000
)

contadorSpam[usuario].push(ahora)
console.log(
    "Spam detector:",
    usuario,
    "cantidad:",
    contadorSpam[usuario].length
)
if (contadorSpam[usuario].length >= 15) {

    advertencias[usuario] = (advertencias[usuario] || 0) + 1

    await sock.sendMessage(chat, {
        text:
`⚠️ *Advertencia automática*

@${usuario.split("@")[0]}

Se detectó posible spam en el grupo.

📊 Advertencias:
${advertencias[usuario]}/5

Por favor evita enviar demasiados mensajes seguidos.`,
        mentions: [usuario]
    })

    contadorSpam[usuario] = []
}         
        // ==========================
        // COMANDOS
        // ==========================        
            if (!comando.startsWith("/")) return
            // /PING
            if (comando === "/ping") {

                await sock.sendMessage(chat, {
                    text: "🏓 Pong! TitansBot está funcionando correctamente."
                })
            }
            // ==========================
            // COMANDOS ADMINISTRATIVOS
            // =========================
            // /ADMIN
            if (comando === "/admin") {

                if (!esAdmin) {
                     return await sock.sendMessage(chat, {
                          text: "❌ Este comando es exclusivo para administradores."
        })
    }

    await sock.sendMessage(chat, {
        text:
`🛡️ PANEL DE ADMINISTRACIÓN

✅ Verificación correcta.

👤 Usuario reconocido como administrador del grupo.

TitansBot tiene permisos administrativos activos.`
    })
}

            // /TAGALL
if (comando === "/tagall") {

    if (!esAdmin) {
        return await sock.sendMessage(chat, {
            text: "❌ Este comando es exclusivo para administradores."
        })
    }

    const metadata = await sock.groupMetadata(chat)

    const participantes = metadata.participants.map(
        participante => participante.id
    )

    let textoTag = "📢 *ATENCIÓN LIGA TITANS TEAM*\n\n"

    textoTag += "Convocatoria general para todos los miembros:\n\n"

    for (let miembro of participantes) {
        textoTag += `@${miembro.split("@")[0]}\n`
    }

    await sock.sendMessage(chat, {
        text: textoTag,
        mentions: participantes
    })
}

// /WARN
if (comando.startsWith("/warn")) {

    if (!esAdmin) {
        return await sock.sendMessage(chat, {
            text: "❌ Este comando es exclusivo para administradores."
        })
    }

    const mencionado =
        mensaje.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0]

    if (!mencionado) {
        return await sock.sendMessage(chat, {
            text: "⚠️ Debes mencionar un usuario.\n\nEjemplo:\n/warn @usuario Spam excesivo"
        })
    }

    const partes = texto.split(" ")
    const motivo = partes.slice(2).join(" ") || "Sin motivo especificado"

    if (!advertencias[mencionado]) {
        advertencias[mencionado] = []
    }

    advertencias[mencionado].push({
        fecha: new Date().toLocaleString("es-CO"),
        administrador: usuario,
        motivo: motivo
    })

    guardarAdvertencias()

    await sock.sendMessage(chat, {
        text:
`⚠️ *ADVERTENCIA REGISTRADA*

👤 Usuario:
@${mencionado.split("@")[0]}

📝 Motivo:
${motivo}

📊 Advertencias actuales:
${advertencias[mencionado].length}/5

La advertencia ha sido almacenada correctamente.`,
        mentions: [mencionado]
    })
}

     // /ADVERTENCIAS
if (comando.startsWith("/advertencias")) {

    if (!esAdmin) {
        return await sock.sendMessage(chat, {
            text: "❌ Este comando es exclusivo para administradores."
        })
    }

    const mencionado =
        mensaje.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0]

    if (!mencionado) {
        return await sock.sendMessage(chat, {
            text: "⚠️ Debes mencionar un usuario.\n\nEjemplo:\n/advertencias @usuario"
        })
    }

    const historial = advertencias[mencionado] || []

    if (historial.length === 0) {
        return await sock.sendMessage(chat, {
            text: `✅ El usuario @${mencionado.split("@")[0]} no tiene advertencias registradas.`,
            mentions: [mencionado]
        })
    }

    let respuesta =
`📊 *HISTORIAL DISCIPLINARIO*

👤 Usuario:
@${mencionado.split("@")[0]}

📈 Advertencias activas:
${historial.length}/5

`

    historial.forEach((item, index) => {
        respuesta +=
`${index + 1}. 📅 ${item.fecha}
📝 ${item.motivo}

`
    })

    await sock.sendMessage(chat, {
        text: respuesta,
        mentions: [mencionado]
    })
}

// /UNWARN
if (comando.startsWith("/unwarn")) {

    if (!esAdmin) {
        return await sock.sendMessage(chat, {
            text: "❌ Este comando es exclusivo para administradores."
        })
    }

    const mencionado =
        mensaje.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0]

    if (!mencionado) {
        return await sock.sendMessage(chat, {
            text:
            "⚠️ Debes mencionar un usuario.\n\nEjemplo:\n/unwarn @usuario"
        })
    }

    if (!advertencias[mencionado] || advertencias[mencionado].length === 0) {
        return await sock.sendMessage(chat, {
            text:
            `✅ @${mencionado.split("@")[0]} no tiene advertencias registradas.`,
            mentions: [mencionado]
        })
    }

    const eliminada = advertencias[mencionado].pop()

    guardarAdvertencias()

    await sock.sendMessage(chat, {
        text:
`✅ *ADVERTENCIA ELIMINADA*

👤 Usuario:
@${mencionado.split("@")[0]}

📝 Advertencia eliminada:
${eliminada.motivo}

📊 Advertencias restantes:
${advertencias[mencionado].length}/5`,
        mentions: [mencionado]
    })
}

// /CLEARWARN
if (comando.startsWith("/clearwarn")) {

    if (!esAdmin) {
        return await sock.sendMessage(chat, {
            text: "❌ Este comando es exclusivo para administradores."
        })
    }

    const mencionado =
        mensaje.message.extendedTextMessage?.contextInfo?.mentionedJid?.[0]

    if (!mencionado) {
        return await sock.sendMessage(chat, {
            text:
            "⚠️ Debes mencionar un usuario.\n\nEjemplo:\n/clearwarn @usuario"
        })
    }

    delete advertencias[mencionado]

    guardarAdvertencias()

    await sock.sendMessage(chat, {
        text:
`🧹 *HISTORIAL DISCIPLINARIO REINICIADO*

👤 Usuario:
@${mencionado.split("@")[0]}

Todas las advertencias fueron eliminadas correctamente.`,
        mentions: [mencionado]
    })
}
            
   // /CERRAR
if (comando === "/cerrar") {

    if (!esAdmin) {
        return await sock.sendMessage(chat, {
            text: "❌ Este comando es exclusivo para administradores."
        })
    }

    await sock.groupSettingUpdate(
        chat,
        "announcement"
    )

    await sock.sendMessage(chat, {
        text:
`🔒 *GRUPO CERRADO*

Solo los administradores pueden enviar mensajes hasta nuevo aviso.`
    })
}

   // /ABRIR
if (comando === "/abrir") {

    if (!esAdmin) {
        return await sock.sendMessage(chat, {
            text: "❌ Este comando es exclusivo para administradores."
        })
    }

    await sock.groupSettingUpdate(
        chat,
        "not_announcement"
    )

    await sock.sendMessage(chat, {
        text:
`🔓 *GRUPO ABIERTO*

Todos los miembros pueden volver a enviar mensajes.`
    })
}         

// /ANUNCIO
if (comando.startsWith("/anuncio")) {

    if (!esAdmin) {
        return await sock.sendMessage(chat, {
            text: "❌ Este comando es exclusivo para administradores."
        })
    }

    const anuncio = texto.replace("/anuncio", "").trim()

    if (!anuncio) {
        return await sock.sendMessage(chat, {
            text:
`⚠️ Debes escribir el contenido del anuncio.

Ejemplo:
/anuncio La final comenzará a las 8:30 PM.`
        })
    }

    await sock.sendMessage(chat, {
        text:
`╔════════════════════╗
📢 *ANUNCIO OFICIAL*
🏆 *LIGA TITANS TEAM*
╚════════════════════╝

${anuncio}

━━━━━━━━━━━━━━━━━━━━
🤖 *TitansBot Oficial*
👑 *Administración Liga Titans Team*`
    })
}

// /ANUNCIOALL
if (comando.startsWith("/anuncioall")) {

    if (!esAdmin) {
        return await sock.sendMessage(chat, {
            text: "❌ Este comando es exclusivo para administradores."
        })
    }

    const anuncio = texto.replace("/anuncioall", "").trim()

    if (!anuncio) {
        return await sock.sendMessage(chat, {
            text:
`⚠️ Debes escribir el contenido del anuncio.

Ejemplo:
/anuncioall La final comenzará a las 8:30 PM.`
        })
    }

    const metadata = await sock.groupMetadata(chat)

    const participantes = metadata.participants.map(
        participante => participante.id
    )

    let menciones = ""

    for (let participante of participantes) {
        menciones += `@${participante.split("@")[0]}\n`
    }

    await sock.sendMessage(chat, {
        text:
`╔════════════════════╗
📢 *ANUNCIO OFICIAL*
🏆 *LIGA TITANS TEAM*
╚════════════════════╝

${anuncio}

━━━━━━━━━━━━━━━━━━━━
📣 *Notificación general enviada a todos los miembros.*

${menciones}

🤖 *TitansBot Oficial*`,
        mentions: participantes
    })
}

// /BOTINFO
if (comando === "/botinfo") {

    const uptime = Date.now() - tiempoInicio

    const horas = Math.floor(uptime / (1000 * 60 * 60))
    const minutos = Math.floor((uptime % (1000 * 60 * 60)) / (1000 * 60))
    const segundos = Math.floor((uptime % (1000 * 60)) / 1000)

    const grupos = sock.chats?.all()?.filter(
        chat => chat.id.endsWith("@g.us")
    ).length || 0

    await sock.sendMessage(chat, {
        text:
`🤖 *TITANSBOT OFICIAL*

📌 Estado: En línea ✅
⏱️ Tiempo activo: ${horas}h ${minutos}m ${segundos}s
👥 Grupos administrados: ${grupos}

🛡️ Anti-spam: Activo
⚠️ Sistema disciplinario: Activo
🎉 Bienvenida automática: Activa
👋 Despedida automática: Activa

🏆 *Liga Titans Team*
👑 Director General:
Jean Pierre Rousseau - David Rivera

🚀 Versión:
TitansBot v1.0`
    })
}

// /TOPACTIVOS
if (comando === "/topactivos") {

    const ranking = Object.entries(actividad)
        .sort((a, b) => b[1].mensajes - a[1].mensajes)
        .slice(0, 10)

    if (ranking.length === 0) {
        return await sock.sendMessage(chat, {
            text: "📊 Aún no hay actividad registrada."
        })
    }

    let respuesta =
`🏆 *TOP 10 MIEMBROS MÁS ACTIVOS*

`

    ranking.forEach((usuarioData, index) => {
        const numero = usuarioData[0].split("@")[0]
        const mensajes = usuarioData[1].mensajes

        respuesta +=
`${index + 1}. @${numero}
💬 ${mensajes} mensajes

`
    })

    await sock.sendMessage(chat, {
        text: respuesta,
        mentions: ranking.map(x => x[0])
    })
}

// /INACTIVOS
if (comando === "/inactivos") {

    if (!chat.endsWith("@g.us")) {
        return await sock.sendMessage(chat, {
            text: "❌ Este comando solo funciona en grupos."
        })
    }

    const metadata = await sock.groupMetadata(chat)

    const participantes = metadata.participants.map(
        participante => participante.id
    )

    const ranking = participantes.map(id => ({
        id,
        mensajes: actividad[id]?.mensajes || 0
    }))
    .sort((a, b) => a.mensajes - b.mensajes)
    .slice(0, 10)

    let respuesta =
`📉 *MIEMBROS MENOS ACTIVOS DEL GRUPO*

`

    ranking.forEach((miembro, index) => {
        respuesta +=
`${index + 1}. @${miembro.id.split("@")[0]}
💬 ${miembro.mensajes} mensajes

`
    })

    await sock.sendMessage(chat, {
        text: respuesta,
        mentions: ranking.map(x => x.id)
    })
}
            
// /PERFIL
if (comando.startsWith("/perfil")) {

    let objetivo = usuario

    const mencionado =
        mensaje.message.extendedTextMessage
            ?.contextInfo
            ?.mentionedJid?.[0]

    if (mencionado) {
        objetivo = mencionado
    }

    const datos = actividad[objetivo] || {
        mensajes: 0
    }

    await sock.sendMessage(chat, {
        text:
`👤 *PERFIL DEL MIEMBRO*

🆔 Usuario:
@${objetivo.split("@")[0]}

💬 Mensajes enviados:
${datos.mensajes}

🏆 Estado:
${datos.mensajes >= 1000 ? "Veterano" :
  datos.mensajes >= 500 ? "Activo" :
  datos.mensajes >= 100 ? "Participativo" :
  "Nuevo miembro"}

🤖 TitansBot Oficial`,
        mentions: [objetivo]
    })
}

// ==========================
// COMANDOS DE DIVERSIÓN
// ==========================

 
// /DADO
if (comando === "/dado") {

    const resultado = Math.floor(Math.random() * 6) + 1

    await sock.sendMessage(chat, {
        text:
`🎲 *LANZAMIENTO DE DADO*

Resultado obtenido:

🎯 ${resultado}`
    })
}

// /MONEDA
if (comando === "/moneda") {

    const resultado =
        Math.random() < 0.5
            ? "🪙 Cara"
            : "🪙 Sello"

    await sock.sendMessage(chat, {
        text:
`🪙 *LANZAMIENTO DE MONEDA*

Resultado:

${resultado}`
    })
}

// /8BALL
if (comandoBase === "/8ball") {

    const respuestas = [
        "✅ Sí",
        "❌ No",
        "🤔 Tal vez",
        "🔥 Definitivamente sí",
        "⚠️ Mejor no",
        "👀 Las probabilidades son buenas",
        "😅 No parece probable",
        "🏆 Todo apunta a que sí"
    ]

    const respuesta =
        respuestas[
            Math.floor(Math.random() * respuestas.length)
        ]

    await sock.sendMessage(chat, {
        text:
`🎱 *BOLA MÁGICA TITANS*

${respuesta}`
    })
}

// /QUIEN
if (comandoBase === "/quien") {

    if (!chat.endsWith("@g.us")) {
        return await sock.sendMessage(chat, {
            text: "❌ Este comando solo funciona en grupos."
        })
    }

    const pregunta = texto.replace("/quien", "").trim()

    if (!pregunta) {
        return await sock.sendMessage(chat, {
            text:
`⚠️ Debes escribir una pregunta.

Ejemplo:
/quien será el MVP de la jornada`
        })
    }

    const metadata = await sock.groupMetadata(chat)

    const participantes = metadata.participants.map(
        participante => participante.id
    )

    const elegido =
        participantes[
            Math.floor(
                Math.random() * participantes.length
            )
        ]

    await sock.sendMessage(chat, {
        text:
`🎲 *TITANSBOT HA DECIDIDO...*

❓ ${pregunta}

👑 El elegido es:

@${elegido.split("@")[0]}

🔥 La comunidad tendrá la última palabra.`,
        mentions: [elegido]
    })
}

// /SHIP
if (comandoBase === "/ship") {

    const mencionados =
        mensaje.message.extendedTextMessage
            ?.contextInfo
            ?.mentionedJid || []

    if (mencionados.length < 2) {
        return await sock.sendMessage(chat, {
            text:
`⚠️ Debes mencionar dos usuarios.

Ejemplo:
/ship @usuario1 @usuario2`
        })
    }

    const porcentaje =
        Math.floor(Math.random() * 101)

    await sock.sendMessage(chat, {
        text:
`💖 *COMPATIBILIDAD TITANSBOT*

@${mencionados[0].split("@")[0]}
❤️
@${mencionados[1].split("@")[0]}

📊 Compatibilidad:
${porcentaje}%`,
        mentions: mencionados
    })
}

// /GATO
if (comando === "/gato") {

    try {

        const respuesta = await axios.get(
            "https://api.thecatapi.com/v1/images/search"
        )

        const imagen = respuesta.data[0].url

        await sock.sendMessage(chat, {
            image: { url: imagen },
            caption: "🐱 Gatito aleatorio de TitansBot."
        })

    } catch {

        await sock.sendMessage(chat, {
            text: "❌ No fue posible obtener una imagen de gato."
        })
    }
}

// /PERRO
if (comando === "/perro") {

    try {

        const respuesta = await axios.get(
            "https://dog.ceo/api/breeds/image/random"
        )

        const imagen = respuesta.data.message

        await sock.sendMessage(chat, {
            image: { url: imagen },
            caption: "🐶 Perrito aleatorio de TitansBot."
        })

    } catch {

        await sock.sendMessage(chat, {
            text: "❌ No fue posible obtener una imagen de perro."
        })
    }
}

// /MEME
if (comando === "/meme") {

    try {

        const respuesta = await axios.get(
            "https://meme-api.com/gimme"
        )

        await sock.sendMessage(chat, {
            image: {
                url: respuesta.data.url
            },
            caption:
`😂 *MEME DEL DÍA*

📌 ${respuesta.data.title}

🤖 TitansBot Oficial`
        })

    } catch {

        await sock.sendMessage(chat, {
            text: "❌ No se pudo obtener un meme."
        })
    }
}

// /ANIME
if (comando === "/anime") {

    try {

        const respuesta = await axios.get(
            "https://nekos.best/api/v2/neko"
        )

        const imagen = respuesta.data.results[0].url

        const buffer = await axios.get(imagen, {
            responseType: "arraybuffer"
        })

        await sock.sendMessage(chat, {
            image: Buffer.from(buffer.data),
            caption: "🌸 Imagen anime aleatoria."
        })

    } catch (error) {

        console.log(error.message)

        await sock.sendMessage(chat, {
            text: "❌ No se pudo obtener una imagen anime."
        })
    }
}
            
// /WAIFU
if (comando === "/waifu") {

    try {

        const respuesta = await axios.get(
            "https://api.waifu.im/search"
        )

        const imagen = respuesta.data.images[0].url

        const buffer = await axios.get(imagen, {
            responseType: "arraybuffer"
        })

        await sock.sendMessage(chat, {
            image: Buffer.from(buffer.data),
            caption: "💖 Waifu seleccionada por TitansBot."
        })

    } catch (error) {

        console.log(error.message)

        await sock.sendMessage(chat, {
            text: "❌ No se pudo obtener una waifu."
        })
    }
}
            
// /EVENTO
if (comando.startsWith("/evento")) {

    if (!esAdmin) {
        return await sock.sendMessage(chat, {
            text: "❌ Este comando es exclusivo para administradores."
        })
    }

    const datos = texto.replace("/evento", "").trim()

    if (!datos) {
        return await sock.sendMessage(chat, {
            text:
`⚠️ Formato incorrecto.

Ejemplo:
/evento Gran Final | Nova E-sport vs Atlas E-sport | Domingo 8:30 PM | BO5`
        })
    }

    const partes = datos.split("|").map(x => x.trim())

    const nombreEvento = partes[0] || "No especificado"
    const enfrentamiento = partes[1] || "No especificado"
    const horario = partes[2] || "No especificado"
    const formato = partes[3] || "No especificado"

    await sock.sendMessage(chat, {
        text:
`╔════════════════════╗
📅 *EVENTO OFICIAL*
🏆 *LIGA TITANS TEAM*
╚════════════════════╝

🎮 *Evento:*
${nombreEvento}

⚔️ *Encuentro:*
${enfrentamiento}

🕒 *Horario:*
${horario}

🎯 *Formato:*
${formato}

━━━━━━━━━━━━━━━━━━━━
🤖 *TitansBot Oficial*`
    })
}

// /RECORDATORIO
if (comandoBase === "/recordatorio") {

    if (!esAdmin) {
        return await sock.sendMessage(chat, {
            text: "❌ Este comando es exclusivo para administradores."
        })
    }

    const partes = texto.split(" ")

    const minutos = parseInt(partes[1])

    if (isNaN(minutos)) {
        return await sock.sendMessage(chat, {
            text:
`⚠️ Formato incorrecto.

Ejemplo:
/recordatorio 30 La final comenzará en 30 minutos.`
        })
    }

    const mensajeRecordatorio = partes.slice(2).join(" ")

    if (!mensajeRecordatorio) {
        return await sock.sendMessage(chat, {
            text:
`⚠️ Debes escribir el mensaje del recordatorio.

Ejemplo:
/recordatorio 30 La final comenzará en 30 minutos.`
        })
    }

    await sock.sendMessage(chat, {
        text:
`⏰ *RECORDATORIO PROGRAMADO*

🕒 Tiempo:
${minutos} minutos

📝 Mensaje:
${mensajeRecordatorio}

✅ TitansBot enviará el aviso automáticamente.`
    })

    setTimeout(async () => {

        await sock.sendMessage(chat, {
            text:
`╔════════════════════╗
⏰ *RECORDATORIO OFICIAL*
🏆 *LIGA TITANS TEAM*
╚════════════════════╝

${mensajeRecordatorio}

━━━━━━━━━━━━━━━━━━━━
🤖 *TitansBot Oficial*`
        })

    }, minutos * 60 * 1000)
}

// /ENCUESTA
if (comandoBase === "/encuesta") {

    if (!esAdmin) {
        return await sock.sendMessage(chat, {
            text: "❌ Este comando es exclusivo para administradores."
        })
    }

    const pregunta = texto.replace("/encuesta", "").trim()

    if (!pregunta) {
        return await sock.sendMessage(chat, {
            text:
`⚠️ Debes escribir una pregunta.

Ejemplo:
/encuesta ¿La próxima temporada debería ser BO3?`
        })
    }

    await sock.sendMessage(chat, {
        text:
`📊 *ENCUESTA OFICIAL*
🏆 *LIGA TITANS TEAM*

❓ ${pregunta}

👍 Reacciona con 👍 para votar SI.
👎 Reacciona con 👎 para votar NO.

🤖 *TitansBot Oficial*`
    })
}

// /MUTE
if (comandoBase === "/mute") {

    if (!esAdmin) {
        return await sock.sendMessage(chat, {
            text: "❌ Este comando es exclusivo para administradores."
        })
    }

    const partes = texto.split(" ")
    const minutos = parseInt(partes[1])

    if (isNaN(minutos)) {
        return await sock.sendMessage(chat, {
            text:
`⚠️ Debes indicar la duración.

Ejemplo:
/mute 30`
        })
    }

    await sock.groupSettingUpdate(
        chat,
        "announcement"
    )

    await sock.sendMessage(chat, {
        text:
`🔇 *MODO SILENCIO ACTIVADO*

⏳ Duración:
${minutos} minutos

📢 Solo los administradores podrán enviar mensajes.

🤖 TitansBot reabrirá automáticamente el grupo.`
    })

    setTimeout(async () => {

        await sock.groupSettingUpdate(
            chat,
            "not_announcement"
        )

        await sock.sendMessage(chat, {
            text:
`🔊 *MODO SILENCIO FINALIZADO*

✅ El grupo ha sido reabierto automáticamente.`
        })

    }, minutos * 60 * 1000)
}

// /UNMUTE
if (comandoBase === "/unmute") {

    if (!esAdmin) {
        return await sock.sendMessage(chat, {
            text: "❌ Este comando es exclusivo para administradores."
        })
    }

    await sock.groupSettingUpdate(
        chat,
        "not_announcement"
    )

    await sock.sendMessage(chat, {
        text:
`🔊 *GRUPO REABIERTO*

Todos los miembros pueden volver a enviar mensajes.`
    })
}
         
            // /MENU
            if (comando === "/menu") {

                await sock.sendMessage(chat, {
                    text:
`🏆 *TITANSBOT - LIGA TITANS TEAM* 🏆

📋 *Comandos disponibles*

🏓 /ping
📜 /menu
🏆 /liga
📖 /reglas
📞 /contacto
📆 /horarios
🌐 /redes
👑 /staff
📞 /contacto
🎥 /stream
❓ /ayuda

🔥 Próximamente:
📊 /tabla
📝 /inscripciones`
                })
            }

            // /LIGA
            if (comando === "/liga") {

                await sock.sendMessage(chat, {
                    text:
`🏆 *Liga Titans Team*

🎮 Liga competitiva de Mobile Legends.
⚔️ Formatos BO1, BO3 y BO5.
🌎 Comunidad competitiva organizada.

👑 Director:
`
                })
            }

            // /REGLAS
            if (comando === "/reglas") {

                await sock.sendMessage(chat, {
                    text:
`📖 *Reglas Generales*

✅ Respeto entre jugadores.
✅ Puntualidad en los horarios.
✅ Prohibido el uso de hacks.
✅ Respetar las decisiones arbitrales.
✅ Mantener un comportamiento deportivo.`
                })
            }

            // /CONTACTO
            if (comando === "/contacto") {

                await sock.sendMessage(chat, {
                    text:
`📞 *Contacto Liga Titans Team*

Para soporte o dudas comunícate con la administración de la liga.`
                })
            }

    // /HORARIOS
if (comando === "/horarios") {

    await sock.sendMessage(chat, {
        text:
`🏆 *GRAN FINAL - LIGA TITANS TEAM* 🏆

📅 *Domingo*
🕣 *Hora:* 9:00 PM
⚔️ *Formato:* BO5

🔥 *Equipos Finalistas*

🔵 Nova E-sport 🆚 🟠 Atlas E-sport

👑 Solo uno levantará el trofeo de campeón.

🎮 ¡No te pierdas la gran final de la temporada!

#LigaTitansTeam`
    })
}

    // /REDES
if (comando === "/redes") {
    await sock.sendMessage(chat, {
        text:
`🌐 *REDES OFICIALES - TITANS CREATIVE* 🌐

📸 *Instagram*
https://www.instagram.com/official_titansteam?igsh=MXZsY3Z0YjFxMmRxOA==

🎵 *TikTok*
https://www.tiktok.com/@titans.team24/

📘 *Facebook*
https://www.facebook.com/share/1EBgSqdnap/

🎬 *Youtube*
https://www.youtube.com/@LigaTitansTeamOficial-l3f

👾 *Twitch*
https://www.twitch.tv/titansteamstournament

🏆 *Liga Titans Team*
Comunidad competitiva de Mobile Legends.

🔥 Síguenos para enterarte de:
✅ Nuevos torneos
✅ Calendarios
✅ Resultados
✅ Noticias y anuncios oficiales

👑 Gracias por formar parte de la comunidad Titans Team.`
    })
}

    // /STAFF
if (comando === "/staff") {
    await sock.sendMessage(chat, {
        text: `👑 *COMITÉ DIRECTIVO*
🏆 *LIGA TITANS TEAM*

👑 *Director General*
• Jean Pierre Rousseau
• David Rivera

🏆 *Director de Torneos*
• Juan Pablo López

⚖️ *Director de Auditoría Interna*
• Alfredo Pérez

🎥 *Directora de Tecnología, Comunicación y Streaming*
• Carol Juliana C

📽️ Sub Director de Tecnología, Comunicación y Moderador
• Johan Andres Navarrete

🗂️ *Director de Asuntos Corporativos*
• Alex Martínez

⚔️ Trabajando juntos para fortalecer la comunidad y el crecimiento competitivo de Liga Titans Team.

🔥 Gracias por formar parte de nuestra comunidad.`
    })
}

    // /CONTACTO
if (comando === "/contacto") {
    await sock.sendMessage(chat, {
        text:
`📞 *CONTACTO OFICIAL - LIGA TITANS TEAM*

👑 Dirección General
[Nombre]

🏆 Dirección de Torneos
[Nombre]

📧 Correo:
[correo@ejemplo.com]

📱 WhatsApp:
[Numero de contacto]

🌐 También puedes encontrarnos en nuestras redes oficiales usando:
/redes`
    })
}

     // /STREAM
if (comando === "/stream") {
    await sock.sendMessage(chat, {
        text:
`🎥 *TRANSMISIÓN OFICIAL*

🏆 Evento:
[Nombre del evento]

📅 Fecha:
[Fecha]

🕒 Hora:
[Hora]

📺 Plataforma:
[Facebook / YouTube / TikTok]

🔗 Enlace:
[Agregar enlace aquí]

🔥 ¡No te pierdas la transmisión oficial de Liga Titans Team!`
    })
}

    // /AYUDA
if (comando === "/ayuda") {
    await sock.sendMessage(chat, {
        text:
`❓ *CENTRO DE AYUDA TITANSBOT*

Si necesitas información utiliza alguno de estos comandos:

📜 /menu
📅 /horarios
👑 /staff
🌐 /redes
📖 /reglas
📞 /contacto
🎥 /stream

🤖 Si tienes problemas o dudas adicionales contacta a la administración mediante:

📞 /contacto`
    })
}
            
        } catch (error) {

            console.log("Error procesando mensaje:")
            console.log(error)
        }
    })

    // ================= BIENVENIDA =================

    sock.ev.on("group-participants.update", async (data) => {

        try {

            if (data.action === "add") {

                for (const participante of data.participants) {

                    await sock.sendMessage(data.id, {
                        text:
`🏆 *Bienvenido a Liga Titans Team* 🏆

👋 Bienvenido @${participante.split("@")[0]}

📜 Escribe */menu* para conocer los comandos disponibles.

⚔️ Respeta las reglas y disfruta del torneo.

🔥 ¡Buena suerte y que gane el mejor equipo!`,
                        mentions: [participante]
                    })
                }
            }

            // DESPEDIDA
if (data.action === "remove") {

    for (const participante of data.participants) {

        await sock.sendMessage(data.id, {
            text:
`👋 *Un miembro ha abandonado la comunidad.*

@${participante.split("@")[0]} ya no forma parte de *Liga Titans Team*.

🏆 Gracias por haber compartido con nosotros y te deseamos éxitos en tus próximos proyectos.

⚔️ Nos vemos en el campo de batalla.`,
            mentions: [participante]
        })
    }
}

        } catch (error) {

            console.log("Error en bienvenida:")
            console.log(error)
        }
    })
}

iniciarBot()
