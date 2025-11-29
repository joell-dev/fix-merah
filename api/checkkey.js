const CONFIG = require('../config');

let usageStats = {};

module.exports = async (req, res) => {
  const apiKey = req.query.apikey || req.headers['x-api-key'];

  if (!CONFIG.API_KEYS.includes(apiKey)) {
    return res.status(403).json({ success: false, error: 'Invalid API key' });
  }

  if (!usageStats[apiKey]) {
    usageStats[apiKey] = { request: 0, success: 0, failed: 0 };
  }

  usageStats[apiKey].request++;

  const success = Math.random() > 0.3;
  if (success) usageStats[apiKey].success++;
  else usageStats[apiKey].failed++;

  res.json({
    key: apiKey,
    data: {
      REQUEST: usageStats[apiKey].request,
      SUCCESS: usageStats[apiKey].success,
      GAGAL: usageStats[apiKey].failed,
    },
  });
};
