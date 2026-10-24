import { expect, test } from "bun:test";
import { readPreference } from "../src/utils/preferences";

function storage(initial: Record<string, string>): Storage {
  const values = new Map(Object.entries(initial));
  return {
    get length() { return values.size; },
    key: index => [...values.keys()][index] ?? null,
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, value); },
    removeItem: key => { values.delete(key); },
    clear: () => { values.clear(); },
  };
}
test("renamed theme preferences retain their saved value", () => {
  const store = storage({ legacy_theme_mode: "light" });
  expect(readPreference(store, "portside_theme_mode", "_theme_mode")).toBe("light");
  expect(store.getItem("portside_theme_mode")).toBe("light");
  expect(store.getItem("legacy_theme_mode")).toBeNull();
});
test("existing preferences and ambiguous legacy values are not overwritten", () => {
  const store = storage({ portside_theme_mode: "dark", legacy_theme_mode: "light" });
  expect(readPreference(store, "portside_theme_mode", "_theme_mode")).toBe("dark");
  const ambiguous = storage({ one_theme_mode: "light", two_theme_mode: "dark" });
  expect(readPreference(ambiguous, "portside_theme_mode", "_theme_mode")).toBeNull();
  expect(ambiguous.length).toBe(2);
});
