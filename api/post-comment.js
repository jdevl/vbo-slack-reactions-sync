export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { channelId, threadTs, text, token } = req.body;

  if (!channelId || !threadTs || !text || !token) {
    return res.status(400).json({ error: 'Missing channelId, threadTs, text, or token' });
  }

  try {
    const response = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        channel: channelId,
        thread_ts: threadTs,
        text: text
      })
    });

    const data = await response.json();

    if (!data.ok) {
      return res.status(400).json({
        error: data.error,
        ok: false
      });
    }

    return res.status(200).json({
      ok: true,
      ts: data.ts,
      message: 'Comment posted successfully'
    });
  } catch (error) {
    console.error('Error posting comment:', error);
    return res.status(500).json({ error: `Server error: ${error.message}` });
  }
}
