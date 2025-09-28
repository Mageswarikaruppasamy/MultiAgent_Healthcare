# Healthcare Multi-Agent Demo

A personalized healthcare application built with multi-agent architecture using Agno framework, featuring AI-powered agents for mood tracking, glucose monitoring, food logging, and meal planning.

## 🏗️ Architecture

- **Backend**: FastAPI with Agno multi-agent framework
- **Frontend**: React with AG-UI  
- **AI**: Google Gemini API for intelligent responses
- **Database**: SQLite for data persistence
- **Deployment**: Docker containerization

## 🎯 Features

### Multi-Agent System
- **Greeting Agent**: User authentication and personalized welcome
- **Mood Tracker Agent**: Emotional state monitoring with trends
- **CGM Agent**: Glucose readings with intelligent alerts
- **Food Intake Agent**: Meal logging with AI nutrition analysis
- **Meal Planner Agent**: Personalized meal recommendations
- **Interrupt Agent**: General Q&A and help system

### User Interface
- **Dashboard**: Comprehensive health overview with charts
- **Interactive Widgets**: Emoji-based mood tracking, glucose logging
- **AI Chat Assistant**: Natural language interactions
- **Real-time Analytics**: Visual trends and insights

## 🚀 Quick Start

### Prerequisites
```bash
- Docker & Docker Compose
- Node.js 18+ (for development)
- Python 3.11+ (for development)
- Google Gemini API key
```

### 1. Clone and Setup
```bash
git clone https://github.com/Mageswarikaruppasamy/MultiAgent_Healthcare.git
cd folder name

# Copy environment template
cp .env.example .env

# Add your Gemini API key to .env file
echo "GEMINI_API_KEY=your_actual_api_key_here" >> .env
```

### 2. Generate Dataset
```bash
# Generate synthetic user data and start frontend and backend
docker-compose up --build
```

### 3. Run with Docker (Recommended)
```bash
# Reuse the existing dataset
docker-compose up

# Access the application
# Frontend: http://localhost:3000
# Backend API: http://localhost:8000
```

### 4. Development Mode

#### Backend Setup
```bash
cd agents
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

pip install -r requirements.txt

# Set environment variables
export DATABASE_PATH="../data/healthcare_data.db"
export GEMINI_API_KEY="your_actual_api_key_here"

# Generate dataset first
cd ../data
python generate_dataset.py

# Run backend
cd ../agents
python app.py
```

#### Frontend Setup
```bash
cd frontend
npm install
npm run dev
