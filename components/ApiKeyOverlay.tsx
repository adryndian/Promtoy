
import React from 'react';

interface ApiKeyOverlayProps {
  onKeySelected: () => void;
}

export const ApiKeyOverlay: React.FC<ApiKeyOverlayProps> = ({ onKeySelected }) => {
  const handleSelectKey = async () => {
    try {
      // @ts-ignore
      await window.aistudio.openSelectKey();
      onKeySelected();
    } catch (err) {
      console.error("Failed to open key selector", err);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
      <div className="glass-card max-w-md w-full p-8 rounded-2xl text-center space-y-6">
        <div className="flex justify-center">
          <div className="w-16 h-16 bg-blue-500/20 rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
            </svg>
          </div>
        </div>
        <h2 className="text-2xl font-bold">API Key Required</h2>
        <p className="text-gray-400">
          Gemini 3 Pro Image generation requires a selected API key from a paid GCP project.
        </p>
        <button
          onClick={handleSelectKey}
          className="w-full py-3 bg-blue-600 hover:bg-blue-500 transition-colors rounded-xl font-semibold"
        >
          Select API Key
        </button>
        <p className="text-xs text-gray-500">
          For more information, visit the{' '}
          <a
            href="https://ai.google.dev/gemini-api/docs/billing"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-400 hover:underline"
          >
            Gemini API Billing Documentation
          </a>.
        </p>
      </div>
    </div>
  );
};
