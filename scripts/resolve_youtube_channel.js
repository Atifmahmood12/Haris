#!/usr/bin/env node
/**
 * resolve_youtube_channel.js
 *
 * Usage:
 *   node scripts/resolve_youtube_channel.js --channel="https://www.youtube.com/@progamer-sub" --file=./categories.json
 *
 * This script fetches the channel page HTML, extracts the channel ID (UC...)
 * and then computes the uploads playlist id (UU...)
 * It updates the first matching channel item in categories.json (matching by URL or title)
 * by adding a `playlist` property with the uploads playlist id (or `embedUrl`).
 *
 * NOTE: This fetch runs from your machine and doesn't require YouTube API keys.
 * It depends on being able to reach youtube.com from the machine where you run it.
 */

const fs = require('fs');
const path = require('path');

async function main(){
  const argv = process.argv.slice(2);
  const opts = {};
  argv.forEach(a=>{
    const m = a.match(/^--([a-zA-Z0-9_-]+)=(.*)$/);
    if(m) opts[m[1]] = m[2];
  });
  if(!opts.channel || !opts.file){
    console.log('Usage: node scripts/resolve_youtube_channel.js --channel="https://www.youtube.com/@progamer-sub" --file=./categories.json [--apiKey=YOUR_KEY]');
    console.log('You can also set the environment variable YOUTUBE_API_KEY instead of passing --apiKey.');
    process.exit(1);
  }
  const channelUrl = opts.channel;
  const jsonPath = path.resolve(opts.file);
  if(!fs.existsSync(jsonPath)){
    console.error('categories.json not found at', jsonPath);
    process.exit(2);
  }

  console.log('Fetching channel page:', channelUrl);
  // If an API key is provided, prefer using the YouTube Data API v3 to fetch
  // channel snippet (title, thumbnails) and uploads playlist id.
  // Accept api key via CLI flag (--apiKey) or environment variable YOUTUBE_API_KEY
  const apiKey = opts.apiKey || opts.apikey || opts.key || process.env.YOUTUBE_API_KEY || process.env.YT_API_KEY;
  // helper to ensure global fetch exists (Node >=18)
  if(typeof fetch !== 'function'){
    console.error('This script requires Node >= 18 (global fetch).');
    console.error('Alternatively, install node-fetch and run with a compatible Node version.');
    process.exit(3);
  }

  // parse the provided channel URL to inspect for /channel/UC... or /user/ or /@handle
  let parsedUrl = null;
  try{ parsedUrl = new URL(channelUrl); }catch(e){ console.error('Invalid channel URL:', channelUrl); process.exit(4); }

  // helpers for updating JSON later
  let apiChannelId = null;
  let apiTitle = null;
  let apiThumbnails = null;
  let uploadsPlaylist = null;

  if(apiKey){
    console.log('Using YouTube Data API with provided API key to resolve channel.');
    // If URL contains /channel/{id}, we already have channel id.
    const p = parsedUrl.pathname.replace(/\/+$/,'');
    const segs = p.split('/').filter(Boolean);
    let possibleId = null;
    let possibleUser = null;
    let possibleHandle = null;
    if(segs[0] === 'channel' && segs[1]) possibleId = segs[1];
    if(segs[0] === 'user' && segs[1]) possibleUser = segs[1];
    // handle forms like /@handle or /@handle/whatever
    if(segs[0] && segs[0].startsWith('@')) possibleHandle = segs[0].slice(1);

    // function to fetch channel by id
    async function fetchChannelById(id){
      const url = `https://www.googleapis.com/youtube/v3/channels?part=snippet,contentDetails&id=${encodeURIComponent(id)}&key=${encodeURIComponent(apiKey)}`;
      const res = await fetch(url);
      if(!res.ok) throw new Error('API channels by id request failed: ' + res.status + ' ' + res.statusText);
      return await res.json();
    }

    // function to fetch channel by username (legacy)
    async function fetchChannelByUsername(username){
      const url = `https://www.googleapis.com/youtube/v3/channels?part=snippet,contentDetails&forUsername=${encodeURIComponent(username)}&key=${encodeURIComponent(apiKey)}`;
      const res = await fetch(url);
      if(!res.ok) throw new Error('API channels by username request failed: ' + res.status + ' ' + res.statusText);
      return await res.json();
    }

    // function to search for channel by query (useful for @handles)
    async function searchChannel(q){
      const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&q=${encodeURIComponent(q)}&key=${encodeURIComponent(apiKey)}&maxResults=1`;
      const res = await fetch(url);
      if(!res.ok) throw new Error('API search request failed: ' + res.status + ' ' + res.statusText);
      return await res.json();
    }

    try{
      let apiRes = null;
      if(possibleId){
        apiRes = await fetchChannelById(possibleId);
      } else if(possibleUser){
        apiRes = await fetchChannelByUsername(possibleUser);
        // if that didn't return items, fall back to search
        if(apiRes && Array.isArray(apiRes.items) && apiRes.items.length === 0){ apiRes = null; }
      }
      if(!apiRes && possibleHandle){
        const s = await searchChannel(possibleHandle);
        if(s && Array.isArray(s.items) && s.items[0] && s.items[0].id && s.items[0].id.channelId){
          apiChannelId = s.items[0].id.channelId;
          apiRes = await fetchChannelById(apiChannelId);
        }
      }
      // As a last resort, if none of the above worked, try searching the hostname+path as query
      if(!apiRes){
        const fallbackQ = parsedUrl.pathname.replace(/\/+$/,'');
        const s2 = await searchChannel(fallbackQ || parsedUrl.hostname);
        if(s2 && Array.isArray(s2.items) && s2.items[0] && s2.items[0].id && s2.items[0].id.channelId){
          apiChannelId = s2.items[0].id.channelId;
          apiRes = await fetchChannelById(apiChannelId);
        }
      }

      if(apiRes && Array.isArray(apiRes.items) && apiRes.items[0]){
        const it = apiRes.items[0];
        apiChannelId = it.id || apiChannelId;
        apiTitle = it.snippet && it.snippet.title;
        apiThumbnails = it.snippet && it.snippet.thumbnails;
        if(it.contentDetails && it.contentDetails.relatedPlaylists && it.contentDetails.relatedPlaylists.uploads){
          uploadsPlaylist = it.contentDetails.relatedPlaylists.uploads;
        }
        console.log('Resolved via API: channelId=', apiChannelId, 'title=', apiTitle);
      } else {
        console.warn('YouTube Data API did not return a channel. Falling back to HTML scraping.');
      }
    }catch(e){
      console.error('YouTube Data API error:', e.message || e);
      console.error('Falling back to HTML scraping.');
    }
  }

  // If uploadsPlaylist wasn't determined via API, fall back to HTML scraping (existing code)
  if(!uploadsPlaylist){
    console.log('Fetching channel page HTML to locate channelId (fallback)...');
    let html;
    try{
      const res = await fetch(channelUrl, {headers: { 'User-Agent': 'node.js' }});
      html = await res.text();
    }catch(e){
      console.error('Failed to fetch channel URL:', e.message || e);
      process.exit(4);
    }

    // Try to find the channelId in the HTML
    // Patterns: "channelId":"UCxxxxx" or "externalId":"UCxxxxx"
    const idMatch = html.match(/"channelId"\s*:\s*"(UC[^"]+)"/) || html.match(/"externalId"\s*:\s*"(UC[^"]+)"/);
    if(!idMatch){
      console.error('Could not find channelId in channel page HTML. YouTube layout may have changed.');
      // continue, we may still have apiChannelId from earlier search
    } else {
      const channelId = idMatch[1];
      console.log('Found channelId in HTML:', channelId);
      // uploads playlist id is usually 'UU' + channelId.slice(2) when channelId starts with 'UC'
      if(channelId && channelId.startsWith('UC')){
        uploadsPlaylist = 'UU' + channelId.slice(2);
        console.log('Computed uploads playlist id:', uploadsPlaylist);
      }
      // if we didn't have apiChannelId, set it
      if(!apiChannelId) apiChannelId = channelId;
    }
  }

  // Load categories.json and find the matching channel item.
  const jsonText = fs.readFileSync(jsonPath,'utf8');
  let data;
  try{ data = JSON.parse(jsonText); }catch(e){ console.error('Failed to parse JSON:', e.message); process.exit(6); }

  let updated = false;
  const wantUrl = normalizeUrl(channelUrl);
  if(Array.isArray(data.categories)){
    for(const cat of data.categories){
      if(!Array.isArray(cat.items)) continue;
      for(const it of cat.items){
        if(it.type !== 'channel') continue;
        // match by URL or by title containing 'ProGamer' or by site
        if(it.url && normalizeUrl(it.url) === wantUrl){
          if(apiTitle) it.title = apiTitle;
          if(apiThumbnails){
            // prefer high then medium then default
            it.avatarUrl = (apiThumbnails.high && apiThumbnails.high.url) || (apiThumbnails.medium && apiThumbnails.medium.url) || (apiThumbnails.default && apiThumbnails.default.url) || it.avatarUrl;
          }
          if(uploadsPlaylist){ it.playlist = uploadsPlaylist; updated = true; }
          // also add embedUrl to be safe (playlist embed)
          if(uploadsPlaylist) it.embedUrl = 'https://www.youtube.com/embed?listType=playlist&list=' + uploadsPlaylist;
        }
        // fallback: if title mentions progamer and no url match, update that first channel we find
        if(!updated && it.title && /progamer/i.test(it.title)){
          if(apiTitle) it.title = apiTitle;
          if(apiThumbnails){
            it.avatarUrl = (apiThumbnails.high && apiThumbnails.high.url) || (apiThumbnails.medium && apiThumbnails.medium.url) || (apiThumbnails.default && apiThumbnails.default.url) || it.avatarUrl;
          }
          if(uploadsPlaylist){ it.playlist = uploadsPlaylist; it.embedUrl = 'https://www.youtube.com/embed?listType=playlist&list=' + uploadsPlaylist; updated = true; }
        }
        if(updated) break;
      }
      if(updated) break;
    }
  }

  if(!updated){
    console.log('No matching channel item found to update in categories.json. Will append a new channel item under the first category.');
    if(!Array.isArray(data.categories)) data.categories = [];
    if(data.categories.length === 0) data.categories.push({ id: 'channels', title: 'Channels', items: [] });
    if(!Array.isArray(data.categories[0].items)) data.categories[0].items = [];
    const newItem = { title: apiTitle || 'ProGamer channel', url: channelUrl, embed: false, type: 'channel', site: 'harisatif' };
    if(apiThumbnails){
      newItem.avatarUrl = (apiThumbnails.high && apiThumbnails.high.url) || (apiThumbnails.medium && apiThumbnails.medium.url) || (apiThumbnails.default && apiThumbnails.default.url);
    }
    if(uploadsPlaylist){ newItem.playlist = uploadsPlaylist; newItem.embedUrl = 'https://www.youtube.com/embed?listType=playlist&list=' + uploadsPlaylist; }
    data.categories[0].items.push(newItem);
    updated = true;
  }

  if(updated){
    fs.writeFileSync(jsonPath, JSON.stringify(data, null, 2), 'utf8');
    console.log('Updated', jsonPath, 'with playlist/embedUrl. You can now reload your site.');
    process.exit(0);
  }else{
    console.log('Nothing updated.');
    process.exit(7);
  }
}

function normalizeUrl(u){
  try{ const x = new URL(u); return x.origin + x.pathname.replace(/\/+$/,''); }catch(e){ return u.replace(/\/+$/,''); }
}

main();
