// frontend/src/App.js
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Heart, User, Activity, MessageSquare, Utensils, Plus, Send, TrendingUp } from 'lucide-react';
import MealPlanner from './components/Mealplanner';

// Simple inline CSS
const styles = {
  app: {
    minHeight: '100vh',
    background: '#f8fafc',
  },
  authContainer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    padding: '20px',
  },
  authCard: {
    background: 'white',
    borderRadius: '16px',
    padding: '40px',
    maxWidth: '400px',
    width: '100%',
    textAlign: 'center',
    boxShadow: '0 20px 40px rgba(0, 0, 0, 0.1)',
  },
  authIcon: {
    width: '60px',
    height: '60px',
    color: '#667eea',
    margin: '0 auto 20px',
  },
  authInput: {
    width: '100%',
    padding: '16px',
    border: '2px solid #e2e8f0',
    borderRadius: '8px',
    fontSize: '16px',
    marginBottom: '16px',
  },
  authButton: {
    width: '100%',
    padding: '16px',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    fontSize: '16px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  navbar: {
    background: 'white',
    padding: '16px 24px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dashboard: {
    padding: '40px 24px',
    maxWidth: '1200px',
    margin: '0 auto',
  },
  error: {
    background: '#fed7d7',
    color: '#c53030',
    padding: '12px 16px',
    borderRadius: '8px',
    margin: '16px 0',
  },
  success: {
    background: '#c6f6d5',
    color: '#22543d',
    padding: '12px 16px',
    borderRadius: '8px',
    margin: '16px 0',
  }
};

