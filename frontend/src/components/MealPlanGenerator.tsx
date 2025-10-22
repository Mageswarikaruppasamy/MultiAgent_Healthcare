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
    
    // Handle the case where we have the structured meal data (breakfast, lunch, dinner)
    if (meal && 'name' in meal) {
      const mealDetails = meal as MealDetails;
      
      return (
        <Card className={`${bgColor}`}>
          <CardContent className="p-4">
            <div className="meal-header flex items-center gap-2 mb-2">
              <span className="text-lg">
                {title === 'Breakfast' ? '🌅' : 
                 title === 'Lunch' ? '☀️' : '🌙'}
              </span>
              <h4 className="font-semibold">{title}</h4>
            </div>
            
            <div className="meal-content space-y-2">
              <h5 className="meal-name font-medium">{mealDetails.name}</h5>
              <p className="meal-description text-sm text-muted-foreground">{mealDetails.description}</p>
              
              {/* Nutrition Information */}
              {mealDetails.estimated_nutrition && (
                <div className="meal-nutrition">
                  <p className="text-xs font-medium mb-1">Estimated Nutrition:</p>
                  <div className="grid grid-cols-2 gap-1 text-xs text-muted-foreground">
                    <div>Calories: {mealDetails.estimated_nutrition.calories || 0}</div>
                    <div>Protein: {mealDetails.estimated_nutrition.protein || 0}g</div>
                    <div>Carbs: {mealDetails.estimated_nutrition.carbs || 0}g</div>
                    <div>Fat: {mealDetails.estimated_nutrition.fat || 0}g</div>
                  </div>
                </div>
              )}
              
              {/* Health Benefits */}
              {mealDetails.health_benefits && mealDetails.health_benefits.length > 0 && (
                <div className="meal-health-benefits">
                  <p className="text-xs font-medium mb-1">Health Benefits:</p>
                  <ul className="text-xs text-muted-foreground list-disc list-inside space-y-1">
                    {mealDetails.health_benefits.map((benefit, i) => (
                      <li key={i}>{benefit}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      );
    }
    
    // Handle case where we have no meal data
    return (
      <Card className={`${bgColor}`}>
        <CardContent className="p-4 text-center text-muted-foreground">
          <p>No {title.toLowerCase()} planned</p>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      {/* User Profile Card */}
      {userProfile && (
        <Card className="shadow-elegant">
          <CardHeader>
            <CardTitle>User Profile</CardTitle>
            <CardDescription>Dietary preferences and medical conditions</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium">Dietary Preference</p>
                <p className="text-sm text-muted-foreground">
                  {userProfile.dietary_preference || 'Not specified'}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium">Medical Conditions</p>
                <p className="text-sm text-muted-foreground">
                  {userProfile.medical_conditions || 'None specified'}
                </p>
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
          <CardDescription>Get a personalized meal plan</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Textarea
              value={specialRequirements}
              onChange={(e) => setSpecialRequirements(e.target.value)}
              placeholder="Any special requirements? (e.g., low sodium, high protein, vegetarian)"
              className="min-h-[100px]"
              disabled={loading}
            />
            <Button 
              onClick={handleGenerateMealPlan} 
              className="w-full"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Calendar className="mr-2 h-4 w-4" />
                  Generate Meal Plan
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Generated Meal Plan */}
      {mealPlan && (
        <Card className="shadow-elegant">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Flame className="h-5 w-5 text-primary" />
              Your Personalized Meal Plan
            </CardTitle>
            <CardDescription>Based on your profile and preferences</CardDescription>
          </CardHeader>
          <CardContent>
            {/* Display meals in the new format */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {renderMeal(mealPlan.breakfast, 'Breakfast', 'bg-green-50')}
              {renderMeal(mealPlan.lunch, 'Lunch', 'bg-blue-50')}
              {renderMeal(mealPlan.dinner, 'Dinner', 'bg-purple-50')}
            </div>

            {/* Display any special notes */}
            {mealPlan.special_notes && mealPlan.special_notes.length > 0 && (
              <div className="mt-6 p-4 bg-yellow-50 rounded-lg">
                <h4 className="font-medium text-yellow-800 mb-2">Special Notes</h4>
                <ul className="list-disc list-inside text-sm text-yellow-700 space-y-1">
                  {mealPlan.special_notes.map((note, i) => (
                    <li key={i}>{note}</li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};