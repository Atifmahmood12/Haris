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
    console.log('Usage: node scripts/resolve_youtube_channel.js --channel="https://www.youtube.com/@progamer-sub" --file=./categories.json');
    process.exit(1);
  }
  const channelUrl = opts.channel;
  const jsonPath = path.resolve(opts.file);
  if(!fs.existsSync(jsonPath)){
    console.error('categories.json not found at', jsonPath);
    process.exit(2);
  }

  console.log('Fetching channel page:', channelUrl);
  // global fetch is available in Node 18+. We'll try to use it; if not available, advise user.
  if(typeof fetch !== 'function'){
    console.error('This script requires Node >= 18 (global fetch).');
    console.error('Alternatively, install node-fetch and modify the script.');
    process.exit(3);
  }

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
    process.exit(5);
  }
  const channelId = idMatch[1];
  console.log('Found channelId:', channelId);

  // uploads playlist id is usually 'UU' + channelId.slice(2) when channelId starts with 'UC'
  let uploadsPlaylist = null;
  if(channelId && channelId.startsWith('UC')){
    uploadsPlaylist = 'UU' + channelId.slice(2);
    console.log('Computed uploads playlist id:', uploadsPlaylist);
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
          if(uploadsPlaylist){ it.playlist = uploadsPlaylist; updated = true; }
          // also add embedUrl to be safe (playlist embed)
          if(uploadsPlaylist) it.embedUrl = 'https://www.youtube.com/embed?listType=playlist&list=' + uploadsPlaylist;
        }
        // fallback: if title mentions progamer and no url match, update that first channel we find
        if(!updated && it.title && /progamer/i.test(it.title)){
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
    const newItem = { title: 'ProGamer channel', url: channelUrl, embed: false, type: 'channel', site: 'harisatif' };
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
