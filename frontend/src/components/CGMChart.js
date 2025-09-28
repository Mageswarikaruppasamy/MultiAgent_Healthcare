// frontend/src/components/CGMChart.js
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Activity, TrendingUp, AlertTriangle, BarChart3, Zap, Target } from 'lucide-react';

const CGMChart = ({ userId, onComplete }) => {
  const [glucoseReading, setGlucoseReading] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [lastReading, setLastReading] = useState(null);
  const [showHistory, setShowHistory] = useState(false);
  const [glucoseHistory, setGlucoseHistory] = useState([]);

  const handleManualEntry = async (e) => {
    e.preventDefault();
    if (!glucoseReading) return;

    setLoading(true);
    setMessage('');

    try {
      const response = await axios.post('/api/cgm', {
        user_id: userId,
        glucose_reading: parseInt(glucoseReading),
        action: 'log'
      });

      if (response.data.success) {
        setMessage(response.data.message);
        setLastReading({
          value: response.data.glucose_reading,
          status: response.data.status,
          alert: response.data.alert_flag,
          recommendations: response.data.recommendations
        });
        setGlucoseReading('');
        
        setTimeout(() => {
          onComplete && onComplete();
        }, 3000);
      } else {
        setMessage(`Error: ${response.data.message}`);
      }
    } catch (error) {
      console.error('CGM logging error:', error);
      setMessage('Failed to log glucose reading. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateReading = async () => {
    setLoading(true);
    setMessage('');

    try {
      const response = await axios.post('/api/cgm', {
        user_id: userId,
        action: 'generate'
      });

      if (response.data.success) {
        setMessage(response.data.message);
        setLastReading({
          value: response.data.glucose_reading,
          status: response.data.status,
          alert: response.data.alert_flag,
          recommendations: response.data.recommendations
        });
        
        setTimeout(() => {
          onComplete && onComplete();
        }, 3000);
      } else {
        setMessage(`Error: ${response.data.message}`);
      }
    } catch (error) {
      console.error('CGM generation error:', error);
      setMessage('Failed to generate glucose reading. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const loadGlucoseHistory = async () => {
    try {
      const response = await axios.post('/api/cgm', {
        user_id: userId,
        action: 'get_stats'
      });

      if (response.data.success && response.data.cgm_stats) {
        setGlucoseHistory(response.data.cgm_stats);
        setShowHistory(true);
      }
    } catch (error) {
      console.error('Failed to load glucose history:', error);
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      'critically_low': '#dc2626',
      'low': '#f97316',
      'normal': '#10b981',
      'elevated': '#f59e0b',
      'high': '#dc2626',
      'critically_high': '#7c2d12'
    };
    return colors[status] || '#6b7280';
  };

  const getStatusIcon = (status) => {
    if (status === 'critically_low' || status === 'critically_high') {
      return <AlertTriangle className="status-icon critical" />;
    }
    if (status === 'normal') {
      return <Target className="status-icon normal" />;
    }
    return <Activity className="status-icon" />;
  };

  const getStatusLabel = (status) => {
    const labels = {
      'critically_low': 'Critical Low',
      'low': 'Low',
      'normal': 'Normal',
      'elevated': 'Elevated',
      'high': 'High',
      'critically_high': 'Critical High'
    };
    return labels[status] || status;
  };

  const getGlucoseCategory = (reading) => {
    if (reading < 70) return 'critically_low';
    if (reading < 80) return 'low';
    if (reading <= 140) return 'normal';
    if (reading <= 180) return 'elevated';
    if (reading <= 250) return 'high';
    return 'critically_high';
  };

  return (
    <div className="cgm-chart">
      <div className="cgm-header">
        <h2>
          <Activity className="component-icon" />
          Glucose Monitor
        </h2>
        <p>Track your blood glucose levels with intelligent analysis</p>
        
        <div className="action-buttons">
          <button 
            onClick={loadGlucoseHistory}
            className="history-btn"
            disabled={loading}
          >
            <BarChart3 className="btn-icon" />
            View History
          </button>
        </div>
      </div>

      {showHistory && (
        <div className="history-overlay">
          <div className="history-modal">
            <button 
              className="close-history-btn"
              onClick={() => setShowHistory(false)}
            >
              ×
            </button>
            <h3>Glucose Statistics</h3>
            <div className="stats-summary">
              {glucoseHistory.total_readings > 0 ? (
                <div className="stats-grid">
                  <div className="stat-card">
                    <div className="stat-value">{glucoseHistory.average_reading}</div>
                    <div className="stat-label">Average Reading</div>
                    <div className="stat-unit">mg/dL</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-value">{glucoseHistory.time_in_range}%</div>
                    <div className="stat-label">Time in Range</div>
                    <div className="stat-unit">70-180 mg/dL</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-value">{glucoseHistory.total_readings}</div>
                    <div className="stat-label">Total Readings</div>
                    <div className="stat-unit">this week</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-value">{glucoseHistory.alerts}</div>
                    <div className="stat-label">Alerts</div>
                    <div className="stat-unit">critical levels</div>
                  </div>
                </div>
              ) : (
                <p className="no-data">No glucose readings recorded yet</p>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="cgm-actions">
        <form onSubmit={handleManualEntry} className="manual-entry">
          <div className="input-group">
            <label htmlFor="glucose">Enter Glucose Reading</label>
            <div className="input-with-unit">
              <input
                id="glucose"
                type="number"
                min="60"
                max="350"
                value={glucoseReading}
                onChange={(e) => setGlucoseReading(e.target.value)}
                placeholder="Enter reading"
                className="glucose-input"
                disabled={loading}
              />
              <span className="input-unit">mg/dL</span>
            </div>
            <div className="input-hint">
              Normal range: 80-180 mg/dL
            </div>
          </div>
          <button 
            type="submit" 
            disabled={loading || !glucoseReading}
            className="log-btn manual"
          >
            <Target className="btn-icon" />
            Log Reading
          </button>
        </form>

        <div className="divider">
          <span>OR</span>
        </div>

        <div className="generate-section">
          <p className="generate-description">
            Generate a realistic reading based on your health profile
          </p>
          <button 
            onClick={handleGenerateReading}
            disabled={loading}
            className="log-btn generate"
          >
            <Zap className="btn-icon" />
            Generate Realistic Reading
          </button>
        </div>
      </div>

      {loading && (
        <div className="loading-message">
          <div className="spinner"></div>
          <p>Processing glucose reading...</p>
          <small>Analyzing your reading and generating recommendations</small>
        </div>
      )}

      {lastReading && (
        <div className="reading-result">
          <div className="reading-display" style={{ '--status-color': getStatusColor(lastReading.status) }}>
            <div className="reading-header">
              {getStatusIcon(lastReading.status)}
              <div className="reading-info">
                <div className="reading-value">
                  <span className="value">{lastReading.value}</span>
                  <span className="unit">mg/dL</span>
                </div>
                <div className="reading-status">
                  {getStatusLabel(lastReading.status)}
                </div>
              </div>
            </div>

            {lastReading.alert && (
              <div className="alert-banner">
                <AlertTriangle className="alert-icon" />
                <span>⚠️ This reading requires immediate attention!</span>
              </div>
            )}

            <div className="reading-visual">
              <div className="glucose-meter">
                <div className="meter-track">
                  <div className="meter-ranges">
                    <div className="range critical-low" style={{ width: '15%' }}></div>
                    <div className="range low" style={{ width: '10%' }}></div>
                    <div className="range normal" style={{ width: '40%' }}></div>
                    <div className="range elevated" style={{ width: '20%' }}></div>
                    <div className="range high" style={{ width: '15%' }}></div>
                  </div>
                  <div 
                    className="meter-pointer"
                    style={{ 
                      left: `${Math.min(Math.max((lastReading.value - 60) / (300 - 60) * 100, 0), 100)}%`,
                      backgroundColor: getStatusColor(lastReading.status)
                    }}
                  ></div>
                </div>
                <div className="meter-labels">
                  <span>60</span>
                  <span>180</span>
                  <span>300</span>
                </div>
              </div>
            </div>

            {lastReading.recommendations && lastReading.recommendations.length > 0 && (
              <div className="recommendations">
                <h4>📋 Recommendations:</h4>
                <ul>
                  {lastReading.recommendations.map((rec, index) => (
                    <li key={index}>{rec}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {message && (
        <div className={`message ${message.includes('Error') ? 'error' : 'success'}`}>
          {message}
        </div>
      )}

      <div className="glucose-ranges-guide">
        <h3>📊 Understanding Glucose Ranges</h3>
        <div className="ranges-grid">
          <div className="range-item critically-low">
            <div className="range-color"></div>
            <div className="range-info">
              <span className="range-label">Critical Low</span>
              <span className="range-values">&lt; 70 mg/dL</span>
              <span className="range-action">Immediate action required</span>
            </div>
          </div>
          <div className="range-item low">
            <div className="range-color"></div>
            <div className="range-info">
              <span className="range-label">Low</span>
              <span className="range-values">70-79 mg/dL</span>
              <span className="range-action">Consider a snack</span>
            </div>
          </div>
          <div className="range-item normal">
            <div className="range-color"></div>
            <div className="range-info">
              <span className="range-label">Normal</span>
              <span className="range-values">80-180 mg/dL</span>
              <span className="range-action">Target range</span>
            </div>
          </div>
          <div className="range-item elevated">
            <div className="range-color"></div>
            <div className="range-info">
              <span className="range-label">Elevated</span>
              <span className="range-values">181-250 mg/dL</span>
              <span className="range-action">Monitor closely</span>
            </div>
          </div>
          <div className="range-item high">
            <div className="range-color"></div>
            <div className="range-info">
              <span className="range-label">High</span>
              <span className="range-values">&gt; 250 mg/dL</span>
              <span className="range-action">Consult healthcare provider</span>
            </div>
          </div>
        </div>
      </div>

      <div className="cgm-tips">
        <h3>🎯 Monitoring Tips</h3>
        <div className="tips-grid">
          <div className="tip-item">
            <div className="tip-icon">⏰</div>
            <div className="tip-content">
              <h5>Regular Monitoring</h5>
              <p>Check glucose levels at consistent times for better pattern recognition</p>
            </div>
          </div>
          <div className="tip-item">
            <div className="tip-icon">🍽️</div>
            <div className="tip-content">
              <h5>Pre/Post Meal</h5>
              <p>Monitor before and 2 hours after meals to understand food impact</p>
            </div>
          </div>
          <div className="tip-item">
            <div className="tip-icon">📱</div>
            <div className="tip-content">
              <h5>Track Patterns</h5>
              <p>Use the history feature to identify trends and share with your doctor</p>
            </div>
          </div>
          <div className="tip-item">
            <div className="tip-icon">🚨</div>
            <div className="tip-content">
              <h5>Emergency Plan</h5>
              <p>Know what to do for critical highs and lows - contact your healthcare provider</p>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        .cgm-chart {
          max-width: 800px;
          margin: 0 auto;
          padding: 20px;
        }

        .cgm-header {
          text-align: center;
          margin-bottom: 30px;
        }

        .cgm-header h2 {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          margin-bottom: 10px;
          color: #2d3748;
          font-size: 28px;
        }

        .component-icon {
          width: 28px;
          height: 28px;
          color: #38b2ac;
        }

        .action-buttons {
          margin-top: 15px;
        }

        .history-btn {
          padding: 8px 16px;
          background: #f7fafc;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 8px;
          transition: all 0.2s;
        }

        .history-btn:hover {
          background: #edf2f7;
          border-color: #cbd5e0;
        }

        .history-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }

        .history-modal {
          background: white;
          border-radius: 16px;
          padding: 24px;
          max-width: 600px;
          width: 90%;
          max-height: 80vh;
          overflow-y: auto;
          position: relative;
        }

        .close-history-btn {
          position: absolute;
          top: 15px;
          right: 20px;
          background: none;
          border: none;
          font-size: 24px;
          cursor: pointer;
          color: #a0aec0;
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 16px;
          margin-top: 20px;
        }

        .stat-card {
          text-align: center;
          padding: 20px;
          background: #f7fafc;
          border-radius: 12px;
        }

        .stat-value {
          font-size: 28px;
          font-weight: bold;
          color: #2d3748;
          margin-bottom: 8px;
        }

        .stat-label {
          font-weight: 600;
          color: #4a5568;
          margin-bottom: 4px;
        }

        .stat-unit {
          font-size: 14px;
          color: #718096;
        }

        .cgm-actions {
          background: white;
          border-radius: 16px;
          padding: 24px;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
          margin-bottom: 30px;
        }

        .manual-entry {
          margin-bottom: 24px;
        }

        .input-group {
          margin-bottom: 20px;
        }

        .input-group label {
          display: block;
          margin-bottom: 8px;
          font-weight: 600;
          color: #2d3748;
        }

        .input-with-unit {
          position: relative;
          display: flex;
          align-items: center;
        }

        .glucose-input {
          flex: 1;
          padding: 16px;
          border: 2px solid #e2e8f0;
          border-radius: 12px;
          font-size: 16px;
          transition: border-color 0.2s;
        }

        .glucose-input:focus {
          outline: none;
          border-color: #38b2ac;
        }

        .input-unit {
          position: absolute;
          right: 16px;
          color: #718096;
          font-weight: 500;
          pointer-events: none;
        }

        .input-hint {
          font-size: 14px;
          color: #718096;
          margin-top: 4px;
        }

        .divider {
          display: flex;
          align-items: center;
          margin: 24px 0;
          color: #718096;
        }

        .divider::before,
        .divider::after {
          content: '';
          flex: 1;
          height: 1px;
          background: #e2e8f0;
        }

        .divider span {
          padding: 0 16px;
          font-size: 14px;
          font-weight: 500;
        }

        .generate-section {
          text-align: center;
        }

        .generate-description {
          color: #4a5568;
          margin-bottom: 16px;
          font-size: 14px;
        }

        .log-btn {
          padding: 14px 24px;
          border: none;
          border-radius: 12px;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          transition: all 0.2s;
          min-height: 48px;
        }

        .log-btn.manual {
          width: 100%;
          background: linear-gradient(135deg, #38b2ac 0%, #2c7a7b 100%);
          color: white;
        }

        .log-btn.generate {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 16px 32px;
        }

        .log-btn:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 8px 25px rgba(0, 0, 0, 0.15);
        }

        .log-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
          transform: none;
        }

        .btn-icon {
          width: 20px;
          height: 20px;
        }

        .reading-result {
          background: white;
          border-radius: 16px;
          padding: 24px;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
          margin-bottom: 30px;
        }

        .reading-display {
          border-left: 4px solid var(--status-color);
          padding-left: 20px;
        }

        .reading-header {
          display: flex;
          align-items: center;
          gap: 16px;
          margin-bottom: 20px;
        }

        .status-icon {
          width: 32px;
          height: 32px;
          color: var(--status-color);
        }

        .reading-value {
          display: flex;
          align-items: baseline;
          gap: 8px;
        }

        .reading-value .value {
          font-size: 36px;
          font-weight: bold;
          color: var(--status-color);
        }

        .reading-value .unit {
          font-size: 16px;
          color: #718096;
        }

        .reading-status {
          font-size: 16px;
          font-weight: 600;
          color: var(--status-color);
        }

        .alert-banner {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 16px;
          background: #fed7d7;
          border: 1px solid #fc8181;
          border-radius: 8px;
          margin-bottom: 20px;
          color: #c53030;
          font-weight: 600;
        }

        .alert-icon {
          width: 20px;
          height: 20px;
        }

        .reading-visual {
          margin: 20px 0;
        }

        .glucose-meter {
          width: 100%;
        }

        .meter-track {
          position: relative;
          height: 12px;
          border-radius: 6px;
          overflow: hidden;
          margin-bottom: 8px;
        }

        .meter-ranges {
          display: flex;
          height: 100%;
        }

        .range.critical-low { background: #dc2626; }
        .range.low { background: #f97316; }
        .range.normal { background: #10b981; }
        .range.elevated { background: #f59e0b; }
        .range.high { background: #dc2626; }

        .meter-pointer {
          position: absolute;
          top: -2px;
          width: 4px;
          height: 16px;
          border-radius: 2px;
          transform: translateX(-50%);
        }

        .meter-labels {
          display: flex;
          justify-content: space-between;
          font-size: 12px;
          color: #718096;
        }

        .recommendations {
          margin-top: 20px;
          padding: 16px;
          background: #f7fafc;
          border-radius: 8px;
        }

        .recommendations h4 {
          margin-bottom: 12px;
          color: #2d3748;
        }

        .recommendations ul {
          margin: 0;
          padding-left: 20px;
        }

        .recommendations li {
          margin-bottom: 8px;
          color: #4a5568;
          line-height: 1.5;
        }

        .glucose-ranges-guide {
          background: white;
          border-radius: 16px;
          padding: 24px;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
          margin-bottom: 30px;
        }

        .glucose-ranges-guide h3 {
          margin-bottom: 20px;
          color: #2d3748;
          text-align: center;
        }

        .ranges-grid {
          display: grid;
          gap: 12px;
        }

        .range-item {
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 16px;
          background: #f7fafc;
          border-radius: 8px;
        }

        .range-item .range-color {
          width: 20px;
          height: 20px;
          border-radius: 50%;
        }

        .range-item.critically-low .range-color { background: #dc2626; }
        .range-item.low .range-color { background: #f97316; }
        .range-item.normal .range-color { background: #10b981; }
        .range-item.elevated .range-color { background: #f59e0b; }
        .range-item.high .range-color { background: #dc2626; }

        .range-info {
          flex: 1;
        }

        .range-label {
          font-weight: 600;
          color: #2d3748;
          display: block;
        }

        .range-values {
          color: #4a5568;
          font-size: 14px;
          display: block;
        }

        .range-action {
          color: #718096;
          font-size: 12px;
          display: block;
        }

        .cgm-tips {
          background: white;
          border-radius: 16px;
          padding: 24px;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
        }

        .cgm-tips h3 {
          margin-bottom: 24px;
          color: #2d3748;
          text-align: center;
        }

        .tips-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 20px;
        }

        .tip-item {
          display: flex;
          gap: 16px;
          padding: 16px;
          background: #f7fafc;
          border-radius: 12px;
        }

        .tip-item .tip-icon {
          font-size: 24px;
          flex-shrink: 0;
        }

        .tip-content h5 {
          margin-bottom: 8px;
          color: #2d3748;
          font-size: 16px;
        }

        .tip-content p {
          color: #4a5568;
          font-size: 14px;
          line-height: 1.5;
        }

        @media (max-width: 768px) {
          .stats-grid {
            grid-template-columns: 1fr;
          }
          
          .tips-grid {
            grid-template-columns: 1fr;
          }
          
          .reading-header {
            flex-direction: column;
            text-align: center;
          }
        }
      `}</style>
    </div>
  );
};

export default CGMChart;