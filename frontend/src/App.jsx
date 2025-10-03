// frontend/src/App.js
import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Heart, User, Activity, MessageSquare, Utensils, Plus, Send, TrendingUp } from 'lucide-react';
import MealPlanner from './components/Mealplanner.jsx';

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

// Styles for bubbles
const userBubbleStyle = {
  background: "#2563eb",   // blue
  color: "white",
  alignSelf: "flex-end",
  borderRadius: "12px 12px 0 12px",
  padding: "12px",
  maxWidth: "70%",
  marginBottom: "12px"
};

const assistantBubbleStyle = {
  background: "#f1f5f9",   // light grey
  color: "#111827",
  alignSelf: "flex-start",
  borderRadius: "12px 12px 12px 0",
  padding: "12px",
  maxWidth: "70%",
  marginBottom: "12px"
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
      const response = await apiCallWithRetry('/api/greet', 'POST', 
        { user_id: parseInt(userId) }
      );
      
      if (response.success) {
        setUser({
          id: userId,
          ...response.user_info
        });
        setIsAuthenticated(true);
        setMessage('Login successful!');
      } else {
        setMessage(response.message || 'Login failed');
      }
    } catch (error) {
      console.error('Login error:', error);
      setMessage('Login failed after multiple attempts. Please check your user ID and try again.');
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

  // API helper function with retry logic
  const apiCallWithRetry = async (endpoint, method = 'GET', data = null, maxRetries = 2) => {
    let lastError;
    
    for (let i = 0; i <= maxRetries; i++) {
      try {
        const config = {
          method,
          url: `http://localhost:8000${endpoint}`,
          headers: { 'Content-Type': 'application/json' },
          timeout: 35000  // 35 seconds timeout
        };
        if (data) config.data = data;
        
        const response = await axios(config);
        return response.data;
      } catch (error) {
        lastError = error;
        console.error(`API call failed for ${endpoint} (attempt ${i + 1}/${maxRetries + 1}):`, error);
        
        // Don't retry on client errors (4xx) or if it's the last attempt
        if ((error.response && error.response.status >= 400 && error.response.status < 500) || i === maxRetries) {
          throw error;
        }
        
        // Wait before retrying (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
      }
    }
    
    throw lastError;
  };

  // API helper function (updated to use retry logic)
  const apiCall = async (endpoint, method = 'GET', data = null) => {
    return await apiCallWithRetry(endpoint, method, data);
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

  // Load initial data when user logs in
  const loadInitialData = useCallback(async () => {
    try {
      // Load mood stats
      const moodResult = await apiCallWithRetry('/api/mood', 'POST', {
        user_id: parseInt(user.id),
        action: 'get_stats'
      });
      if (moodResult.success && moodResult.mood_history) {
        // Transform mood_history to match expected format
        const transformedMoodData = moodResult.mood_history.map(entry => ({
          mood: entry.mood,
          timestamp: entry.timestamp,
          score: entry.score || 0 // Add fallback for score
        }));
        setMoodData(transformedMoodData);
      }

      // Load glucose stats
      const glucoseResult = await apiCallWithRetry('/api/cgm', 'POST', {
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
      const foodResult = await apiCallWithRetry('/api/food', 'POST', {
        user_id: parseInt(user.id),
        action: 'get_stats'
      });
      if (foodResult.success && foodResult.nutrition_analysis) {
        // Transform food data to include nutrition in expected format
        const transformedFoodData = foodResult.nutrition_analysis.map(entry => ({
          ...entry,
          description: entry.meal_description || entry.description || 'No description',
          nutritional_analysis: {
            calories: Math.round(entry.estimated_calories !== undefined ? entry.estimated_calories : 
                     entry.calories !== undefined ? entry.calories : 0),
            carbs: entry.estimated_carbs !== undefined ? entry.estimated_carbs : 
                 entry.carbohydrates !== undefined ? entry.carbohydrates : 
                 entry.carbs !== undefined ? entry.carbs : 0,
            protein: entry.estimated_protein !== undefined ? entry.estimated_protein : 
                   entry.protein !== undefined ? entry.protein : 0,
            fat: entry.estimated_fat !== undefined ? entry.estimated_fat : 
               entry.fat !== undefined ? entry.fat : 0,
            fiber: entry.estimated_fiber !== undefined ? entry.estimated_fiber : 
                 entry.fiber !== undefined ? entry.fiber : 0
          }
        }));
        setFoodLogs(transformedFoodData);
      }
      
      // Clear any previous error messages on successful load
      if (message && message.includes('Failed to load')) {
        setMessage('');
      }
    } catch (error) {
      console.error('Failed to load initial data:', error);
      setMessage('Failed to load health data after multiple attempts. Please try refreshing the page.');
      // Re-throw the error so calling functions can handle it appropriately
      throw error;
    }
  }, [user, getGlucoseStatus, message, setMessage]);

  useEffect(() => {
    if (isAuthenticated && user) {
      loadInitialData();
    }
  }, [isAuthenticated, user, loadInitialData]);

  // Mood Tracker Functions
  const handleMoodSubmit = async (mood) => {
    try {
      setLoading(true);
      const result = await apiCallWithRetry('/api/mood', 'POST', {
        user_id: parseInt(user.id),
        mood: mood,
        action: 'log'
      });
      
      if (result.success) {
        setMessage(`Mood "${mood}" logged successfully!`);
        // Add a small delay to ensure database commits are completed
        await new Promise(resolve => setTimeout(resolve, 500));
        loadInitialData();
      }
    } catch (error) {
      setMessage('Failed to log mood after multiple attempts. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // New function to handle free text mood input
  const handleMoodTextInput = async (e) => {
    e.preventDefault();
    const moodText = e.target.moodText.value;
    if (!moodText.trim()) return;
    
    try {
      setLoading(true);
      const result = await apiCallWithRetry('/api/mood', 'POST', {
        user_id: parseInt(user.id),
        user_input: moodText,
        action: 'log'
      });
      
      if (result.success) {
        setMessage(`Mood "${result.logged_mood}" logged successfully based on your input!`);
        e.target.moodText.value = '';
        // Add a small delay to ensure database commits are completed
        await new Promise(resolve => setTimeout(resolve, 500));
        loadInitialData();
      }
    } catch (error) {
      setMessage('Failed to log mood after multiple attempts. Please try again.');
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
      setMessage('Analyzing nutritional content... This may take a moment.');
      
      const result = await apiCallWithRetry('/api/food', 'POST', {
        user_id: parseInt(user.id),
        meal_description: foodDescription,
        action: 'log'
      });
      
      if (result.success) {
        setMessage('Food logged successfully!');
        setFoodDescription('');
        
        // Refresh data without unnecessary delays
        try {
          setMessage('Updating food log...');
          await apiCallWithRetry('/api/food', 'POST', {
            user_id: parseInt(user.id),
            action: 'get_stats'
          });
          await loadInitialData();
        } catch (error) {
          console.warn('Failed to refresh food data:', error);
          // Even if refresh fails, the food was logged successfully
        }
      } else {
        setMessage(result.message || 'Failed to log food. Please try again.');
      }
    } catch (error) {
      console.error('Food logging error:', error);
      setMessage(`Failed to log food after multiple attempts: ${error.message || 'Unknown error'}. Please try again.`);
    } finally {
      setLoading(false);
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

  // Sort by timestamp from DB
  const sortedData = [...glucoseData].sort(
    (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
  );

  // Take the last 7 readings
  const last7Readings = sortedData.slice(-7);

  const maxReading = Math.max(...last7Readings.map(d => d.reading));
  const minReading = Math.min(...last7Readings.map(d => d.reading));
  const range = maxReading - minReading || 50;

  return (
    <div style={{ height: '220px', position: 'relative' }}>
      {/* Y-axis labels */}
      <div
        style={{
          position: 'absolute',
          left: '0',
          top: '0',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          fontSize: '12px',
          color: '#666'
        }}
      >
        <span>{Math.round(maxReading + 20)}</span>
        <span>{Math.round((maxReading + minReading) / 2)}</span>
        <span>{Math.round(minReading - 20)}</span>
      </div>

      {/* Chart container */}
      <div
        style={{
          marginLeft: '40px',
          height: '100%',
          position: 'relative',
          border: '1px solid #e5e7eb',
          borderRadius: '6px',
          padding: '10px',
          background: 'linear-gradient(to bottom,rgb(200, 208, 215), #f3f4f6)'
        }}
      >
        {/* Polyline graph */}
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          width="100%"
          height="100%"
          style={{ position: 'absolute', top: 0, left: 0 }}
        >
          <polyline
            points={last7Readings
              .map((d, i) => {
                const x = (i / (last7Readings.length - 1)) * 100;
                const y =
                  100 - ((d.reading - (minReading - 20)) / (range + 40)) * 100;
                return `${x},${y}`;
              })
              .join(' ')}
            fill="none"
            stroke="#4f46e5"
            strokeWidth="1"
          />

          {last7Readings.map((d, i) => {
            const x = (i / (last7Readings.length - 1)) * 100;
            const y =
              100 - ((d.reading - (minReading - 20)) / (range + 40)) * 100;
            return (
              <circle
                key={i}
                cx={x}
                cy={y}
                r="1.2"
                fill={getGlucoseStatus(d.reading).color}
                stroke="white"
                strokeWidth="0.3"
              >
                <title>
                  {`Glucose: ${d.reading} on ${new Date(
                    d.timestamp
                  ).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric'
                  })}`}
                </title>
              </circle>
            );
          })}
        </svg>

        {/* X-axis labels from DB */}
        <div
          style={{
            position: 'absolute',
            bottom: '-25px',
            left: '0',
            right: '0',
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: '12px',
            color: '#444'
          }}
        >
          {last7Readings.map((d, i) => (
            <span key={i}>
              {new Date(d.timestamp).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric'
              })}
            </span>
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

  const last7DaysData = moodData.slice(0, 7);

  const moodCounts = last7DaysData.reduce((acc, entry) => {
    const mood = entry.mood.toLowerCase().trim();
    acc[mood] = (acc[mood] || 0) + 1;
    return acc;
  }, {});

  const moodColors = {
    happy: '#10b981',
    sad: '#3b82f6',
    anxious: '#f59e0b',
    tired: '#6b7280',
    angry: '#ef4444',
    calm: '#8b5cf6'
  };

  const maxCount = Math.max(...Object.values(moodCounts));

  return (
    <div
      style={{
        height: '250px',
        padding: '20px',
        borderRadius: '5px',
        background: 'linear-gradient(135deg, #d9e4f5, #f9fafc)',
        boxShadow: '0px 8px 20px rgba(0,0,0,0.1)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between'
      }}
    >

      <div
        style={{
          display: 'flex',
          alignItems: 'end',
          height: '180px',
          gap: '16px',
          justifyContent: 'space-around',
          paddingTop: '10px'
        }}
      >
        {Object.entries(moodCounts).map(([mood, count]) => (
          <div
            key={mood}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              flex: 1,
              transition: 'transform 0.2s ease',
              cursor: 'pointer'
            }}
            onMouseEnter={e => e.currentTarget.style.transform = "scale(1.05)"}
            onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}
          >
            {/* Count Label */}
            <div
              style={{
                fontSize: '14px',
                fontWeight: '600',
                marginBottom: '6px',
                color: '#333'
              }}
            >
              {count}
            </div>

            {/* Mood Bar */}
            <div
              style={{
                width: '100%',
                maxWidth: '50px',
                height: `${(count / maxCount) * 140}px`,
                background: `linear-gradient(180deg, ${moodColors[mood] || '#6b7280'})`,
                borderRadius: '10px',
                minHeight: '20px',
                boxShadow: '0px 2px 6px rgba(0,0,0,0.1)',
                transition: 'height 0.3s ease'
              }}
            ></div>

            {/* Mood Label */}
            <div
              style={{
                fontSize: '13px',
                color: '#555',
                marginTop: '15px',
                marginBottom: '-25px',
                textAlign: 'center',
                fontWeight: '500'
              }}
            >
              {mood.charAt(0).toUpperCase() + mood.slice(1)}
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
      // Add a thinking message to show the AI is processing
      const thinkingIndex = Date.now();
      setChatMessages(prev => [...prev, { 
        type: 'assistant', 
        message: 'Thinking...',
        isThinking: true,
        id: thinkingIndex
      }]);
      
      const result = await apiCallWithRetry('/api/interrupt', 'POST', {
        user_id: parseInt(user.id),
        query: userMessage,
        current_context: { active_agent: activeSection }
      });
      
      // Remove the thinking message
      setChatMessages(prev => prev.filter(msg => !(msg.isThinking && msg.id === thinkingIndex)));
      
      if (result.success) {
        setChatMessages(prev => [...prev, { 
          type: 'assistant', 
          message: result.message,
          suggestion: result.navigation_suggestion 
        }]);
      } else {
        setChatMessages(prev => [...prev, { 
          type: 'assistant', 
          message: result.message || 'Sorry, I encountered an error. Please try again.' 
        }]);
      }
    } catch (error) {
      console.error('Chat error:', error);
      // Remove the thinking message
      setChatMessages(prev => prev.filter(msg => !msg.isThinking));
      
      setChatMessages(prev => [...prev, { 
        type: 'assistant', 
        message: `Sorry, I encountered an error after multiple attempts: ${error.message || 'Unknown error'}. Please try again.` 
      }]);
    }
  };

  // Send initial greeting when user enters chat
  useEffect(() => {
  if (activeSection === "chat") {
    setChatMessages([
      { type: "assistant", message: `Hi ${user.first_name}, I'm your AI Health Assistant. How can I help you today?` }
    ]);
  }
}, [activeSection]);

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
            
            {/* Third Row: Empty - Food logs moved to dedicated section */}
            {/* Food logs are now only visible in the Food Logger section as requested */}
          </>
        )}

        {activeSection === 'mood' && (
        <>
          <div style={{
            background: '#ffffff',
            padding: '28px',
            borderRadius: '16px',
            boxShadow: '0 8px 20px rgba(0, 0, 0, 0.12)',
            marginBottom: '24px',
            maxWidth: '100%',
            margin: 'auto'
          }}>
            <h3 style={{
              fontSize: '20px',
              fontWeight: '600',
              color: '#111827',
              textAlign: 'center'
            }}>
              How are you feeling today?

            </h3>
            
            {/* Free text mood input */}
            <form onSubmit={handleMoodTextInput} style={{ marginBottom: '24px' }}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                  Describe your mood or just tap to express it
                </label>
                <textarea
                  name="moodText"
                  placeholder="Example: I'm feeling great today after my morning workout!"
                  rows={2}
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
                disabled={loading}
                style={{
                  padding: '10px 16px',
                  background: '#667eea',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                {loading ? 'Processing...' : 'Log Mood from Text'}
              </button>
            </form>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)', // Forces 3 columns
              gap: '20px',
              marginTop: '24px'
            }}>

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
                    padding: '18px',
                    background: `linear-gradient(135deg, ${mood.color}55, ${mood.color}22)`,
                    border: 'none',
                    borderRadius: '12px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    textAlign: 'center',
                    boxShadow: `0 4px 12px ${mood.color}33`,
                    transition: 'transform 0.2s, box-shadow 0.2s',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
                  onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                >
                  <div style={{
                    fontSize: '28px',
                    marginBottom: '8px',
                    background: '#fff',
                    borderRadius: '50%',
                    padding: '12px',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.1)'
                  }}>
                    {mood.emoji}
                  </div>
                  <div style={{
                    fontWeight: '500',
                    color: '#1f2937'
                  }}>{mood.name}</div>
                </button>
              ))}
            </div>
          </div>
        </>
      )}


        {activeSection === 'glucose' && (
          <>
            
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
          </>
        )}

        {activeSection === 'food' && (
          <>
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
                    {(entry.nutrition || entry.nutritional_analysis || (entry.estimated_carbs !== undefined && entry.estimated_protein !== undefined && entry.estimated_fat !== undefined)) && (
                      <div style={{ marginBottom: '12px' }}>
                        <h4 style={{ fontSize: '14px', color: '#667eea', marginBottom: '8px' }}>Nutritional Analysis:</h4>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '8px' }}>
                          {/* Calories */}
                          <div style={{ padding: '8px', background: '#fef3c7', borderRadius: '6px', textAlign: 'center' }}>
                            <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#d97706' }}>
                              {entry.nutrition?.calories || entry.nutritional_analysis?.calories || Math.round(entry.estimated_calories) || Math.round((entry.estimated_carbs * 4) + (entry.estimated_protein * 4) + (entry.estimated_fat * 9)) || 'N/A'}
                            </div>
                            <div style={{ fontSize: '12px', color: '#92400e' }}>Calories</div>
                          </div>
                          
                          {/* Protein */}
                          <div style={{ padding: '8px', background: '#dbeafe', borderRadius: '6px', textAlign: 'center' }}>
                            <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#2563eb' }}>
                              {entry.nutrition?.protein || entry.nutritional_analysis?.protein || entry.estimated_protein || 'N/A'}g
                            </div>
                            <div style={{ fontSize: '12px', color: '#1d4ed8' }}>Protein</div>
                          </div>
                          
                          {/* Carbohydrates */}
                          <div style={{ padding: '8px', background: '#dcfce7', borderRadius: '6px', textAlign: 'center' }}>
                            <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#16a34a' }}>
                              {entry.nutrition?.carbs || entry.nutritional_analysis?.carbs || entry.nutritional_analysis?.carbohydrates || entry.estimated_carbs || 'N/A'}g
                            </div>
                            <div style={{ fontSize: '12px', color: '#15803d' }}>Carbs</div>
                          </div>
                          
                          {/* Fat */}
                          <div style={{ padding: '8px', background: '#fce7f3', borderRadius: '6px', textAlign: 'center' }}>
                            <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#db2777' }}>
                              {entry.nutrition?.fat || entry.nutritional_analysis?.fat || entry.estimated_fat || 'N/A'}g
                            </div>
                            <div style={{ fontSize: '12px', color: '#be185d' }}>Fat</div>
                          </div>
                        </div>
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
            <div style={{
              background: 'white',
              padding: '24px',
              borderRadius: '12px',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)',
              marginBottom: '24px'
            }}>
              {(() => {
                try {
                  return (
                    <MealPlanner 
                      userId={parseInt(user?.id || 1)}
                      userContext={{
                        first_name: user?.first_name || 'User',
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
                      onComplete={() => {
                        setMessage('Meal plan generated successfully!');
                        // Refresh data to include the new meal plan
                        setTimeout(() => loadInitialData(), 1000);
                      }}
                    />
                  );
                } catch (error) {
                  console.error('MealPlanner Error:', error);
                  return (
                    <div style={{ padding: '20px', background: '#fed7d7', borderRadius: '8px' }}>
                      <h3>Error Loading Meal Planner</h3>
                      <p>Error: {error.message}</p>
                      <button 
                        onClick={() => window.location.reload()} 
                        style={{
                          padding: '10px 16px',
                          background: '#667eea',
                          color: 'white',
                          border: 'none',
                          borderRadius: '8px',
                          fontWeight: '600',
                          cursor: 'pointer',
                          marginTop: '10px'
                        }}
                      >
                        Reload Page
                      </button>
                    </div>
                  );
                }
              })()}
            </div>
          </>
        )}

        {activeSection === "chat" && (
        <>
          <div style={{
            background: "white",
            padding: "24px",
            borderRadius: "12px",
            boxShadow: "0 4px 20px rgba(0, 0, 0, 0.1)",
            height: "600px",
            display: "flex",
            flexDirection: "column"
          }}>
            <h3>Chat with your AI Health Assistant</h3>
            <div style={{
              flex: 1,
              border: "1px solid #e2e8f0",
              borderRadius: "8px",
              padding: "16px",
              marginTop: "16px",
              marginBottom: "16px",
              overflowY: "auto",
              background: "#f8fafc",
              display: "flex",
              flexDirection: "column"
            }}>
              {chatMessages.length === 0 ? (
                <div style={{ color: "#666", fontStyle: "italic", textAlign: "center", marginTop: "40px" }}>
                  Start a conversation! Ask me about your health, get recommendations, or navigate to specific features.
                </div>
              ) : (
                chatMessages.map((msg, index) => (
                  <div 
                    key={index} 
                    style={msg.type === "user" ? userBubbleStyle : assistantBubbleStyle}
                  >
                    <div>{msg.message}</div>
                  </div>
                ))
              )}
            </div>

            {/* Chat input */}
            <form onSubmit={handleChatSubmit} style={{ display: "flex", gap: "12px" }}>
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder={`Ask me anything, ${user.first_name}...`}
                style={{
                  flex: 1,
                  padding: "12px",
                  border: "2px solid #e2e8f0",
                  borderRadius: "8px",
                  fontSize: "16px"
                }}
                disabled={loading}
              />
              <button
                type="submit"
                disabled={loading || !chatInput.trim()}
                style={{
                  padding: "12px 20px",
                  background: "#10b981",
                  color: "white",
                  border: "none",
                  borderRadius: "8px",
                  fontWeight: "600",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px"
                }}
              >
                <Send size={16} />
                {loading ? "Sending..." : "Send"}
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