function App() {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [activeSection, setActiveSection] = useState('dashboard');
  
  // Agent-specific states
  const [moodData, setMoodData] = useState([]);
  const [glucoseData, setGlucoseData] = useState([]);
  const [foodLogs, setFoodLogs] = useState([]);
  const [mealPlan, setMealPlan] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  
  // Form states
  const [glucoseReading, setGlucoseReading] = useState('');
  const [foodDescription, setFoodDescription] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    const userId = e.target.userId.value;
    
    if (!userId) return;
    
    setLoading(true);
    setMessage('');

    try {
      const response = await axios.post('/api/greet', 
        { user_id: parseInt(userId) },
        { 
          baseURL: 'http://localhost:8000',
          timeout: 10000 
        }
      );
      
      if (response.data.success) {
        setUser({
          id: userId,
          ...response.data.user_info
        });
        setIsAuthenticated(true);
        setMessage('Login successful!');
      } else {
        setMessage(response.data.message || 'Login failed');
      }
    } catch (error) {
      console.error('Login error:', error);
      setMessage('Login failed. Please check your user ID and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    setUser(null);
    setIsAuthenticated(false);
    setMessage('');
    setActiveSection('dashboard');
  };

  // API helper function
  const apiCall = async (endpoint, method = 'GET', data = null) => {
    try {
      const config = {
        method,
        url: `http://localhost:8000${endpoint}`,
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000
      };
      if (data) config.data = data;
      
      const response = await axios(config);
      return response.data;
    } catch (error) {
      console.error(`API call failed for ${endpoint}:`, error);
      throw error;
    }
  };

  // Load initial data when user logs in
  useEffect(() => {
    if (isAuthenticated && user) {
      loadInitialData();
    }
  }, [isAuthenticated, user]);

  const loadInitialData = async () => {
    try {
      // Load mood stats
      const moodResult = await apiCall('/api/mood', 'POST', {
        user_id: parseInt(user.id),
        action: 'get_stats'
      });
      if (moodResult.success && moodResult.mood_history) {
        // Transform mood_history to match expected format
        const transformedMoodData = moodResult.mood_history.map(entry => ({
          mood: entry.mood,
          timestamp: entry.timestamp,
          score: entry.score
        }));
        setMoodData(transformedMoodData);
      }

      // Load glucose stats
      const glucoseResult = await apiCall('/api/cgm', 'POST', {
        user_id: parseInt(user.id),
        action: 'get_stats'
      });
      if (glucoseResult.success && glucoseResult.cgm_history) {
        // Transform cgm_history to match expected format
        const transformedData = glucoseResult.cgm_history.map(entry => ({
          reading: entry.glucose_reading,
          timestamp: entry.timestamp,
          status: getGlucoseStatus(entry.glucose_reading).status
        }));
        setGlucoseData(transformedData);
      }

      // Load food stats
      const foodResult = await apiCall('/api/food', 'POST', {
        user_id: parseInt(user.id),
        action: 'get_stats'
      });
      if (foodResult.success && foodResult.recent_meals) {
        // Transform food data to include nutrition in expected format
        const transformedFoodData = foodResult.recent_meals.map(entry => ({
          ...entry,
          description: entry.meal_description,
          nutritional_analysis: {
            calories: Math.round(entry.calories),
            carbs: entry.carbs,
            protein: entry.protein,
            fat: entry.fat
          }
        }));
        setFoodLogs(transformedFoodData);
      }
      
      // Generate sample data if both arrays are empty
      if (moodData.length === 0 && foodLogs.length === 0) {
        await generateSampleData();
      }
    } catch (error) {
      console.error('Failed to load initial data:', error);
    }
  };
  
  // Generate sample data function
  const generateSampleData = async () => {
    try {
      // Generate sample mood entries
      const sampleMoods = ['Happy', 'Calm', 'Anxious', 'Tired', 'Happy'];
      for (const mood of sampleMoods) {
        await apiCall('/api/mood', 'POST', {
          user_id: parseInt(user.id),
          mood: mood,
          action: 'log'
        });
      }
      
      // Generate sample food logs
      const sampleMeals = [
        'Grilled chicken breast with quinoa and steamed vegetables',
        'Greek yogurt with berries and granola',
        'Salmon with sweet potato and asparagus'
      ];
      for (const meal of sampleMeals) {
        await apiCall('/api/food', 'POST', {
          user_id: parseInt(user.id),
          meal_description: meal,
          action: 'log'
        });
      }
      
      // Reload data after generating samples
      await loadInitialData();
    } catch (error) {
      console.error('Failed to generate sample data:', error);
    }
  };

  // Mood Tracker Functions
  const handleMoodSubmit = async (mood) => {
    try {
      setLoading(true);
      const result = await apiCall('/api/mood', 'POST', {
        user_id: parseInt(user.id),
        mood: mood,
        action: 'log'
      });
      
      if (result.success) {
        setMessage(`Mood "${mood}" logged successfully!`);
        loadInitialData();
      }
    } catch (error) {
      setMessage('Failed to log mood. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Glucose Monitor Functions
  const handleGlucoseSubmit = async (e) => {
    e.preventDefault();
    if (!glucoseReading) return;
    
    try {
      setLoading(true);
      const result = await apiCall('/api/cgm', 'POST', {
        user_id: parseInt(user.id),
        glucose_reading: parseInt(glucoseReading),
        action: 'log'
      });
      
      if (result.success) {
        setMessage(`Glucose reading ${glucoseReading} mg/dL logged successfully!`);
        setGlucoseReading('');
        loadInitialData();
      }
    } catch (error) {
      setMessage('Failed to log glucose reading. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const generateGlucoseReading = async () => {
    try {
      setLoading(true);
      const result = await apiCall('/api/cgm', 'POST', {
        user_id: parseInt(user.id),
        action: 'generate'
      });
      
      if (result.success) {
        setMessage(`Generated glucose reading: ${result.glucose_reading} mg/dL`);
        loadInitialData();
      }
    } catch (error) {
      setMessage('Failed to generate glucose reading.');
    } finally {
      setLoading(false);
    }
  };

  // Food Logger Functions
  const handleFoodSubmit = async (e) => {
    e.preventDefault();
    if (!foodDescription.trim()) return;
    
    try {
      setLoading(true);
      const result = await apiCall('/api/food', 'POST', {
        user_id: parseInt(user.id),
        meal_description: foodDescription,
        action: 'log'
      });
      
      if (result.success) {
        setMessage('Food logged successfully!');
        setFoodDescription('');
        loadInitialData();
      }
    } catch (error) {
      setMessage('Failed to log food. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Helper function to determine glucose status
  const getGlucoseStatus = (reading) => {
    if (!reading) return { status: 'No data', color: '#6b7280' };
    
    if (reading < 70) {
      return { status: 'Low', color: '#ef4444' };
    } else if (reading >= 70 && reading <= 140) {
      return { status: 'Normal', color: '#10b981' };
    } else {
      return { status: 'High', color: '#f59e0b' };
    }
  };

  // Function to render glucose line chart
  const renderGlucoseChart = () => {
    if (glucoseData.length === 0) {
      return (
        <div style={{ textAlign: 'center', color: '#666', padding: '40px' }}>
          No glucose data available. Start logging readings to see trends.
        </div>
      );
    }

    const last7Days = glucoseData.slice(0, 7).reverse();
    const maxReading = Math.max(...last7Days.map(d => d.reading));
    const minReading = Math.min(...last7Days.map(d => d.reading));
    const range = maxReading - minReading || 50;

    return (
      <div style={{ height: '200px', position: 'relative' }}>
        {/* Y-axis labels */}
        <div style={{ position: 'absolute', left: '0', top: '0', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', fontSize: '12px', color: '#666' }}>
          <span>{Math.round(maxReading + 20)}</span>
          <span>{Math.round((maxReading + minReading) / 2)}</span>
          <span>{Math.round(minReading - 20)}</span>
        </div>
        
        {/* Chart area */}
        <div style={{ marginLeft: '40px', height: '100%', position: 'relative', border: '1px solid #e5e7eb', borderRadius: '4px', padding: '10px' }}>
          {/* Reference lines */}
          <div style={{ position: 'absolute', top: '30%', left: '0', right: '0', height: '1px', background: '#10b981', opacity: '0.3' }}></div>
          <div style={{ position: 'absolute', top: '30%', left: '0', fontSize: '10px', color: '#10b981' }}>Normal Range</div>
          
          {/* Data points and line */}
          <svg width="100%" height="100%" style={{ position: 'absolute', top: '0', left: '0' }}>
            {/* Line connecting the dots */}
            <polyline
              points={last7Days.map((d, i) => {
                const x = (i / (last7Days.length - 1)) * 100;
                const y = 100 - ((d.reading - (minReading - 20)) / (range + 40)) * 100;
                return `${x}%,${y}%`;
              }).join(' ')}
              fill="none"
              stroke="#667eea"
              strokeWidth="2"
            />
            {/* Data points */}
            {last7Days.map((d, i) => {
              const x = (i / (last7Days.length - 1)) * 100;
              const y = 100 - ((d.reading - (minReading - 20)) / (range + 40)) * 100;
              return (
                <circle
                  key={i}
                  cx={`${x}%`}
                  cy={`${y}%`}
                  r="4"
                  fill={getGlucoseStatus(d.reading).color}
                  stroke="black"
                  strokeWidth="2"
                />
              );
            })}
          </svg>
          
          {/* X-axis labels */}
          <div style={{ position: 'absolute', bottom: '-25px', left: '0', right: '0', display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#666' }}>
            {last7Days.map((d, i) => (
              <span key={i}>{new Date(d.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
            ))}
          </div>
        </div>
      </div>
    );
  };

  // Function to render mood bar chart
  const renderMoodChart = () => {
    if (moodData.length === 0) {
      return (
        <div style={{ textAlign: 'center', color: '#666', padding: '40px' }}>
          No mood data available. Start tracking your mood to see patterns.
        </div>
      );
    }

    const moodCounts = moodData.reduce((acc, entry) => {
      acc[entry.mood] = (acc[entry.mood] || 0) + 1;
      return acc;
    }, {});

    const moodColors = {
      'Happy': '#10b981',
      'Sad': '#3b82f6',
      'Anxious': '#f59e0b',
      'Tired': '#6b7280',
      'Angry': '#ef4444',
      'Calm': '#8b5cf6'
    };

    const maxCount = Math.max(...Object.values(moodCounts));

    return (
      <div style={{ height: '200px' }}>
        <div style={{ display: 'flex', alignItems: 'end', height: '160px', gap: '8px', justifyContent: 'space-around' }}>
          {Object.entries(moodCounts).map(([mood, count]) => (
            <div key={mood} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
              <div style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '4px' }}>{count}</div>
              <div
                style={{
                  width: '100%',
                  maxWidth: '40px',
                  height: `${(count / maxCount) * 120}px`,
                  background: moodColors[mood] || '#6b7280',
                  borderRadius: '4px 4px 0 0',
                  minHeight: '20px'
                }}
              ></div>
              <div style={{ fontSize: '11px', color: '#666', marginTop: '8px', transform: 'rotate(-45deg)', transformOrigin: 'center' }}>
                {mood}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // Chat/Interrupt Agent Functions
  const handleChatSubmit = async (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    
    const userMessage = chatInput.trim();
    setChatInput('');
    setChatMessages(prev => [...prev, { type: 'user', message: userMessage }]);
    
    try {
      const result = await apiCall('/api/interrupt', 'POST', {
        user_id: parseInt(user.id),
        query: userMessage,
        current_context: { active_agent: activeSection }
      });
      
      if (result.success) {
        setChatMessages(prev => [...prev, { 
          type: 'assistant', 
          message: result.message,
          suggestion: result.navigation_suggestion 
        }]);
      }
    } catch (error) {
      setChatMessages(prev => [...prev, { 
        type: 'assistant', 
        message: 'Sorry, I encountered an error. Please try again.' 
      }]);
    }
  };

  // Send initial greeting when user enters chat
  useEffect(() => {
    if (activeSection === 'chat' && chatMessages.length === 0) {
      const greetingMessage = `Hello ${user.first_name}! 👋 Welcome to your AI Health Assistant.

How can I help you today? I can assist you with:
• Mood tracking
• Glucose monitoring
• Food logging
• Meal planning
• General health questions`;
      setChatMessages([{ type: 'assistant', message: greetingMessage }]);
    }
  }, [activeSection, user, chatMessages.length]);

  if (!isAuthenticated) {
    return (
      <div style={styles.app}>
        <div style={styles.authContainer}>
          <div style={styles.authCard}>
            <Heart style={styles.authIcon} />
            <h1>Healthcare Assistant</h1>
            <p>Your AI-powered health companion</p>
            
            {message && (
              <div style={message.includes('error') || message.includes('Cannot') || message.includes('failed') ? 
                          styles.error : styles.success}>
                {message}
              </div>
            )}

            <form onSubmit={handleLogin}>
              <input
                type="number"
                name="userId"
                placeholder="Enter User ID (1-100)"
                min="1"
                max="100"
                style={styles.authInput}
                disabled={loading}
              />
              <button 
                type="submit" 
                disabled={loading} 
                style={styles.authButton}
              >
                {loading ? 'Logging in...' : 'Login'}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.app}>
      <nav style={styles.navbar}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Heart style={{ width: '24px', height: '24px', color: '#667eea' }} />
          <span style={{ fontWeight: '600', fontSize: '18px' }}>Health Assistant</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <span>Welcome, {user.first_name}!</span>
          <button onClick={handleLogout} style={{
            padding: '8px 16px',
            background: '#f7fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '6px',
            cursor: 'pointer'
          }}>
            Logout
          </button>
        </div>
      </nav>

      <div style={styles.dashboard}>
        {/* Navigation Bar */}
        <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', flexWrap: 'wrap' }}>
          {[
            { key: 'dashboard', label: 'Dashboard', icon: Activity },
            { key: 'mood', label: 'Mood Tracker', icon: Activity },
            { key: 'glucose', label: 'Glucose Monitor', icon: TrendingUp },
            { key: 'food', label: 'Food Logger', icon: Activity },
            { key: 'meal-plan', label: 'Meal Planner', icon: Utensils },
            { key: 'chat', label: 'AI Assistant', icon: MessageSquare }
          ].map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveSection(key)}
              style={{
                padding: '12px 20px',
                background: activeSection === key ? '#667eea' : '#f7fafc',
                color: activeSection === key ? 'white' : '#4a5568',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontWeight: '500'
              }}
            >
              <Icon size={16} />
              {label}
            </button>
          ))}
        </div>

        {/* Content Area */}
        {activeSection === 'dashboard' && (
          <>
            <h1>Health Dashboard</h1>
            
            {/* First Row: User Profile Only */}
            <div style={{ marginBottom: '24px' }}>
              {/* User Profile */}
              <div style={{
                background: 'white',
                padding: '24px',
                borderRadius: '12px',
                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)'
              }}>
                <h2 style={{ color: '#667eea', marginBottom: '16px' }}>👤 User Profile</h2>
                <div style={{ lineHeight: '1.8' }}>
                  <p><strong>Name:</strong> {user.first_name} {user.last_name}</p>
                  <p><strong>Location:</strong> {user.city}</p>
                  <p><strong>Diet:</strong> {user.dietary_preference}</p>
                  <p><strong>Conditions:</strong> {user.medical_conditions?.filter(c => c !== 'None').join(', ') || 'None'}</p>
                </div>
                
                {/* Latest Glucose Status */}
                {glucoseData.length > 0 && (
                  <div style={{ marginTop: '16px', padding: '12px', borderRadius: '8px', background: getGlucoseStatus(glucoseData[0]?.reading).color }}>
                    <div style={{ fontWeight: 'bold', color: 'white' }}>Latest Glucose Status</div>
                    <div style={{ color: 'white' }}>{glucoseData[0]?.reading} mg/dL - {getGlucoseStatus(glucoseData[0]?.reading).status}</div>
                  </div>
                )}

            </div>
          </div>
            
            {/* Second Row: Charts */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
              {/* Glucose Chart */}
              <div style={{
                background: 'white',
                padding: '24px',
                borderRadius: '12px',
                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)'
              }}>
                <h3 style={{ color: '#667eea', marginBottom: '16px' }}>📈 Glucose Trends (Past Week)</h3>
                {renderGlucoseChart()}
              </div>
              
              {/* Mood Chart */}
              <div style={{
                background: 'white',
                padding: '24px',
                borderRadius: '12px',
                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)'
              }}>
                <h3 style={{ color: '#667eea', marginBottom: '16px' }}>📊 Mood Tracking</h3>
                {renderMoodChart()}
              </div>
            </div>
          </>
        )}

        {activeSection === 'mood' && (
          <>
            <h1>Mood Tracker</h1>
            <div style={{
              background: 'white',
              padding: '24px',
              borderRadius: '12px',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)',
              marginBottom: '24px'
            }}>
              <h3>How are you feeling today?</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '16px', marginTop: '20px' }}>
                {[
                  { emoji: '😊', name: 'Happy', color: '#4ade80' },
                  { emoji: '😢', name: 'Sad', color: '#3b82f6' },
                  { emoji: '😠', name: 'Angry', color: '#ef4444' },
                  { emoji: '😌', name: 'Calm', color: '#06b6d4' },
                  { emoji: '😴', name: 'Tired', color: '#64748b' },
                  { emoji: '😰', name: 'Anxious', color: '#f97316' }
                ].map((mood) => (
                  <button
                    key={mood.name}
                    onClick={() => handleMoodSubmit(mood.name)}
                    disabled={loading}
                    style={{
                      padding: '16px',
                      background: '#f7fafc',
                      border: '2px solid #e2e8f0',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      fontSize: '14px',
                      textAlign: 'center'
                    }}
                  >
                    <div style={{ fontSize: '24px', marginBottom: '4px' }}>{mood.emoji}</div>
                    <div>{mood.name}</div>
                  </button>
                ))}
              </div>
            </div>
            {moodData.length > 0 && (
              <div style={{ background: 'white', padding: '24px', borderRadius: '12px', boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)' }}>
                <h3>Recent Mood Entries</h3>
                {moodData.slice(0, 5).map((entry, index) => (
                  <div key={index} style={{ padding: '12px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between' }}>
                    <span>{entry.mood}</span>
                    <span style={{ color: '#666', fontSize: '14px' }}>{entry.timestamp}</span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {activeSection === 'glucose' && (
          <>
            <h1>Glucose Monitor</h1>
            
            {/* Current Status Display */}
            {glucoseData.length > 0 && (
              <div style={{
                background: 'white',
                padding: '24px',
                borderRadius: '12px',
                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)',
                marginBottom: '24px'
              }}>
                <div style={{
                  padding: '20px',
                  borderRadius: '12px',
                  background: getGlucoseStatus(glucoseData[0]?.reading).color,
                  color: 'white',
                  textAlign: 'center',
                  marginBottom: '20px'
                }}>
                  <div style={{ fontSize: '20px', fontWeight: 'bold' }}>Latest Glucose Reading</div>
                  <div style={{ fontSize: '48px', fontWeight: 'bold', margin: '16px 0' }}>{glucoseData[0]?.reading}</div>
                  <div style={{ fontSize: '16px' }}>mg/dL</div>
                  <div style={{ fontSize: '18px', marginTop: '8px' }}>Status: {getGlucoseStatus(glucoseData[0]?.reading).status}</div>
                  <div style={{ fontSize: '14px', opacity: '0.9', marginTop: '8px' }}>
                    Last updated: {new Date(glucoseData[0]?.timestamp).toLocaleString()}
                  </div>
                </div>
                
                {/* Reference Ranges */}
                <div style={{ padding: '16px', background: '#f8fafc', borderRadius: '8px' }}>
                  <h4 style={{ margin: '0 0 12px 0', color: '#374151' }}>Reference Ranges:</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', fontSize: '14px' }}>
                    <div style={{ padding: '8px', background: '#ef4444', color: 'white', borderRadius: '4px', textAlign: 'center' }}>
                      <strong>Low</strong><br/>&lt; 70 mg/dL
                    </div>
                    <div style={{ padding: '8px', background: '#10b981', color: 'white', borderRadius: '4px', textAlign: 'center' }}>
                      <strong>Normal</strong><br/>70-140 mg/dL
                    </div>
                    <div style={{ padding: '8px', background: '#f59e0b', color: 'white', borderRadius: '4px', textAlign: 'center' }}>
                      <strong>High</strong><br/>&gt; 140 mg/dL
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {/* No data message */}
            {glucoseData.length === 0 && (
              <div style={{
                background: 'white',
                padding: '40px',
                borderRadius: '12px',
                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)',
                textAlign: 'center',
                marginBottom: '24px'
              }}>
                <div style={{ fontSize: '18px', color: '#666', marginBottom: '16px' }}>
                  No glucose readings available yet.
                </div>
                <div style={{ fontSize: '14px', color: '#999' }}>
                  Glucose readings are automatically captured from your CGM device.
                </div>
              </div>
            )}
            
            {/* Manual Entry Option */}
            <div style={{
              background: 'white',
              padding: '24px',
              borderRadius: '12px',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)',
              marginBottom: '24px'
            }}>
              <h3>Manual Glucose Entry</h3>
              <p style={{ color: '#666', marginBottom: '16px' }}>Enter a manual reading if needed:</p>
              
              <form onSubmit={handleGlucoseSubmit}>
                <div style={{ display: 'flex', gap: '16px', alignItems: 'end' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                      Glucose Reading (mg/dL)
                    </label>
                    <input
                      type="number"
                      value={glucoseReading}
                      onChange={(e) => setGlucoseReading(e.target.value)}
                      placeholder="Enter reading (e.g., 120)"
                      min="50"
                      max="500"
                      style={{
                        width: '100%',
                        padding: '12px',
                        border: '2px solid #e2e8f0',
                        borderRadius: '8px',
                        fontSize: '16px'
                      }}
                      disabled={loading}
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={loading || !glucoseReading}
                    style={{
                      padding: '12px 24px',
                      background: '#10b981',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      fontWeight: '600',
                      cursor: 'pointer'
                    }}
                  >
                    {loading ? 'Logging...' : 'Log Reading'}
                  </button>
                </div>
              </form>
            </div>
            
            {/* Recent Readings */}
            {glucoseData.length > 0 && (
              <div style={{ background: 'white', padding: '24px', borderRadius: '12px', boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)' }}>
                <h3>Recent Glucose Readings</h3>
                {glucoseData.slice(0, 10).map((entry, index) => (
                  <div key={index} style={{ padding: '12px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div
                        style={{
                          width: '12px',
                          height: '12px',
                          borderRadius: '50%',
                          background: getGlucoseStatus(entry.reading).color
                        }}
                      ></div>
                      <span style={{ fontWeight: '500' }}>{entry.reading} mg/dL</span>
                      <span style={{
                        padding: '2px 8px',
                        borderRadius: '12px',
                        fontSize: '12px',
                        background: getGlucoseStatus(entry.reading).color,
                        color: 'white'
                      }}>
                        {getGlucoseStatus(entry.reading).status}
                      </span>
                    </div>
                    <span style={{ color: '#666', fontSize: '14px' }}>{new Date(entry.timestamp).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {activeSection === 'food' && (
          <>
            <h1>Food Logger</h1>
            <div style={{
              background: 'white',
              padding: '24px',
              borderRadius: '12px',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)',
              marginBottom: '24px'
            }}>
              <h3>Log Food Intake</h3>
              <form onSubmit={handleFoodSubmit} style={{ marginTop: '20px' }}>
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                    Describe your meal
                  </label>
                  <textarea
                    value={foodDescription}
                    onChange={(e) => setFoodDescription(e.target.value)}
                    placeholder="Example: Grilled chicken breast with steamed broccoli and quinoa"
                    rows={3}
                    style={{
                      width: '100%',
                      padding: '12px',
                      border: '2px solid #e2e8f0',
                      borderRadius: '8px',
                      fontSize: '16px',
                      resize: 'vertical'
                    }}
                    disabled={loading}
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading || !foodDescription.trim()}
                  style={{
                    padding: '12px 24px',
                    background: '#10b981',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
                >
                  {loading ? 'Analyzing...' : 'Log Food & Analyze Nutrition'}
                </button>
              </form>
            </div>
            {foodLogs.length > 0 && (
              <div style={{ background: 'white', padding: '24px', borderRadius: '12px', boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)' }}>
                <h3>Recent Food Logs</h3>
                {foodLogs.slice(0, 5).map((entry, index) => (
                  <div key={index} style={{ padding: '16px', borderBottom: '1px solid #e2e8f0', marginBottom: '12px' }}>
                    <div style={{ fontWeight: '500', marginBottom: '8px', fontSize: '16px' }}>{entry.description || entry.meal_description}</div>
                    
                    {/* Nutrition Information */}
                    {(entry.nutrition || entry.nutritional_analysis || (entry.carbs !== undefined && entry.protein !== undefined && entry.fat !== undefined)) && (
                      <div style={{ marginBottom: '12px' }}>
                        <h4 style={{ fontSize: '14px', color: '#667eea', marginBottom: '8px' }}>Nutritional Analysis:</h4>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '8px' }}>
                          {/* Calories */}
                          <div style={{ padding: '8px', background: '#fef3c7', borderRadius: '6px', textAlign: 'center' }}>
                            <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#d97706' }}>
                              {entry.nutrition?.calories || entry.nutritional_analysis?.calories || Math.round((entry.carbs * 4) + (entry.protein * 4) + (entry.fat * 9)) || 'N/A'}
                            </div>
                            <div style={{ fontSize: '12px', color: '#92400e' }}>Calories</div>
                          </div>
                          
                          {/* Protein */}
                          <div style={{ padding: '8px', background: '#dbeafe', borderRadius: '6px', textAlign: 'center' }}>
                            <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#2563eb' }}>
                              {entry.nutrition?.protein || entry.nutritional_analysis?.protein || entry.protein || 'N/A'}g
                            </div>
                            <div style={{ fontSize: '12px', color: '#1d4ed8' }}>Protein</div>
                          </div>
                          
                          {/* Carbohydrates */}
                          <div style={{ padding: '8px', background: '#dcfce7', borderRadius: '6px', textAlign: 'center' }}>
                            <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#16a34a' }}>
                              {entry.nutrition?.carbs || entry.nutritional_analysis?.carbs || entry.nutritional_analysis?.carbohydrates || entry.carbs || 'N/A'}g
                            </div>
                            <div style={{ fontSize: '12px', color: '#15803d' }}>Carbs</div>
                          </div>
                          
                          {/* Fat */}
                          <div style={{ padding: '8px', background: '#fce7f3', borderRadius: '6px', textAlign: 'center' }}>
                            <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#db2777' }}>
                              {entry.nutrition?.fat || entry.nutritional_analysis?.fat || entry.fat || 'N/A'}g
                            </div>
                            <div style={{ fontSize: '12px', color: '#be185d' }}>Fat</div>
                          </div>
                        </div>
                        
                        {/* Additional nutrition info if available */}
                        {(entry.nutritional_analysis?.fiber || entry.nutritional_analysis?.sodium) && (
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '8px', marginTop: '8px' }}>
                            {entry.nutritional_analysis?.fiber && (
                              <div style={{ padding: '6px', background: '#f3e8ff', borderRadius: '6px', textAlign: 'center' }}>
                                <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#7c3aed' }}>
                                  {entry.nutritional_analysis.fiber}g
                                </div>
                                <div style={{ fontSize: '11px', color: '#6d28d9' }}>Fiber</div>
                              </div>
                            )}
                            {entry.nutritional_analysis?.sodium && (
                              <div style={{ padding: '6px', background: '#fef2f2', borderRadius: '6px', textAlign: 'center' }}>
                                <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#dc2626' }}>
                                  {entry.nutritional_analysis.sodium}mg
                                </div>
                                <div style={{ fontSize: '11px', color: '#b91c1c' }}>Sodium</div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                    
                    {/* Health insights if available */}
                    {entry.health_insights && (
                      <div style={{ padding: '10px', background: '#f0f9ff', borderRadius: '6px', marginBottom: '8px' }}>
                        <div style={{ fontSize: '12px', color: '#0369a1', fontWeight: '500' }}>💡 Health Insights:</div>
                        <div style={{ fontSize: '13px', color: '#0284c7', marginTop: '4px' }}>{entry.health_insights}</div>
                      </div>
                    )}
                    
                    <div style={{ fontSize: '12px', color: '#999', marginTop: '8px' }}>
                      {new Date(entry.timestamp).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {activeSection === 'meal-plan' && (
          <>
            <h1>AI Meal Planner</h1>
            <div style={{
              background: 'white',
              padding: '24px',
              borderRadius: '12px',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)',
              marginBottom: '24px'
            }}>
              <div style={{ padding: '10px', marginBottom: '20px', background: '#f0f9ff', borderRadius: '8px' }}>
                <small>Debug Info - User: {user?.first_name} (ID: {user?.id}), Dietary: {user?.dietary_preference || 'None'}</small>
              </div>
              {(() => {
                try {
                  return (
                    <MealPlanner 
                      userId={parseInt(user?.id || 1)}
                      userContext={{
                        dietary_preference: user?.dietary_preference || 'No preference specified',
                        medical_conditions: (() => {
                          if (!user?.medical_conditions) return ['None'];
                          if (Array.isArray(user.medical_conditions)) return user.medical_conditions;
                          if (typeof user.medical_conditions === 'string') {
                            return user.medical_conditions.split(',').map(c => c.trim()).filter(c => c);
                          }
                          return ['None'];
                        })()
                      }}
                      onComplete={() => setMessage('Meal plan generated successfully!')}
                    />
                  );
                } catch (error) {
                  console.error('MealPlanner Error:', error);
                  return (
                    <div style={{ padding: '20px', background: '#fed7d7', borderRadius: '8px' }}>
                      <h3>Error Loading Meal Planner</h3>
                      <p>Error: {error.message}</p>
                      <button onClick={() => window.location.reload()}>Reload Page</button>
                    </div>
                  );
                }
              })()}
            </div>
          </>
        )}

        {activeSection === 'chat' && (
          <>
            <h1>AI Health Assistant</h1>
            <div style={{
              background: 'white',
              padding: '24px',
              borderRadius: '12px',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)',
              height: '600px',
              display: 'flex',
              flexDirection: 'column'
            }}>
              <h3>Chat with your AI Health Assistant</h3>
              <div style={{
                flex: 1,
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                padding: '16px',
                marginTop: '16px',
                marginBottom: '16px',
                overflowY: 'auto',
                background: '#f8fafc'
              }}>
                {chatMessages.length === 0 ? (
                  <div style={{ color: '#666', fontStyle: 'italic', textAlign: 'center', marginTop: '40px' }}>
                    Start a conversation! Ask me about your health, get recommendations, or navigate to specific features.
                  </div>
                ) : (
                  chatMessages.map((msg, index) => (
                    <div key={index} style={{
                      marginBottom: '16px',
                      padding: '12px',
                      borderRadius: '8px',
                      background: msg.type === 'user' ? '#667eea' : 'white',
                      color: msg.type === 'user' ? 'white' : '#333',
                      alignSelf: msg.type === 'user' ? 'flex-end' : 'flex-start',
                      maxWidth: '80%',
                      marginLeft: msg.type === 'user' ? 'auto' : '0',
                      marginRight: msg.type === 'user' ? '0' : 'auto'
                    }}>
                      <div>{msg.message}</div>
                      {msg.suggestion && (
                        <div style={{
                          marginTop: '8px',
                          padding: '8px',
                          background: '#f0f9ff',
                          borderRadius: '4px',
                          fontSize: '14px',
                          color: '#0369a1'
                        }}>
                          💡 Suggestion: {msg.suggestion}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
              <form onSubmit={handleChatSubmit} style={{ display: 'flex', gap: '12px' }}>
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder={`Ask me anything, ${user.first_name}...`}
                  style={{
                    flex: 1,
                    padding: '12px',
                    border: '2px solid #e2e8f0',
                    borderRadius: '8px',
                    fontSize: '16px'
                  }}
                  disabled={loading}
                />
                <button
                  type="submit"
                  disabled={loading || !chatInput.trim()}
                  style={{
                    padding: '12px 20px',
                    background: '#10b981',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                >
                  <Send size={16} />
                  {loading ? 'Sending...' : 'Send'}
                </button>
              </form>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default App;