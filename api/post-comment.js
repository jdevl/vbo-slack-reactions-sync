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
    // Convert @name mentions in the comment to real Slack <@USERID> tags
    const processedText = await resolveMentions(text, token);

    const response = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        channel: channelId,
        thread_ts: threadTs,
        text: processedText
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

async function resolveMentions(text, token) {
  // Find all @word patterns in the text
  const mentionPattern = /@(\w+)/g;
  const mentions = [...text.matchAll(mentionPattern)];

  if (mentions.length === 0) {
    return text;
  }

  try {
    // Fetch the full user list from Slack
    const usersRes = await fetch('https://slack.com/api/users.list', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      }
    });

    const usersData = await usersRes.json();

    if (!usersData.ok || !usersData.members) {
      console.error('Failed to fetch users list:', usersData.error);
      return text;
    }

    let processedText = text;

    // For each unique mention, try to find a matching user
    const uniqueMentions = [...new Set(mentions.map(m => m[1].toLowerCase()))];

    for (const mentionName of uniqueMentions) {
      const matchedUser = usersData.members.find(user => {
        if (user.deleted || user.is_bot) return false;
        const displayName = (user.profile?.display_name || '').toLowerCase();
        const realName = (user.profile?.real_name || user.real_name || '').toLowerCase();
        const firstName = realName.split(' ')[0];
        const username = (user.name || '').toLowerCase();

        return displayName === mentionName ||
               displayName.startsWith(mentionName) ||
               firstName === mentionName ||
               username === mentionName;
      });

      if (matchedUser) {
        // Replace @name with <@USERID> (case-insensitive, word boundary)
        const regex = new RegExp(`@${mentionName}\\b`, 'gi');
        processedText = processedText.replace(regex, `<@${matchedUser.id}>`);
      }
    }

    return processedText;
  } catch (e) {
    console.error('Error resolving mentions:', e);
    return text;
  }
}
