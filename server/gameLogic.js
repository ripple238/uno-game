const COLORS = ['Red', 'Yellow', 'Green', 'Blue'];
const VALUES = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'Skip', 'Reverse', 'Draw 2'];
const WILD_VALUES = ['Wild', 'Wild Draw 4'];

function createDeck() {
  let deck = [];
  for (let color of COLORS) {
    deck.push({ color, value: '0' });
    for (let i = 1; i <= 9; i++) {
      deck.push({ color, value: i.toString() });
      deck.push({ color, value: i.toString() });
    }
    deck.push({ color, value: 'Skip' });
    deck.push({ color, value: 'Skip' });
    deck.push({ color, value: 'Reverse' });
    deck.push({ color, value: 'Reverse' });
    deck.push({ color, value: 'Draw 2' });
    deck.push({ color, value: 'Draw 2' });
  }
  for (let i = 0; i < 4; i++) {
    deck.push({ color: 'Black', value: 'Wild' });
    deck.push({ color: 'Black', value: 'Wild Draw 4' });
  }
  return deck;
}

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

export class UnoGame {
  constructor(roomCode, io, theme) {
    this.roomCode = roomCode;
    this.io = io;
    this.theme = theme || 'classic';
    this.players = []; // { id, name, avatar, isBot, hand: [], score: 0, status: 'playing' | 'won' }
    this.spectators = [];
    this.gameState = 'waiting'; // waiting, playing, finished
    this.deck = [];
    this.discardPile = [];
    this.currentTurnIndex = 0;
    this.direction = 1; // 1 for clockwise, -1 for counter-clockwise
    this.currentColor = ''; // Useful for wilds
    this.roundNumber = 1;
  }

  addPlayer(id, name, avatar, isBot) {
    if (this.gameState !== 'waiting') return false;
    if (this.players.find(p => p.id === id)) return false;
    this.players.push({ id, name, avatar, isBot, hand: [], score: 0, status: 'playing' });
    return true;
  }

  addSpectator(id, name) {
    if (this.spectators.find(s => s.id === id)) return false;
    this.spectators.push({ id, name });
    return true;
  }

  removePlayer(id) {
    const pIndex = this.players.findIndex(p => p.id === id);
    if (pIndex !== -1) {
      if (this.gameState === 'playing') {
        // Return their cards to deck and shuffle
        this.deck.push(...this.players[pIndex].hand);
        shuffle(this.deck);
      }
      this.players.splice(pIndex, 1);
      
      // Fix turn index if necessary
      if (this.currentTurnIndex >= this.players.length) {
        this.currentTurnIndex = 0;
      }

      this.checkEndConditions();
      return true;
    }
    const sIndex = this.spectators.findIndex(s => s.id === id);
    if (sIndex !== -1) {
      this.spectators.splice(sIndex, 1);
      return true;
    }
    return false;
  }

  startGame() {
    this.gameState = 'playing';
    this.deck = createDeck();
    shuffle(this.deck);
    this.discardPile = [];
    
    // Reset players for new round
    this.players.forEach(p => {
      p.hand = [];
      p.status = 'playing';
    });

    // Deal 7 cards each
    for (let i = 0; i < 7; i++) {
      for (let p of this.players) {
        p.hand.push(this.drawFromDeck());
      }
    }

    // First card
    let firstCard = this.drawFromDeck();
    while (firstCard.color === 'Black' || firstCard.value === 'Skip' || firstCard.value === 'Reverse' || firstCard.value === 'Draw 2') {
      this.deck.push(firstCard);
      shuffle(this.deck);
      firstCard = this.drawFromDeck();
    }
    this.discardPile.push(firstCard);
    this.currentColor = firstCard.color;
    this.currentTurnIndex = Math.floor(Math.random() * this.players.length);
    this.direction = 1;

    this.broadcastGameState();
    this.checkBotTurn();
  }

  drawFromDeck() {
    if (this.deck.length === 0) {
      const topCard = this.discardPile.pop();
      this.deck = [...this.discardPile];
      this.discardPile = [topCard];
      shuffle(this.deck);
    }
    if (this.deck.length === 0) return null; // Edge case
    return this.deck.pop();
  }

  nextTurn() {
    let loopCount = 0;
    do {
      this.currentTurnIndex = (this.currentTurnIndex + this.direction + this.players.length) % this.players.length;
      loopCount++;
    } while (this.players[this.currentTurnIndex].status !== 'playing' && loopCount < this.players.length + 1);
    
    this.checkBotTurn();
  }

  isValidPlay(card) {
    const topCard = this.discardPile[this.discardPile.length - 1];
    return card.color === 'Black' || 
           card.color === this.currentColor || 
           card.value === topCard.value;
  }

