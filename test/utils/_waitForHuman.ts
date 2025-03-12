/**
 * Very often, I just need to pause the test to debug it.
 */
export async function _waitForHuman() {
  await new Promise((resolve) => setTimeout(resolve, 5 * 60 * 1000));
}
