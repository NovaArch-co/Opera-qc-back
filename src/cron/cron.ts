import {Queue} from "bullmq";
import {redisConfig} from "@/cron/redis";
import {addAnalyseCalls} from "@/cron/analysisFiles";
import {env} from "@/common/utils/envConfig";
import {CreateSessionEventSchema} from "@/api/session/sessionModel";

const queueName = env.BULL_QUEUE;
const queue = new Queue(queueName, {connection: redisConfig});

export async function addAnalysisCallJob(data) {
    console.log("add job")

    await queue.add(
        Date.now().toString(),
        {message: data},
    );
    console.log("✅ Job scheduled to run every 1 second.");

}

// setInterval(addJob, 1000);


addAnalyseCalls()