import {
  CreateBucketCommand,
  HeadBucketCommand,
  PutBucketPolicyCommand,
  S3Client,
} from "@aws-sdk/client-s3";

const {
  RUSTFS_ENDPOINT: endpoint,
  RUSTFS_BUCKET: bucket,
  RUSTFS_BOOTSTRAP_ACCESS_KEY: accessKeyId,
  RUSTFS_BOOTSTRAP_SECRET_KEY: secretAccessKey,
} = process.env;

if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) {
  throw new Error("RustFS endpoint, bucket, and bootstrap credentials are required");
}
if (!/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(bucket)) {
  throw new Error("RUSTFS_BUCKET must be a valid DNS-compatible bucket name");
}

const client = new S3Client({
  endpoint,
  region: process.env.RUSTFS_REGION || "us-east-1",
  credentials: { accessKeyId, secretAccessKey },
  forcePathStyle: true,
});

try {
  try {
    await client.send(new HeadBucketCommand({ Bucket: bucket }));
  } catch {
    await client.send(new CreateBucketCommand({ Bucket: bucket }));
  }

  await client.send(
    new PutBucketPolicyCommand({
      Bucket: bucket,
      Policy: JSON.stringify({
        Version: "2012-10-17",
        Statement: [
          {
            Sid: "PublicReadProfileImages",
            Effect: "Allow",
            Principal: "*",
            Action: ["s3:GetObject"],
            Resource: [`arn:aws:s3:::${bucket}/public/profiles/*`],
          },
        ],
      }),
    }),
  );
  console.log(`Bucket ${bucket} is ready with profile-only public reads`);
} finally {
  client.destroy();
}
