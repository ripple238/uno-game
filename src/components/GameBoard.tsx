import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card } from './Card';
import confetti from 'canvas-confetti';

interface GameBoardProps {
  gameState: any;
  myId: string;
  myHand: any[];
  onPlayCard: (index: number, color?: string) => void;
  onDrawCard: () => void;
  onKeepPlaying: () => void;
  onSendEmoji: (emoji: string) => void;
  onSendChat: (text: string) => void;
}

const EMOJIS = ['😂', '🔥', '💀', '👀', '❤️', '😡', '👏'];

export const GameBoard: React.FC<GameBoardProps> = ({
  gameState, myId, myHand, onPlayCard, onDrawCard, onKeepPlaying, onSendEmoji, onSendChat
}) => {
  const [chatText, setChatText] = useState('');
  const [showColorPicker, setShowColorPicker] = useState<number | null>(null);

  const myPlayerInfo = gameState.players.find((p: any) => p.id === myId);
  const isSpectator = !myPlayerInfo;
  const isMyTurn = !isSpectator && gameState.players[gameState.currentTurnIndex]?.id === myId;
  const topCard = gameState.topCard;

  const handlePlayCard = (index: number) => {
    if (!isMyTurn) return;
    const card = myHand[index];
    
    // Check if valid
    const isValid = card.color === 'Black' || card.color === gameState.currentColor || card.value === topCard?.value;
    if (!isValid) return;

    if (card.color === 'Black') {
      setShowColorPicker(index);
    } else {
      onPlayCard(index);
    }
  };

  const handleColorSelect = (color: string) => {
    if (showColorPicker !== null) {
      onPlayCard(showColorPicker, color);
      setShowColorPicker(null);
    }
  };

  const opponents = gameState.players.filter((p: any) => p.id !== myId);

  // Trigger confetti if game is finished and someone won
  React.useEffect(() => {
    if (gameState.gameState === 'finished') {
      confetti({
        particleCount: 150,
        spread: 100,
        origin: { y: 0.6 }
      });
    }
  }, [gameState.gameState]);

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col relative overflow-hidden">
      {/* Background Ambience */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-zinc-900 to-zinc-950 pointer-events-none" />
      <div className="absolute top-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-5 pointer-events-none" />

      {/* Top Bar: Opponents & Info */}
      <div className="relative z-10 flex-none h-32 p-4 flex justify-between items-start">
        <div className="flex gap-4">
          {opponents.map((p: any, idx: number) => {
            const isTheirTurn = gameState.players[gameState.currentTurnIndex]?.id === p.id;
            return (
              <motion.div 
                key={p.id}
                animate={{ y: isTheirTurn ? 10 : 0, scale: isTheirTurn ? 1.05 : 1 }}
                className={`glass-panel p-3 flex flex-col items-center min-w-[100px] ${isTheirTurn ? 'border-neon-blue shadow-[0_0_15px_rgba(0,229,255,0.3)]' : ''}`}
              >
                <div className="relative">
                  <div className="text-3xl mb-1">{p.isBot ? '🤖' : '👤'}</div>
                  {p.status === 'won' && <div className="absolute -top-2 -right-2 text-xl">👑</div>}
                </div>
                <div className="text-sm font-bold text-white truncate max-w-[80px]">{p.name}</div>
                <div className="text-xs text-zinc-400">{p.cardCount} cards</div>
                <div className="text-xs text-neon-purple font-bold">Score: {p.score}</div>
              </motion.div>
            )
          })}
        </div>

        <div className="glass-panel px-6 py-3 text-right">
          <div className="text-zinc-400 text-sm">Room: <span className="text-white font-mono">{gameState.roomCode}</span></div>
          <div className="text-neon-green font-bold">Round {gameState.roundNumber}</div>
        </div>
      </div>

      {/* Center: Table (Discard & Draw Pile) */}
      <div className="flex-1 relative z-10 flex items-center justify-center gap-12">
        {/* Draw Pile */}
        <div className="relative cursor-pointer group" onClick={() => isMyTurn && onDrawCard()}>
          <div className="absolute inset-0 bg-neon-blue/20 blur-xl rounded-xl group-hover:bg-neon-blue/40 transition-all"></div>
          <div className="w-24 h-36 rounded-xl border-4 border-zinc-700 bg-zinc-800 flex items-center justify-center shadow-2xl relative z-10 overflow-hidden transform -rotate-6 transition-transform group-hover:-translate-y-2 group-hover:rotate-0">
             <div className="text-red-500 font-black text-4xl transform -rotate-45 opacity-50">UNO</div>
             <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-transparent"></div>
          </div>
          <div className="absolute -bottom-6 w-full text-center text-sm font-bold text-zinc-400 group-hover:text-neon-blue transition-colors">DRAW</div>
        </div>

        {/* Direction Indicator */}
        <motion.div 
          animate={{ rotate: gameState.direction === 1 ? 360 : -360 }}
          transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
          className="absolute text-zinc-700/50 text-8xl pointer-events-none"
        >
          {gameState.direction === 1 ? '↻' : '↺'}
        </motion.div>

        {/* Discard Pile */}
        <div className="relative">
          {topCard && (
            <>
              <div className={`absolute inset-0 blur-2xl rounded-full bg-${topCard.color === 'Black' ? 'zinc' : topCard.color.toLowerCase()}-500/30`} />
              <Card 
                color={topCard.color} 
                value={topCard.value} 
                className={`transform ${topCard.color === 'Black' ? `border-${gameState.currentColor.toLowerCase()}-500 shadow-[0_0_20px_${gameState.currentColor.toLowerCase()}]` : ''}`} 
              />
            </>
          )}
        </div>
      </div>

      {/* Bottom: Player Hand */}
      {!isSpectator && (
        <div className="flex-none h-64 p-4 flex flex-col items-center justify-end relative z-20">
          <AnimatePresence>
            {showColorPicker !== null && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                className="absolute bottom-64 glass-panel p-4 flex gap-4 z-50"
              >
                {['Red', 'Blue', 'Green', 'Yellow'].map(color => (
                  <button
                    key={color}
                    onClick={() => handleColorSelect(color)}
                    className={`w-12 h-12 rounded-full border-2 border-white shadow-lg transform hover:scale-110 transition-transform bg-${color.toLowerCase()}-500`}
                  />
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Turn Indicator */}
          <div className="mb-4 text-center h-8">
            {isMyTurn ? (
              <motion.div 
                animate={{ scale: [1, 1.1, 1] }} 
                transition={{ repeat: Infinity, duration: 2 }}
                className="text-neon-green font-bold text-xl drop-shadow-[0_0_8px_rgba(57,255,20,0.8)]"
              >
                YOUR TURN
              </motion.div>
            ) : (
              <div className="text-zinc-500 font-medium">Waiting for other players...</div>
            )}
          </div>

          <div className="flex justify-center -space-x-8 px-4 w-full max-w-5xl overflow-x-auto pb-8 pt-4 custom-scrollbar">
            {myHand.map((card: any, idx: number) => {
               const isValid = card.color === 'Black' || card.color === gameState.currentColor || card.value === topCard?.value;
               return (
                 <motion.div key={`${idx}-${card.color}-${card.value}`} layout>
                   <Card
                     color={card.color}
                     value={card.value}
                     isPlayable={isMyTurn && isValid}
                     onClick={() => handlePlayCard(idx)}
                     className="transform origin-bottom hover:z-50"
                     style={{
                       rotate: `${(idx - myHand.length / 2) * 5}deg`,
                       y: Math.abs(idx - myHand.length / 2) * 5
                     }}
                   />
                 </motion.div>
               );
            })}
          </div>
        </div>
      )}

      {/* Chat & Emojis Bar */}
      <div className="absolute bottom-4 left-4 right-4 z-30 flex justify-between items-end pointer-events-none">
        
        <div className="pointer-events-auto flex flex-col gap-2">
          {gameState.gameState === 'finished' && !isSpectator && (
            <button 
              onClick={onKeepPlaying}
              className="bg-neon-blue text-black font-bold px-4 py-2 rounded-xl mb-4 hover:scale-105 transition-transform"
            >
              Keep Playing (Next Round)
            </button>
          )}
          
          <div className="glass-panel flex p-2 gap-2 w-64">
            <input 
              value={chatText}
              onChange={e => setChatText(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && chatText.trim()) {
                  onSendChat(chatText.trim());
                  setChatText('');
                }
              }}
              placeholder="Send message..."
              className="bg-transparent text-white border-none focus:outline-none w-full px-2"
              maxLength={50}
            />
            <button 
              onClick={() => {
                if (chatText.trim()) {
                  onSendChat(chatText.trim());
                  setChatText('');
                }
              }}
              className="text-neon-blue hover:text-white transition-colors px-2"
            >
              ➤
            </button>
          </div>
        </div>

        <div className="pointer-events-auto glass-panel p-2 flex gap-2">
          {EMOJIS.map(emoji => (
            <motion.button
              key={emoji}
              whileHover={{ scale: 1.2 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => onSendEmoji(emoji)}
              className="text-2xl hover:bg-zinc-800 rounded-lg p-2 transition-colors"
            >
              {emoji}
            </motion.button>
          ))}
        </div>
      </div>
    </div>
  );
};
