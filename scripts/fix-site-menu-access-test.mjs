import fs from "node:fs";

const path = "app/routes/site-menu-access.test.ts";
const source = fs.readFileSync(path, "utf8");
const next = source
  .replace(
    'import { MemoryRouter } from "react-router";',
    'import { createMemoryRouter, RouterProvider } from "react-router";',
  )
  .replace(
    `function renderMenu(props = {}) {\n  return renderToStaticMarkup(\n    createElement(\n      MemoryRouter,\n      null,\n      createElement(GroupSiteMenu, { groupCode: "river-check", ...props }),\n    ),\n  );\n}`,
    `function renderMenu(props = {}) {\n  const router = createMemoryRouter(\n    [\n      {\n        path: "*",\n        element: createElement(GroupSiteMenu, {\n          groupCode: "river-check",\n          ...props,\n        }),\n      },\n    ],\n    { initialEntries: ["/g/river-check"] },\n  );\n  return renderToStaticMarkup(createElement(RouterProvider, { router }));\n}`,
  );

if (next === source && !source.includes("createMemoryRouter")) {
  throw new Error("site menu test anchor not found");
}
fs.writeFileSync(path, next);
