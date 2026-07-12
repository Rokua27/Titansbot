const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion
} = require("@whiskeysockets/baileys")

const pino = require("pino")

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

            const reason =
                lastDisconnect?.error?.output?.statusCode

            console.log("❌ Conexión cerrada:", reason)

            if (reason !== DisconnectReason.loggedOut) {
                iniciarBot()
            }
        }
    })

    setTimeout(async () => {
        try {

            if (!state.creds.registered) {

                const codigo = await sock.requestPairingCode(
                    "573189333079"
                )

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
    }, 10000)
}

iniciarBot()
