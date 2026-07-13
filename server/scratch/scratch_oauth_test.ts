import { getGoogleAuthUrl, handleGoogleCallback } from "./src/providers/gmail.provider.js";

async function test() {
  try {
    console.log("Testing getGoogleAuthUrl...");
    console.log(getGoogleAuthUrl());

    console.log("Testing handleGoogleCallback with fake code...");
    await handleGoogleCallback("fake_code_12345");
  } catch (error) {
    console.error("EXPECTED ERROR:", error);
  } finally {
    process.exit(0);
  }
}

test();
