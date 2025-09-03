#!/bin/bash

echo "🎮 TESTING ALL DECKS"
echo "===================="
echo ""

ORG_ID="be34910d-fc7b-475b-8112-67fe778bff2c"
BASE_URL="http://localhost:3000"

DECKS=("0" "1" "2" "3" "company" "sales" "marketing" "product")

passed=0
total=${#DECKS[@]}

for deck in "${DECKS[@]}"; do
    echo "🧪 Testing deck '$deck'..."
    
    response=$(curl -s -X POST "$BASE_URL/api/play/start" \
        -H "Content-Type: application/json" \
        -d "{\"organizationId\":\"$ORG_ID\",\"deckTag\":\"$deck\"}" \
        2>/dev/null)
    
    if echo "$response" | grep -q '"playId"'; then
        cards_count=$(echo "$response" | grep -o '"totalCards":[0-9]*' | cut -d':' -f2)
        card_titles=$(echo "$response" | grep -o '"title":"[^"]*"' | cut -d'"' -f4 | tr '\n' ',' | sed 's/,$//')
        echo "   ✅ SUCCESS: $cards_count cards ($card_titles)"
        ((passed++))
    else
        error=$(echo "$response" | grep -o '"error":"[^"]*"' | cut -d'"' -f4)
        echo "   ❌ FAILED: $error"
    fi
done

echo ""
echo "🏆 RESULTS: $passed/$total decks working"

if [ $passed -eq $total ]; then
    echo ""
    echo "🎉 ALL DECKS ARE WORKING!"
    echo ""
    echo "🎯 YOU CAN NOW:"
    echo "   1. Play simple decks (0, 1, 2, 3, sales, marketing, product)"
    echo "   2. Play hierarchical deck (company) with multi-level flow"
    echo "   3. Experience the complete decision tree system"
    echo ""
    echo "🚀 Go to: http://localhost:3000/play?org=$ORG_ID"
    echo "   Select any deck and start playing!"
else
    echo ""
    echo "⚠️ Some decks still have issues."
fi
