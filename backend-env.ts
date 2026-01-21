const baseUrl = process.env.BASE_URL;
if (!baseUrl) {
  throw new Error("BASE_URL is not set");
}

const env = {
  BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
  BASE_URL: baseUrl,
};

export default env;