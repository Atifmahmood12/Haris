# Static multi-site skeleton

This folder contains a small static site skeleton that supports multiple sites under `sites/` and a GitHub Actions workflow to publish any chosen site folder to GitHub Pages.

## How it works

- Put a site in `sites/<site-name>/index.html`.
- Edit `categories.json` to add categories, items and to list sites.
- The site index (`index.html`) will generate a simple list and category boxes from `categories.json`.
- YouTube links in `categories.json` with `embed: true` open an in-site player modal; otherwise they open the external YouTube page.

## Publishing (GitHub Pages)

1. Push to the `main` branch. The workflow `.github/workflows/deploy.yml` will automatically publish the default site `sites/harisatif` to the `gh-pages` branch.
2. To publish a different folder, go to Actions → Deploy selected site, use the **Run workflow** and set `site_path` (for example `sites/another-site`).
3. In GitHub repository Settings → Pages set the source to the `gh-pages` branch (if not done automatically).

## Notes for hosting multiple sites

- This repository is configured to publish a single site (the chosen folder) to GitHub Pages. If you want fully separate URLs for several sites, create one repository per public site or use subpaths/branches and configure a reverse proxy on your domain.
- The workflow can publish any folder inside the repository; that lets you keep multiple site folders but publish one at a time.

## Adding categories and items

- Edit `categories.json`. Each item can set `embed: true` to allow opening the video inside the site.

## Resolving YouTube channels (helper script)

The repository includes a small helper script that can resolve a YouTube channel's uploads playlist id and (optionally) fetch the channel title and avatar using the YouTube Data API.

### Usage examples

- Run the script directly (example):

```bash
node scripts/resolve_youtube_channel.js --channel="https://www.youtube.com/@your-handle" --file=./categories.json --apiKey=YOUR_API_KEY
```

- Or set the API key via environment variable (recommended to avoid exposing the key on the command line):

```bash
export YOUTUBE_API_KEY=YOUR_API_KEY
node scripts/resolve_youtube_channel.js --channel="https://www.youtube.com/@your-handle" --file=./categories.json
```

- There's an npm script shortcut. Run (you can pass flags or use the environment variable):

```bash
# using environment variable
YOUTUBE_API_KEY=YOUR_API_KEY npm run resolve:channel -- --channel="https://www.youtube.com/@your-handle" --file=./categories.json

# or pass the key inline (less secure)
npm run resolve:channel -- --channel="https://www.youtube.com/@your-handle" --file=./categories.json --apiKey=YOUR_API_KEY
```

### Notes

- The script prefers the YouTube Data API when an API key is provided (it will populate `title` and `avatarUrl` from the channel snippet, and the uploads playlist id). If no key is provided or the API call fails, it falls back to scraping the channel page HTML to find the channel id and compute the uploads playlist id.
- The script requires Node >= 18 (uses global fetch). If you have an older Node.js, either upgrade or run with a fetch polyfill.

If you'd like, I can:
- Add more example sites under `sites/`.
- Add small unit tests or an npm build step.
- Wire up a small admin JSON editor page to add categories directly from the browser.
