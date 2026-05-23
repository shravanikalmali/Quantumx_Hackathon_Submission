import { GEMINI_API_KEY } from "../constants";

const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";
const SPEECH_TO_TEXT_URL = "https://speech.googleapis.com/v1/speech:recognize";

/**
 * Convert audio file to text using Google Cloud Speech-to-Text API
 * @param {string} audioUri - URI of the audio file
 * @returns {Promise<string>} - Transcribed text
 */
export async function speechToText(audioUri) {
  try {
    // Read audio file and convert to base64
    const response = await fetch(audioUri);
    const blob = await response.blob();
    const reader = new FileReader();
    
    return new Promise((resolve, reject) => {
      reader.onload = async () => {
        const base64Audio = reader.result.split(',')[1];
        
        try {
          const speechResponse = await fetch(
            `${SPEECH_TO_TEXT_URL}?key=${GEMINI_API_KEY}`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                config: {
                  encoding: "LINEAR16",
                  languageCode: "en-IN",
                  sampleRateHertz: 16000,
                },
                audio: {
                  content: base64Audio,
                },
              }),
            }
          );

          if (!speechResponse.ok) {
            console.error("Speech-to-Text error:", speechResponse.status);
            resolve(""); // Return empty string on error
            return;
          }

          const speechData = await speechResponse.json();
          const transcript =
            speechData?.results?.[0]?.alternatives?.[0]?.transcript || "";
          resolve(transcript);
        } catch (error) {
          console.error("Speech-to-Text API error:", error);
          resolve(""); // Return empty string on error
        }
      };
      
      reader.onerror = () => {
        console.error("File read error:", reader.error);
        reject(reader.error);
      };
      
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error("Audio conversion error:", error);
    return "";
  }
}

/**
 * Transcribe voice text using Gemini API
 * @param {string} voiceText - The voice input text to transcribe/enhance
 * @returns {Promise<string>} - Enhanced/corrected transcription
 */
export async function transcribeVoice(voiceText) {
  if (!voiceText?.trim()) {
    return voiceText;
  }

  try {
    const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: `You are a voice transcription assistant. The user has spoken an emergency report. Clean up and improve the following transcription while keeping the original meaning. Return only the cleaned text, nothing else:\n\n"${voiceText}"`,
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 256,
        },
      }),
    });

    if (!response.ok) {
      console.error("Gemini API error:", response.status);
      return voiceText; // Return original if API fails
    }

    const data = await response.json();
    let cleanedText =
      data?.candidates?.[0]?.content?.parts?.[0]?.text || voiceText;
    // Remove markdown code blocks if present
    cleanedText = cleanedText.replace(/```json\n?|```\n?/g, "").trim();
    return cleanedText;
  } catch (error) {
    console.error("Transcription error:", error);
    return voiceText; // Return original on error
  }
}

/**
 * Analyze incident text using Gemini API
 * @param {string} text - The incident description
 * @returns {Promise<object>} - Analysis results
 */
export async function analyzeIncidentWithGemini(text) {
  if (!text?.trim()) {
    return null;
  }

  try {
    console.log("Calling Gemini API with key:", GEMINI_API_KEY.substring(0, 10) + "...");
    const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: `Analyze this emergency incident report and provide structured analysis. Return a JSON object with these fields:
- incident_type: (fire, flood, road_accident, medical_emergency, etc.)
- severity_score: (0-1)
- urgency_level: (low, medium, high, critical)
- escalation_probability: (0-1)
- summary: (brief description)
- recommended_resources: (array of resource types)

Incident: "${text}"

Return ONLY valid JSON, no other text.`,
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 512,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Gemini API error:", response.status, errorText);
      // Return a mock analysis for demo purposes
      return {
        incident_type: "emergency",
        severity_score: 0.7,
        urgency_level: "high",
        escalation_probability: 0.5,
        summary: text.substring(0, 100),
        recommended_resources: ["emergency_services"]
      };
    }

    const data = await response.json();
    let analysisText =
      data?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";

    try {
      // Remove markdown code blocks if present
      analysisText = analysisText.replace(/```json\n?|```\n?/g, "").trim();
      return JSON.parse(analysisText);
    } catch (parseError) {
      console.error("Failed to parse Gemini response:", parseError, analysisText);
      return null;
    }
  } catch (error) {
    console.error("Analysis error:", error);
    return null;
  }
}

/**
 * Generate AI summary from multiple incidents
 * @param {array} incidents - Array of incident objects
 * @returns {Promise<string>} - AI-generated summary
 */
export async function generateAISummary(incidents) {
  if (!incidents || incidents.length === 0) {
    return "No incidents to summarize";
  }

  try {
    const incidentList = incidents
      .slice(0, 5)
      .map(
        (inc) =>
          `- ${inc.incident_type || "incident"} at ${inc.area_name} (${inc.risk_label})`
      )
      .join("\n");

    const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: `Generate a brief, actionable AI summary (1-2 sentences) of these active incidents for an emergency dashboard:\n\n${incidentList}\n\nBe concise and focus on the most critical issues.`,
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.5,
          maxOutputTokens: 150,
        },
      }),
    });

    if (!response.ok) {
      return "Multiple incidents detected - review dashboard";
    }

    const data = await response.json();
    return (
      data?.candidates?.[0]?.content?.parts?.[0]?.text ||
      "Multiple incidents detected"
    );
  } catch (error) {
    console.error("Summary generation error:", error);
    return "Multiple incidents detected - review dashboard";
  }
}
