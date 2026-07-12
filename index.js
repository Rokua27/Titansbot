const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason
} = require("@whiskeysockets/baileys")

const pino = require("pino")

async function iniciarBot() {

    const { state, saveCreds } = await useMultiFileAuthState("auth")

    const sock = makeWASocket({
        auth: state,
        logger: pino({ level: "silent" }),
        printQRInTerminal: false
    })

    sock.ev.on("creds.update", saveCreds)

    sock.ev.on("connection.update", async (update) => {

        const { connection, lastDisconnect } = update

        if (connection === "open") {
            console.log("✅ TitansBot conectado correctamente")
        }

        if (connection === "close") {

            const shouldReconnect =
                lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut

            console.log("❌ Conexión cerrada")

            if (shouldReconnect) {
                iniciarBot()
            }
        }
    })

    if (!state.creds.registered) {

        const numero = "573189333079"

        const codigo = await sock.requestPairingCode(numero)

        console.log("")
        console.log("================================")
        console.log("CODIGO DE VINCULACION:")
        console.log(codigo)
        console.log("================================")
        console.log("")
    }
}

iniciarBot()
