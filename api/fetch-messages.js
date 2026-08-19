export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { channelId, userId, token } = req.query;

  if (!channelId || !userId || !token) {
    return res.status(400).json({ error: 'Missing channelId, userId, or token' });
  }

  try {
    // Fetch recent messages from channel
    const historyRes = await fetch('https://slack.com/api/conversations.history', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        channel: channelId,
        limit: 30,
        inclusive: true
      })
    });

    const historyData = await historyRes.json();

    if (!historyData.ok) {
      return res.status(400).json({ error: historyData.error });
    }

    const messages = historyData.messages || [];

    // Filter to Ace OpenClaw messages only
    const aceMessages = messages.filter(m => m.user === 'U0ADATUK7MM');

    // For each message, check if userId has reacted
    const messagesWithReactions = await Promise.all(
      aceMessages.map(async (msg) => {
        try {
          const reactionsRes = await fetch('https://slack.com/api/reactions.get', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              channel: channelId,
              timestamp: msg.ts,
              full: true
            })
          });

          const reactionsData = await reactionsRes.json();
          const userReactions = reactionsData.message?.reactions || [];

          return {
            ts: msg.ts,
            user: msg.user,
            user_name: 'Ace OpenClaw',
            text: msg.text,
            reactions: userReactions.map(r => ({
              name: r.name,
              count: r.users.length,
              hasUserReacted: r.users.includes(userId)
            }))
          };
        } catch (e) {
          console.error(`Error getting reactions for ${msg.ts}:`, e);
          return {
            ts: msg.ts,
            user: msg.user,
            user_name: 'Ace OpenClaw',
            text: msg.text,
            reactions: []
          };
        }
      })
    );

    // Filter out messages where user has already reacted
    const unreactedMessages = messagesWithReactions.filter(msg => {
      const userReacted = msg.reactions.some(r => r.hasUserReacted);
      return !userReacted;
    });

    // Clean up reactions data for display (remove hasUserReacted flag)
    const cleanMessages = unreactedMessages.map(msg => ({
      ts: msg.ts,
      user: msg.user,
      user_name: msg.user_name,
      text: msg.text,
      reactions: msg.reactions.map(r => ({
        name: r.name,
        count: r.count
      }))
    }));

    return res.status(200).json({
      success: true,
      messages: cleanMessages,
      total: cleanMessages.length
    });
  } catch (error) {
    console.error('Error fetching messages:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
