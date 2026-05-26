# 🔥 UNO Online - Full-Featured Multiplayer Card Game

A complete, responsive, real-time multiplayer UNO game built with Node.js, Express, Socket.IO, and vanilla JavaScript. Deploy to Render.com for free hosting.

## ✨ Features

### Core Gameplay
- ✅ **Real-time multiplayer** - Play with friends anywhere
- ✅ **AI Bots** - Practice against smart computer opponents
- ✅ **Spectator Mode** - Watch games live without playing
- ✅ **Score Tracking** - Points accumulate across multiple rounds
- ✅ **Winning Condition** - First to 500 points wins the match

### Interactive Experience
- ✅ **Sound Effects** - Every action has unique audio feedback
  - Card selection, play, draw sounds
  - Special sounds for Skip, Reverse, +2, Wild, Wild+4
  - UNO call sound, win/lose fanfares
  - Background ambient music (toggleable)
- ✅ **Animations** - Smooth card movements, floating particles, confetti
- ✅ **Emoji Reactions** - Send floating emojis during gameplay
- ✅ **Live Chat** - Talk with other players and spectators

### Customization
- ✅ **4 Card Themes** - Classic, Neon Glow, Dark Mode, Minimal
- ✅ **Game Settings** - Stack +2, max players, bot count
- ✅ **Responsive Design** - Works on desktop, tablet, and mobile

### Bug Fixes & Reliability
- ✅ **Server-side turn validation** - Prevents stuck turns and double plays
- ✅ **Turn locking** - Eliminates race conditions
- ✅ **Auto-reconnection** - Rejoins room if connection drops
- ✅ **State synchronization** - All clients see identical game state

## 🚀 Quick Deploy to Render.com

### Step 1: Push to GitHub
1. Create a new GitHub repository
2. Upload all files from this project:
   ```
   uno-game/
   ├── server.js
   ├── package.json
   ├── .gitignore
   ├── README.md
   └── public/
       ├── index.html
       ├── game.html
       ├── css/
       │   └── style.css
       └── js/
           ├── main.js
           ├── game.js
           ├── sounds.js
           └── animations.js
   ```
3. Commit and push

### Step 2: Deploy on Render
1. Go to [render.com](https://render.com) and sign up/login
2. Click **"New +"** → **"Web Service"**
3. Connect your GitHub repository
4. Configure:
   - **Name**: `uno-game` (or whatever you want)
   - **Runtime**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Plan**: Free
5. Click **"Create Web Service"**
6. Wait for deployment (~2 minutes)
7. Your game will be live at `https://uno-game.onrender.com` (or your chosen name)

### Step 3: Share & Play
- Share the Render URL with friends
- Create a room, copy the room code
- Friends join with the code
- Have fun! 🎉

## 🎮 How to Play

1. **Create Room** - Set your name, choose settings, get a room code
2. **Invite Friends** - Share the 6-digit room code
3. **Start Game** - Host clicks "Start Game" when everyone is ready
4. **Play Cards** - Click cards on your turn, match color or number
5. **Special Cards**:
   - **Skip** (⊘) - Next player loses turn
   - **Reverse** (⇄) - Changes direction
   - **+2** - Next player draws 2 cards
   - **Wild** (★) - Change color
   - **Wild +4** (+4) - Change color + next player draws 4
6. **Say UNO!** - Press the UNO button when you have 1 card left
7. **Win Rounds** - Empty your hand to win the round and collect points

## 🎯 Controls

- **Click card** - Play it (if valid)
- **Draw pile / Draw button** - Draw a card
- **UNO button** - Call UNO when you have 1 card
- **Spacebar** - Quick draw
- **U key** - Quick UNO
- **Enter** - Send chat message

## 🛠️ Local Development

```bash
# Clone the repo
git clone <your-repo-url>
cd uno-game

# Install dependencies
npm install

# Run locally
npm run dev

# Open http://localhost:3000
```

## 📁 Project Structure

```
├── server.js          # Main server - game logic, rooms, Socket.IO
├── package.json       # Dependencies
├── public/
│   ├── index.html     # Lobby - create/join rooms
│   ├── game.html      # Game interface
│   ├── css/
│   │   └── style.css  # All styles + animations + responsive
│   └── js/
│       ├── main.js    # Lobby logic
│       ├── game.js    # Game interface logic
│       ├── sounds.js  # Web Audio API sound engine
│       └── animations.js # Animation helpers
```

## 🔧 Tech Stack

- **Backend**: Node.js, Express, Socket.IO
- **Frontend**: Vanilla JavaScript, CSS3, HTML5
- **Real-time**: WebSockets via Socket.IO
- **Audio**: Web Audio API (no external files needed)
- **Styling**: CSS Grid, Flexbox, CSS Animations, Backdrop Filter
- **Deployment**: Render.com (free tier)

## 🐛 Troubleshooting

**Game gets stuck?**
- Server-side turn locking prevents this. If it happens, refresh the page to reconnect.

**Can't hear sounds?**
- Click anywhere on the page first (browser requires user interaction for audio)
- Check the 🔊 button in the top right

**Mobile issues?**
- Use in landscape mode for best experience
- Tap cards firmly to select

**Bots not moving?**
- Bots have a 1.5-2.5 second delay to feel natural
- If stuck, the host can refresh to restart

## 📜 License

MIT License - Feel free to modify and share!

---

Made with ❤️ for playing UNO with friends online.
