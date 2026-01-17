const apiBaseUrl = process.env.API_BASE_URL;
const baseUrl = process.env.BASE_URL;

if (!apiBaseUrl) {
  throw new Error("API_BASE_URL is not set");
}

if (!baseUrl) {
  throw new Error("BASE_URL is not set");
}

const env = {
  BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
  BASE_URL: baseUrl,
  API_BASE_URL: apiBaseUrl,
};

export default env;