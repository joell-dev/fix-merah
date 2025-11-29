  const fs = require('fs')
const nodemailer = require('nodemailer')

// ====== CONFIG DASAR ======
const CONFIG = {
  SMTP_HOST: 'smtp.gmail.com',
  SMTP_PORT: 465,
  SMTP_SECURE: true,
  DEFAULT_RECIPIENT: 'smb@support.whatsapp.com',
  LOG_FILE: __dirname + '/../email_logs.txt',
  VALID_KEYS: ['angela'] // 🔐 daftar key yang boleh
}

// ====== SISTEM LIMIT API ======
const LIMIT = new Map()
const COOLDOWN = 2 * 60 * 1000 // 2 menit

function checkRateLimit(key) {
  if (key === 'angela') return false // angela bebas limit
  const lastUse = LIMIT.get(key)
  if (!lastUse) {
    LIMIT.set(key, Date.now())
    return false
  }
  const diff = Date.now() - lastUse
  if (diff < COOLDOWN) return true
  LIMIT.set(key, Date.now())
  return false
}

function loadAccounts() {
  const raw = fs.readFileSync(__dirname + '/../dataimel.txt', 'utf8')
  return raw
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => {
      const [user, pass] = line.split(':')
      return { user, pass }
    })
}

function pickRandomAccount(accounts) {
  const idx = Math.floor(Math.random() * accounts.length)
  return accounts[idx]
}

function logToFile(entry) {
  try {
    fs.appendFileSync(CONFIG.LOG_FILE, `[${new Date().toISOString()}] ${entry}\n`)
  } catch (err) {
    console.log(`[LOG] ${entry}`)
  }
}

async function sendMail({ account, to, subject, text }) {
  const transporter = nodemailer.createTransport({
    host: CONFIG.SMTP_HOST,
    port: CONFIG.SMTP_PORT,
    secure: CONFIG.SMTP_SECURE,
    auth: { user: account.user, pass: account.pass }
  })
  return transporter.sendMail({ from: account.user, to, subject, text })
}

// ====== MAIN HANDLER ======
module.exports = async (req, res) => {
  // ====== ✅ FIX CORS ======
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-api-key')
  
  if (req.method === 'OPTIONS') return res.status(200).end()

  // ====== CEK API KEY ======
  const apiKey = req.headers['x-api-key'] || req.query.apikey
  if (!apiKey)
    return res.status(400).json({ success: false, error: 'API key wajib' })

  if (!CONFIG.VALID_KEYS.includes(apiKey))
    return res.status(403).json({ success: false, error: 'API key tidak valid' })

  if (checkRateLimit(apiKey))
    return res.status(429).json({
      success: false,
      error: 'Terlalu sering! Coba lagi dalam 2 menit.'
    })

  // ====== CEK NOMOR ======
  const nomor = req.query.nomor
  if (!nomor)
    return res.status(400).json({ success: false, error: 'Parameter ?nomor= wajib diisi' })

  try {
    const accounts = loadAccounts()
    if (!accounts.length)
      return res.status(500).json({ success: false, error: 'Tidak ada akun SMTP di dataimel.txt' })

    const account = pickRandomAccount(accounts)
    const uniqueId = Math.floor(Date.now() / 1000)
    const subject = `Banding ${uniqueId}`
    const text = `Halo pihak WhatsApp,
Perkenalkan nama saya (RijalJr).
Saya ingin mengajukan banding tentang mendaftar nomor telepon.
Saat registrasi muncul teks "login tidak tersedia".
Mohon untuk memperbaiki masalah tersebut.
Nomor saya (+${nomor}).`

    const info = await sendMail({ account, to: CONFIG.DEFAULT_RECIPIENT, subject, text })
    logToFile(`SENT by ${account.user} → ${CONFIG.DEFAULT_RECIPIENT} | Nomor: +${nomor}`)

    res.json({
      success: true,
      message: 'Email banding berhasil dikirim',
      usedAccount: account.user,
      nomor: `+${nomor}`,
      messageId: info.messageId
    })
  } catch (err) {
    logToFile(`ERROR: ${err.message}`)
    res.status(500).json({ success: false, error: err.message })
  }
}
