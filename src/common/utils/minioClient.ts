import { Client } from "minio";

const minioClient = new Client({
  endPoint: "87.248.156.130",
  port: 9005,
  useSSL: false,
  accessKey: "admin",
  secretKey: "1234!@#$2025",
});

export const ensureBucketExists = async (bucketName: string) => {
  const exists = await minioClient.bucketExists(bucketName);
  if (!exists) {
    await minioClient.makeBucket(bucketName, "us-east-1");
    console.log(`Bucket "${bucketName}" created.`);
  }
};

export default minioClient;
