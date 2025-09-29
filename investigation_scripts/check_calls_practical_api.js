const axios = require('axios');

// Configuration
const config = {
    baseUrl: 'http://31.184.134.153:8081',  // Updated port
    // You'll need to provide these credentials
    loginCredentials: {
        email: 'your_email@example.com',    // Replace with actual email
        password: 'your_password'           // Replace with actual password
    }
};

class SessionEventAPI {
    constructor() {
        this.baseUrl = config.baseUrl;
        this.jwtToken = null;
    }

    async login() {
        try {
            console.log('🔐 Logging in to get JWT token...');
            
            const response = await axios.post(`${this.baseUrl}/api/auth/login`, {
                email: config.loginCredentials.email,
                password: config.loginCredentials.password
            });

            if (response.data && response.data.token) {
                this.jwtToken = response.data.token;
                console.log('✅ Successfully logged in');
                return true;
            } else {
                console.error('❌ Login failed - no token received');
                return false;
            }
        } catch (error) {
            console.error('❌ Login failed:', error.response?.data || error.message);
            return false;
        }
    }

    async getSessions(params = {}) {
        if (!this.jwtToken) {
            throw new Error('Not authenticated. Please login first.');
        }

        try {
            const response = await axios.get(`${this.baseUrl}/api/event`, {
                headers: {
                    'Authorization': `Bearer ${this.jwtToken}`
                },
                params: params,
                timeout: 10000
            });

            return response.data;
        } catch (error) {
            if (error.response?.status === 401) {
                console.log('🔄 Token expired, trying to re-login...');
                await this.login();
                // Retry the request
                const retryResponse = await axios.get(`${this.baseUrl}/api/event`, {
                    headers: {
                        'Authorization': `Bearer ${this.jwtToken}`
                    },
                    params: params,
                    timeout: 10000
                });
                return retryResponse.data;
            }
            throw error;
        }
    }

    async searchCallsByDate(targetDate = '01-07-1404') {
        console.log('=========================================');
        console.log(`    SEARCHING FOR CALLS ON ${targetDate}`);
        console.log('=========================================');
        console.log(`Generated at: ${new Date().toISOString()}`);
        console.log('');

        // Define search patterns for the Persian date
        const patterns = ['14040701', '14040107', '140407', '140401'];
        console.log(`🔍 Search patterns: ${patterns.join(', ')}`);
        console.log('');

        let foundCalls = [];
        let page = 1;
        const limit = 50; // Reasonable page size
        let hasMorePages = true;

        try {
            while (hasMorePages) {
                console.log(`📄 Checking page ${page}...`);
                
                const response = await this.getSessions({
                    page: page,
                    limit: limit
                });

                if (response.data && response.data.data && response.data.data.length > 0) {
                    const calls = response.data.data;
                    console.log(`   Found ${calls.length} calls on page ${page}`);

                    // Search for matching calls in this page
                    const matchingCalls = calls.filter(call => {
                        const filename = call.filename || '';
                        return patterns.some(pattern => filename.includes(pattern));
                    });

                    if (matchingCalls.length > 0) {
                        console.log(`   ✅ Found ${matchingCalls.length} matching calls on page ${page}`);
                        foundCalls.push(...matchingCalls);
                    }

                    // Check if there are more pages
                    const pagination = response.data.pagination;
                    if (pagination && page >= pagination.totalPages) {
                        hasMorePages = false;
                    } else {
                        page++;
                    }

                    // Safety limit to prevent infinite loops
                    if (page > 100) {
                        console.log('⚠️  Reached page limit (100), stopping search');
                        hasMorePages = false;
                    }
                } else {
                    hasMorePages = false;
                }
            }

            // Display results
            console.log('');
            console.log('📊 SEARCH RESULTS:');
            console.log('------------------');
            console.log(`Total calls found for ${targetDate}: ${foundCalls.length}`);
            console.log('');

            if (foundCalls.length > 0) {
                foundCalls.forEach((call, index) => {
                    console.log(`--- Call ${index + 1} ---`);
                    console.log(`ID: ${call.id}`);
                    console.log(`Filename: ${call.filename}`);
                    console.log(`Date: ${call.date}`);
                    console.log(`Type: ${call.type}`);
                    console.log(`Source: ${call.sourceNumber} -> Dest: ${call.destNumber}`);
                    console.log(`Duration: ${call.duration}`);
                    console.log(`Has Transcription: ${call.transcription ? 'YES' : 'NO'}`);
                    console.log(`Has Explanation: ${call.explanation ? 'YES' : 'NO'}`);
                    console.log(`Category: ${call.category || 'N/A'}`);
                    console.log(`Emotion: ${call.emotion || 'N/A'}`);
                    console.log(`Keywords: ${call.keyWords ? call.keyWords.join(', ') : 'N/A'}`);
                    
                    if (call.transcription) {
                        console.log('Transcription Preview:');
                        try {
                            const transcript = typeof call.transcription === 'string' 
                                ? JSON.parse(call.transcription) 
                                : call.transcription;
                            
                            if (transcript.Agent) {
                                console.log(`  Agent: ${transcript.Agent.substring(0, 100)}${transcript.Agent.length > 100 ? '...' : ''}`);
                            }
                            if (transcript.Customer) {
                                console.log(`  Customer: ${transcript.Customer.substring(0, 100)}${transcript.Customer.length > 100 ? '...' : ''}`);
                            }
                        } catch (e) {
                            console.log(`  Raw: ${JSON.stringify(call.transcription).substring(0, 100)}...`);
                        }
                    }
                    console.log('');
                });

                // Summary statistics
                const withTranscription = foundCalls.filter(c => c.transcription).length;
                const withExplanation = foundCalls.filter(c => c.explanation).length;
                const withCategory = foundCalls.filter(c => c.category).length;
                const withEmotion = foundCalls.filter(c => c.emotion).length;

                console.log('📈 TRANSCRIPTION STATISTICS:');
                console.log('----------------------------');
                console.log(`Calls with transcription: ${withTranscription}/${foundCalls.length} (${((withTranscription/foundCalls.length)*100).toFixed(1)}%)`);
                console.log(`Calls with explanation: ${withExplanation}/${foundCalls.length} (${((withExplanation/foundCalls.length)*100).toFixed(1)}%)`);
                console.log(`Calls with category: ${withCategory}/${foundCalls.length} (${((withCategory/foundCalls.length)*100).toFixed(1)}%)`);
                console.log(`Calls with emotion: ${withEmotion}/${foundCalls.length} (${((withEmotion/foundCalls.length)*100).toFixed(1)}%)`);
            } else {
                console.log('❌ No calls found for the specified date patterns');
                console.log('');
                console.log('💡 Possible reasons:');
                console.log('   - No calls were made on that date');
                console.log('   - Date format is different than expected');
                console.log('   - Calls exist but haven\'t been processed yet');
                console.log('   - Date is outside the current database range');
            }

            return foundCalls;

        } catch (error) {
            console.error('❌ Error searching for calls:', error.message);
            throw error;
        }
    }

