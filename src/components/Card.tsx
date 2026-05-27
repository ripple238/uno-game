import React from 'react';
import { motion } from 'framer-motion';

interface CardProps {
  color: string;
  value: string;
  onClick?: () => void;
  isPlayable?: boolean;
  style?: React.CSSProperties;
  className?: string;
}

export const Card: React.FC<CardProps> = ({ color, value, onClick, isPlayable = false, style, className = '' }) => {
  const isBlack = color === 'Black';
  
  const bgClass = {
    'Red': 'bg-red-500 from-red-600 to-red-400',
    'Blue': 'bg-blue-500 from-blue-600 to-blue-400',
    'Green': 'bg-green-500 from-green-600 to-green-400',
    'Yellow': 'bg-yellow-500 from-yellow-600 to-yellow-400',
    'Black': 'bg-zinc-800 from-zinc-900 to-zinc-700'
  }[color] || 'bg-gray-500';

  const glowClass = {
    'Red': 'shadow-red-500/50',
    'Blue': 'shadow-blue-500/50',
    'Green': 'shadow-green-500/50',
    'Yellow': 'shadow-yellow-500/50',
    'Black': 'shadow-zinc-500/50'
  }[color] || 'shadow-gray-500/50';

  return (
    <motion.div
      onClick={isPlayable ? onClick : undefined}
      whileHover={isPlayable ? { scale: 1.1, y: -20, zIndex: 10 } : {}}
      whileTap={isPlayable ? { scale: 0.95 } : {}}
      className={`relative w-24 h-36 rounded-xl border-4 border-white shadow-xl flex flex-col justify-between p-2 cursor-${isPlayable ? 'pointer' : 'default'} bg-gradient-to-br ${bgClass} ${isPlayable ? 'hover:shadow-2xl ' + glowClass : ''} ${className}`}
      style={{
        ...style,
        opacity: onClick && !isPlayable ? 0.5 : 1
      }}
      initial={{ y: 50, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
    >
      {/* Top Left Value */}
      <div className="text-white font-bold text-lg leading-none drop-shadow-md">
        {value}
      </div>
      
      {/* Center Circle */}
      <div className="absolute inset-0 m-auto w-16 h-24 bg-white/20 rounded-[50%] flex items-center justify-center transform -rotate-12 backdrop-blur-sm border border-white/30 shadow-inner">
        <span className="text-white font-black text-3xl drop-shadow-lg" style={{ 
          color: isBlack ? '#ffaa00' : 'white',
          WebkitTextStroke: isBlack ? '1px #ff073a' : '0'
        }}>
          {value === 'Wild Draw 4' ? '+4' : value === 'Draw 2' ? '+2' : value === 'Reverse' ? '⇄' : value === 'Skip' ? '⊘' : value === 'Wild' ? 'W' : value}
        </span>
      </div>

      {/* Bottom Right Value */}
      <div className="text-white font-bold text-lg leading-none drop-shadow-md self-end transform rotate-180">
        {value}
      </div>
    </motion.div>
  );
};
