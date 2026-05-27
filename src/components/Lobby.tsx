import React, { useState } from 'react';
import { motion } from 'framer-motion';

interface LobbyProps {
  onJoin: (roomCode: string, name: string) => void;
  onCreate: (name: string, theme: string) => void;
  onAddBot: () => void;
  onStart: () => void;
  gameState: any;
  roomCode: string;
}

export const Lobby: React.FC<LobbyProps> = ({ onJoin, onCreate, onAddBot, onStart, gameState, roomCode }) => {
  const [name, setName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [theme] = useState('neon');

  if (roomCode && gameState) {
    // Inside a room lobby
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-zinc-950 p-6 relative overflow-hidden">
        {/* Background blobs */}
        <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-neon-blue/20 rounded-full blur-[100px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-neon-purple/20 rounded-full blur-[100px]" />

        <motion.div 
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="glass-panel p-8 w-full max-w-2xl text-center relative z-10"
        >
          <h2 className="text-4xl font-black mb-2 text-transparent bg-clip-text bg-gradient-to-r from-neon-blue to-neon-purple">Room Code: {roomCode}</h2>
          <p className="text-zinc-400 mb-8">Share this code with your friends to play together!</p>

          <div className="mb-8">
            <h3 className="text-xl font-bold mb-4 text-white">Players ({gameState.players?.length || 0})</h3>
            <div className="flex flex-wrap gap-4 justify-center">
              {gameState.players?.map((p: any) => (
                <div key={p.id} className="bg-zinc-800/80 px-4 py-2 rounded-full border border-zinc-700 flex items-center gap-2">
                  <span className="text-lg">{p.isBot ? '🤖' : '👤'}</span>
                  <span className="font-medium">{p.name}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <motion.button 
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={onAddBot}
              className="px-6 py-3 bg-zinc-800 hover:bg-zinc-700 text-white font-bold rounded-xl border border-zinc-600 transition-colors"
            >
              Add AI Bot
            </motion.button>
            <motion.button 
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={onStart}
              className="px-8 py-3 bg-gradient-to-r from-neon-blue to-neon-purple text-white font-bold rounded-xl shadow-lg shadow-neon-blue/20 hover:shadow-neon-blue/40 transition-shadow"
            >
              Start Game
            </motion.button>
          </div>
        </motion.div>
      </div>
    );
  }

  // Initial Join/Create screen
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-zinc-950 p-6 relative overflow-hidden">
      {/* Background blobs */}
      <div className="absolute top-[20%] left-[10%] w-[500px] h-[500px] bg-neon-red/10 rounded-full blur-[120px]" />
      <div className="absolute bottom-[10%] right-[20%] w-[400px] h-[400px] bg-neon-blue/10 rounded-full blur-[100px]" />

      <motion.div 
        initial={{ y: 50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.8, type: 'spring' }}
        className="glass-panel p-10 w-full max-w-md relative z-10"
      >
        <h1 className="text-6xl font-black text-center mb-8 italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-br from-red-500 to-yellow-500 drop-shadow-[0_0_15px_rgba(255,0,0,0.5)]">UNO.IO</h1>

        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-2">Your Name</label>
            <input 
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-neon-blue focus:ring-1 focus:ring-neon-blue transition-all"
              placeholder="Enter your nickname..."
            />
          </div>

          <div className="pt-4 border-t border-zinc-800">
            <button 
              onClick={() => onCreate(name || 'Player', theme)}
              className="w-full bg-gradient-to-r from-neon-red to-orange-500 text-white font-bold text-lg py-3 rounded-xl shadow-[0_0_20px_rgba(255,7,58,0.3)] hover:shadow-[0_0_30px_rgba(255,7,58,0.5)] transition-all hover:scale-[1.02] active:scale-95"
            >
              Create New Room
            </button>
          </div>

          <div className="relative flex items-center py-2">
            <div className="flex-grow border-t border-zinc-800"></div>
            <span className="flex-shrink-0 mx-4 text-zinc-500 text-sm">OR</span>
            <div className="flex-grow border-t border-zinc-800"></div>
          </div>

          <div className="space-y-4">
            <input 
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-neon-purple focus:ring-1 focus:ring-neon-purple transition-all text-center tracking-widest font-mono text-lg"
              placeholder="ROOM CODE"
              maxLength={6}
            />
            <button 
              onClick={() => onJoin(joinCode, name || 'Player')}
              disabled={joinCode.length < 6}
              className="w-full bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-lg py-3 rounded-xl border border-zinc-600 transition-all hover:scale-[1.02] active:scale-95"
            >
              Join Room
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
