// Simple test script to verify folder processing endpoint
const axios = require('axios');

async function testFolderProcessing() {
    try {
        const response = await axios.post('http://localhost:3000/api/event/processFolderAudio', {
            folderPath: '/home/afeai/VOICE-2channel',
            processAll: true
        }, {
            auth: {
                username: 'tipax',
                password: 'opera-qc-2024'
            },
            headers: {
                'Content-Type': 'application/json'
            }
        });

        console.log('Success:', response.data);
    } catch (error) {
        if (error.response) {
            console.log('Error response:', error.response.data);
        } else {
            console.log('Error:', error.message);
        }
    }
}

async function testDefaultVoiceFolder() {
    try {
        const response = await axios.post('http://localhost:3000/api/event/processVoiceFolder', {}, {
            auth: {
                username: 'tipax',
                password: 'opera-qc-2024'
            },
            headers: {
                'Content-Type': 'application/json'
            }
        });

        console.log('Default voice folder processing success:', response.data);
    } catch (error) {
        if (error.response) {
            console.log('Error response:', error.response.data);
        } else {
            console.log('Error:', error.message);
        }
    }
}

// Uncomment to test when server is running:
// testFolderProcessing();
// testDefaultVoiceFolder();

console.log('Test script created. Options:');
console.log('1. testFolderProcessing() - Test with custom folder path');
console.log('2. testDefaultVoiceFolder() - Test with default voice folder (/home/afeai/VOICE-2channel)');
console.log('Uncomment the desired function and run with: node test-folder-processing.js');