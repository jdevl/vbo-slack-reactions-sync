export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { reactions, channelId, token } = req.body;

  if (!reactions || !Array.isArray(reactions)) {
    return res.status(400).json({ error: 'Invalid reactions data' });
  }

  let successful = 0;
  let failed = 0;

  for (const reaction of reactions) {
    try {
      const response = await fetch('https://slack.com/api/reactions.add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          token,
          channel: channelId,
          timestamp: reaction.ts,
          name: reaction.name
        })
      });
      
      const data = await response.json();
      if (data.ok) {
        successful++;
      } else {
        failed++;
      }
    } catch (error) {
      failed++;
    }
  }

  res.status(200).json({ successful, failed });
}
