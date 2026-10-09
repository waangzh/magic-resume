import assert from "node:assert/strict";
import test from "node:test";
import { getProjectLinkHref, getStandaloneProjectLinkMeta } from "../src/lib/projectLink";

test("existing projects retain their separate link label", () => {
  const project = { link: "example.test/project", linkLabel: "项目官网" };
  assert.equal(getStandaloneProjectLinkMeta(project)?.label, "项目官网");
  assert.equal(getStandaloneProjectLinkMeta({ ...project, linkOnTitle: false })?.href, "https://example.test/project");
});

test("title links suppress the separate link without losing the destination", () => {
  const project = { link: " example.test/project ", linkOnTitle: true };
  assert.equal(getProjectLinkHref(project.link), "https://example.test/project");
  assert.equal(getStandaloneProjectLinkMeta(project), null);
});

test("project title links reject executable and unsupported protocols", () => {
  for (const link of ["javascript:alert(1)", "data:text/html,<script>alert(1)</script>", "vbscript:msgbox(1)", "ftp://example.test", "mailto:hello@example.test", ""]) {
    assert.equal(getProjectLinkHref(link), null);
    assert.equal(getStandaloneProjectLinkMeta({ link }), null);
  }
});
