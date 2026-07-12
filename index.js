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

// ================== SERVIDOR HTTP ==================

const server = http.createServer(async (req, res) => {

    if (req.url === "/qr") {

        if (qrImage) {
            res.writeHead(200, { "Content-Type": "text/html" })

            res.end(`
                <html>
                    <head>
                        <title>TitansBot QR</title>
                    </head>
                    <body style="text-align:center;font-family:Arial;padding-top:30px">
                        <h1>Escanea este QR con WhatsApp Business</h1>
                        <img src="${qrImage}" width="350"/>
                    </body>
                </html>
            `)

        } else {
            res.writeHead(200, { "Content-Type": "text/html" })
            res.end("<h1>TitansBot ya está conectado a WhatsApp.</h1>")
        }

        return
    }

    res.writeHead(200, { "Content-Type": "text/plain" })
    res.end("TitansBot funcionando correctamente")
})

server.listen(PORT, () => {
    console.log(`🌐 Servidor HTTP iniciado en puerto ${PORT}`)
})

// ================== BOT ==================

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
            console.log("================================")
            console.log("QR generado correctamente")
            console.log("Abre:")
            console.log("https://titansbot.onrender.com/qr")
            console.log("================================")
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

            const reason = lastDisconnect?.error?.output?.statusCode

            console.log(`❌ Conexión cerrada: ${reason}`)

            if (reason !== DisconnectReason.loggedOut) {
                setTimeout(() => iniciarBot(), 5000)
            }
        }
    })

    // ================== COMANDOS ==================

    sock.ev.on("messages.upsert", async ({ messages }) => {

        const mensaje = messages[0]

        if (!mensaje.message) return

        const texto =
            mensaje.message.conversation ||
            mensaje.message.extendedTextMessage?.text ||
            ""

        const comando = texto.toLowerCase().trim()
        const chat = mensaje.key.remoteJid

        // PING
        if (comando === "ping") {
            await sock.sendMessage(chat, {
                text: "🏓 Pong! TitansBot está funcionando correctamente."
            })
        }

        // MENU
        if (comando === "menu") {
            await sock.sendMessage(chat, {
                text:
`🏆 *TITANSBOT - LIGA TITANS TEAM* 🏆

📋 Comandos disponibles:

🏓 ping
📜 menu
🏆 liga
📖 reglas
📞 contacto`
            })
        }

        // LIGA
        if (comando === "liga") {
            await sock.sendMessage(chat, {
                text:
`🏆 *Liga Titans Team*

🎮 Liga competitiva de Mobile Legends.
⚔️ Torneos BO1, BO3 y BO5.
🌎 Comunidad competitiva organizada.

👑 Director:
David Rivera`
            })
        }

        // REGLAS
        if (comando === "reglas") {
            await sock.sendMessage(chat, {
                text:
`📖 *Reglas básicas*

✅ Respeto entre jugadores.
✅ Puntualidad en los horarios.
✅ Prohibido el uso de hacks.
✅ Respetar las decisiones arbitrales.`
            })
        }

        // CONTACTO
        if (comando === "contacto") {
            await sock.sendMessage(chat, {
                text:
`📞 *Contacto Liga Titans Team*

Para soporte o dudas comunícate con la administración de la liga.`
            })
        }
    })
}

iniciarBot()
