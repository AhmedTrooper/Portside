import { expect, test } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AboutPage } from "../src/features/about/AboutPage";

test("About contains only the repository link", () => {
  const html = renderToStaticMarkup(<AboutPage />);
  expect(html).toContain('href="https://github.com/AhmedTrooper/Portside"');
  expect(html.replace(/<[^>]*>/g, "")).toBe("https://github.com/AhmedTrooper/Portside");
});
