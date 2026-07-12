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
            res.end("<h1>Esperando generación del QR...</h1>")
        }

        return
    }

    res.writeHead(200, { "Content-Type": "text/plain" })
    res.end("TitansBot funcionando correctamente")
})

server.listen(PORT, () => {
    console.log(`🌐 Servidor iniciado en puerto ${PORT}`)
})

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

            console.log("✅ QR generado")
            console.log("Abre:")
            console.log("https://titansbot.onrender.com/qr")
        }

        if (connection === "open") {
            console.log("✅ TitansBot conectado correctamente a WhatsApp")
            qrImage = null
        }

        if (connection === "close") {

            const reason = lastDisconnect?.error?.output?.statusCode

            console.log("❌ Conexión cerrada:", reason)

            if (reason !== DisconnectReason.loggedOut) {
                setTimeout(() => iniciarBot(), 5000)
            }
        }
    })
}

iniciarBot()
