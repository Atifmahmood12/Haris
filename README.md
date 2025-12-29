# Static multi-site skeleton

This folder contains a small static site skeleton that supports multiple sites under `sites/` and a GitHub Actions workflow to publish any chosen site folder to GitHub Pages.

How it works
- Put a site in `sites/<site-name>/index.html`.
- Edit `categories.json` to add categories, items and to list sites.
- The site index (`index.html`) will generate a simple list and category boxes from `categories.json`.
- YouTube links in `categories.json` with `embed: true` open an in-site player modal; otherwise they open the external YouTube page.

Publishing (GitHub Pages)
1. Push to the `main` branch. The workflow `.github/workflows/deploy.yml` will automatically publish the default site `sites/harisatif` to the `gh-pages` branch.
2. To publish a different folder, go to Actions → Deploy selected site, use the **Run workflow** and set `site_path` (for example `sites/another-site`).
3. In GitHub repository Settings → Pages set the source to the `gh-pages` branch (if not done automatically).

Notes for hosting multiple sites
- This repository is configured to publish a single site (the chosen folder) to GitHub Pages. If you want fully separate URLs for several sites, create one repository per public site or use subpaths/branches and configure a reverse proxy on your domain.
- The workflow can publish any folder inside the repository; that lets you keep multiple site folders but publish one at a time.

Adding categories and items
- Edit `categories.json`. Each item can set `embed: true` to allow opening the video inside the site.

If you'd like, I can:
- Add more example sites under `sites/`.
- Add small unit tests or an npm build step.
- Wire up a small admin JSON editor page to add categories directly from the browser.
