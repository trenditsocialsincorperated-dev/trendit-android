const { RtcTokenBuilder, RtcRole } = require('agora-token');

const APP_ID = process.env.AGORA_APP_ID;
const APP_CERTIFICATE = process.env.AGORA_APP_CERTIFICATE;
const TOKEN_EXPIRATION_SECONDS = 3600;

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'POST, OPTIONS'
    },
    body: JSON.stringify(body)
  };
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return json(204, {});
  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'Method not allowed. Use POST.' });
  }

  if (!APP_ID || !APP_CERTIFICATE) {
    console.error('Missing AGORA_APP_ID or AGORA_APP_CERTIFICATE environment variable.');
    return json(500, { error: 'Agora token server is not configured.' });
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch (_) {
    return json(400, { error: 'Invalid JSON body.' });
  }

  const channel = String(body.channelName || body.channel || '').trim();
  const uidNumber = Number(body.uid);

  if (!channel || channel.length > 64) {
    return json(400, { error: 'channel must be a non-empty string of 64 characters or fewer.' });
  }

  if (!Number.isInteger(uidNumber) || uidNumber < 1 || uidNumber > 2147483647) {
    return json(400, { error: 'uid must be a positive 32-bit integer.' });
  }

  try {
    const currentTimestamp = Math.floor(Date.now() / 1000);
    const privilegeExpiredTs = currentTimestamp + TOKEN_EXPIRATION_SECONDS;

    const token = RtcTokenBuilder.buildTokenWithUid(
      APP_ID,
      APP_CERTIFICATE,
      channel,
      uidNumber,
      RtcRole.PUBLISHER,
      privilegeExpiredTs
    );

    return json(200, {
      token,
      uid: uidNumber,
      channel,
      expiresIn: TOKEN_EXPIRATION_SECONDS
    });
  } catch (error) {
    console.error('Agora token generation failed:', error);
    return json(500, {
      error: 'Failed to generate Agora token.',
      details: error && error.message ? error.message : String(error)
    });
  }
};
