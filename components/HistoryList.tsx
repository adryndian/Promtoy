
import React from 'react';
import { GenerationHistory } from '../types';

interface HistoryListProps {
  history: GenerationHistory[];
  onSelect: (item: GenerationHistory) => void;
  onClear: () => void;
}

export const HistoryList: React.FC<HistoryListProps> = ({ history, onSelect, onClear }) => {
  if (history.length === 0) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between px-2">
        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Recent Creations</h3>
        <button 
          onClick={onClear}
          className="text-xs text-red-400 hover:text-red-300 transition-colors"
        >
          Clear All
        </button>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {history.map((item) => (
          <button
            key={item.id}
            onClick={() => onSelect(item)}
            className="group relative aspect-square rounded-xl overflow-hidden glass hover:ring-2 hover:ring-blue-500 transition-all text-left"
          >
            {item.imageUrl ? (
              <img 
                src={item.imageUrl} 
                alt={item.userQuery} 
                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gray-900/50">
                <span className="text-xs text-gray-500 italic px-4 text-center">Prompt only</span>
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-3">
              <p className="text-xs font-medium truncate">{item.userQuery}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};
