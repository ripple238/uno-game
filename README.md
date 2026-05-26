# 🎴 UNO Multiplayer

A full-featured, real-time multiplayer UNO game built with Node.js, Socket.io, and vanilla JavaScript. Deploy it to **Render.com** for free and play with friends anywhere.

![UNO Game](https://i.imgur.com/placeholder.png)

## ✨ Features

- 🎮 **Real-time Multiplayer** — Play with friends via room codes
- 🤖 **AI Bots** — Add bots to fill seats or practice solo
- 🏆 **Score Tracking** — Multi-round matches with target score (200/500/1000)
- 🎨 **Custom Card Themes** — Classic, Neon, Dark, Ocean, Nature
- 👁 **Spectator Mode** — Watch live games after they start
- 🔊 **Sound Effects & Music** — Procedural audio for every action
- 😂 **Emoji Reactions** — Float reactions over the table
- 💬 **In-Game Chat** — Talk smack between turns
- ⏱ **Turn Timer** — Auto-draw if you AFK (no more stuck turns!)
- 📱 **Fully Responsive** — Desktop, tablet, and mobile layouts
- 🔄 **Smart Turn Logic** — Server-authoritative, bug-free rotation

## 🚀 Quick Deploy to Render.com

### 1. Push to GitHub

Create a new repository and push these files:

```bash
git init
git add .
git commit -m "Initial UNO game"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/uno-multiplayer.git
git push -u origin main
```

### 2. Deploy on Render

1. Go to [render.com](https://render.com) and sign in
2. Click **New +** → **Web Service**
3. Connect your GitHub repo
4. Use these settings:
   - **Name:** `uno-multiplayer`
   - **Runtime:** `Node`
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Plan:** Free
5. Click **Create Web Service**

Render will give you a URL like `https://uno-multiplayer.onrender.com`. Share it with friends!

> ⚠️ Free tier spins down after 15 min of inactivity. First load may take 30s to wake up.

## 🖥 Local Development

```bash
npm install
npm start
```

Open `http://localhost:3000`

## 🎮 How to Play

1. **Create Room** → Set your name and rules
2. **Share Code** → Friends click "Join Room" and enter the 6-character code
3. **Add Bots** (optional) → Click "+ Add Bot" to fill empty seats
4. **Start Game** → Host clicks "Start Game"
5. **Match color or number** to play cards
6. **Press UNO** (button or `U` key) when you have 1 card left!
7. **First to empty hand** wins the round and scores opponent cards

### Special Cards
| Card | Effect |
|------|--------|
| Skip | Next player loses turn |
| Reverse | Switches direction |
| +2 | Next player draws 2 (stackable) |
| Wild | Pick any color |
| Wild +4 | Pick color + next draws 4 (stackable) |

### Keyboard Shortcuts
- `U` — Say UNO
- `D` — Draw card
- `Esc` — Close overlays

## 🛠 Tech Stack

- **Backend:** Node.js + Express + Socket.io
- **Frontend:** Vanilla JS + CSS Grid/Flexbox
- **Audio:** Web Audio API (no external assets!)
- **Cards:** Pure CSS/SVG (no image downloads needed)
- **Hosting:** Render.com (free tier)

## 📝 File Structure

```
uno-multiplayer/
├── server.js          # Game logic, rooms, WebSocket events
├── package.json       # Dependencies
├── public/
│   ├── index.html     # Game UI structure
│   ├── css/
│   │   └── style.css  # Styling + themes + responsive
│   └── js/
│       └── client.js  # Frontend game engine
└── README.md
```

## 🐛 Bug Fixes Included

- **Stuck turns** → Server-side turn timer auto-draws after 30s
- **Wrong player turn** → Strict server-authoritative turn state; clients only enable controls on `turnStarted` event
- **Bot desync** → Bots run entirely server-side; clients see "Bot is thinking..."
- **Card desync** → All plays validated server-side before broadcast

## 🎨 Themes

Switch themes in Settings or lobby:
- **Classic** — Traditional UNO colors
- **Neon** — Glowing cyberpunk palette
- **Dark** — High contrast midnight
- **Ocean** — Cyan & teal vibes
- **Nature** — Earthy greens & browns

## 📄 License

MIT — Build your own card game empire!
