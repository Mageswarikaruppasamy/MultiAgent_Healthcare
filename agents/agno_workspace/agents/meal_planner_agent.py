# agents/agno_workspace/agents/meal_planner_agent.py
import sqlite3
import os
import json
from typing import Dict, Any, List

try:
    # ✅ Try new google-genai package
    from google import genai
    USE_NEW_GENAI = True
except ImportError:
    # ✅ Fallback to google-generativeai
    import google.generativeai as genai
    USE_NEW_GENAI = False


class MealPlannerAgent:
    def __init__(self):
        self.db_path = os.getenv('DATABASE_PATH', '../../../data/healthcare_data.db')

        api_key = os.getenv('GEMINI_API_KEY') or os.getenv('GOOGLE_API_KEY', 'YOUR_GEMINI_API_KEY_PLACEHOLDER')

        if USE_NEW_GENAI:
            # new google-genai style
            self.client = genai.Client(api_key=api_key)
            self.model_name = "gemini-2.5-flash"
        else:
            # old google-generativeai style
            genai.configure(api_key=api_key)
            self.model = genai.GenerativeModel("gemini-1.5-flash")

    def get_database_connection(self):
        return sqlite3.connect(self.db_path)

    def get_user_context(self, user_id: int) -> Dict[str, Any]:
        """Get user context from database"""
        try:
            conn = self.get_database_connection()
            cursor = conn.cursor()

            cursor.execute('''
                SELECT first_name, dietary_preference, medical_conditions, physical_limitations
                FROM users WHERE id = ?
            ''', (user_id,))
            user_data = cursor.fetchone()
            if not user_data:
                return {}

            cursor.execute('''
                SELECT mood FROM mood_logs
                WHERE user_id = ? AND timestamp >= datetime('now', '-3 days')
                ORDER BY timestamp DESC LIMIT 5
            ''', (user_id,))
            recent_moods = [row[0] for row in cursor.fetchall()]

            cursor.execute('''
                SELECT glucose_reading FROM cgm_readings
                WHERE user_id = ? AND timestamp >= datetime('now', '-3 days')
                ORDER BY timestamp DESC LIMIT 10
            ''', (user_id,))
            recent_cgm = [row[0] for row in cursor.fetchall()]

            cursor.execute('''
                SELECT meal_description FROM food_logs
                WHERE user_id = ? AND timestamp >= datetime('now', '-3 days')
                ORDER BY timestamp DESC LIMIT 10
            ''', (user_id,))
            recent_meals = [row[0] for row in cursor.fetchall()]

            conn.close()

            return {
                "first_name": user_data[0],
                "dietary_preference": user_data[1],
                "medical_conditions": json.loads(user_data[2]),
                "physical_limitations": json.loads(user_data[3]),
                "recent_moods": recent_moods,
                "recent_cgm_readings": recent_cgm,
                "recent_meals": recent_meals,
            }
        except Exception as e:
            print(f"Database error getting user context: {e}")
            return {}

    def generate_meal_plan_with_llm(self, user_context: Dict[str, Any], special_requirements: str = None) -> Dict[str, Any]:
        """Generate personalized meal plan using Gemini or fallback"""
        try:
            if USE_NEW_GENAI:
                # new google-genai usage
                prompt = f"""
                Create a one-day personalized meal plan for {user_context.get('first_name')} 
                with dietary preference {user_context.get('dietary_preference')} 
                and conditions {user_context.get('medical_conditions')}.
                Meals: breakfast, lunch, dinner. Include nutrition (calories, carbs, protein, fat, fiber).
                
                IMPORTANT: Please provide your response in this EXACT format:
                
                Breakfast: [Meal name]
                [Brief description]
                Ingredients: [ingredient1], [ingredient2], [ingredient3]
                Nutrition: [calories] calories, [carbs]g carbs, [protein]g protein, [fat]g fat, [fiber]g fiber
                Benefits: [benefit1], [benefit2]
                
                Lunch: [Meal name]
                [Brief description]
                Ingredients: [ingredient1], [ingredient2], [ingredient3]
                Nutrition: [calories] calories, [carbs]g carbs, [protein]g protein, [fat]g fat, [fiber]g fiber
                Benefits: [benefit1], [benefit2]
                
                Dinner: [Meal name]
                [Brief description]
                Ingredients: [ingredient1], [ingredient2], [ingredient3]
                Nutrition: [calories] calories, [carbs]g carbs, [protein]g protein, [fat]g fat, [fiber]g fiber
                Benefits: [benefit1], [benefit2]
                
                Make sure to provide real numeric values for all nutrition information.
                """
                if special_requirements:
                    prompt += f"\nSpecial requirements: {special_requirements}"

                response = self.client.models.generate_content(
                    model=self.model_name,
                    contents=prompt,
                )
                
                # Parse the structured response
                return self.parse_meal_plan_response(response.text)

            else:
                # old google-generativeai usage
                prompt = f"""
                Create a one-day personalized meal plan for {user_context.get('first_name')} 
                with dietary preference {user_context.get('dietary_preference')} 
                and conditions {user_context.get('medical_conditions')}.
                Meals: breakfast, lunch, dinner. Include nutrition (calories, carbs, protein, fat, fiber).
                
                IMPORTANT: Please provide your response in this EXACT format:
                
                Breakfast: [Meal name]
                [Brief description]
                Ingredients: [ingredient1], [ingredient2], [ingredient3]
                Nutrition: [calories] calories, [carbs]g carbs, [protein]g protein, [fat]g fat, [fiber]g fiber
                Benefits: [benefit1], [benefit2]
                
                Lunch: [Meal name]
                [Brief description]
                Ingredients: [ingredient1], [ingredient2], [ingredient3]
                Nutrition: [calories] calories, [carbs]g carbs, [protein]g protein, [fat]g fat, [fiber]g fiber
                Benefits: [benefit1], [benefit2]
                
                Dinner: [Meal name]
                [Brief description]
                Ingredients: [ingredient1], [ingredient2], [ingredient3]
                Nutrition: [calories] calories, [carbs]g carbs, [protein]g protein, [fat]g fat, [fiber]g fiber
                Benefits: [benefit1], [benefit2]
                
                Make sure to provide real numeric values for all nutrition information.
                """
                if special_requirements:
                    prompt += f"\nSpecial requirements: {special_requirements}"

                response = self.model.generate_content(prompt)
                
                # Parse the structured response
                return self.parse_meal_plan_response(response.text)

        except Exception as e:
            print(f"LLM generation failed, using fallback: {e}")
            return self.generate_fallback_meal_plan(
                user_context.get("dietary_preference", "non-vegetarian"),
                user_context.get("medical_conditions", []),
            )
    
    def parse_meal_plan_response(self, response_text: str) -> Dict[str, Any]:
        """Parse LLM response text into structured meal plan format"""
        try:
            import re
            
            # Initialize meal plan structure
            meal_plan = {
                "breakfast": {},
                "lunch": {},
                "dinner": {},
                "daily_totals": {
                    "calories": 0,
                    "carbs": 0,
                    "protein": 0,
                    "fat": 0,
                    "fiber": 0
                },
                "special_notes": [
                    "This meal plan was generated by AI and should be adjusted based on your individual needs",
                    "Consider consulting with a nutritionist for personalized advice"
                ]
            }
            
            # Handle case where response is already in JSON format
            if response_text.strip().startswith('{') and response_text.strip().endswith('}'):
                try:
                    # Try to parse as JSON directly
                    parsed_json = json.loads(response_text)
                    if isinstance(parsed_json, dict) and any(key in parsed_json for key in ['breakfast', 'lunch', 'dinner']):
                        # If it's already structured correctly, use it
                        return parsed_json
                except:
                    pass  # Continue with text parsing if JSON parsing fails
            
            # Split response into sections
            sections = re.split(r'\n\s*\n', response_text.strip())
            
            # If we have very few sections, try line-by-line parsing
            if len(sections) < 3:
                lines = [line.strip() for line in response_text.split('\n') if line.strip()]
                sections = []
                current_section = []
                for line in lines:
                    if any(meal_type in line.lower() for meal_type in ['breakfast', 'lunch', 'dinner']):
                        if current_section:
                            sections.append('\n'.join(current_section))
                        current_section = [line]
                    else:
                        current_section.append(line)
                if current_section:
                    sections.append('\n'.join(current_section))
            
            # Parse each meal section
            parsed_meals = 0
            for section in sections:
                lines = [line.strip() for line in section.split('\n') if line.strip()]
                if not lines:
                    continue
                    
                # Determine meal type from first line
                first_line = lines[0].lower()
                meal_type = None
                if 'breakfast' in first_line:
                    meal_type = 'breakfast'
                elif 'lunch' in first_line:
                    meal_type = 'lunch'
                elif 'dinner' in first_line:
                    meal_type = 'dinner'
                else:
                    # Try to find meal type anywhere in the section
                    section_text = ' '.join(lines).lower()
                    if 'breakfast' in section_text:
                        meal_type = 'breakfast'
                    elif 'lunch' in section_text:
                        meal_type = 'lunch'
                    elif 'dinner' in section_text:
                        meal_type = 'dinner'
                    else:
                        continue  # Skip unrecognized sections
                
                # Parse meal details
                if len(lines) >= 2:
                    # Extract meal name (everything after the colon or just the first meaningful line)
                    meal_name = "Meal"
                    description = ""
                    
                    # Look for meal name
                    for line in lines:
                        if ':' in line and meal_type.capitalize() in line:
                            meal_name_match = re.search(r':\s*(.+)', line)
                            if meal_name_match:
                                meal_name = meal_name_match.group(1).strip()
                                break
                        elif meal_type.capitalize() in line:
                            meal_name = line.replace(meal_type.capitalize() + ':', '').strip()
                            if meal_name:
                                break
                    
                    # Get description (usually the line after the meal name)
                    for i, line in enumerate(lines):
                        if meal_type.capitalize() in line or meal_name in line:
                            if i + 1 < len(lines):
                                description = lines[i + 1]
                                break
                    
                    # Parse ingredients
                    ingredients = []
                    for line in lines:
                        if line.startswith('Ingredients:') or 'Ingredients:' in line:
                            ingredients_str = line.replace('Ingredients:', '').strip()
                            if ingredients_str:
                                ingredients = [ing.strip() for ing in re.split(r'[,;]', ingredients_str) if ing.strip()]
                                break
                    
                    # Parse nutrition
                    nutrition = {"calories": 0, "carbs": 0, "protein": 0, "fat": 0, "fiber": 0}
                    for line in lines:
                        if line.startswith('Nutrition:') or 'Nutrition:' in line:
                            nutrition_str = line.replace('Nutrition:', '').strip()
                            if nutrition_str:
                                # Extract nutrition values using regex
                                cal_match = re.search(r'(\d+(?:\.\d+)?)\s*calories?', nutrition_str, re.IGNORECASE)
                                carbs_match = re.search(r'(\d+(?:\.\d+)?)\s*g?\s*carbs?', nutrition_str, re.IGNORECASE)
                                protein_match = re.search(r'(\d+(?:\.\d+)?)\s*g?\s*protein', nutrition_str, re.IGNORECASE)
                                fat_match = re.search(r'(\d+(?:\.\d+)?)\s*g?\s*fat', nutrition_str, re.IGNORECASE)
                                fiber_match = re.search(r'(\d+(?:\.\d+)?)\s*g?\s*fiber', nutrition_str, re.IGNORECASE)
                                
                                if cal_match:
                                    nutrition["calories"] = float(cal_match.group(1))
                                if carbs_match:
                                    nutrition["carbs"] = float(carbs_match.group(1))
                                if protein_match:
                                    nutrition["protein"] = float(protein_match.group(1))
                                if fat_match:
                                    nutrition["fat"] = float(fat_match.group(1))
                                if fiber_match:
                                    nutrition["fiber"] = float(fiber_match.group(1))
                                break
                    
                    # Parse benefits
                    benefits = []
                    for line in lines:
                        if line.startswith('Benefits:') or 'Benefits:' in line:
                            benefits_str = line.replace('Benefits:', '').strip()
                            if benefits_str:
                                benefits = [benefit.strip() for benefit in re.split(r'[,;]', benefits_str) if benefit.strip()]
                                break
                    
                    # Store meal data
                    meal_plan[meal_type] = {
                        "name": meal_name if meal_name else f"{meal_type.capitalize()} Meal",
                        "description": description if description else "A nutritious meal option",
                        "ingredients": ingredients if ingredients else ["Various ingredients"],
                        "estimated_nutrition": nutrition,
                        "health_benefits": benefits if benefits else ["General health benefits"]
                    }
                    
                    # Add to daily totals
                    for key in nutrition:
                        meal_plan["daily_totals"][key] += nutrition[key]
                    
                    parsed_meals += 1
            
            # If we successfully parsed at least one meal, return the structured plan
            if parsed_meals > 0:
                return meal_plan
            else:
                # If parsing failed, try to extract any structured information
                # Look for any nutrition-like information in the entire response
                nutrition = {"calories": 0, "carbs": 0, "protein": 0, "fat": 0, "fiber": 0}
                all_text = response_text.lower()
                
                cal_match = re.search(r'(\d+(?:\.\d+)?)\s*calories?', all_text, re.IGNORECASE)
                carbs_match = re.search(r'(\d+(?:\.\d+)?)\s*g?\s*carbs?', all_text, re.IGNORECASE)
                protein_match = re.search(r'(\d+(?:\.\d+)?)\s*g?\s*protein', all_text, re.IGNORECASE)
                fat_match = re.search(r'(\d+(?:\.\d+)?)\s*g?\s*fat', all_text, re.IGNORECASE)
                fiber_match = re.search(r'(\d+(?:\.\d+)?)\s*g?\s*fiber', all_text, re.IGNORECASE)
                
                if cal_match:
                    nutrition["calories"] = float(cal_match.group(1))
                if carbs_match:
                    nutrition["carbs"] = float(carbs_match.group(1))
                if protein_match:
                    nutrition["protein"] = float(protein_match.group(1))
                if fat_match:
                    nutrition["fat"] = float(fat_match.group(1))
                if fiber_match:
                    nutrition["fiber"] = float(fiber_match.group(1))
                
                # Create a basic meal plan with the extracted information
                if any(nutrition.values()):
                    meal_plan["breakfast"] = {
                        "name": "Breakfast Option",
                        "description": "A balanced breakfast based on your health profile",
                        "ingredients": ["Mixed ingredients"],
                        "estimated_nutrition": nutrition,
                        "health_benefits": ["Nutritious start to the day"]
                    }
                    meal_plan["lunch"] = {
                        "name": "Lunch Option",
                        "description": "A satisfying lunch option",
                        "ingredients": ["Mixed ingredients"],
                        "estimated_nutrition": nutrition,
                        "health_benefits": ["Sustained energy"]
                    }
                    meal_plan["dinner"] = {
                        "name": "Dinner Option",
                        "description": "A wholesome dinner option",
                        "ingredients": ["Mixed ingredients"],
                        "estimated_nutrition": nutrition,
                        "health_benefits": ["Good for recovery"]
                    }
                    
                    # Calculate daily totals
                    for key in nutrition:
                        meal_plan["daily_totals"][key] = nutrition[key] * 3
                    
                    return meal_plan
                else:
                    # If nothing could be parsed, return the raw text with a note
                    return {
                        "breakfast": {
                            "name": "Personalized Meal Plan",
                            "description": response_text,
                            "ingredients": ["See description for details"],
                            "estimated_nutrition": {"calories": 0, "carbs": 0, "protein": 0, "fat": 0, "fiber": 0},
                            "health_benefits": ["Generated by AI"]
                        },
                        "lunch": {
                            "name": "Personalized Meal Plan",
                            "description": "Please check the breakfast section for details",
                            "ingredients": ["See breakfast section"],
                            "estimated_nutrition": {"calories": 0, "carbs": 0, "protein": 0, "fat": 0, "fiber": 0},
                            "health_benefits": ["Generated by AI"]
                        },
                        "dinner": {
                            "name": "Personalized Meal Plan",
                            "description": "Please check the breakfast section for details",
                            "ingredients": ["See breakfast section"],
                            "estimated_nutrition": {"calories": 0, "carbs": 0, "protein": 0, "fat": 0, "fiber": 0},
                            "health_benefits": ["Generated by AI"]
                        },
                        "daily_totals": {"calories": 0, "carbs": 0, "protein": 0, "fat": 0, "fiber": 0},
                        "special_notes": [
                            "The AI response format was not as expected",
                            "This meal plan was generated by AI and should be adjusted based on your individual needs"
                        ]
                    }
                
        except Exception as e:
            print(f"Error parsing meal plan response: {e}")
            # If parsing fails completely, return a basic structure with the raw text
            return {
                "breakfast": {
                    "name": "AI Generated Meal Plan",
                    "description": f"Raw response from AI: {response_text}",
                    "ingredients": ["See description"],
                    "estimated_nutrition": {"calories": 0, "carbs": 0, "protein": 0, "fat": 0, "fiber": 0},
                    "health_benefits": ["AI Generated"]
                },
                "lunch": {
                    "name": "AI Generated Meal Plan",
                    "description": "See breakfast section for details",
                    "ingredients": ["See breakfast section"],
                    "estimated_nutrition": {"calories": 0, "carbs": 0, "protein": 0, "fat": 0, "fiber": 0},
                    "health_benefits": ["AI Generated"]
                },
                "dinner": {
                    "name": "AI Generated Meal Plan",
                    "description": "See breakfast section for details",
                    "ingredients": ["See breakfast section"],
                    "estimated_nutrition": {"calories": 0, "carbs": 0, "protein": 0, "fat": 0, "fiber": 0},
                    "health_benefits": ["AI Generated"]
                },
                "daily_totals": {"calories": 0, "carbs": 0, "protein": 0, "fat": 0, "fiber": 0},
                "special_notes": [
                    f"Parsing error occurred: {str(e)}",
                    "This meal plan was generated by AI and should be adjusted based on your individual needs"
                ]
            }
    
    def generate_fallback_meal_plan(self, dietary_pref: str, medical_conditions: List[str]) -> Dict[str, Any]:
        """Generate a basic fallback meal plan"""
        is_diabetic = "Type 2 Diabetes" in medical_conditions
        is_vegetarian = dietary_pref in ['vegetarian', 'vegan']
        
        if is_vegetarian:
            breakfast = {
                "name": "Overnight Oats with Berries",
                "description": "Steel-cut oats soaked with almond milk, topped with blueberries and walnuts",
                "ingredients": ["steel-cut oats", "unsweetened almond milk", "blueberries", "walnuts", "cinnamon"],
                "estimated_nutrition": {"calories": 320, "carbs": 45, "protein": 12, "fat": 12, "fiber": 8},
                "health_benefits": ["High fiber", "Antioxidants", "Heart-healthy fats"]
            }
            lunch = {
                "name": "Quinoa Buddha Bowl",
                "description": "Quinoa with roasted vegetables, chickpeas, and tahini dressing",
                "ingredients": ["quinoa", "roasted bell peppers", "chickpeas", "spinach", "tahini", "lemon"],
                "estimated_nutrition": {"calories": 480, "carbs": 65, "protein": 18, "fat": 16, "fiber": 12},
                "health_benefits": ["Complete protein", "High fiber", "Plant-based nutrition"]
            }
            dinner = {
                "name": "Lentil and Vegetable Curry",
                "description": "Red lentil curry with mixed vegetables served with brown rice",
                "ingredients": ["red lentils", "mixed vegetables", "coconut milk", "brown rice", "turmeric", "ginger"],
                "estimated_nutrition": {"calories": 420, "carbs": 58, "protein": 16, "fat": 14, "fiber": 15},
                "health_benefits": ["Plant protein", "Anti-inflammatory spices", "Complex carbohydrates"]
            }
        else:
            protein_source = "grilled chicken" if not is_diabetic else "lean fish"
            breakfast = {
                "name": "Veggie Scramble",
                "description": "Scrambled eggs with spinach, tomatoes, and herbs",
                "ingredients": ["eggs", "spinach", "cherry tomatoes", "bell pepper", "herbs", "olive oil"],
                "estimated_nutrition": {"calories": 280, "carbs": 8, "protein": 18, "fat": 20, "fiber": 3},
                "health_benefits": ["High protein", "Low carb", "Nutrient-dense vegetables"]
            }
            lunch = {
                "name": f"Grilled {protein_source.split()[1].title()} Salad",
                "description": f"{protein_source.title()} with mixed greens, avocado, and olive oil dressing",
                "ingredients": [protein_source, "mixed greens", "avocado", "cucumber", "olive oil", "lemon"],
                "estimated_nutrition": {"calories": 420, "carbs": 12, "protein": 35, "fat": 28, "fiber": 8},
                "health_benefits": ["Lean protein", "Healthy fats", "Low glycemic"]
            }
            dinner = {
                "name": "Baked Salmon with Roasted Vegetables",
                "description": "Herb-crusted salmon with roasted broccoli and sweet potato",
                "ingredients": ["salmon fillet", "broccoli", "sweet potato", "herbs", "olive oil"],
                "estimated_nutrition": {"calories": 450, "carbs": 25, "protein": 32, "fat": 24, "fiber": 6},
                "health_benefits": ["Omega-3 fatty acids", "High protein", "Complex carbohydrates"]
            }
        
        return {
            "breakfast": breakfast,
            "lunch": lunch,
            "dinner": dinner,
            "daily_totals": {
                "calories": breakfast["estimated_nutrition"]["calories"] + lunch["estimated_nutrition"]["calories"] + dinner["estimated_nutrition"]["calories"],
                "carbs": breakfast["estimated_nutrition"]["carbs"] + lunch["estimated_nutrition"]["carbs"] + dinner["estimated_nutrition"]["carbs"],
                "protein": breakfast["estimated_nutrition"]["protein"] + lunch["estimated_nutrition"]["protein"] + dinner["estimated_nutrition"]["protein"],
                "fat": breakfast["estimated_nutrition"]["fat"] + lunch["estimated_nutrition"]["fat"] + dinner["estimated_nutrition"]["fat"],
                "fiber": breakfast["estimated_nutrition"]["fiber"] + lunch["estimated_nutrition"]["fiber"] + dinner["estimated_nutrition"]["fiber"]
            },
            "special_notes": [
                "Drink plenty of water throughout the day",
                "Consider spacing meals 3-4 hours apart",
                "Adjust portions based on your individual needs"
            ]
        }
    
    def save_meal_plan(self, user_id: int, meal_plan: Dict[str, Any]) -> bool:
        """Save meal plan to database"""
        try:
            conn = self.get_database_connection()
            cursor = conn.cursor()
            cursor.execute('''
                INSERT INTO meal_plans (user_id, plan_data)
                VALUES (?, ?)
            ''', (user_id, json.dumps(meal_plan)))
            conn.commit()
            conn.close()
            return True
        except Exception as e:
            print(f"Database error saving meal plan: {e}")
            return False
    
    def process(self, inputs: Dict[str, Any]) -> Dict[str, Any]:
        """Main processing function"""
        user_id = inputs.get('user_id')
        special_requirements = inputs.get('special_requirements')
        action = inputs.get('action', 'generate')  # 'generate' or 'get_latest'
        
        if not user_id:
            return {
                'success': False,
                'message': 'User ID is required',
                'error': 'missing_user_id'
            }
        
        if action == 'generate':
            # Get user context
            user_context = self.get_user_context(user_id)
            if not user_context:
                return {
                    'success': False,
                    'message': 'Unable to retrieve user information for meal planning',
                    'error': 'user_context_error'
                }
            
            # Generate meal plan
            meal_plan = self.generate_meal_plan_with_llm(user_context, special_requirements)
            
            # Log the meal plan for debugging
            print(f"Generated meal plan: {meal_plan}")
            
            # Save meal plan
            success = self.save_meal_plan(user_id, meal_plan)
            if not success:
                return {
                    'success': False,
                    'message': 'Failed to save meal plan. Please try again.',
                    'error': 'database_error'
                }
            
            return {
                'success': True,
                'message': self.generate_meal_plan_message(user_context['first_name'], meal_plan),
                'meal_plan': meal_plan,
                'user_context': {
                    'dietary_preference': user_context.get('dietary_preference'),
                    'medical_conditions': user_context.get('medical_conditions')
                }
            }
        
        elif action == 'get_latest':
            try:
                conn = self.get_database_connection()
                cursor = conn.cursor()
                cursor.execute('''
                    SELECT plan_data, created_at FROM meal_plans 
                    WHERE user_id = ? ORDER BY created_at DESC LIMIT 1
                ''', (user_id,))
                
                result = cursor.fetchone()
                conn.close()
                
                if result:
                    meal_plan = json.loads(result[0])
                    created_at = result[1]
                    
                    # Log the retrieved meal plan for debugging
                    print(f"Retrieved meal plan: {meal_plan}")
                    
                    return {
                        'success': True,
                        'message': f'Here\'s your latest meal plan from {created_at}:',
                        'meal_plan': meal_plan,
                        'created_at': created_at
                    }
                else:
                    return {
                        'success': False,
                        'message': 'No meal plans found. Generate your first meal plan!',
                        'error': 'no_plans_found'
                    }
            except Exception as e:
                print(f"Error retrieving latest meal plan: {e}")
                return {
                    'success': False,
                    'message': 'Failed to retrieve meal plan. Please try again.',
                    'error': 'database_error'
                }
        
        else:
            return {
                'success': False,
                'message': 'Invalid action. Use "generate" or "get_latest".',
                'error': 'invalid_action'
            }
    
    def generate_meal_plan_message(self, first_name: str, meal_plan: Dict[str, Any]) -> str:
        """Generate meal plan presentation message"""
        message = f"🍽️ Here's your personalized meal plan, {first_name}!\n\n"
        
        meals = ['breakfast', 'lunch', 'dinner']
        meal_emojis = ['🌅', '☀️', '🌙']
        
        for i, meal_type in enumerate(meals):
            meal = meal_plan.get(meal_type, {})
            message += f"{meal_emojis[i]} **{meal_type.title()}**: {meal.get('name', 'Not specified')}\n"
            message += f"   {meal.get('description', '')}\n"
            
            nutrition = meal.get('estimated_nutrition', {})
            message += f"   📊 {nutrition.get('calories', 0):.0f} cal | "
            message += f"{nutrition.get('carbs', 0):.0f}g carbs | "
            message += f"{nutrition.get('protein', 0):.0f}g protein\n\n"
        
        daily_totals = meal_plan.get('daily_totals', {})
        message += f"📈 **Daily Totals**: {daily_totals.get('calories', 0):.0f} calories, "
        message += f"{daily_totals.get('carbs', 0):.0f}g carbs, "
        message += f"{daily_totals.get('protein', 0):.0f}g protein\n\n"
        
        special_notes = meal_plan.get('special_notes', [])
        if special_notes:
            message += "💡 **Special Notes**:\n"
            for note in special_notes:
                message += f"• {note}\n"
        
        return message

# Agent schema for Agno
AGENT_SCHEMA = {
    "name": "meal_planner_agent",
    "version": "1.0.0",
    "description": "Generates adaptive meal plans based on user preferences and health data",
    "inputs": {
        "user_id": {
            "type": "integer",
            "description": "User ID",
            "required": True
        },
        "special_requirements": {
            "type": "string",
            "description": "Special dietary requirements or preferences for this meal plan",
            "required": False
        },
        "action": {
            "type": "string",
            "description": "Action to perform",
            "enum": ["generate", "get_latest"],
            "default": "generate"
        }
    },
    "outputs": {
        "success": {
            "type": "boolean",
            "description": "Whether the operation was successful"
        },
        "message": {
            "type": "string",
            "description": "Response message with meal plan details"
        },
        "meal_plan": {
            "type": "object",
            "description": "Complete meal plan with nutrition information"
        },
        "user_context": {
            "type": "object",
            "description": "User context used for meal planning"
        }
    }
}