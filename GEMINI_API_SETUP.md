# GEMINI_API_KEY Setup Guide 🔑

## Step 1: Get Your API Key (2 minutes)

### Option A: Google AI Studio (Easiest)
1. Go to **https://aistudio.google.com**
2. Click **"Get API Key"** button
3. Click **"Create API key in new project"**
4. Copy the generated key
5. **Done!** You now have your GEMINI_API_KEY

### Option B: Google Cloud Console (More Control)
1. Go to **https://console.cloud.google.com**
2. Create a new project (or use existing)
3. Enable "Generative Language API"
4. Go to **Credentials** → **Create Credentials** → **API Key**
5. Copy the key
6. **Done!**

---

## Step 2: Set Environment Variable

### On macOS/Linux:

**Option A: Temporary (Current Terminal Session Only)**
```bash
export GEMINI_API_KEY="your_api_key_here"
```

**Option B: Permanent (Add to ~/.zshrc or ~/.bash_profile)**
```bash
# Open your shell config file
nano ~/.zshrc

# Add this line at the end:
export GEMINI_API_KEY="your_api_key_here"

# Save (Ctrl+O, Enter, Ctrl+X)
# Reload:
source ~/.zshrc
```

**Option C: Create .env file in backend directory**
```bash
cd /Users/3963829/Desktop/City-Samaachar-master/backend
echo 'GEMINI_API_KEY="your_api_key_here"' > .env
```

---

## Step 3: Verify It's Working

### Test 1: Check Environment Variable
```bash
echo $GEMINI_API_KEY
# Should print your key
```

### Test 2: Run Backend
```bash
cd /Users/3963829/Desktop/City-Samaachar-master/backend
python -m uvicorn api.routes:app --reload
```

**Expected output**:
```
INFO:     Uvicorn running on http://127.0.0.1:8000
INFO:     Application startup complete
```

### Test 3: Test Gemini API Call
```bash
curl -X POST http://localhost:8000/pipeline/run \
  -H "Content-Type: application/json" \
  -d '{}'
```

**Expected response**: Incidents analyzed with Gemini AI (not heuristic defaults)

---

## Step 4: Run Frontend

```bash
cd /Users/3963829/Desktop/City-Samaachar-master/Frontend
npx expo start
```

Then:
- Press `i` for iOS simulator, or
- Press `a` for Android emulator, or
- Scan QR code with Expo Go app

---

## Step 5: Test Full Pipeline

1. **Open app** → Home screen
2. **Tap "Load demo data"** button
3. **Wait 10-15 seconds** for pipeline to run
4. **Check incidents** → Should show:
   - ✅ Proper incident types (fire, flood, accident, etc.)
   - ✅ Severity scores (0.0-1.0)
   - ✅ Recommended resources (ambulance, fire_truck, etc.)
   - ✅ Escalation probabilities

---

## Troubleshooting

### Problem: "GEMINI_API_KEY not set"
**Solution**: 
```bash
# Check if key is set
echo $GEMINI_API_KEY

# If empty, set it:
export GEMINI_API_KEY="your_key_here"

# Verify:
echo $GEMINI_API_KEY
```

### Problem: "Invalid API key"
**Solution**:
1. Go to https://aistudio.google.com
2. Check that your key is correct (copy again)
3. Make sure there are no extra spaces
4. Try a fresh key

### Problem: "API quota exceeded"
**Solution**:
- Free tier has limits (~60 requests/minute)
- Wait a few minutes and try again
- Or upgrade to paid plan

### Problem: Backend runs but Gemini not used
**Solution**:
1. Check logs for "Gemini analysis failed"
2. Verify API key is set: `echo $GEMINI_API_KEY`
3. Check internet connection
4. Try test curl command above

---

## What Changes With API Key?

### Without API Key (Fallback):
```json
{
  "incident_type": "other",
  "severity_score": 0.5,
  "urgency_level": "medium",
  "escalation_probability": 0.3,
  "recommended_resources": []
}
```

### With API Key (Gemini AI):
```json
{
  "incident_type": "fire",
  "severity_score": 0.85,
  "urgency_level": "critical",
  "escalation_probability": 0.76,
  "recommended_resources": ["fire_truck", "ambulance", "rescue_team"]
}
```

**Much better!** ✅

---

## Quick Setup Script

**Save this as `setup_gemini.sh`:**

```bash
#!/bin/bash

echo "🔑 GEMINI_API_KEY Setup"
echo "======================="
echo ""
echo "1. Go to: https://aistudio.google.com"
echo "2. Click 'Get API Key'"
echo "3. Copy your key"
echo ""
read -p "Paste your GEMINI_API_KEY here: " API_KEY

# Add to ~/.zshrc
echo "" >> ~/.zshrc
echo "# City Samaachar - Gemini API Key" >> ~/.zshrc
echo "export GEMINI_API_KEY=\"$API_KEY\"" >> ~/.zshrc

echo ""
echo "✅ API key saved to ~/.zshrc"
echo "Run: source ~/.zshrc"
echo "Then: echo \$GEMINI_API_KEY"
```

**Run it:**
```bash
chmod +x setup_gemini.sh
./setup_gemini.sh
```

---

## Files That Use GEMINI_API_KEY

1. **backend/intelligence/incident_analysis.py** - Analyzes incident text
2. **backend/upload-report/main2.py** - Analyzes user-submitted photos
3. **backend/orchestration/pipeline.py** - Full pipeline execution
4. **backend/utils/config.py** - Loads from environment

---

## Next Steps

1. ✅ Get API key from https://aistudio.google.com
2. ✅ Set `export GEMINI_API_KEY="your_key"`
3. ✅ Run backend: `python -m uvicorn api.routes:app --reload`
4. ✅ Run frontend: `npx expo start`
5. ✅ Load demo data and test

---

## Support

If you get stuck:
1. Check `echo $GEMINI_API_KEY` (should print your key)
2. Check backend logs for errors
3. Try the test curl command
4. Verify key is valid at https://aistudio.google.com

**You're all set!** 🚀
