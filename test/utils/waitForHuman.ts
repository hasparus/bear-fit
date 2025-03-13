import { sleep } from "./sleep";

/**
 * Very often, I just need to pause the test to debug it.
 */
export async function waitForHuman() {
  await sleep(5 * 60 * 1000);
}
