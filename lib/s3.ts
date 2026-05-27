import { S3Client, PutObjectCommand, DeleteObjectCommand, ListObjectsV2Command, GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

const REGION = process.env.AWS_REGION || 'ap-southeast-7'
const BUCKET = process.env.AWS_S3_BUCKET || 'usam-support-storage-320900771144-ap-southeast-7-an'

function getS3Client(): S3Client {
  return new S3Client({
    region: REGION,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
    },
  })
}

/** Upload a file buffer to S3. Returns the object key. */
export async function uploadToS3(
  key: string,
  body: Buffer | Uint8Array,
  contentType: string,
): Promise<string> {
  const client = getS3Client()
  await client.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  )
  return key
}

/** Delete an object from S3 */
export async function deleteFromS3(key: string): Promise<void> {
  const client = getS3Client()
  await client.send(
    new DeleteObjectCommand({
      Bucket: BUCKET,
      Key: key,
    }),
  )
}

/** List objects in S3 under a prefix */
export async function listS3Files(prefix?: string): Promise<{ key: string; size: number; lastModified: Date }[]> {
  const client = getS3Client()
  const result = await client.send(
    new ListObjectsV2Command({
      Bucket: BUCKET,
      Prefix: prefix,
    }),
  )
  return (result.Contents || []).map((obj) => ({
    key: obj.Key || '',
    size: obj.Size || 0,
    lastModified: obj.LastModified || new Date(),
  }))
}

/** Get a presigned URL for downloading an object (valid for 1 hour) */
export async function getS3DownloadUrl(key: string): Promise<string> {
  const client = getS3Client()
  return getSignedUrl(
    client,
    new GetObjectCommand({ Bucket: BUCKET, Key: key }),
    { expiresIn: 3600 },
  )
}

/** Build the public URL for an S3 object */
export function getS3PublicUrl(key: string): string {
  return `https://${BUCKET}.s3.${REGION}.amazonaws.com/${key}`
}
