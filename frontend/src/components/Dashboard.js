// frontend/src/components/Dashboard.js
import React, { useState } from 'react';
import MoodTracker from './MoodTracker';
import CGMChart from './CGMChart';
import FoodLogger from './FoodLogger';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp, Heart, Activity, Utensils, Target, AlertCircle } from 'lucide-react';

const Dashboard = ({ user, summary, onRefresh }) => {
  const [activeWidget, setActiveWidget] = useState(null);

  // Process mood data for chart
  const processMoodData = () => {
    if (!summary?.mood_summary?.mood_history) return [];
    
    const moodValues = {
      'happy': 5, 'calm': 4, 'tired': 2, 'anxious': 2,
     'sad': 1, 'angry': 1
    };
    
    return summary.mood_summary.mood_history
      .slice(0, 7)
      .reverse()
      .map((entry, index) => ({
        day: `Day ${index + 1}`,
        mood: entry.mood,
        score: moodValues[entry.mood] || 3,
        timestamp: entry.timestamp
      }));
  };

  // Process CGM data for chart
  const processCGMData = () => {
    if (!summary?.cgm_summary?.cgm_history) return [];
    
    return summary.cgm_summary.cgm_history
      .slice(0, 10)
      .reverse()
      .map((entry, index) => ({
        reading: `#${index + 1}`,
        glucose: entry.glucose_reading,
        status: entry.status,
        timestamp: entry.timestamp,
        isAlert: entry.alert_flag
      }));
  };

  // Get health status based on recent data
  const getHealthStatus = () => {
    const alerts = [];
    let overallStatus = 'good';

    // Check mood trends
    if (summary?.mood_summary?.mood_stats?.trend === 'declining') {
      alerts.push('Mood trending downward - consider stress management techniques');
      overallStatus = 'attention';
    }

    // Check glucose control
    if (summary?.cgm_summary?.cgm_stats?.time_in_range < 70) {
      alerts.push('Glucose control needs improvement - review meal planning');
      overallStatus = 'attention';
    }

    // Check for alerts
    if (summary?.cgm_summary?.cgm_stats?.alerts > 0) {
      alerts.push(`${summary.cgm_summary.cgm_stats.alerts} glucose alerts in the past week`);
      overallStatus = 'attention';
    }

    return { status: overallStatus, alerts };
  };

  const healthStatus = getHealthStatus();
  const moodData = processMoodData();
  const cgmData = processCGMData();

  const StatCard = ({ title, value, subtitle, icon: Icon, color, trend }) => (
    <div className={`stat-card ${color}`}>
      <div className="stat-header">
        <Icon className="stat-icon" />
        <span className="stat-title">{title}</span>
      </div>
      <div className="stat-value">{value}</div>
      <div className="stat-subtitle">
        {subtitle}
        {trend && (
          <span className={`trend ${trend > 0 ? 'up' : trend < 0 ? 'down' : 'stable'}`}>
            <TrendingUp className="trend-icon" />
          </span>
        )}
      </div>
    </div>
  );

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <h1>Health Dashboard</h1>
        <p>Hello {user.first_name}! Here's your health overview.</p>
        
        {healthStatus.alerts.length > 0 && (
          <div className="health-alerts">
            <AlertCircle className="alert-icon" />
            <div className="alert-content">
              <h3>Health Alerts</h3>
              <ul>
                {healthStatus.alerts.map((alert, index) => (
                  <li key={index}>{alert}</li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>

      <div className="stats-grid">
        <StatCard
          title="Average Mood"
          value={summary?.mood_summary?.mood_stats?.average_score?.toFixed(1) || '3.0'}
          subtitle={`${summary?.mood_summary?.mood_stats?.total_entries || 0} entries`}
          icon={Heart}
          color="mood"
        />
        
        <StatCard
          title="Glucose Control"
          value={`${summary?.cgm_summary?.cgm_stats?.time_in_range?.toFixed(0) || '0'}%`}
          subtitle="Time in range (70-180 mg/dL)"
          icon={Activity}
          color="glucose"
        />
        
        <StatCard
          title="Daily Calories"
          value={`${summary?.nutrition_summary?.nutrition_stats?.daily_averages?.calories?.toFixed(0) || '0'}`}
          subtitle={`${summary?.nutrition_summary?.nutrition_stats?.total_entries || 0} meals logged`}
          icon={Utensils}
          color="nutrition"
        />
        
        <StatCard
          title="Health Score"
          value={healthStatus.status === 'good' ? '85' : '72'}
          subtitle={healthStatus.status === 'good' ? 'Great progress!' : 'Needs attention'}
          icon={Target}
          color={healthStatus.status}
        />
      </div>

      <div className="charts-grid">
        {moodData.length > 0 && (
          <div className="chart-container">
            <h3>Mood Trends (Last 7 Days)</h3>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={moodData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="day" />
                <YAxis domain={[1, 5]} />
                <Tooltip 
                  labelFormatter={(label) => `Day: ${label}`}
                  formatter={(value, name) => [value, 'Mood Score']}
                />
                <Line 
                  type="monotone" 
                  dataKey="score" 
                  stroke="#8884d8" 
                  strokeWidth={2}
                  dot={{ fill: '#8884d8', strokeWidth: 2, r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {cgmData.length > 0 && (
          <div className="chart-container">
            <h3>Glucose Readings (Latest 10)</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={cgmData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="reading" />
                <YAxis domain={[60, 300]} />
                <Tooltip 
                  formatter={(value, name) => [`${value} mg/dL`, 'Glucose']}
                />
                <Bar 
                  dataKey="glucose" 
                  fill={(entry) => entry.isAlert ? '#ff6b6b' : '#4ecdc4'}
                  stroke="#333"
                  strokeWidth={1}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="quick-actions">
        <h3>Quick Actions</h3>
        <div className="action-buttons">
          <button 
            className="action-btn mood"
            onClick={() => setActiveWidget('mood')}
          >
            <Heart className="btn-icon" />
            Track Mood
          </button>
          
          <button 
            className="action-btn glucose"
            onClick={() => setActiveWidget('glucose')}
          >
            <Activity className="btn-icon" />
            Log Glucose
          </button>
          
          <button 
            className="action-btn food"
            onClick={() => setActiveWidget('food')}
          >
            <Utensils className="btn-icon" />
            Log Food
          </button>
          
          <button 
            className="action-btn meal-plan"
            onClick={() => setActiveWidget('meal-plan')}
          >
            <Target className="btn-icon" />
            Get Meal Plan
          </button>
        </div>
      </div>

      {/* Widget overlays */}
      {activeWidget === 'mood' && (
        <div className="widget-overlay">
          <div className="widget-modal">
            <button 
              className="close-btn"
              onClick={() => setActiveWidget(null)}
            >
              ×
            </button>
            <MoodTracker 
              userId={user.id} 
              onComplete={() => {
                setActiveWidget(null);
                onRefresh();
              }}
            />
          </div>
        </div>
      )}

      {activeWidget === 'glucose' && (
        <div className="widget-overlay">
          <div className="widget-modal">
            <button 
              className="close-btn"
              onClick={() => setActiveWidget(null)}
            >
              ×
            </button>
            <CGMChart 
              userId={user.id} 
              onComplete={() => {
                setActiveWidget(null);
                onRefresh();
              }}
            />
          </div>
        </div>
      )}

      {activeWidget === 'food' && (
        <div className="widget-overlay">
          <div className="widget-modal">
            <button 
              className="close-btn"
              onClick={() => setActiveWidget(null)}
            >
              ×
            </button>
            <FoodLogger 
              userId={user.id} 
              onComplete={() => {
                setActiveWidget(null);
                onRefresh();
              }}
            />
          </div>
        </div>
      )}

      {activeWidget === 'meal-plan' && (
        <div className="widget-overlay">
          <div className="widget-modal large">
            <button 
              className="close-btn"
              onClick={() => setActiveWidget(null)}
            >
              ×
            </button>
            <MealPlanner 
              userId={user.id} 
              userContext={user}
              onComplete={() => {
                setActiveWidget(null);
                onRefresh();
              }}
            />
          </div>
        </div>
      )}

      <div className="dashboard-footer">
        <button onClick={onRefresh} className="refresh-btn">
          Refresh Data
        </button>
        <p>Last updated: {new Date().toLocaleString()}</p>
      </div>
    </div>
  );
};

export default Dashboard;