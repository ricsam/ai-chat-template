const apiBaseUrl = process.env.BUN_PUBLIC_API_BASE_URL;
const baseUrl = process.env.BUN_PUBLIC_BASE_URL;

if (!apiBaseUrl) {
  throw new Error("API_BASE_URL is not set");
}

if (!baseUrl) {
  throw new Error("BASE_URL is not set");
}

const env = {
  API_BASE_URL: apiBaseUrl,
  BASE_URL: baseUrl,
};
export default env;
