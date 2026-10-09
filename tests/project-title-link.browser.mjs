import assert from "node:assert/strict";
import test from "node:test";
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";

const baseURL = process.env.PREVIEW_TEST_URL || "http://127.0.0.1:3000";
const href = "https://example.test/greencare";
const sectionSelector = '#resume-preview [data-resume-section-id="projects"]';

test("project names can open links in all templates without a separate link row", { timeout: 120_000 }, async (t) => {
  const browser = await chromium.launch();
  t.after(() => browser.close());
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.setDefaultNavigationTimeout(60_000);
  await page.context().route("https://example.test/**", route => route.fulfill({ contentType: "text/html", body: "<title>Project destination</title>" }));
  await page.goto(`${baseURL}/app/dashboard`, { waitUntil: "domcontentloaded" });
  const id = await page.evaluate(async () => {
    const { useResumeStore } = await import("/src/store/useResumeStore.ts");
    const store = useResumeStore.getState();
    const id = store.createResume(null);
    store.updateResume(id, {
      templateId: "classic",
      menuSections: [{ id: "projects", title: "项目经历", icon: "", enabled: true, order: 0 }],
      projects: [{ id: "title-link-project", name: "GreenCare", role: "后端开发", date: "2024/09 - 2026/04", description: "<p>项目说明</p>", visible: true, link: "example.test/greencare", linkLabel: "项目官网" }],
      globalSettings: { ...useResumeStore.getState().activeResume.globalSettings, fontFamily: "Arial, sans-serif", flexibleHeaderLayout: true, centerSubtitle: true, autoOnePage: false },
    });
    return id;
  });
  await page.goto(`${baseURL}/app/workbench/${id}`, { waitUntil: "domcontentloaded" });
  await page.locator(`${sectionSelector} a`).waitFor();
  assert.equal(await page.locator(`${sectionSelector} a`).innerText(), "项目官网");
  await page.evaluate(async () => {
    const { useResumeStore } = await import("/src/store/useResumeStore.ts");
    useResumeStore.getState().setActiveSection("projects");
  });
  const editor = page.locator("#edit-panel");
  await editor.locator("#title-link-project h3").click();
  const toggle = editor.getByRole("checkbox", { name: /项目名称作为链接|Link project name/ });
  await toggle.check();
  const titleLink = page.locator(sectionSelector).getByRole("link", { name: "GreenCare", exact: true });
  await titleLink.waitFor();
  assert.equal(await titleLink.getAttribute("href"), href);
  assert.equal(await page.locator(`${sectionSelector} a`).count(), 1);
  assert.equal(await editor.getByRole("textbox", { name: /显示文字|Display Text/ }).isDisabled(), true);
  const [popup] = await Promise.all([page.waitForEvent("popup"), titleLink.click()]);
  await popup.waitForLoadState();
  assert.equal(popup.url(), href);
  await popup.close();
  await toggle.uncheck();
  await page.locator(sectionSelector).getByRole("link", { name: "项目官网", exact: true }).waitFor();
  assert.equal(await editor.getByRole("textbox", { name: /显示文字|Display Text/ }).isDisabled(), false);
  await toggle.check();
  await titleLink.waitFor();
  await mkdir("node_modules/.cache/project-title-link", { recursive: true });
  await page.locator(sectionSelector).screenshot({ path: "node_modules/.cache/project-title-link/preview.png" });

  await page.reload({ waitUntil: "domcontentloaded" });
  await page.locator(sectionSelector).getByRole("link", { name: "GreenCare", exact: true }).waitFor();
  const exported = await page.evaluate(async () => {
    const { useResumeStore } = await import("/src/store/useResumeStore.ts");
    const { generateResumeMarkdown } = await import("/src/utils/markdown.ts");
    const { cloneResumeForExport } = await import("/src/utils/resumeLayout.ts");
    const resume = useResumeStore.getState().activeResume;
    return { enabled: resume.projects[0].linkOnTitle, markdown: generateResumeMarkdown(resume), cloneHref: cloneResumeForExport(document.querySelector("#resume-preview")).querySelector("h3 a").getAttribute("href") };
  });
  assert.equal(exported.enabled, true);
  assert.ok(exported.markdown.includes(`### [GreenCare](<${href}>)`));
  assert.ok(!exported.markdown.includes("项目官网"));
  assert.equal(exported.cloneHref, href);

  const templates = await page.evaluate(async () => (await import("/src/components/templates/registry.ts")).DEFAULT_TEMPLATES.map(template => template.id));
  for (const templateId of templates) {
    for (const centerSubtitle of [false, true]) {
      for (const flexibleHeaderLayout of [false, true]) {
        const name = `${templateId}-${centerSubtitle}-${flexibleHeaderLayout}`;
        await page.evaluate(async ({ templateId, name, centerSubtitle, flexibleHeaderLayout }) => {
          const { useResumeStore } = await import("/src/store/useResumeStore.ts");
          const store = useResumeStore.getState();
          store.updateResume(store.activeResumeId, { templateId, projects: [{ ...store.activeResume.projects[0], name }], globalSettings: { ...store.activeResume.globalSettings, centerSubtitle, flexibleHeaderLayout } });
        }, { templateId, name, centerSubtitle, flexibleHeaderLayout });
        const link = page.locator(sectionSelector).getByRole("link", { name, exact: true });
        await link.waitFor();
        assert.equal(await page.locator(`${sectionSelector} a`).count(), 1, `${templateId}: no duplicate link`);
        assert.equal(await link.getAttribute("href"), href);
        assert.equal(await link.getAttribute("target"), "_blank");
        assert.match(await link.getAttribute("rel"), /noopener/);
        assert.ok(await link.evaluate(element => getComputedStyle(element).fontSize === getComputedStyle(element.parentElement).fontSize));
      }
    }
  }
  await page.evaluate(async () => {
    const { useResumeStore } = await import("/src/store/useResumeStore.ts");
    const store = useResumeStore.getState();
    store.updateProjects({ ...store.activeResume.projects[0], link: "javascript:alert(1)" });
  });
  await page.waitForFunction(selector => !document.querySelector(`${selector} a`), sectionSelector);
  assert.equal(await page.locator(`${sectionSelector} a`).count(), 0);
});

