#!/bin/bash

# City Samaachar - GEMINI_API_KEY Setup Script

echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║  City Samaachar - GEMINI_API_KEY Setup                     ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Check if key already set
if [ -n "$GEMINI_API_KEY" ]; then
    echo "✅ GEMINI_API_KEY already set!"
    echo "   Value: ${GEMINI_API_KEY:0:20}..."
    echo ""
    read -p "Do you want to update it? (y/n): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 0
    fi
fi

echo "📋 Steps to get your API key:"
echo "   1. Go to: https://aistudio.google.com"
echo "   2. Click 'Get API Key' button"
echo "   3. Click 'Create API key in new project'"
echo "   4. Copy the generated key"
echo ""

read -p "Paste your GEMINI_API_KEY here: " API_KEY

if [ -z "$API_KEY" ]; then
    echo "❌ No API key provided. Exiting."
    exit 1
fi

# Validate key format (should be at least 20 chars)
if [ ${#API_KEY} -lt 20 ]; then
    echo "⚠️  Warning: API key seems too short. Make sure you copied it correctly."
    read -p "Continue anyway? (y/n): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Add to shell config
SHELL_CONFIG=""
if [ -f "$HOME/.zshrc" ]; then
    SHELL_CONFIG="$HOME/.zshrc"
elif [ -f "$HOME/.bash_profile" ]; then
    SHELL_CONFIG="$HOME/.bash_profile"
elif [ -f "$HOME/.bashrc" ]; then
    SHELL_CONFIG="$HOME/.bashrc"
fi

if [ -n "$SHELL_CONFIG" ]; then
    # Check if already exists
    if grep -q "GEMINI_API_KEY" "$SHELL_CONFIG"; then
        echo "⚠️  GEMINI_API_KEY already in $SHELL_CONFIG"
        read -p "Replace it? (y/n): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            # Remove old entry
            sed -i '' '/GEMINI_API_KEY/d' "$SHELL_CONFIG"
        else
            exit 0
        fi
    fi
    
    # Add new entry
    echo "" >> "$SHELL_CONFIG"
    echo "# City Samaachar - Gemini API Key" >> "$SHELL_CONFIG"
    echo "export GEMINI_API_KEY=\"$API_KEY\"" >> "$SHELL_CONFIG"
    
    echo "✅ API key saved to $SHELL_CONFIG"
    echo ""
    echo "📝 Run this to apply changes:"
    echo "   source $SHELL_CONFIG"
    echo ""
else
    echo "⚠️  Could not find shell config file"
    echo "   Please manually add this line to your ~/.zshrc or ~/.bash_profile:"
    echo ""
    echo "   export GEMINI_API_KEY=\"$API_KEY\""
    echo ""
fi

# Also create .env file in backend
BACKEND_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/backend" && pwd)"
if [ -d "$BACKEND_DIR" ]; then
    echo "GEMINI_API_KEY=$API_KEY" > "$BACKEND_DIR/.env"
    echo "✅ Also saved to $BACKEND_DIR/.env"
fi

echo ""
echo "🧪 Test your setup:"
echo "   1. Reload shell: source $SHELL_CONFIG"
echo "   2. Verify: echo \$GEMINI_API_KEY"
echo "   3. Start backend: cd backend && python -m uvicorn api.routes:app --reload"
echo "   4. Start frontend: cd Frontend && npx expo start"
echo ""
echo "✨ All set! Your agentic AI pipeline is now using Gemini API."
echo ""
