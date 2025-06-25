// jBots WhatsApp Bot - Full Edition
// Author: Jwans (fb.com/gbadamosi.tajudeen.369188 | youtube.com/@jagwaz-c5p)
// Deployment: Glitch, Render, Cyclic
// Requires: Node.js v18+
// Dependencies: @whiskeysockets/baileys, axios, ytdl-core, openai, express, spotifydl-core

const { makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion, DisconnectReason, makeInMemoryStore } = require('@whiskeysockets/baileys')
const pino = require('pino')
const axios = require('axios')
const ytdl = require('ytdl-core')
const { Configuration, OpenAIApi } = require('openai')
const express = require('express')
const fs = require('fs')
const path = require('path')

// --- CONFIGURATION ---
const BOT_NAME = 'jBots'
const LOGO = `
     ██╗    ██╗██████╗  ██████╗ ████████╗███████╗
     ██║    ██║██╔══██╗██╔═══██╗╚══██╔══╝██╔════╝
     ██║ █╗ ██║██████╔╝██║   ██║   ██║   █████╗  
     ██║███╗██║██╔═══╝ ██║   ██║   ██║   ██╔══╝  
     ╚███╔███╔╝██║     ╚██████╔╝   ██║   ███████╗
      ╚══╝╚══╝ ╚═╝      ╚═════╝    ╚═╝   ╚══════╝
`
const SOCIALS = {
    facebook: 'https://www.facebook.com/gbadamosi.tajudeen.369188?mibextid=ZbWKwL',
    youtube: 'https://youtube.com/@jagwaz-c5p?si=kkJzspZ_yP5gOOwo',
    whatsappGroup: 'https://chat.whatsapp.com/EwfKgxk1jXL6Xqm0zXi6NG'
}

// --- AI SETUP (OpenAI) ---
const openai = new OpenAIApi(new Configuration({ apiKey: process.env.OPENAI_API_KEY || 'sk-xxx' })) // Put your OpenAI key here

// --- EXPRESS WEB SERVER (for deployment) ---
const app = express()
app.get('/', (req, res) => {
    res.send(`<h1>${BOT_NAME} is Running!</h1><pre>${LOGO}</pre>`)
})
app.listen(process.env.PORT || 3000, () => console.log('Web server running...'))

