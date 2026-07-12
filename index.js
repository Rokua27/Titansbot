const http = require("http")
const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion
} = require("@whiskeysockets/baileys")

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
        printQRInTerminal: false
    })

    sock.ev.on("creds.update", saveCreds)

    sock.ev.on("connection.update", async (update) => {

        const { connection, lastDisconnect } = update

        if (connection === "open") {
            console.log("✅ TitansBot conectado correctamente a WhatsApp")
        }

        if (connection === "close") {
            const reason = lastDisconnect?.error?.output?.statusCode

            console.log("❌ Conexión cerrada:", reason)

            if (reason !== DisconnectReason.loggedOut) {
                setTimeout(() => {
                    iniciarBot()
                }, 5000)
            }
        }
    })

    try {
        if (!state.creds.registered) {

            const codigo = await sock.requestPairingCode("57TU_NUMERO")

            console.log("")
            console.log("================================")
            console.log("CODIGO DE VINCULACION:")
            console.log(codigo)
            console.log("================================")
            console.log("")
        }
    } catch (error) {
        console.log("Error generando código:")
        console.log(error)
    }
}

iniciarBot()
