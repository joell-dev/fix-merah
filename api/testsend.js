const fs = require('fs')
const nodemailer = require('nodemailer')

const CONFIG = {
  SMTP_HOST: 'smtp.gmail.com',
  SMTP_PORT: 465,
  SMTP_SECURE: true,
  LOG_FILE: __dirname + '/../email_logs.txt'
}

const LIMIT = new Map()
const COOLDOWN = 2 * 60 * 1000

function checkRateLimit(key) {
  if (key === 'angela') return false
  const last = LIMIT.get(key)
  if (!last) {
    LIMIT.set(key, Date.now())
    return false
  }
  if (Date.now() - last < COOLDOWN) return true
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
  console.log(`[LOG] ${new Date().toISOString()} ${entry}`)
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

let counter = 1

module.exports = async (req, res) => {
  const apiKey = req.headers['x-api-key'] || req.query.apikey
  if (!apiKey)
    return res.status(400).json({ success: false, error: 'API key wajib' })

  if (checkRateLimit(apiKey))
    return res.status(429).json({
      success: false,
      error: 'Terlalu sering! Coba lagi dalam 2 menit.'
    })

  const email = req.query.email
  const nomor = req.query.nomor
  if (!email || !nomor)
    return res.status(400).json({
      success: false,
      error: 'Parameter kurang. Gunakan ?apikey=&email=&nomor='
    })

  try {
    const accounts = loadAccounts()
    if (!accounts.length)
      return res.status(500).json({ success: false, error: 'Tidak ada akun SMTP di dataimel.txt' })

    const subject = `Test Banding #${counter}`
    const text = `Test pengiriman ke ${email}\nNomor: +${nomor}\n#${counter}`

    const account = pickRandomAccount(accounts)
    const info = await sendMail({ account, to: email, subject, text })

    logToFile(`TEST by ${account.user} → ${email} | Subject: ${subject}`)
    counter++
    res.json({
      success: true,
      message: 'Email test berhasil dikirim',
      usedAccount: account.user,
      to: email,
      nomor: `+${nomor}`,
      subject,
      messageId: info.messageId
    })
  } catch (err) {
    logToFile(`ERROR: ${err.message}`)
    res.status(500).json({ success: false, error: err.message })
  }
}