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
    console.log(`[fetch-messages] Total messages from history: ${messages.length}`);

    // Filter to only Ace OpenClaw (U0ADATUK7MM)
    const aceMessages = messages.filter(m => {
      const isAce = m.user === 'U0ADATUK7MM';
      if (!isAce && messages.length <= 10) {
        console.log(`[fetch-messages] Non-Ace user: ${m.user}`);
      }
      return isAce;
    });
    console.log(`[fetch-messages] Ace OpenClaw messages: ${aceMessages.length}`);

    // For each Ace message, check if user has reacted based on message reactions
    const messagesWithReactionCheck = aceMessages.map((msg) => {
      // Check message's reactions directly from the message object
      let hasUserReacted = false;

      if (msg.reactions && Array.isArray(msg.reactions)) {
        hasUserReacted = msg.reactions.some(r =>
          r.users && Array.isArray(r.users) && r.users.includes(userId)
        );
      }

      return {
        msg: msg,
        hasUserReacted: hasUserReacted
      };
    });

    // Filter out messages where user has reacted
    const reacted = messagesWithReactionCheck.filter(item => item.hasUserReacted).length;
    const unreacted = messagesWithReactionCheck.filter(item => !item.hasUserReacted).length;
    console.log(`[fetch-messages] Messages with user reaction: ${reacted}, without: ${unreacted}`);

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
      total: unreactedMessages.length,
      debug: {
        totalFetched: messages.length,
        aceMessages: aceMessages.length,
        checkedReactions: messagesWithReactionCheck.length,
        hasUserReacted: reacted,
        unreacted: unreacted
      }
    });
  } catch (error) {
    console.error('Error fetching messages:', error);
    return res.status(500).json({ error: `Server error: ${error.message}` });
  }
}
