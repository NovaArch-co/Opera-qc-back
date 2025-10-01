import { Client } from "minio";
import { env } from "./envConfig";

const minioClient = new Client({
  endPoint: process.env.MINIO_ENDPOINT || "minio",
  port: parseInt(process.env.MINIO_PORT || "9000"),
  useSSL: false,
  accessKey: process.env.MINIO_ACCESS_KEY || env.MINIO_ACCESS_KEY || "minioaccesskey",
  secretKey: process.env.MINIO_SECRET_KEY || env.MINIO_SECRET_KEY || "miniosecretkey",
});

export const ensureBucketExists = async (bucketName: string) => {
  const exists = await minioClient.bucketExists(bucketName);
  if (!exists) {
    await minioClient.makeBucket(bucketName, "us-east-1");
    console.log(`Bucket "${bucketName}" created.`);
  }
};

export default minioClient;
