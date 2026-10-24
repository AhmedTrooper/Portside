import { expect, test } from "bun:test";
import { notificationOptions } from "../src/hooks/usePortsideToast";

test("error notifications expire even if callers request persistent messages", () => {
  expect(notificationOptions({ body: "Failed", type: "error", isAutoHide: false })).toMatchObject({ isAutoHide: true, autoHideDuration: 6000 });
});
test("success notifications expire and valid explicit durations are retained", () => {
  expect(notificationOptions({ body: "Saved" }).autoHideDuration).toBe(3000);
  expect(notificationOptions({ body: "Saved", autoHideDuration: 2500 }).autoHideDuration).toBe(2500);
  expect(notificationOptions({ body: "Failed", type: "error", autoHideDuration: Infinity }).autoHideDuration).toBe(6000);
});
