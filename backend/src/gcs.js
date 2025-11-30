const { Storage } = require("@google-cloud/storage");

const storage = new Storage({
  credentials: {
    type: process.env.GCP_TYPE,
    project_id: process.env.GCP_PROJECT_ID,
    private_key_id: process.env.GCP_PRIVATE_KEY_ID,
    private_key: process.env.GCP_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    client_email: process.env.GCP_CLIENT_EMAIL,
    client_id: process.env.GCP_CLIENT_ID,
    auth_uri: process.env.GCP_AUTH_URI,
    token_uri: process.env.GCP_TOKEN_URI,
    auth_provider_x509_cert_url: process.env.GCP_AUTH_PROVIDER_CERT_URL,
    client_x509_cert_url: process.env.GCP_CLIENT_CERT_URL,
  }
});

const bucketName = "multi-file-reader-storage";
const bucket = storage.bucket(bucketName);

module.exports = { storage, bucket, bucketName };