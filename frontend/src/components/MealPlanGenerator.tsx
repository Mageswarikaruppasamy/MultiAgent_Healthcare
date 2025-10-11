import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { healthcareApi, UserProfile } from '@/services/api';
import { toast } from '@/hooks/use-toast';
import { Calendar, Loader2, Clock, Flame } from 'lucide-react';

interface MealPlanGeneratorProps {
  userId: number;
}

interface MealDetails {
  name?: string;
  description?: string;
  ingredients?: string[];
  estimated_nutrition?: {
    calories?: number;
    carbs?: number;
    protein?: number;
    fat?: number;
    fiber?: number;
  };
  health_benefits?: string[];
}

// Update interfaces to match the actual API response structure
interface ActualMeal {
  meal_type: string;
  meal_name: string;
  description: string;
  ingredients: string[];
  instructions: string[];
}

interface MealPlan {
  meal_plan?: ActualMeal[];
  meal_plan_for_next_day?: ActualMeal[]; // Add this property
  general_notes_for_depression?: string[];
  breakfast?: MealDetails;
  lunch?: MealDetails;
  dinner?: MealDetails;
}

export const MealPlanGenerator = ({ userId }: MealPlanGeneratorProps) => {
  const [specialRequirements, setSpecialRequirements] = useState('');
  const [loading, setLoading] = useState(false);
  const [mealPlan, setMealPlan] = useState<MealPlan | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    fetchUserProfile();
    fetchLatestMealPlan();
  }, [userId]);

  const fetchUserProfile = async () => {
    try {
      const response = await healthcareApi.greetUser(userId);
      if (response.success && response.user) {
        setUserProfile(response.user);
      }
    } catch (error) {
      console.error('Error fetching user profile:', error);
    }
  };

  const fetchLatestMealPlan = async () => {
    try {
      const response = await healthcareApi.getLatestMealPlan(userId);
      console.log('=== FETCH LATEST MEAL PLAN RESPONSE ===');
      console.log('Full response:', JSON.stringify(response, null, 2));
      
      if (response.success && response.meal_plan) {
        // Log the exact structure we're receiving
        console.log('meal_plan type:', typeof response.meal_plan);
        console.log('meal_plan keys:', Object.keys(response.meal_plan));
        
        // Check if it's a string that needs parsing
        let mealPlanData = response.meal_plan;
        if (typeof mealPlanData === 'string') {
          console.log('meal_plan is a string, attempting to parse...');
          try {
            mealPlanData = JSON.parse(mealPlanData);
            console.log('Parsed meal_plan keys:', Object.keys(mealPlanData));
          } catch (parseError) {
            console.error('Error parsing meal plan JSON:', parseError);
          }
        }
        
        // Log nested structure
        if (mealPlanData['meal_plan']) {
          console.log('Nested meal_plan keys:', Object.keys(mealPlanData['meal_plan']));
          if (mealPlanData['meal_plan']['meals']) {
            console.log('Meals array length:', mealPlanData['meal_plan']['meals'].length);
            console.log('First meal:', mealPlanData['meal_plan']['meals'][0]);
          }
        }
        
        setMealPlan(mealPlanData);
      } else {
        console.log('No meal plan found in response');
      }
    } catch (error) {
      console.error('Error fetching meal plan:', error);
    }
  };

  const handleGenerateMealPlan = async () => {
    setLoading(true);
    try {
      const response = await healthcareApi.generateMealPlan(
        userId,
        specialRequirements || undefined
      );
      
      console.log('=== GENERATE MEAL PLAN RESPONSE ===');
      console.log('Full response:', JSON.stringify(response, null, 2));
      
      if (response.success) {
        // Log the exact structure we're receiving
        console.log('meal_plan type:', typeof response.meal_plan);
        console.log('meal_plan keys:', Object.keys(response.meal_plan));
        
        // Check if it's a string that needs parsing
        let mealPlanData = response.meal_plan;
        if (typeof mealPlanData === 'string') {
          console.log('meal_plan is a string, attempting to parse...');
          try {
            mealPlanData = JSON.parse(mealPlanData);
            console.log('Parsed meal_plan keys:', Object.keys(mealPlanData));
          } catch (parseError) {
            console.error('Error parsing meal plan JSON:', parseError);
          }
        }
        
        setMealPlan(mealPlanData);
        toast({
          title: 'Meal Plan Generated',
          description: response.message || 'Your personalized meal plan is ready!'
        });
      } else {
        toast({
          title: 'Error',
          description: response.message || 'Failed to generate meal plan.',
          variant: 'destructive'
        });
      }
    } catch (error) {
      console.error('Error generating meal plan:', error);
      toast({
        title: 'Connection Error',
        description: 'Unable to generate meal plan. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  // Update the renderMeal function to display in the desired format
  const renderMeal = (meal: MealDetails | ActualMeal | undefined, title: string, bgColor: string) => {
    console.log(`Rendering meal for ${title}:`, meal);
    
    // Handle case where we have the actual meal data from the meal_plan array
    if (meal && 'meal_name' in meal) {
      const actualMeal = meal as ActualMeal;
      
      // Extract health benefits from the description (first 2 sentences)
      const descriptionSentences = actualMeal.description.split('. ').filter(s => s.trim().length > 0);
      const healthBenefits = descriptionSentences.slice(0, 2);
      
      return (
        <Card className={`${bgColor}`}>
          <CardContent className="p-4">
            <div className="meal-header flex items-center gap-2 mb-2">
              <span className="text-lg">
                {actualMeal.meal_type === 'Breakfast' ? '🌅' : 
                 actualMeal.meal_type === 'Lunch' ? '☀️' : '🌙'}
              </span>
              <h4 className="font-semibold">{actualMeal.meal_type}</h4>
            </div>
            
            <div className="meal-content space-y-2">
              <h5 className="meal-name font-medium">{actualMeal.meal_name}</h5>
              <p className="meal-description text-sm text-muted-foreground">{actualMeal.description}</p>
              
              {/* Health Benefits */}
              <div className="meal-health-benefits">
                <p className="text-xs font-medium mb-1">Health Benefits:</p>
                <ul className="text-xs text-muted-foreground list-disc list-inside space-y-1">
                  {healthBenefits.map((benefit, i) => (
                    <li key={i}>{benefit}{benefit.endsWith('.') ? '' : '.'}</li>
                  ))}
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      );
    }
    
    // Handle default meal case
    const isDefaultMeal = meal && 
      'name' in meal &&
      meal.name === "Default meal" && 
      meal.description === "Default description" &&
      meal.estimated_nutrition?.calories === 0 &&
      meal.estimated_nutrition?.carbs === 0 &&
      meal.estimated_nutrition?.protein === 0 &&
      meal.estimated_nutrition?.fat === 0 &&
      meal.estimated_nutrition?.fiber === 0 &&
      (!meal.health_benefits || meal.health_benefits.length === 0);

    if (!meal || ('name' in meal && isDefaultMeal)) {
      return (
        <Card className={`${bgColor}`}>
          <CardContent className="p-4">
            <div className="meal-header flex items-center gap-2 mb-2">
              <span className="text-lg">🍽️</span>
              <h4 className="font-semibold">{title}</h4>
            </div>
            <p className="text-sm text-muted-foreground italic">
              No specific meal generated. Try generating a new meal plan.
            </p>
          </CardContent>
        </Card>
      );
    }

    // Handle the case where we have the old MealDetails structure
    const mealDetails = meal as MealDetails;
    const nutrition = mealDetails.estimated_nutrition;

    return (
      <Card className={`${bgColor}`}>
        <CardContent className="p-4">
          <div className="meal-header flex items-center gap-2 mb-2">
            <span className="text-lg">
              {title === 'Breakfast' ? '🌅' : title === 'Lunch' ? '☀️' : '🌙'}
            </span>
            <h4 className="font-semibold">{title}</h4>
          </div>
          
          <div className="meal-content space-y-2">
            <h5 className="meal-name font-medium">{mealDetails.name || "Not specified"}</h5>
            <p className="meal-description text-sm text-muted-foreground">{mealDetails.description || "No description available"}</p>
            
            {nutrition && (
              <div className="meal-nutrition">
                <div className="grid grid-cols-2 gap-1 text-xs">
                  <div><strong>{nutrition.calories !== undefined ? Math.round(nutrition.calories) : 'N/A'}</strong> cal</div>
                  <div><strong>{nutrition.carbs !== undefined ? Math.round(nutrition.carbs) + 'g' : 'N/A'}</strong> carbs</div>
                  <div><strong>{nutrition.protein !== undefined ? Math.round(nutrition.protein) + 'g' : 'N/A'}</strong> protein</div>
                  <div><strong>{nutrition.fat !== undefined ? Math.round(nutrition.fat) + 'g' : 'N/A'}</strong> fat</div>
                </div>
              </div>
            )}
            
            {mealDetails.health_benefits && mealDetails.health_benefits.length > 0 && (
              <div className="meal-health-benefits">
                <p className="text-xs font-medium mb-1">Health Benefits:</p>
                <ul className="text-xs text-muted-foreground list-disc list-inside space-y-1">
                  {mealDetails.health_benefits.slice(0, 2).map((benefit: string, i: number) => (
                    <li key={i}>{benefit}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      {/* User Profile Info */}
      {userProfile && (
        <Card className="shadow-elegant bg-gradient-to-r from-primary/5 to-accent/5">
          <CardHeader>
            <CardTitle>Your Health Profile</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 text-sm">
              <div>
                <span className="font-medium">Dietary Preferences:</span>
                <span className="ml-2 text-muted-foreground">
                  {userProfile.dietary_preference || 'Not specified'}
                </span>
              </div>
              <div>
                <span className="font-medium">Medical Conditions:</span>
                <span className="ml-2 text-muted-foreground">
                  {userProfile.medical_conditions || 'None reported'}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Meal Plan Generator */}
      <Card className="shadow-elegant">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            Generate Meal Plan
          </CardTitle>
          <CardDescription>
            AI-powered personalized meal recommendations
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            value={specialRequirements}
            onChange={(e) => setSpecialRequirements(e.target.value)}
            placeholder="Any special requirements? (e.g., vegetarian, low-carb, gluten-free, high-protein)"
            className="min-h-[100px]"
            disabled={loading}
          />
          <Button
            onClick={handleGenerateMealPlan}
            disabled={loading}
            className="w-full"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Generating your meal plan...
              </>
            ) : (
              'Generate Meal Plan'
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Generated Meal Plan */}
      {mealPlan && (
        <div className="space-y-4">
          <h3 className="text-xl font-semibold">Your Personalized Meal Plan</h3>
          {/* Handle the nested structure with better debugging */}
          {(() => {
            console.log('Rendering meal plan, mealPlan:', mealPlan);
            
            // Check if we have the nested meal_plan.meals structure
            const nestedMealPlan = mealPlan['meal_plan'];
            console.log('nestedMealPlan:', nestedMealPlan);
            
            if (nestedMealPlan && typeof nestedMealPlan === 'object') {
              const mealsArray = nestedMealPlan['meals'];
              console.log('mealsArray:', mealsArray);
              
              if (mealsArray && Array.isArray(mealsArray) && mealsArray.length > 0) {
                // Create a map of meals by type for easier access
                const mealsByType = {};
                mealsArray.forEach((meal: ActualMeal) => {
                  if (meal && meal.meal_type) {
                    mealsByType[meal.meal_type.toLowerCase()] = meal;
                  }
                });
                console.log('mealsByType:', mealsByType);
                
                return (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {renderMeal(mealsByType['breakfast'], 'Breakfast', 'bg-green-500/10')}
                    {renderMeal(mealsByType['lunch'], 'Lunch', 'bg-blue-500/10')}
                    {renderMeal(mealsByType['dinner'], 'Dinner', 'bg-purple-500/10')}
                  </div>
                );
              }
            }
            
            // Fallback to individual meal properties
            console.log('Falling back to individual meal properties');
            return (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {renderMeal(mealPlan.breakfast, 'Breakfast', 'bg-green-500/10')}
                {renderMeal(mealPlan.lunch, 'Lunch', 'bg-blue-500/10')}
                {renderMeal(mealPlan.dinner, 'Dinner', 'bg-purple-500/10')}
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
};