// --- BAILEYS WHATSAPP BOT SETUP ---
const store = makeInMemoryStore({ logger: pino().child({ level: 'silent', stream: 'store' }) })
store.readFromFile('./baileys_store.json')
setInterval(() => store.writeToFile('./baileys_store.json'), 10_000)

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys')
    const { version } = await fetchLatestBaileysVersion()
    const sock = makeWASocket({
        logger: pino({ level: 'silent' }),
        printQRInTerminal: true,
        auth: state,
        version,
        browser: [BOT_NAME, 'Chrome', '110.0.0.1'],
        markOnlineOnConnect: true,
        shouldSyncHistoryMessage: false
    })
    store.bind(sock.ev)
    sock.ev.on('creds.update', saveCreds)

    // Always online & typing presence
    setInterval(() => sock.sendPresenceUpdate('available'), 25_000)

    // Message event handler
    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        for (const msg of messages) {
            if (!msg.message || msg.key.fromMe) continue
            const m = msg.message
            const sender = msg.key.remoteJid

            // Helper: reply with logo
            const reply = (text, extra = {}) =>
                sock.sendMessage(sender, { text: `${LOGO}\n${text}\n\n*— ${BOT_NAME}*`, ...extra }, { quoted: msg })

            // --- COMMANDS ---

            // Help menu
            if (/^!help$/i.test(m.conversation || '')) {
                reply(
`Hi, I'm *${BOT_NAME}* 🤖
Features:
- Save view once (!savevo)
- View statuses (!status)
- Recover deleted messages
- Play music (!music [song])
- Download TikTok (!tiktok [url])
- Download YouTube (!yt [url])
- AI chat (!ai [msg])
- Games (!game, !guess [n])
- Quick reactions (!react ❤️)
- Group/join/socials (!join, !socials)
- Always online, typing
`
                )
            }

            // Save View Once (reply to view once)
            if (/^!savevo$/i.test(m.conversation || '')) {
                if (msg.message?.viewOnceMessageV2 || msg.message?.viewOnceMessage) {
                    // Remove viewOnce and resend
                    let mediaMsg = msg.message.viewOnceMessageV2?.message || msg.message.viewOnceMessage?.message
                    await sock.sendMessage(sender, mediaMsg, { quoted: msg })
                    reply('View Once media saved!')
                } else {
                    reply('Reply to a view once media with !savevo')
                }
            }

            // View statuses (list contacts' statuses)
            if (/^!status$/i.test(m.conversation || '')) {
                let statusList = store.chats.all().filter(c => c.status).map(c => `• ${c.name || c.id}`).join('\n') || 'No statuses found.'
                reply(`Available statuses:\n${statusList}`)
            }

            // --- Anti-delete (recover deleted messages) ---
            let chatId = msg.key.remoteJid
            if (!global.deletedMsgs) global.deletedMsgs = {}
            if (!global.deletedMsgs[chatId]) global.deletedMsgs[chatId] = []
            global.deletedMsgs[chatId].push(msg)
            if (global.deletedMsgs[chatId].length > 20) global.deletedMsgs[chatId].shift()
            sock.ev.on('messages.delete', async ({ keys }) => {
                for (const key of keys) {
                    let deleted = global.deletedMsgs[key.remoteJid]?.find(x => x.key.id === key.id)
                    if (deleted) {
                        await sock.sendMessage(key.remoteJid, { text: `♻️ Recovered deleted message:\n${JSON.stringify(deleted.message)}` })
                    }
                }
            })

            // Play music (YouTube audio)
            if (/^!music (.+)/i.test(m.conversation || '')) {
                let song = m.conversation.match(/^!music (.+)/i)[1]
                reply(`🔎 Searching YouTube for: ${song}`)
                try {
                    // Use a YouTube search API or ytdl-core
                    let searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(song)}`
                    let { data } = await axios.get(searchUrl)
                    let ytIdMatch = data.match(/\/watch\?v=([a-zA-Z0-9_-]{11})/)
                    if (!ytIdMatch) return reply('Song not found!')
                    let ytUrl = `https://www.youtube.com/watch?v=${ytIdMatch[1]}`
                    let info = await ytdl.getInfo(ytUrl)
                    let title = info.videoDetails.title
                    reply(`🎵 Downloading audio: ${title}`)
                    let stream = ytdl(ytUrl, { filter: 'audioonly' })
                    let filePath = path.join(__dirname, 'audio.mp3')
                    stream.pipe(fs.createWriteStream(filePath))
                    stream.on('end', async () => {
                        await sock.sendMessage(sender, { audio: fs.readFileSync(filePath), mimetype: 'audio/mp4', ptt: false }, { quoted: msg })
                        fs.unlinkSync(filePath)
                    })
                } catch (e) {
                    reply('❌ Error fetching music: ' + e.message)
                }
            }

            // YouTube video download (audio/video)
            if (/^!yt (https?:\/\/[^\s]+)/i.test(m.conversation || '')) {
                let url = m.conversation.match(/^!yt (https?:\/\/[^\s]+)/i)[1]
                if (!ytdl.validateURL(url)) return reply('Invalid YouTube URL!')
                let info = await ytdl.getInfo(url)
                let title = info.videoDetails.title
                reply(`⬇️ Downloading: ${title}`)
                let stream = ytdl(url, { filter: 'audioandvideo', quality: '18' })
                let filePath = path.join(__dirname, 'video.mp4')
                stream.pipe(fs.createWriteStream(filePath))
                stream.on('end', async () => {
                    await sock.sendMessage(sender, { video: fs.readFileSync(filePath), mimetype: 'video/mp4', caption: title }, { quoted: msg })
                    fs.unlinkSync(filePath)
                })
            }

            // TikTok video download (using external public API)
            if (/^!tiktok (https?:\/\/[^\s]+)/i.test(m.conversation || '')) {
                let url = m.conversation.match(/^!tiktok (https?:\/\/[^\s]+)/i)[1]
                reply('⬇️ Downloading TikTok video...')
                try {
                    let api = `https://api.tikmate.app/api/lookup?url=${encodeURIComponent(url)}`
                    let { data } = await axios.get(api)
                    let dlUrl = `https://tikmate.app/download/${data.token}/${data.id}.mp4`
                    let filePath = path.join(__dirname, 'tiktok.mp4')
                    let res = await axios.get(dlUrl, { responseType: 'arraybuffer' })
                    fs.writeFileSync(filePath, res.data)
                    await sock.sendMessage(sender, { video: fs.readFileSync(filePath), mimetype: 'video/mp4', caption: 'TikTok Downloaded!' }, { quoted: msg })
                    fs.unlinkSync(filePath)
                } catch (e) {
                    reply('❌ Error downloading TikTok: ' + e.message)
                }
            }

            // AI Chat (GPT)
            if (/^!ai (.+)/i.test(m.conversation || '')) {
                let prompt = m.conversation.match(/^!ai (.+)/i)[1]
                reply('_Thinking..._')
                try {
                    let aires = await openai.createChatCompletion({
                        model: 'gpt-3.5-turbo',
                        messages: [{ role: "user", content: prompt }]
                    })
                    reply(aires.data.choices[0].message.content)
                } catch (e) {
                    reply('AI error: ' + e.message)
                }
            }

            // Simple Game: Guess the number
            if (/^!game$/i.test(m.conversation || '')) {
                let num = Math.floor(Math.random() * 10) + 1
                reply('Guess the number (1-10)! Reply with: !guess [number]')
                global.gameNum = num
            }
            if (/^!guess (\d+)/i.test(m.conversation || '')) {
                let guess = parseInt(m.conversation.match(/^!guess (\d+)/i)[1])
                if (guess === global.gameNum) {
                    reply('🎉 Correct! You win!')
                } else {
                    reply('❌ Wrong! Try again.')
                }
            }

            // Quick React to message
            if (/^!react (\S+)/i.test(m.conversation || '')) {
                let emoji = m.conversation.match(/^!react (\S+)/i)[1]
                await sock.sendMessage(sender, { react: { text: emoji, key: msg.key } })
            }

            // Socials
            if (/^!socials$/i.test(m.conversation || '')) {
                reply(
`Connect with me:
Facebook: ${SOCIALS.facebook}
YouTube: ${SOCIALS.youtube}
Join WhatsApp Group: ${SOCIALS.whatsappGroup}`
                )
            }

            // Join group/channel
            if (/^!join$/i.test(m.conversation || '')) {
                reply(
`Join our WhatsApp group:
${SOCIALS.whatsappGroup}
Subscribe to YouTube:
${SOCIALS.youtube}`
                )
            }

            // Bot info/logo
            if (/^!bot$/i.test(m.conversation || '')) {
                reply(`*${BOT_NAME}*\nAlways Online\nType !help for commands.`)
            }
        }
    })

    // QR code or Pairing code for WhatsApp registration
    sock.ev.on('connection.update', ({ connection, lastDisconnect, qr, pairingCode }) => {
        if (qr) {
            console.log('Scan this QR to connect:', qr)
        }
        if (pairingCode) {
            console.log('Pairing code:', pairingCode)
        }
        if (connection === 'close') {
            startBot()
        }
    })

    // Always online presence
    sock.ev.on('contacts.update', () => {
        sock.sendPresenceUpdate('available')
    })
}
startBot()