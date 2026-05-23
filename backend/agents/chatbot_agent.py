"""
ResQ Pulse Chatbot Agent

An intelligent chatbot that answers questions about:
- Current emergency situations in Bengaluru
- System capabilities and features
- Incident predictions and risk assessments
- Resource allocation and responder status
- Historical crash data and area risk profiles

Uses Gemini AI for natural language understanding and response generation.
"""

import logging
import json
from datetime import datetime, timezone
from typing import Optional

import google.generativeai as genai
from backend.utils.config import GEMINI_API_KEY

logging.basicConfig(level=logging.INFO)

if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)
    gemini_model = genai.GenerativeModel("gemini-1.5-pro")
else:
    gemini_model = None
    logging.warning("Gemini API key not configured - chatbot will use fallback responses")


class ChatbotAgent:
    """
    Intelligent chatbot for ResQ Pulse emergency response system.
    """
    
    def __init__(self):
        self.conversation_history = []
        self.system_context = self._build_system_context()
    
    def _build_system_context(self) -> str:
        """Build system context for the chatbot."""
        return """You are ResQ Pulse AI Assistant, an intelligent chatbot for Bengaluru's emergency response system.

**System Capabilities:**
- Real-time incident monitoring from Google News, Reddit, and citizen reports
- Quantum ML risk prediction using 4-qubit variational quantum circuits
- Semantic clustering of related incidents
- QAOA-based optimal resource allocation
- Live weather integration (Open-Meteo API)
- Historical crash risk data from OpenCity (2007-2025)
- Responder tracking and dispatch management

**Data Sources:**
1. Historical crash risk (16 Bengaluru areas)
2. Citizen reports (via /report endpoint)
3. Traffic alerts (real-time)
4. Google News RSS (Bangalore emergencies)
5. Reddit r/bangalore (emergency posts)
6. Live weather data (Open-Meteo)

**QML Features:**
- severity_score: Current incident severity (0-1)
- historical_area_risk: Area crash history (0-1)
- report_density: Time-weighted incident density (0-1)
- accessibility_risk: Traffic + weather impact (0-1)

**Responders:**
- 3 Ambulances
- 2 Fire Trucks
- 2 Rescue Teams
- 2 Police Units
- 1 Hazmat Unit
- 1 Medical Team

**Key Areas Covered:**
Silk Board, HSR Layout, Koramangala, Whitefield, Marathahalli, Electronic City, MG Road, Majestic, Hebbal, Yeshwanthpur, Indiranagar, Jayanagar, BTM Layout, JP Nagar, and more.

**Your Role:**
- Answer questions about current emergencies
- Explain system features and capabilities
- Provide risk assessments for specific areas
- Help users understand predictions and allocations
- Be concise, accurate, and helpful
- Use plain language, avoid jargon unless asked

**Response Style:**
- Be professional but friendly
- Use bullet points for lists
- Include specific data when available
- Suggest actions when appropriate
- Admit when you don't have information
"""
    
    def ask(self, question: str, context: Optional[dict] = None) -> dict:
        """
        Answer a user question using Gemini AI.
        
        Args:
            question: User's question
            context: Optional system context (clusters, allocations, weather, etc.)
        
        Returns:
            {
                "answer": str,
                "confidence": float,
                "sources": list,
                "timestamp": str
            }
        """
        if not gemini_model:
            return self._fallback_response(question)
        
        try:
            # Build prompt with system context and current data
            prompt = self._build_prompt(question, context)
            
            # Get response from Gemini
            response = gemini_model.generate_content(prompt)
            answer = response.text.strip()
            
            # Store in conversation history
            self.conversation_history.append({
                "question": question,
                "answer": answer,
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "context_provided": context is not None
            })
            
            return {
                "answer": answer,
                "confidence": 0.9,  # High confidence with Gemini
                "sources": self._extract_sources(context),
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "conversation_id": len(self.conversation_history)
            }
            
        except Exception as e:
            logging.error(f"Chatbot error: {e}")
            return self._fallback_response(question)
    
    def _build_prompt(self, question: str, context: Optional[dict]) -> str:
        """Build the full prompt for Gemini."""
        prompt_parts = [self.system_context]
        
        # Add current system context if provided
        if context:
            prompt_parts.append("\n**Current System State:**")
            
            if "clusters" in context:
                clusters = context["clusters"]
                prompt_parts.append(f"\nActive Clusters: {len(clusters)}")
                for i, cluster in enumerate(clusters[:5], 1):  # Show top 5
                    prompt_parts.append(
                        f"{i}. {cluster.get('incident_type', 'unknown')} in "
                        f"{cluster.get('jurisdiction', 'Unknown')} - "
                        f"Severity: {cluster.get('cluster_severity', 0):.2f}, "
                        f"Incidents: {cluster.get('incident_count', 0)}, "
                        f"Trend: {cluster.get('escalation_trend', 'stable')}"
                    )
            
            if "allocations" in context:
                allocations = context["allocations"]
                prompt_parts.append(f"\nActive Allocations: {len(allocations)}")
                for alloc in allocations[:5]:
                    prompt_parts.append(
                        f"- {alloc.get('responder_type', 'unknown')} → "
                        f"{alloc.get('cluster_incident_type', 'unknown')} "
                        f"(ETA: {alloc.get('eta_minutes', 0):.0f} min)"
                    )
            
            if "weather" in context:
                weather = context["weather"]
                prompt_parts.append(
                    f"\nCurrent Weather: {weather.get('condition', 'unknown')}, "
                    f"Rainfall: {weather.get('rainfall_mm', 0):.1f}mm, "
                    f"Temp: {weather.get('temperature_c', 0):.1f}°C"
                )
            
            if "responder_state" in context:
                state = context["responder_state"]
                available = sum(1 for s in state.values() if s.get("status") == "available")
                total = len(state)
                prompt_parts.append(f"\nResponders Available: {available}/{total}")
            
            if "training_status" in context:
                training = context["training_status"]
                prompt_parts.append(
                    f"\nQML Model: {training.get('status', 'unknown')}, "
                    f"Accuracy: {training.get('accuracy', 0):.1%}"
                )
        
        # Add conversation history (last 3 exchanges)
        if self.conversation_history:
            prompt_parts.append("\n**Recent Conversation:**")
            for exchange in self.conversation_history[-3:]:
                prompt_parts.append(f"Q: {exchange['question']}")
                prompt_parts.append(f"A: {exchange['answer'][:100]}...")
        
        # Add current question
        prompt_parts.append(f"\n**User Question:**\n{question}")
        prompt_parts.append("\n**Your Answer (be concise and helpful):**")
        
        return "\n".join(prompt_parts)
    
    def _extract_sources(self, context: Optional[dict]) -> list:
        """Extract data sources from context."""
        sources = ["ResQ Pulse System Knowledge"]
        if context:
            if "clusters" in context:
                sources.append("Current Active Clusters")
            if "allocations" in context:
                sources.append("Resource Allocations")
            if "weather" in context:
                sources.append("Live Weather Data")
            if "responder_state" in context:
                sources.append("Responder Status")
        return sources
    
    def _fallback_response(self, question: str) -> dict:
        """Fallback response when Gemini is unavailable."""
        question_lower = question.lower()
        
        # Simple keyword matching
        if any(word in question_lower for word in ["what", "how", "explain", "tell"]):
            if "qml" in question_lower or "quantum" in question_lower:
                answer = "ResQ Pulse uses a 4-qubit Quantum ML model to predict incident risk. It analyzes severity, historical crash data, report density, and accessibility factors to provide risk scores."
            elif "responder" in question_lower or "ambulance" in question_lower:
                answer = "The system tracks 11 emergency responders including ambulances, fire trucks, rescue teams, police units, hazmat, and medical teams. They are allocated using QAOA quantum optimization."
            elif "area" in question_lower or "location" in question_lower:
                answer = "ResQ Pulse covers 16+ areas in Bengaluru including Silk Board, HSR Layout, Koramangala, Whitefield, Electronic City, and more. Each area has historical crash risk data."
            elif "weather" in question_lower:
                answer = "The system integrates live weather data from Open-Meteo API, including rainfall, temperature, humidity, and visibility. This affects accessibility risk calculations."
            else:
                answer = "ResQ Pulse is an AI-powered emergency response system for Bengaluru. It monitors incidents, predicts risks using Quantum ML, and optimally allocates responders. Ask me about specific features!"
        else:
            answer = "I can help you understand ResQ Pulse's emergency response capabilities. Try asking about: QML predictions, responder allocation, area risk profiles, or current incidents."
        
        return {
            "answer": answer,
            "confidence": 0.6,  # Lower confidence for fallback
            "sources": ["System Knowledge Base"],
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "fallback": True
        }
    
    def get_conversation_history(self) -> list:
        """Get the full conversation history."""
        return self.conversation_history
    
    def clear_history(self):
        """Clear conversation history."""
        self.conversation_history = []
        logging.info("Conversation history cleared")
    
    def predict(self, incident_data: dict) -> dict:
        """
        Get QML risk prediction for an incident and explain it.
        
        Args:
            incident_data: {
                "text": "Fire at HSR Layout",
                "location": {"latitude": 12.9081, "longitude": 77.6476},
                "severity": 0.85,
                "incident_type": "fire"
            }
        
        Returns:
            {
                "prediction": {...},  # QML prediction results
                "explanation": str,   # Natural language explanation
                "confidence": float
            }
        """
        try:
            from backend.quantum.qml_incident_predictor import predict_incident_qml
            from backend.prediction.feature_builder import build_qml_features
            
            # Build features
            features_result = build_qml_features(incident_data)
            
            # Get QML prediction
            qml_prediction = predict_incident_qml(incident_data)
            
            # Generate natural language explanation
            if gemini_model:
                prompt = f"""You are explaining a Quantum ML risk prediction to an emergency coordinator.

**Incident:**
{incident_data.get('text', 'Unknown incident')}

**QML Prediction:**
- Risk Score: {qml_prediction.get('qml_risk_score', 0):.3f}
- Risk Label: {qml_prediction.get('qml_risk_label', 'unknown')}
- Confidence: {qml_prediction.get('qml_confidence', 0):.1%}

**Features Used:**
- Severity: {features_result['features'][0]:.3f}
- Historical Area Risk: {features_result['features'][1]:.3f}
- Report Density: {features_result['features'][2]:.3f}
- Accessibility Risk: {features_result['features'][3]:.3f}

**Plain Language:**
{qml_prediction.get('plain_language', '')}

Provide a 2-3 sentence explanation of what this prediction means and what action should be taken."""
                
                response = gemini_model.generate_content(prompt)
                explanation = response.text.strip()
            else:
                # Fallback explanation
                risk_label = qml_prediction.get('qml_risk_label', 'unknown')
                risk_score = qml_prediction.get('qml_risk_score', 0)
                explanation = f"The QML model predicts this incident has a {risk_label} risk level (score: {risk_score:.3f}). "
                
                if risk_score >= 0.75:
                    explanation += "Immediate emergency response is strongly recommended."
                elif risk_score >= 0.55:
                    explanation += "Emergency response should be dispatched soon."
                elif risk_score >= 0.35:
                    explanation += "Monitor the situation and prepare resources."
                else:
                    explanation += "Low risk - continue monitoring."
            
            return {
                "prediction": qml_prediction,
                "features": features_result,
                "explanation": explanation,
                "confidence": qml_prediction.get('qml_confidence', 0.5),
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
            
        except Exception as e:
            logging.error(f"Prediction error: {e}")
            return {
                "error": str(e),
                "explanation": "Unable to generate prediction at this time.",
                "confidence": 0.0
            }


# Global chatbot instance
_chatbot = None

def get_chatbot() -> ChatbotAgent:
    """Get or create the global chatbot instance."""
    global _chatbot
    if _chatbot is None:
        _chatbot = ChatbotAgent()
    return _chatbot


if __name__ == "__main__":
    # Test the chatbot
    bot = ChatbotAgent()
    
    test_questions = [
        "What does ResQ Pulse do?",
        "How does the QML model work?",
        "Which areas are covered?",
        "What responders are available?",
        "How is weather data used?",
    ]
    
    for q in test_questions:
        print(f"\nQ: {q}")
        response = bot.ask(q)
        print(f"A: {response['answer']}")
        print(f"Confidence: {response['confidence']:.1%}")
