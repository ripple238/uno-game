import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { Lobby } from './components/Lobby';
import { GameBoard } from './components/GameBoard';
import { FloatingChat, type EmojiEvent, type ChatEvent } from './components/FloatingChat';
import { useGameAudio } from './hooks/useGameAudio';

// If deployed, point to your backend URL. For local, use localhost:3001
const SOCKET_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

let socket: Socket;

function App() {
  const [gameState, setGameState] = useState<any>(null);
  const [myId, setMyId] = useState<string>('');
  const [myHand, setMyHand] = useState<any[]>([]);
  const [roomCode, setRoomCode] = useState<string>('');
  const [error, setError] = useState<string>('');
  
  const [emojis, setEmojis] = useState<EmojiEvent[]>([]);
  const [chats, setChats] = useState<ChatEvent[]>([]);

  const { playCardSound, playSpecialCardSound, playDrawSound, playWinSound } = useGameAudio();

  useEffect(() => {
    socket = io(SOCKET_URL);

    socket.on('connect', () => {
      setMyId(socket.id || '');
    });

    socket.on('roomCreated', (data) => {
      setRoomCode(data.roomCode);
    });

    socket.on('joinedRoom', (data) => {
      setRoomCode(data.roomCode);
    });

    socket.on('joinedAsSpectator', (data) => {
      setRoomCode(data.roomCode);
    });

    socket.on('gameState', (data) => {
      setGameState(data);
      if (data.myHand) {
        setMyHand(data.myHand);
      }
    });

    socket.on('error', (msg) => {
      setError(msg);
      setTimeout(() => setError(''), 3000);
    });

    socket.on('receiveEmoji', (data) => {
      setEmojis(prev => [...prev, { id: Math.random().toString(), emoji: data.emoji, x: data.x }]);
    });

    socket.on('receiveChat', (data) => {
      setChats(prev => [...prev, { id: Math.random().toString(), text: data.text, playerName: data.playerName, y: 10 + Math.random() * 80 }]);
    });

    socket.on('soundEffect', (data) => {
      if (data.type === 'play') playCardSound();
      if (data.type === 'special') playSpecialCardSound();
      if (data.type === 'draw') playDrawSound();
      if (data.type === 'win') playWinSound();
    });

    socket.on('playerWon', () => {
      // Just receive event, UI state will update via gameState
      // Could trigger toast here
    });

    return () => {
      socket.disconnect();
    };
  }, [playCardSound, playSpecialCardSound, playDrawSound, playWinSound]);

  const handleCreateRoom = (playerName: string, theme: string) => {
    socket.emit('createRoom', { playerName, avatar: 'avatar1', theme });
  };

  const handleJoinRoom = (code: string, playerName: string) => {
    socket.emit('joinRoom', { roomCode: code, playerName, avatar: 'avatar1' });
  };

  const handleAddBot = () => {
    socket.emit('addBot', { roomCode });
  };

  const handleStartGame = () => {
    socket.emit('startGame', { roomCode });
  };

  const handlePlayCard = (index: number, color?: string) => {
    socket.emit('playCard', { roomCode, cardIndex: index, color });
  };

  const handleDrawCard = () => {
    socket.emit('drawCard', { roomCode });
  };

  const handleKeepPlaying = () => {
    socket.emit('keepPlaying', { roomCode });
  };

  const handleSendEmoji = (emoji: string) => {
    socket.emit('sendEmoji', { roomCode, emoji });
  };

  const handleSendChat = (text: string) => {
    socket.emit('sendChat', { roomCode, text });
  };

  return (
    <div className="text-white w-full h-full min-h-screen bg-zinc-950 font-sans">
      <FloatingChat emojis={emojis} chats={chats} />
      
      {error && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 bg-red-500 text-white px-6 py-3 rounded-full shadow-2xl z-50 animate-bounce">
          {error}
        </div>
      )}

      {!gameState || gameState.gameState === 'waiting' ? (
        <Lobby 
          onJoin={handleJoinRoom}
          onCreate={handleCreateRoom}
          onAddBot={handleAddBot}
          onStart={handleStartGame}
          gameState={gameState}
          roomCode={roomCode}
        />
      ) : (
        <GameBoard 
          gameState={gameState}
          myId={myId}
          myHand={myHand}
          onPlayCard={handlePlayCard}
          onDrawCard={handleDrawCard}
          onKeepPlaying={handleKeepPlaying}
          onSendEmoji={handleSendEmoji}
          onSendChat={handleSendChat}
        />
      )}
    </div>
  );
}

export default App;
