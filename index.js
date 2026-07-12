const http = require("http")
const QRCode = require("qrcode")
const {
    default: makeWASocket,
    useMultiFileAuthState,
    fetchLatestBaileysVersion,
    DisconnectReason
} = require("@whiskeysockets/baileys")

const pino = require("pino")

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

    sock.ev.on("messages.upsert", async ({ messages }) => {

        try {

            const mensaje = messages[0]

            if (!mensaje.message) return
            if (mensaje.key.fromMe) return

            const texto =
                mensaje.message.conversation ||
                mensaje.message.extendedTextMessage?.text ||
                ""

            const comando = texto.toLowerCase().trim()

            if (!comando.startsWith("/")) return

            const chat = mensaje.key.remoteJid

            // /PING
            if (comando === "/ping") {

                await sock.sendMessage(chat, {
                    text: "🏓 Pong! TitansBot está funcionando correctamente."
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

        } catch (error) {

            console.log("Error en bienvenida:")
            console.log(error)
        }
    })
}

iniciarBot()