  playCard(playerId, cardIndex, chosenColor) {
    if (this.gameState !== 'playing') return;
    const player = this.players[this.currentTurnIndex];
    if (player.id !== playerId) return; // Not their turn

    const card = player.hand[cardIndex];
    if (!card || !this.isValidPlay(card)) return;

    // Remove card from hand
    player.hand.splice(cardIndex, 1);
    this.discardPile.push(card);

    if (card.color === 'Black') {
      this.currentColor = chosenColor || COLORS[Math.floor(Math.random() * 4)];
    } else {
      this.currentColor = card.color;
    }

    let skipNext = false;
    if (card.value === 'Skip') {
      skipNext = true;
    } else if (card.value === 'Reverse') {
      this.direction *= -1;
      if (this.players.filter(p => p.status === 'playing').length === 2) {
        skipNext = true; // Reverse acts as skip in 2 player
      }
    } else if (card.value === 'Draw 2') {
      skipNext = true;
      this.drawCardsToNextPlayer(2);
    } else if (card.value === 'Wild Draw 4') {
      skipNext = true;
      this.drawCardsToNextPlayer(4);
    }

    this.io.to(this.roomCode).emit('soundEffect', { type: card.color === 'Black' || card.value === 'Draw 2' || card.value === 'Reverse' || card.value === 'Skip' ? 'special' : 'play' });

    if (player.hand.length === 0) {
      player.status = 'won';
      // Calculate score based on remaining players cards
      let scoreGained = 0;
      for (let p of this.players) {
        if (p.id !== player.id) {
          for (let c of p.hand) {
            if (c.color === 'Black') scoreGained += 50;
            else if (['Skip', 'Reverse', 'Draw 2'].includes(c.value)) scoreGained += 20;
            else scoreGained += parseInt(c.value) || 0;
          }
        }
      }
      player.score += scoreGained;
      this.io.to(this.roomCode).emit('playerWon', { playerName: player.name, scoreGained });
      this.io.to(this.roomCode).emit('soundEffect', { type: 'win' });
    }

    if (!this.checkEndConditions()) {
      if (skipNext) {
        this.nextTurn();
      }
      this.nextTurn();
      this.broadcastGameState();
    }
  }

  drawCardsToNextPlayer(count) {
    let nextIndex = (this.currentTurnIndex + this.direction + this.players.length) % this.players.length;
    while(this.players[nextIndex].status !== 'playing') {
      nextIndex = (nextIndex + this.direction + this.players.length) % this.players.length;
    }
    const targetPlayer = this.players[nextIndex];
    for (let i = 0; i < count; i++) {
      const drawn = this.drawFromDeck();
      if (drawn) targetPlayer.hand.push(drawn);
    }
  }

  drawCard(playerId) {
    if (this.gameState !== 'playing') return;
    const player = this.players[this.currentTurnIndex];
    if (player.id !== playerId) return;

    const drawn = this.drawFromDeck();
    if (drawn) {
      player.hand.push(drawn);
      this.io.to(this.roomCode).emit('soundEffect', { type: 'draw' });
    }
    this.nextTurn();
    this.broadcastGameState();
  }

  checkEndConditions() {
    const playingPlayers = this.players.filter(p => p.status === 'playing');
    if (playingPlayers.length <= 1) {
      this.gameState = 'finished';
      if (playingPlayers.length === 1) {
          playingPlayers[0].status = 'finished';
      }
      this.roundNumber++;
      this.broadcastGameState();
      return true;
    }
    return false;
  }

  keepPlaying() {
    if (this.gameState === 'finished') {
       this.startGame();
    }
  }

  checkBotTurn() {
    if (this.gameState !== 'playing') return;
    const player = this.players[this.currentTurnIndex];
    if (player.isBot && player.status === 'playing') {
      setTimeout(() => {
        if (this.gameState !== 'playing' || this.players[this.currentTurnIndex]?.id !== player.id) return;
        
        // Bot AI
        const validCardIndex = player.hand.findIndex(c => this.isValidPlay(c));
        if (validCardIndex !== -1) {
          const card = player.hand[validCardIndex];
          let chosenColor = null;
          if (card.color === 'Black') {
            // Pick most common color in hand
            const colorCounts = { Red: 0, Yellow: 0, Green: 0, Blue: 0 };
            player.hand.forEach(c => { if (c.color !== 'Black') colorCounts[c.color]++; });
            chosenColor = Object.keys(colorCounts).reduce((a, b) => colorCounts[a] > colorCounts[b] ? a : b);
            if (colorCounts[chosenColor] === 0) chosenColor = COLORS[Math.floor(Math.random() * 4)];
          }
          this.playCard(player.id, validCardIndex, chosenColor);
        } else {
          this.drawCard(player.id);
        }
      }, 1500 + Math.random() * 1000); // 1.5 - 2.5s thinking time
    }
  }

  getPublicGameState() {
    return {
      gameState: this.gameState,
      roomCode: this.roomCode,
      theme: this.theme,
      players: this.players.map(p => ({
        id: p.id,
        name: p.name,
        avatar: p.avatar,
        cardCount: p.hand.length,
        score: p.score,
        status: p.status,
        isBot: p.isBot
      })),
      spectators: this.spectators,
      currentTurnIndex: this.currentTurnIndex,
      direction: this.direction,
      topCard: this.discardPile[this.discardPile.length - 1] || null,
      currentColor: this.currentColor,
      roundNumber: this.roundNumber
    };
  }

  broadcastGameState() {
    const publicState = this.getPublicGameState();
    
    // Send to spectators
    for (let s of this.spectators) {
      this.io.to(s.id).emit('gameState', { ...publicState, myHand: [] });
    }

    // Send to players (with their private hands)
    for (let p of this.players) {
      this.io.to(p.id).emit('gameState', { ...publicState, myHand: p.hand });
    }
  }
}
