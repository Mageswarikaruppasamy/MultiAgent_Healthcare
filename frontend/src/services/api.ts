import axios from 'axios';

const API_BASE_URL = 'https://multiagent-healthcare-32b9.onrender.com';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export interface MoodData {
  timestamp: string;
  mood: string;
  value: number;
}

export interface CGMData {
  timestamp: string;
  glucose: number;
}

export interface UserProfile {
  user_id: number;
  first_name: string;
  last_name?: string;
  city?: string;
  dietary_preference?: string;
  medical_conditions?: string;
}

export interface UserSummary {
  success: boolean;
  mood_summary: {
    success: boolean;
    data?: MoodData[];
    average?: number;
    message?: string;
  };
  cgm_summary: {
    success: boolean;
    data?: CGMData[];
    average?: number;
    message?: string;
  };
  nutrition_summary: {
    success: boolean;
    data?: any[];
    message?: string;
  };
  latest_meal_plan: {
    success: boolean;
    meal_plan?: any;
    message?: string;
  };
}

// Mood value mapping
const moodValues: Record<string, number> = {
  happy: 5,
  calm: 4,
  energetic: 4,
  tired: 2,
  sad: 1,
  anxious: 1,
  angry: 1,
};

export const healthcareApi = {
  // Greet user
  greetUser: async (userId: number) => {
    const response = await api.post('/api/greet', { user_id: userId });
    return response.data;
  },

  // Mood tracking
  logMood: async (userId: number, mood: string, userInput?: string) => {
    const response = await api.post('/api/mood', {
      user_id: userId,
      mood,
      action: 'log',
      user_input: userInput,
    });
    return response.data;
  },

  getMoodStats: async (userId: number) => {
    const response = await api.post('/api/mood', {
      user_id: userId,
      action: 'get_stats',
    });
    
    // Transform backend response to frontend format
    const backendData = response.data;
    if (backendData.success && backendData.mood_history) {
      const transformedData: MoodData[] = backendData.mood_history.map((entry: any) => ({
        mood: entry.mood,
        timestamp: entry.timestamp,
        value: moodValues[entry.mood.toLowerCase()] || 3,
      }));
      
      // Calculate average
      const average = transformedData.length > 0
        ? transformedData.reduce((sum, item) => sum + item.value, 0) / transformedData.length
        : 0;
      
      return {
        success: true,
        data: transformedData,
        average,
        message: backendData.message,
      };
    }
    
    return { success: false, data: [], average: 0 };
  },

  // CGM management
  logCGM: async (userId: number, glucoseReading: number) => {
    const response = await api.post('/api/cgm', {
      user_id: userId,
      glucose_reading: glucoseReading,
      action: 'log',
    });
    return response.data;
  },

  getCGMStats: async (userId: number) => {
    const response = await api.post('/api/cgm', {
      user_id: userId,
      action: 'get_stats',
    });
    
    // Transform backend response to frontend format
    const backendData = response.data;
    if (backendData.success && backendData.cgm_history) {
      const transformedData: CGMData[] = backendData.cgm_history.map((entry: any) => ({
        glucose: entry.glucose_reading,
        timestamp: entry.timestamp,
      }));
      
      // Calculate average
      const average = transformedData.length > 0
        ? transformedData.reduce((sum, item) => sum + item.glucose, 0) / transformedData.length
        : 0;
      
      return {
        success: true,
        data: transformedData,
        average,
        message: backendData.message,
      };
    }
    
    return { success: false, data: [], average: 0 };
  },

  generateCGMReading: async (userId: number) => {
    const response = await api.post('/api/cgm', {
      user_id: userId,
      action: 'generate',
    });
    return response.data;
  },

  // Food intake
  logFood: async (userId: number, mealDescription: string) => {
    const response = await api.post('/api/food', {
      user_id: userId,
      meal_description: mealDescription,
      action: 'log',
    });
    return response.data;
  },

  getFoodStats: async (userId: number) => {
    const response = await api.post('/api/food', {
      user_id: userId,
      action: 'get_stats',
    });
    
    // Transform backend response to frontend format
    const backendData = response.data;
    if (backendData.success && backendData.nutrition_analysis) {
      const transformedData = backendData.nutrition_analysis.map((entry: any) => ({
        meal_description: entry.meal_description,
        calories: Math.round(entry.estimated_calories || 0),
        protein: Math.round(entry.estimated_protein || 0),
        carbohydrates: Math.round(entry.estimated_carbs || 0),
        fat: Math.round(entry.estimated_fat || 0),
        timestamp: entry.timestamp,
      }));
      
      return {
        success: true,
        data: transformedData,
        message: backendData.message,
      };
    }
    
    return { success: false, data: [] };
  },

  // Meal planning
  generateMealPlan: async (userId: number, specialRequirements?: string) => {
    const response = await api.post('/api/meal-plan', {
      user_id: userId,
      special_requirements: specialRequirements,
      action: 'generate',
    });
    return response.data;
  },

  getLatestMealPlan: async (userId: number) => {
    const response = await api.post('/api/meal-plan', {
      user_id: userId,
      action: 'get_latest',
    });
    return response.data;
  },

  // Interrupt agent
  handleInterrupt: async (query: string, userId?: number, currentContext?: any) => {
    const response = await api.post('/api/interrupt', {
      user_id: userId,
      query,
      current_context: currentContext,
    });
    return response.data;
  },

  // Specialized AI Assistant methods
  handleMoodLogging: async (userId: number, userInput: string) => {
    return await healthcareApi.logMood(userId, '', userInput);
  },

  handleMealPlanning: async (userId: number, requirements?: string) => {
    return await healthcareApi.generateMealPlan(userId, requirements);
  },

  handleNutritionAnalysis: async (userId: number, mealDescription: string) => {
    return await healthcareApi.logFood(userId, mealDescription);
  },

  // User summary
  getUserSummary: async (userId: number): Promise<UserSummary> => {
    const response = await api.get(`/api/users/${userId}/summary`);
    const backendData = response.data;
    
    // Transform mood summary
    let moodSummary = { success: false, data: [], average: 0 };
    if (backendData.mood_summary?.success && backendData.mood_summary.mood_history) {
      const moodData: MoodData[] = backendData.mood_summary.mood_history.map((entry: any) => ({
        mood: entry.mood,
        timestamp: entry.timestamp,
        value: moodValues[entry.mood.toLowerCase()] || 3,
      }));
      const average = moodData.length > 0
        ? moodData.reduce((sum, item) => sum + item.value, 0) / moodData.length
        : 0;
      moodSummary = { success: true, data: moodData, average };
    }
    
    // Transform CGM summary
    let cgmSummary = { success: false, data: [], average: 0 };
    if (backendData.cgm_summary?.success && backendData.cgm_summary.cgm_history) {
      const cgmData: CGMData[] = backendData.cgm_summary.cgm_history.map((entry: any) => ({
        glucose: entry.glucose_reading,
        timestamp: entry.timestamp,
      }));
      const average = cgmData.length > 0
        ? cgmData.reduce((sum, item) => sum + item.glucose, 0) / cgmData.length
        : 0;
      cgmSummary = { success: true, data: cgmData, average };
    }
    
    return {
      success: backendData.success,
      mood_summary: moodSummary,
      cgm_summary: cgmSummary,
      nutrition_summary: backendData.nutrition_summary || { success: false },
      latest_meal_plan: backendData.latest_meal_plan || { success: false },
    };
  },

  // Available moods
  getAvailableMoods: async () => {
    const response = await api.get('/api/available-moods');
    return response.data;
  },
};