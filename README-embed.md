Embedding YouTube channel on the homepage

This project includes a tiny helper script to resolve a YouTube channel handle (like https://www.youtube.com/@progamer-sub) into an uploads playlist ID and add an embeddable playlist URL into `categories.json`.

Why this is needed
- YouTube channel handles/pages usually cannot be embedded directly due to X-Frame-Options.
- The reliable approach is embedding a playlist (the channel uploads playlist) or a specific video using the `/embed` endpoint.
- The helper script fetches the public channel page and extracts the channel ID (no API key required). It then computes the uploads playlist id and updates `categories.json` with `playlist` and `embedUrl` properties for the channel item.

How to run (on your machine)
- Requires Node.js >= 18 (so that `fetch` is available globally). If you have older Node, install Node 18+ or modify the script to use `node-fetch`.

From project root:

```bash
node scripts/resolve_youtube_channel.js --channel="https://www.youtube.com/@progamer-sub" --file=./categories.json
```

What it does
- Fetches the channel page HTML and extracts the channelId (UC...)
- Computes uploads playlist id: `UU` + channelId.slice(2)
- Updates the existing matching channel item in `categories.json` (matching by URL or by title containing "progamer").
- Adds `playlist` and `embedUrl` fields to the item. Example:

{
  "title": "ProGamer channel",
  "url": "https://www.youtube.com/@progamer-sub",
  "embed": false,
  "site": "harisatif",
  "type": "channel",
  "playlist": "PLxxxxxxxx",
  "embedUrl": "https://www.youtube.com/embed?listType=playlist&list=PLxxxxxxxx"
}

After running
- Reload your site (or click the Reload button) and the homepage should inject an embeddable YouTube iframe for the channel's uploads.

If you prefer not to run the script
- You can manually add a `playlist` or `embedUrl` property to the channel item in `categories.json`.
- Example playlist embedUrl (replace PL... with the playlist id):
  "embedUrl": "https://www.youtube.com/embed?listType=playlist&list=PL..."

Security & notes
- The script fetches public YouTube HTML and parses it locally; it does not require or send any API key.
- YouTube HTML layout might change; if the script fails to find a channelId, let me know and I can update the parser or offer an API-key-based alternative.
