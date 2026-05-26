# 🎴 UNO Ultimate

> The ultimate multiplayer UNO experience — play with friends, AI bots, spectators, custom themes, score tracking, sound effects, and emoji reactions. All in your browser.

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy)

## ✨ Features

| Feature | Description |
|---------|-------------|
| 🎮 **Real-time Multiplayer** | 2-10 players with WebSocket sync |
| 🤖 **AI Bots** | Easy, Medium, Hard difficulty bots |
| 👁️ **Spectator Mode** | Watch live games without playing |
| 🎨 **6 Custom Themes** | Classic, Neon, Ocean, Sunset, Forest, Cyberpunk |
| 🏆 **Score Tracking** | Multi-round games with target score (250/500/1000) |
| 🔊 **Sound Effects** | Built-in audio (no files needed) |
| 😂 **Emoji Reactions** | 10 animated emoji reactions |
| 💬 **In-game Chat** | Real-time messaging |
| 📱 **Fully Responsive** | Works on mobile, tablet, desktop |
| 🎯 **Full UNO Rules** | Skip, Reverse, Draw 2, Wild, Wild Draw 4, UNO call |

## 🚀 Deploy to Render (Free)

### Step 1: Push to GitHub

```bash
# Create a new repo on GitHub, then:
git init
git add .
git commit -m "UNO Ultimate v2.0"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/uno-ultimate.git
git push -u origin main
```

### Step 2: Deploy on Render

1. Go to [render.com](https://render.com) and sign up (free)
2. Click **"New +"** → **"Web Service"**
3. Connect your GitHub repo
4. Settings:
   - **Name**: `uno-ultimate`
   - **Runtime**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Plan**: Free
5. Click **Create Web Service**
6. Wait ~2 minutes → Your game is live!

## 🎮 How to Play

### Creating a Game
1. Click **"Create Room"**
2. Enter your name
3. Choose settings (target score, theme, spectators)
4. Share the 6-digit room code with friends

### Joining a Game
1. Click **"Join Room"**
2. Enter the room code + your name
3. Wait for host to start

### Spectating
1. Click **"Spectate Game"**
2. Enter room code
3. Watch all hands live!

### Gameplay
- **Match** color or number with the top card
- **Special cards**: Skip (⏭), Reverse (🔄), Draw 2 (+2)
- **Wild cards**: Choose any color (+4 draws 4)
- **Say UNO** when you have 1 card left (press U or click button)
- **First** to play all cards wins the round
- **Reach target score** to win the game!

### Adding AI Bots
- In lobby, host can add Easy/Medium/Hard bots
- Bots play automatically with smart strategies
- Great for practicing or filling empty seats

### Keyboard Shortcuts
| Key | Action |
|-----|--------|
| `U` | Say UNO |
| `D` | Draw card |
| `ESC` | Close modals |

## 🛠 Tech Stack

- **Backend**: Node.js + Express + Socket.io
- **Frontend**: Vanilla JavaScript + CSS3
- **Real-time**: WebSocket (Socket.io)
- **Audio**: Web Audio API (no external files)
- **Hosting**: Render (Free Tier)

## 📁 Project Structure

```
uno-ultimate/
├── package.json          # Dependencies
├── server.js             # Backend (rooms, game logic, AI bots)
├── README.md             # This file
└── public/
    ├── index.html        # Game UI
    ├── style.css         # Responsive styling + themes
    └── app.js            # Frontend logic
```

## 🎨 Themes

| Theme | Preview |
|-------|---------|
| Classic | Dark blue/purple gradient |
| Neon | Purple cyber gradient |
| Ocean | Blue aquatic gradient |
| Sunset | Warm orange/pink gradient |
| Forest | Green nature gradient |
| Cyberpunk | Black/red tech gradient |

## 📝 License

MIT — Built for fun! Play responsibly.

---

**Made with ❤️ for card game lovers everywhere.**
