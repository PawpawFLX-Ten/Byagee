[English] | [[简体中文](./README_zh.md)]

# Game Intro
Human beings are under serious threat of Byagee mouth. When spicies chew yet with their lips open, nuclear noise would evaporate all lives' blood from the heart.

You act as the man of justice, trying to fight against this endless noise. Your goal is to maintain social order and peace amongst public space - but new Byagee mouther still occur occasionally. You have to fight hard and make sure your lips are shut during chewing.

Be mad! Fight Hard

# Deployment

This folder contains the pre-built static files for Civic Man. No backend, no server-side logic — just upload these files to any static host.

## Files

```
Deployment/
├── index.html          # Entry point
├── manifest.json       # PWA manifest
├── favicon.svg         # Favicon
├── icons.svg           # Icon sprites
└── assets/
    ├── index-*.css     # Compiled styles
    └── index-*.js      # Compiled game (Three.js + React + Zustand)
```

All paths are relative (`./`) — works at domain root or any subdirectory.

## Quick Deploy

### Any static file server

```bash
cd Deployment
npx serve .
# or
python -m http.server 8080
```

### Nginx

```nginx
location /civic-man/ {
    alias /var/www/civic-man/;
    try_files $uri $uri/ /civic-man/index.html;
}
```

### Cloudflare Pages / Netlify / Vercel

Upload the `Deployment/` folder as the site root. No build command needed.

### Docker

```dockerfile
FROM nginx:alpine
COPY . /usr/share/nginx/html
```

## Requirements

- HTTPS (for browser TTS `speechSynthesis` API on some browsers)
- Modern browser with WebGL support
- No database, no API keys, no environment variables

## PWA

The game includes a `manifest.json` — users can "Add to Home Screen" on mobile or "Install" on desktop Chrome/Edge for an app-like experience.
