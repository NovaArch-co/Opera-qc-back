import axios from "axios";
import fs from "node:fs";

export const downloadAndSaveAudio = async (url: string, outputPath: string, auth: { username: string; password: string }) => {
    try {
        const response = await axios.get(url, {
            auth: auth,
            responseType: "stream",
        });

        const writer = fs.createWriteStream(outputPath);
        response.data.pipe(writer);

        return new Promise((resolve, reject) => {
            writer.on("finish", () => resolve("File saved successfully"));
            writer.on("error", (err) => reject("Error saving file: " + err));
        });
    } catch (error) {
        console.error("Error downloading the audio stream:", error);
        // throw new Error("Failed to download the audio stream.");
    }
};
