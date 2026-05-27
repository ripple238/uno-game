import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export interface EmojiEvent {
  id: string;
  emoji: string;
  x: number; // percentage 0-100
}

export interface ChatEvent {
  id: string;
  text: string;
  playerName: string;
  y: number; // percentage 10-90
}

interface FloatingChatProps {
  emojis: EmojiEvent[];
  chats: ChatEvent[];
}

export const FloatingChat: React.FC<FloatingChatProps> = ({ emojis, chats }) => {
  const [activeEmojis, setActiveEmojis] = useState<EmojiEvent[]>([]);
  const [activeChats, setActiveChats] = useState<ChatEvent[]>([]);

  useEffect(() => {
    if (emojis.length > 0) {
      const latest = emojis[emojis.length - 1];
      // Spawn multiple emojis for one click
      const newEmojis = Array.from({ length: 15 }).map((_, i) => ({
        id: `${latest.id}-${i}`,
        emoji: latest.emoji,
        x: latest.x + (Math.random() * 20 - 10) // spread around the base x
      }));
      setActiveEmojis(prev => [...prev, ...newEmojis]);

      // Cleanup
      setTimeout(() => {
        setActiveEmojis(prev => prev.filter(e => !newEmojis.find(n => n.id === e.id)));
      }, 3000);
    }
  }, [emojis]);

  useEffect(() => {
    if (chats.length > 0) {
      const latest = chats[chats.length - 1];
      setActiveChats(prev => [...prev, latest]);
      
      // Cleanup
      setTimeout(() => {
        setActiveChats(prev => prev.filter(c => c.id !== latest.id));
      }, 8000);
    }
  }, [chats]);

  return (
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
      <AnimatePresence>
        {activeEmojis.map(emoji => (
          <motion.div
            key={emoji.id}
            initial={{ y: '100vh', x: `${emoji.x}vw`, opacity: 1, scale: 0.5 }}
            animate={{ 
              y: '-10vh', 
              x: `${emoji.x + (Math.random() * 10 - 5)}vw`,
              opacity: 0,
              scale: 2 + Math.random()
            }}
            exit={{ opacity: 0 }}
            transition={{ duration: 2 + Math.random(), ease: "easeOut" }}
            className="absolute text-4xl drop-shadow-lg"
          >
            {emoji.emoji}
          </motion.div>
        ))}
      </AnimatePresence>

      <AnimatePresence>
        {activeChats.map(chat => (
          <motion.div
            key={chat.id}
            initial={{ x: '100vw', y: `${chat.y}vh`, opacity: 0 }}
            animate={{ x: '-100vw', opacity: 1 }}
            transition={{ duration: 7, ease: "linear" }}
            className="absolute flex items-center gap-3 bg-zinc-900/80 backdrop-blur-md px-6 py-3 rounded-full border border-white/10 shadow-2xl"
          >
            <span className="font-bold text-neon-blue">{chat.playerName}:</span>
            <span className="text-white text-xl">{chat.text}</span>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};
