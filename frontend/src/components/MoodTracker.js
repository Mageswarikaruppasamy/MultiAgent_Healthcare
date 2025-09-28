// frontend/src/components/MoodTracker.js
import React, { useState } from 'react';
import axios from 'axios';

const MoodTracker = ({ userId, onComplete }) => {
  const [selectedMood, setSelectedMood] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  // Updated to only show 6 specific moods as requested
  const moods = [
    { name: 'Happy', emoji: '😊', color: '#4ade80' },
    { name: 'Sad', emoji: '😢', color: '#3b82f6' },
    { name: 'Angry', emoji: '😠', color: '#ef4444' },
    { name: 'Calm', emoji: '😌', color: '#06b6d4' },
    { name: 'Tired', emoji: '😴', color: '#64748b' },
    { name: 'Anxious', emoji: '😰', color: '#f97316' }
  ];

  const handleMoodSelection = async (mood) => {
    setSelectedMood(mood);
    setLoading(true);
    setMessage('');

    try {
      const response = await axios.post('/api/mood', {
        user_id: userId,
        mood: mood,
        action: 'log'
      });

      if (response.data.success) {
        setMessage(response.data.message);
        setTimeout(() => {
          onComplete && onComplete();
        }, 2000);
      } else {
        setMessage(`Error: ${response.data.message}`);
      }
    } catch (error) {
      console.error('Mood tracking error:', error);
      setMessage('Failed to log mood. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mood-tracker">
      <h2>How are you feeling?</h2>
      <p>Click on an emoji to track your current mood</p>
      
      <div className="mood-grid">
        {moods.map((mood) => (
          <button
            key={mood.name}
            className={`mood-btn ${selectedMood === mood.name ? 'selected' : ''}`}
            onClick={() => handleMoodSelection(mood.name)}
            disabled={loading}
            style={{ '--mood-color': mood.color }}
          >
            <span className="mood-emoji">{mood.emoji}</span>
            <span className="mood-label">{mood.name}</span>
          </button>
        ))}
      </div>

      {loading && (
        <div className="loading-message">
          <div className="spinner"></div>
          <p>Logging your mood...</p>
        </div>
      )}

      {message && (
        <div className={`message ${message.includes('Error') ? 'error' : 'success'}`}>
          {message}
        </div>
      )}

      <div className="mood-tips">
        <h3>💡 Mood Tracking Tips</h3>
        <ul>
          <li>Track your mood at the same time each day for better patterns</li>
          <li>Consider what activities or foods influence your mood</li>
          <li>Don't worry about being "perfect" - all feelings are valid</li>
        </ul>
      </div>
    </div>
  );
};

export default MoodTracker;