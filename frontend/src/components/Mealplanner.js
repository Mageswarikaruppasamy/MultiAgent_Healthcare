// frontend/src/components/MealPlanner.js
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Calendar, Clock, Target, Utensils, Leaf, Heart } from 'lucide-react';
import './Mealplanner.css';

const MealPlanner = ({ userId, userContext, onComplete }) => {
  const [specialRequirements, setSpecialRequirements] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [mealPlan, setMealPlan] = useState(null);
  const [showLatest, setShowLatest] = useState(false);

  useEffect(() => {
    if (userId) {
      loadLatestMealPlan();
    }
  }, [userId]);

  const loadLatestMealPlan = async () => {
    try {
      const response = await axios.post('http://localhost:8000/api/meal-plan', {
        user_id: userId,
        action: 'get_latest'
      }, {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });

      if (response.data.success) {
        setMealPlan(response.data.meal_plan);
        setShowLatest(true);
      }
    } catch (error) {
      console.error('Failed to load latest meal plan:', error);
      // Don't show error to user for initial load failure
    }
  };

  const handleGeneratePlan = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    setMealPlan(null);

    try {
      const response = await axios.post('http://localhost:8000/api/meal-plan', {
        user_id: userId,
        special_requirements: specialRequirements,
        action: 'generate'
      }, {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 30000 // Longer timeout for generation
      });

      if (response.data.success) {
        setMessage('✅ New meal plan generated successfully!');
        setMealPlan(response.data.meal_plan);
        setShowLatest(false);
        setSpecialRequirements('');
        
        setTimeout(() => {
          onComplete && onComplete();
        }, 5000);
      } else {
        setMessage(`Error: ${response.data.message}`);
      }
    } catch (error) {
      console.error('Meal plan generation error:', error);
      setMessage('Failed to generate meal plan. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const getMealIcon = (mealType) => {
    const icons = {
      breakfast: '🌅',
      lunch: '☀️',
      dinner: '🌙'
    };
    return icons[mealType] || '🍽️';
  };

  const formatNutrition = (nutrition) => {
    if (!nutrition) return 'N/A';
    return {
      calories: Math.round(nutrition.calories || 0),
      carbs: Math.round((nutrition.carbs || 0) * 10) / 10,
      protein: Math.round((nutrition.protein || 0) * 10) / 10,
      fat: Math.round((nutrition.fat || 0) * 10) / 10,
      fiber: Math.round((nutrition.fiber || 0) * 10) / 10
    };
  };

  return (
    <div className="meal-planner">
      <h2>Personalized Meal Planner</h2>
      <p>Get meal recommendations tailored to your health profile</p>

      {userContext && (
        <div className="user-profile">
          <h3>Your Profile</h3>
          <div className="profile-tags">
            <span className="tag dietary">
              <Leaf className="tag-icon" />
              {userContext.dietary_preference}
            </span>
            {userContext.medical_conditions?.filter(c => c !== 'None').map((condition, index) => (
              <span key={index} className="tag medical">
                <Heart className="tag-icon" />
                {condition}
              </span>
            ))}
          </div>
        </div>
      )}

      <form onSubmit={handleGeneratePlan} className="meal-form">
        <div className="input-group">
          <label htmlFor="requirements">Special Requirements (Optional)</label>
          <textarea
            id="requirements"
            value={specialRequirements}
            onChange={(e) => setSpecialRequirements(e.target.value)}
            placeholder="Any specific dietary needs, food preferences, or restrictions for this meal plan..."
            rows={3}
            className="requirements-input"
            maxLength={300}
          />
        </div>

        <button 
          type="submit" 
          disabled={loading}
          className="generate-btn"
        >
          <Target className="btn-icon" />
          {loading ? 'Generating Plan...' : 'Generate New Meal Plan'}
        </button>
      </form>

      {showLatest && !loading && mealPlan && (
        <div className="latest-plan-notice">
          <Clock className="notice-icon" />
          <span>Showing your latest meal plan. Generate a new one above if needed.</span>
        </div>
      )}

      {loading && (
        <div className="loading-message">
          <div className="spinner"></div>
          <p>Generating your personalized meal plan...</p>
          <small>This may take a moment while we analyze your health profile</small>
        </div>
      )}

      {mealPlan && (
        <div className="meal-plan-result">
          <h3>Your Meal Plan</h3>
          
          <div className="meals-container">
            {['breakfast', 'lunch', 'dinner'].map((mealType) => {
              const meal = mealPlan[mealType];
              const nutrition = formatNutrition(meal?.estimated_nutrition);
              
              return (
                <div key={mealType} className="meal-card">
                  <div className="meal-header">
                    <span className="meal-icon">{getMealIcon(mealType)}</span>
                    <h4>{mealType.charAt(0).toUpperCase() + mealType.slice(1)}</h4>
                  </div>
                  
                  <div className="meal-content">
                    <h5 className="meal-name">{meal?.name || 'Not specified'}</h5>
                    <p className="meal-description">{meal?.description || 'No description available'}</p>
                    
                    {meal?.ingredients && (
                      <div className="ingredients">
                        <strong>Ingredients:</strong>
                        <ul>
                          {meal.ingredients.map((ingredient, index) => (
                            <li key={index}>{ingredient}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    
                    <div className="meal-nutrition">
                      <div className="nutrition-row">
                        <span className="nutrition-item">
                          <strong>{nutrition.calories}</strong> cal
                        </span>
                        <span className="nutrition-item">
                          <strong>{nutrition.carbs}g</strong> carbs
                        </span>
                        <span className="nutrition-item">
                          <strong>{nutrition.protein}g</strong> protein
                        </span>
                        <span className="nutrition-item">
                          <strong>{nutrition.fat}g</strong> fat
                        </span>
                      </div>
                    </div>
                    
                    {meal?.health_benefits && (
                      <div className="health-benefits">
                        <strong>Health Benefits:</strong>
                        <div className="benefits-tags">
                          {meal.health_benefits.map((benefit, index) => (
                            <span key={index} className="benefit-tag">{benefit}</span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {mealPlan.daily_totals && (
            <div className="daily-totals">
              <h4>Daily Totals</h4>
              <div className="totals-grid">
                <div className="total-item">
                  <span className="total-value">{Math.round(mealPlan.daily_totals.calories || 0)}</span>
                  <span className="total-label">Calories</span>
                </div>
                <div className="total-item">
                  <span className="total-value">{Math.round(mealPlan.daily_totals.carbs || 0)}g</span>
                  <span className="total-label">Carbs</span>
                </div>
                <div className="total-item">
                  <span className="total-value">{Math.round(mealPlan.daily_totals.protein || 0)}g</span>
                  <span className="total-label">Protein</span>
                </div>
                <div className="total-item">
                  <span className="total-value">{Math.round(mealPlan.daily_totals.fat || 0)}g</span>
                  <span className="total-label">Fat</span>
                </div>
                {mealPlan.daily_totals.fiber && (
                  <div className="total-item">
                    <span className="total-value">{Math.round(mealPlan.daily_totals.fiber || 0)}g</span>
                    <span className="total-label">Fiber</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {mealPlan.special_notes && (
            <div className="special-notes">
              <h4>💡 Special Notes</h4>
              <ul>
                {mealPlan.special_notes.map((note, index) => (
                  <li key={index}>{note}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {message && (
        <div className={`message ${message.includes('Error') ? 'error' : 'success'}`}>
          {message}
        </div>
      )}

      <div className="meal-planning-tips">
        <h3>🍽️ Meal Planning Tips</h3>
        <ul>
          <li>Plans are personalized based on your dietary preferences and health conditions</li>
          <li>Feel free to swap similar ingredients based on availability</li>
          <li>Consider meal prep to save time during busy days</li>
          <li>Stay hydrated and listen to your body's hunger cues</li>
        </ul>
      </div>
    </div>
  );
};

export default MealPlanner;