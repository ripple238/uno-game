# UNO Online v2.0

Beautiful circular-table UNO game. Deploy to Render.com for free.

## Features
- Real-time multiplayer (up to 10 players)
- AI bots for practice
- Spectator mode
- Score tracking across rounds (first to 500 wins)
- 3 card themes (Classic, Modern, Dark)
- Full sound effects + ambient music
- Emoji reactions
- Live chat
- Responsive design (desktop + mobile)
- **Bug-free**: Server-side turn locking prevents stuck turns and double plays

## Deploy to Render.com

1. **Push to GitHub**
```bash
git init
git add .
git commit -m "UNO v2"
git remote add origin https://github.com/YOURNAME/uno-game.git
git push -u origin main
```

2. **Create Web Service on Render**
- Go to render.com → New + → Web Service
- Connect your GitHub repo
- Settings:
  - Runtime: Node
  - Build: `npm install`
  - Start: `npm start`
  - Plan: Free
- Click Create Web Service
- Wait 2 minutes, then play at your URL

## Local Development
```bash
npm install
npm start
# Open http://localhost:3000
```

## Controls
- Click card to play
- Click deck to draw
- Space = Draw
- U = UNO
- Enter = Send chat