    async getRecentCallsForReference(limit = 10) {
        console.log('');
        console.log('📋 RECENT CALLS FOR REFERENCE:');
        console.log('------------------------------');
        
        try {
            const response = await this.getSessions({
                page: 1,
                limit: limit
            });

            if (response.data && response.data.data) {
                const calls = response.data.data;
                console.log(`Showing ${calls.length} most recent calls:`);
                console.log('');

                calls.forEach((call, index) => {
                    console.log(`${index + 1}. ID: ${call.id} | Filename: ${call.filename} | Date: ${call.date} | Transcription: ${call.transcription ? 'YES' : 'NO'}`);
                });
            }
        } catch (error) {
            console.error('Error fetching recent calls:', error.message);
        }
    }
}

// Usage example
async function main() {
    const api = new SessionEventAPI();
    
    try {
        // Step 1: Login
        const loginSuccess = await api.login();
        if (!loginSuccess) {
            console.log('');
            console.log('❌ AUTHENTICATION REQUIRED');
            console.log('==========================');
            console.log('Please update the login credentials in this script:');
            console.log('1. Open this file in an editor');
            console.log('2. Replace "your_email@example.com" with your actual email');
            console.log('3. Replace "your_password" with your actual password');
            console.log('4. Run the script again');
            return;
        }

        // Step 2: Search for calls on the specific date
        await api.searchCallsByDate('01-07-1404');

        // Step 3: Show recent calls for reference
        await api.getRecentCallsForReference(5);

        console.log('');
        console.log('✅ SEARCH COMPLETED SUCCESSFULLY');
        console.log('================================');

    } catch (error) {
        console.log('');
        console.log('❌ SEARCH FAILED');
        console.log('================');
        console.error('Error:', error.message);
        
        if (error.code === 'ECONNREFUSED') {
            console.log('');
            console.log('💡 Connection refused. Please check:');
            console.log('   - Server is running on http://31.184.134.153:8081');
            console.log('   - Port 8081 is accessible');
            console.log('   - No firewall blocking the connection');
        }
    }
}

// Run the search
main();

