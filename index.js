const http = require("http")
const QRCode = require("qrcode")
const {
    default: makeWASocket,
    useMultiFileAuthState,
    fetchLatestBaileysVersion,
    DisconnectReason
} = require("@whiskeysockets/baileys")

const pino = require("pino")
const fs = require("fs")

const PORT = process.env.PORT || 10000
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
    
function guardarAdvertencias() {
    fs.writeFileSync(
        "./advertencias.json",
        JSON.stringify(advertencias, null, 2)
    )
    }
    sock.ev.on("messages.upsert", async ({ messages }) => {

        try {

            const mensaje = messages[0]

            if (!mensaje.message) return
            if (mensaje.key.fromMe) return
            const chat = mensaje.key.remoteJid
            // ==========================
            // VERIFICAR ADMINISTRADORES
            // =========================
            const usuario = mensaje.key.participant || mensaje.key.remoteJid

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
