const http = require("http")
const {
    default: makeWASocket,
    useMultiFileAuthState,
    fetchLatestBaileysVersion,
    DisconnectReason
} = require("@whiskeysockets/baileys")

const qrcode = require("qrcode-terminal")
const pino = require("pino")

const PORT = process.env.PORT || 10000

http.createServer((req, res) => {
    res.writeHead(200, { "Content-Type": "text/plain" })
    res.end("TitansBot funcionando correctamente")
}).listen(PORT, () => {
    console.log(`🌐 Servidor HTTP iniciado en puerto ${PORT}`)
})

async function iniciarBot() {

    const { state, saveCreds } = await useMultiFileAuthState("./auth")

    const { version } = await fetchLatestBaileysVersion()

    const sock = makeWASocket({
        version,
        auth: state,
        logger: pino({ level: "silent" }),
        printQRInTerminal: true,
        browser: ["TitansBot", "Chrome", "1.0.0"]
    })

    sock.ev.on("creds.update", saveCreds)

    sock.ev.on("connection.update", async (update) => {

        const { connection, qr, lastDisconnect } = update

        if (qr) {
            console.log("")
            console.log("================================")
            console.log("ESCANEA EL QR DESDE WHATSAPP")
            console.log("================================")
            qrcode.generate(qr, { small: true })
        }

        if (connection === "open") {
            console.log("✅ TitansBot conectado correctamente a WhatsApp")
        }

        if (connection === "close") {

            const reason = lastDisconnect?.error?.output?.statusCode

            console.log(`❌ Conexión cerrada: ${reason}`)

            if (reason !== DisconnectReason.loggedOut) {
                setTimeout(() => iniciarBot(), 5000)
            }
        }
    })
}

iniciarBot()
