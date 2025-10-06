const axios = require('axios');
const crypto = require('crypto'); // For random IDs

// Config
const URL = 'http://localhost:8081/api/event/sessionReceived';
const AUTH = {
  username: 'tipax',
  password: 'opera-qc-2024'
};
const NUM_REQUESTS = 20000; // Total mock calls
const BATCH_SIZE = 100000;    // Requests per batch
const DELAY_MS = 5000;      // Delay between batches (ms)

// Generate mock data
function generateMockData(index) {
  const now = new Date();
  const randomDate = new Date(now.getTime() - Math.floor(Math.random() * 30 * 24 * 60 * 60 * 1000)); // Up to 30 days ago
  const dateStr = randomDate.toISOString().slice(0, 19).replace('T', ' ');
  
  return {
    type: Math.random() > 0.2 ? 'incoming' : 'outgoing', // Mostly incoming
    source_channel: `SIP/${Math.floor(Math.random() * 900) + 100}`,
    source_number: `${Math.floor(Math.random() * 900) + 100}`,
    queue: Math.random() > 0.5 ? 'null' : `queue${Math.floor(Math.random() * 10) + 1}`,
    dest_channel: `SIP/${['cisco', 'polycom', 'yealink'][Math.floor(Math.random() * 3)]}`,
    dest_number: `BB${crypto.randomBytes(6).toString('hex')}`,
    date: dateStr,
    duration: `00:${String(Math.floor(Math.random() * 60)).padStart(2, '0')}:${String(Math.floor(Math.random() * 60)).padStart(2, '0')}`,
    filename: `${randomDate.toISOString().slice(0,10).replace(/-/g,'')}-${crypto.randomBytes(3).toString('hex')}-${crypto.randomBytes(5).toString('hex')}-${Math.floor(Math.random() * 900) + 100}`,
    level: [10, 20, 30, 40][Math.floor(Math.random() * 4)],
    time: `${Date.now()}`,
    pid: Math.floor(Math.random() * 10000) + 1,
    hostname: ['backend', 'server1', 'prod-host'][Math.floor(Math.random() * 3)],
    name: `session-${index}`,
    msg: 'Mock session event for load testing'
  };
}

// Send a batch asynchronously
async function sendBatch(batchNum, batchSize) {
  let successes = 0;
  const promises = [];

  for (let i = 0; i < batchSize; i++) {
    const index = batchNum * BATCH_SIZE + i + 1;
    const data = generateMockData(index);
    
    promises.push(
      axios.post(URL, data, { auth: AUTH })
        .then(res => {
          console.log(`Request ${index}: ${res.status} - ${JSON.stringify(res.data).slice(0, 100)}...`);
          successes++;
        })
        .catch(err => {
          console.error(`Request ${index} failed: ${err.message}`);
        })
    );
  }

  await Promise.all(promises);
  return successes;
}

// Main function
async function main() {
  let totalSuccess = 0;
  const numBatches = Math.ceil(NUM_REQUESTS / BATCH_SIZE);

  for (let batch = 0; batch < numBatches; batch++) {
    console.log(`Sending batch ${batch + 1}/${numBatches}...`);
    const remaining = Math.min(BATCH_SIZE, NUM_REQUESTS - batch * BATCH_SIZE);
    const success = await sendBatch(batch, remaining);
    totalSuccess += success;

    if (batch < numBatches - 1) {
      console.log(`Waiting ${DELAY_MS / 1000} seconds...`);
      await new Promise(resolve => setTimeout(resolve, DELAY_MS));
    }
  }

  console.log(`Total successful requests: ${totalSuccess}/${NUM_REQUESTS}`);
}

main().catch(console.error);