test("custom module titles support the same saved links in all templates", { timeout: 120_000 }, async (t) => {
  const browser = await chromium.launch();
  t.after(() => browser.close());
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.setDefaultNavigationTimeout(60_000);
  const sectionId = "custom-title-link-section";
  const selector = `#resume-preview [data-resume-section-id="${sectionId}"]`;
  const destination = "https://example.test/portfolio";
  await page.context().route("https://example.test/**", route => route.fulfill({ contentType: "text/html", body: "<title>Portfolio destination</title>" }));
  await page.goto(`${baseURL}/app/dashboard`, { waitUntil: "domcontentloaded" });
  const id = await page.evaluate(async sectionId => {
    const { useResumeStore } = await import("/src/store/useResumeStore.ts");
    const store = useResumeStore.getState();
    const id = store.createResume(null);
    store.updateResume(id, {
      templateId: "classic",
      menuSections: [{ id: sectionId, title: "自定义作品", icon: "", enabled: true, order: 0 }],
      customData: { [sectionId]: [{ id: "custom-link-item", title: "我的作品", subtitle: "开源项目", dateRange: "2024/09 - 2026/04", description: "<p>作品说明</p>", visible: true }] },
      globalSettings: { ...useResumeStore.getState().activeResume.globalSettings, fontFamily: "Arial, sans-serif", flexibleHeaderLayout: true, centerSubtitle: true, autoOnePage: false },
    });
    return id;
  }, sectionId);
  await page.goto(`${baseURL}/app/workbench/${id}`, { waitUntil: "domcontentloaded" });
  await page.locator(`${selector} h4`).waitFor();
  await page.waitForLoadState("load");
  assert.equal(await page.locator(`${selector} a`).count(), 0, "old custom entries stay plain text");
  await page.evaluate(async sectionId => {
    const { useResumeStore } = await import("/src/store/useResumeStore.ts");
    useResumeStore.getState().setActiveSection(sectionId);
  }, sectionId);
  const editor = page.locator("#edit-panel");
  await editor.locator("#custom-link-item h3").click();
  await editor.getByRole("textbox", { name: /链接地址|Link URL/ }).fill("example.test/portfolio");
  await editor.getByRole("textbox", { name: /显示文字|Display Text/ }).fill("作品链接");
  await page.locator(selector).getByRole("link", { name: "作品链接", exact: true }).waitFor();
  const toggle = editor.getByRole("checkbox", { name: /标题作为链接|Link title/ });
  await toggle.check();
  const titleLink = page.locator(selector).getByRole("link", { name: "我的作品", exact: true });
  await titleLink.waitFor();
  assert.equal(await page.locator(`${selector} a`).count(), 1);
  assert.equal(await titleLink.getAttribute("href"), destination);
  const [popup] = await Promise.all([page.waitForEvent("popup"), titleLink.click()]);
  await popup.waitForLoadState();
  assert.equal(popup.url(), destination);
  await popup.close();
  await toggle.uncheck();
  await page.locator(selector).getByRole("link", { name: "作品链接", exact: true }).waitFor();
  await toggle.check();
  await titleLink.waitFor();
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.locator(selector).getByRole("link", { name: "我的作品", exact: true }).waitFor();

  const exported = await page.evaluate(async sectionId => {
    const { useResumeStore } = await import("/src/store/useResumeStore.ts");
    const { generateResumeMarkdown } = await import("/src/utils/markdown.ts");
    const { cloneResumeForExport } = await import("/src/utils/resumeLayout.ts");
    const resume = useResumeStore.getState().activeResume;
    return { enabled: resume.customData[sectionId][0].linkOnTitle, markdown: generateResumeMarkdown(resume), cloneHref: cloneResumeForExport(document.querySelector("#resume-preview")).querySelector("h4 a").getAttribute("href") };
  }, sectionId);
  assert.equal(exported.enabled, true);
  assert.ok(exported.markdown.includes(`### [我的作品](<${destination}>)`));
  assert.ok(!exported.markdown.includes("作品链接"));
  assert.equal(exported.cloneHref, destination);

  const templates = await page.evaluate(async () => (await import("/src/components/templates/registry.ts")).DEFAULT_TEMPLATES.map(template => template.id));
  for (const templateId of templates) {
    for (const centerSubtitle of [false, true]) {
      for (const flexibleHeaderLayout of [false, true]) {
        const title = `${templateId}-${centerSubtitle}-${flexibleHeaderLayout}`;
        await page.evaluate(async ({ sectionId, templateId, title, centerSubtitle, flexibleHeaderLayout }) => {
          const { useResumeStore } = await import("/src/store/useResumeStore.ts");
          const store = useResumeStore.getState();
          store.updateResume(store.activeResumeId, { templateId, customData: { [sectionId]: [{ ...store.activeResume.customData[sectionId][0], title }] }, globalSettings: { ...store.activeResume.globalSettings, centerSubtitle, flexibleHeaderLayout } });
        }, { sectionId, templateId, title, centerSubtitle, flexibleHeaderLayout });
        const link = page.locator(selector).getByRole("link", { name: title, exact: true });
        await link.waitFor();
        assert.equal(await page.locator(`${selector} a`).count(), 1, `${templateId}: no duplicate custom link`);
        assert.equal(await link.getAttribute("href"), destination);
        assert.equal(await link.getAttribute("target"), "_blank");
        assert.match(await link.getAttribute("rel"), /noopener/);
      }
    }
  }
  await page.evaluate(async sectionId => {
    const { useResumeStore } = await import("/src/store/useResumeStore.ts");
    useResumeStore.getState().updateCustomItem(sectionId, "custom-link-item", { link: "javascript:alert(1)" });
  }, sectionId);
  await page.waitForFunction(selector => !document.querySelector(`${selector} a`), selector);
  assert.equal(await page.locator(`${selector} a`).count(), 0);
});
