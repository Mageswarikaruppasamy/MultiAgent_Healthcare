import React, { useState, useEffect } from "react";
import axios from "axios";
import { Calendar, Clock, Target, Utensils, Leaf, Heart } from "lucide-react";
import "./Mealplanner.css";

// ====== SET BACKEND BASE URL ======
const API_BASE = "https://multiagent-healthcare-32b9.onrender.com"; // Change to your backend address

// ====== Axios helper with retry logic ======
async function apiCallWithRetry(endpoint, config = {}, maxRetries = 2) {
  let lastError;

  for (let i = 0; i <= maxRetries; i++) {
    try {
      const response = await axios({
        ...config,
        url: `${API_BASE}${endpoint}`,
        timeout: 35000,
        headers: {
          "Content-Type": "application/json",
          ...(config.headers || {})
        }
      });
      return response.data;
    } catch (error) {
      lastError = error;
      console.error(`API call failed (attempt ${i + 1}/${maxRetries + 1}):`, error);

      if ((error.response && error.response.status >= 400 && error.response.status < 500) || i === maxRetries) {
        throw error;
      }

      await new Promise((resolve) => setTimeout(resolve, Math.pow(2, i) * 1000));
    }
  }

  throw lastError;
}

const MealPlanner = ({ userId, userContext, onComplete }) => {
  const [specialRequirements, setSpecialRequirements] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [mealPlan, setMealPlan] = useState(null);
  const [showLatest, setShowLatest] = useState(false);

  useEffect(() => {
    loadLatestMealPlan();
  }, [userId]);

  const loadLatestMealPlan = async () => {
    try {
      const response = await apiCallWithRetry("/api/meal-plan", {
        method: "POST",
        data: {
          user_id: userId,
          action: "get_latest"
        }
      });

      if (response.success) {
        setMealPlan(response.meal_plan);
        setShowLatest(true);
      }
    } catch (error) {
      console.error("Failed to load latest meal plan:", error);
      setMessage("Unable to load latest meal plan.");
    }
  };

  const handleGeneratePlan = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    setMealPlan(null);

    try {
      const response = await apiCallWithRetry("/api/meal-plan", {
        method: "POST",
        data: {
          user_id: userId,
          special_requirements: specialRequirements,
          action: "generate"
        }
      });

      if (response.success) {
        setMessage("✅ New meal plan generated successfully!");
        setMealPlan(response.meal_plan);
        setShowLatest(false);
        setSpecialRequirements("");

        setTimeout(() => {
          onComplete && onComplete();
        }, 5000);
      } else {
        setMessage(`Error: ${response.message}`);
      }
    } catch (error) {
      console.error("Meal plan generation error:", error);
      setMessage("Failed to generate meal plan. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const getMealIcon = (mealType) => {
    const icons = {
      breakfast: "🌅",
      lunch: "☀️",
      dinner: "🌙"
    };
    return icons[mealType] || "🍽️";
  };

  const formatNutrition = (nutrition) => {
    if (!nutrition)
      return { calories: "N/A", carbs: "N/A", protein: "N/A", fat: "N/A", fiber: "N/A" };

    return {
      calories: nutrition.calories !== undefined ? Math.round(nutrition.calories) : "N/A",
      carbs: nutrition.carbs !== undefined ? Math.round(nutrition.carbs * 10) / 10 : "N/A",
      protein: nutrition.protein !== undefined ? Math.round(nutrition.protein * 10) / 10 : "N/A",
      fat: nutrition.fat !== undefined ? Math.round(nutrition.fat * 10) / 10 : "N/A",
      fiber: nutrition.fiber !== undefined ? Math.round(nutrition.fiber * 10) / 10 : "N/A"
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
            {userContext.medical_conditions
              ?.filter((c) => c !== "None")
              .map((condition, index) => (
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

        <button type="submit" disabled={loading} className="generate-btn">
          <Target className="btn-icon" />
          {loading ? "Generating Plan..." : "Generate New Meal Plan"}
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
            {["breakfast", "lunch", "dinner"].map((mealType) => {
              const meal = mealPlan[mealType];
              const nutrition = meal?.estimated_nutrition
                ? formatNutrition(meal.estimated_nutrition)
                : { calories: "N/A", carbs: "N/A", protein: "N/A", fat: "N/A", fiber: "N/A" };

              return (
                <div key={mealType} className="meal-card">
                  <div className="meal-header">
                    <span className="meal-icon">{getMealIcon(mealType)}</span>
                    <h4>{mealType.charAt(0).toUpperCase() + mealType.slice(1)}</h4>
                  </div>
                  <div className="meal-content">
                    <h5 className="meal-name">{meal?.name || "Not specified"}</h5>
                    <p className="meal-description">{meal?.description || "No description available"}</p>

                    <div className="meal-nutrition">
                      <div className="nutrition-row">
                        <span className="nutrition-item">
                          <strong>{nutrition.calories}</strong> cal
                        </span>
                        <span className="nutrition-item">
                          <strong>{nutrition.carbs !== "N/A" ? nutrition.carbs + "g" : nutrition.carbs}</strong>{" "}
                          carbs
                        </span>
                        <span className="nutrition-item">
                          <strong>{nutrition.protein !== "N/A" ? nutrition.protein + "g" : nutrition.protein}</strong>{" "}
                          protein
                        </span>
                        <span className="nutrition-item">
                          <strong>{nutrition.fat !== "N/A" ? nutrition.fat + "g" : nutrition.fat}</strong> fat
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {message && <div className={`message ${message.includes("Error") ? "error" : "success"}`}>{message}</div>}
    </div>
  );
};

export default MealPlanner;

