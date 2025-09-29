#!/bin/bash

echo "========================================="
echo "    CURL COMMANDS FOR CHECKING CALLS"
echo "========================================="
echo "Generated at: $(date)"
echo ""

# Configuration
BASE_URL="http://31.184.134.153:8081"
EMAIL="your_email@example.com"    # Replace with your actual email
PASSWORD="your_password"          # Replace with your actual password

echo "🔗 API Configuration:"
echo "--------------------"
echo "Base URL: $BASE_URL"
echo "Email: $EMAIL"
echo "Password: $PASSWORD"
echo ""

echo "📋 STEP-BY-STEP INSTRUCTIONS:"
echo "-----------------------------"
echo ""

echo "1️⃣  FIRST: Update your credentials in this script"
echo "   - Edit this file and replace 'your_email@example.com' with your actual email"
echo "   - Replace 'your_password' with your actual password"
echo ""

echo "2️⃣  LOGIN to get JWT token:"
echo "   Run this command to login and get your JWT token:"
echo ""
echo "curl -X POST \"$BASE_URL/api/auth/login\" \\"
echo "  -H \"Content-Type: application/json\" \\"
echo "  -d '{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}'"
echo ""
echo "   Copy the 'token' value from the response for the next steps."
echo ""

echo "3️⃣  SEARCH for calls (replace YOUR_JWT_TOKEN with the actual token):"
echo ""

echo "   📄 Get recent calls (page 1, 20 items):"
echo "curl -H \"Authorization: Bearer YOUR_JWT_TOKEN\" \\"
echo "  \"$BASE_URL/api/event?page=1&limit=20\""
echo ""

echo "   📄 Get more calls (page 2, 20 items):"
echo "curl -H \"Authorization: Bearer YOUR_JWT_TOKEN\" \\"
echo "  \"$BASE_URL/api/event?page=2&limit=20\""
echo ""

echo "   📄 Filter by call type (incoming only):"
echo "curl -H \"Authorization: Bearer YOUR_JWT_TOKEN\" \\"
echo "  \"$BASE_URL/api/event?page=1&limit=50&type=incoming\""
echo ""

echo "4️⃣  AUTOMATED SEARCH SCRIPT:"
echo "   If you have jq installed, you can use this automated approach:"
echo ""

cat << 'EOF'
#!/bin/bash
# Automated search script (requires jq)

BASE_URL="http://31.184.134.153:8081"
EMAIL="your_email@example.com"
PASSWORD="your_password"

# Login and get token
echo "Logging in..."
TOKEN=$(curl -s -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}" | jq -r '.token')

if [ "$TOKEN" = "null" ] || [ -z "$TOKEN" ]; then
    echo "❌ Login failed"
    exit 1
fi

echo "✅ Login successful"

# Search for calls with date patterns
echo "🔍 Searching for calls on 01-07-1404..."
PATTERNS=("14040701" "14040107" "140407" "140401")

for page in {1..10}; do
    echo "Checking page $page..."
    
    RESPONSE=$(curl -s -H "Authorization: Bearer $TOKEN" \
      "$BASE_URL/api/event?page=$page&limit=50")
    
    # Check if we have data
    CALL_COUNT=$(echo "$RESPONSE" | jq -r '.data.data | length')
    
    if [ "$CALL_COUNT" = "0" ] || [ "$CALL_COUNT" = "null" ]; then
        echo "No more data on page $page"
        break
    fi
    
    echo "Found $CALL_COUNT calls on page $page"
    
    # Search for matching patterns
    for pattern in "${PATTERNS[@]}"; do
        MATCHES=$(echo "$RESPONSE" | jq -r ".data.data[] | select(.filename | contains(\"$pattern\")) | {id, filename, date, transcription: (.transcription != null)}")
        
        if [ ! -z "$MATCHES" ] && [ "$MATCHES" != "" ]; then
            echo "✅ Found matches for pattern $pattern:"
            echo "$MATCHES"
        fi
    done
done
EOF

echo ""
echo "5️⃣  MANUAL SEARCH APPROACH:"
echo "   1. Use the login command to get your JWT token"
echo "   2. Use the search commands with your token"
echo "   3. Look through the JSON response for filenames containing:"
echo "      - 14040701 (YYYY-MM-DD format)"
echo "      - 14040107 (YYYY-DD-MM format)"
echo "      - 140407 or 140401 (partial matches)"
echo ""

echo "6️⃣  WHAT TO LOOK FOR IN THE RESPONSE:"
echo "   - 'transcription': null means no transcription stored"
echo "   - 'transcription': {...} means transcription is available"
echo "   - 'explanation': AI analysis of the call"
echo "   - 'category': Call categorization"
echo "   - 'emotion': Detected emotion"
echo "   - 'keyWords': Extracted keywords"
echo ""

echo "💡 TIPS:"
echo "--------"
echo "- The /api/event endpoint only shows calls WITH transcription data"
echo "- If no calls are found, they might not have been transcribed yet"
echo "- Use small page sizes (20-50) for faster responses"
echo "- The API supports filtering by emotion, category, destNumber, etc."
echo ""

echo "🔧 TROUBLESHOOTING:"
echo "------------------"
echo "- If you get 401 Unauthorized: Check your email/password"
echo "- If you get 404 Not Found: Check the server URL and port"
echo "- If you get timeout: The server might be slow or down"
echo "- If no data: The date might not exist or use different format"
echo ""

echo "========================================="



