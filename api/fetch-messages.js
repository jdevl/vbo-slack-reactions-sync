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
        limit: 100,
      })
    });

    const historyData = await historyRes.json();

    if (!historyData.ok) {
      return res.status(400).json({ error: `Slack API error: ${historyData.error}` });
    }

    const messages = historyData.messages || [];

    // Filter to only Ace OpenClaw (U0ADATUK7MM)
    const aceMessages = messages.filter(m => m.user === 'U0ADATUK7MM');

    // For each Ace message, check reactions via API to see if user has reacted
    const messagesWithReactionCheck = await Promise.all(
      aceMessages.map(async (msg) => {
        try {
          // Use reactions.list to get full reaction data
          const reactionsRes = await fetch('https://slack.com/api/reactions.list', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              channel: channelId,
              ts: msg.ts,
            })
          });

          const reactionsData = await reactionsRes.json();
          let hasUserReacted = false;

          // Check if current user has any reaction on this message
          if (reactionsData.ok && reactionsData.message && reactionsData.message.reactions) {
            hasUserReacted = reactionsData.message.reactions.some(r =>
              r.users && r.users.includes(userId)
            );
          }

          return {
            msg: msg,
            hasUserReacted: hasUserReacted
          };
        } catch (e) {
          console.error(`Error checking reactions for ${msg.ts}:`, e);
          // If reaction check fails, include message anyway
          return {
            msg: msg,
            hasUserReacted: false
          };
        }
      })
    );

    // Filter out messages where user has reacted
    const unreactedMessages = messagesWithReactionCheck
      .filter(item => !item.hasUserReacted)
      .map(item => {
        const msg = item.msg;
        // Preserve original reaction data from message if available
        return {
          ts: msg.ts,
          user: msg.user,
          user_name: 'Ace OpenClaw',
          text: msg.text || '',
          reactions: (msg.reactions || []).map(r => ({
            name: r.name,
            count: r.count || 1
          }))
        };
      });

    return res.status(200).json({
      success: true,
      messages: unreactedMessages,
      total: unreactedMessages.length
    });
  } catch (error) {
    console.error('Error fetching messages:', error);
    return res.status(500).json({ error: `Server error: ${error.message}` });
  }
}
