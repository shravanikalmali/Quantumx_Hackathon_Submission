#!/bin/bash

# Test script for ResQ Pulse Chatbot

echo "=== Testing ResQ Pulse Chatbot ==="
echo ""

# Test 1: Simple question without context
echo "Test 1: Simple question"
curl -X POST http://localhost:8080/chatbot/ask \
  -H "Content-Type: application/json" \
  -d '{"question": "What does ResQ Pulse do?"}' \
  | jq '.'

echo ""
echo "---"
echo ""

# Test 2: Question about QML
echo "Test 2: QML question"
curl -X POST http://localhost:8080/chatbot/ask \
  -H "Content-Type: application/json" \
  -d '{"question": "How does the quantum ML model work?"}' \
  | jq '.'

echo ""
echo "---"
echo ""

# Test 3: Question with context
echo "Test 3: Question with system context"
curl -X POST http://localhost:8080/chatbot/ask \
  -H "Content-Type: application/json" \
  -d '{"question": "What is the current emergency situation?", "include_context": true}' \
  | jq '.'

echo ""
echo "---"
echo ""

# Test 4: Question about areas
echo "Test 4: Areas covered"
curl -X POST http://localhost:8080/chatbot/ask \
  -H "Content-Type: application/json" \
  -d '{"question": "Which areas of Bengaluru are covered?"}' \
  | jq '.'

echo ""
echo "---"
echo ""

# Test 5: Get conversation history
echo "Test 5: Conversation history"
curl http://localhost:8080/chatbot/history | jq '.'

echo ""
echo "=== Tests Complete ==="
