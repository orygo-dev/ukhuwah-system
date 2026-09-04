import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { createRequire } from "node:module";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import {
  DEFAULT_LANDING_PAGE,
  LEGACY_LANDING_PAGE,
  normalizeLandingPage,
  mergeLandingPage,
  type LandingPageConfig,
} from "../src/lib/landing-page.shared";
import { isSafeLandingHref, landingBrand } from "../src/lib/landing-experience";
import { landingPageSchema } from "../src/lib/landing-page.schema";
import { LANDING_INFORMATION } from "../src/lib/landing-information";
import type {
  PublicCatalog,
  CatalogAudience,
} from "../src/lib/landing-catalog";

const requireModule = createRequire(import.meta.url);

test("slow settings read cannot replace a newer successful save in the landing cache", async () => {
  let finishRead!: (row: { value: LandingPageConfig }) => void;
  const service = load("src/lib/landing-page.ts", {
    "@/lib/prisma": {
      prisma: {
        platformSetting: {
          findUnique: () =>
            new Promise((resolve) => {
              finishRead = resolve;
            }),
          upsert: async () => ({}),
        },
      },
    },
  });
  const read = service.getLandingPageConfig as () => Promise<LandingPageConfig>;
  const save = service.saveLandingPageConfig as (
    config: LandingPageConfig,
  ) => Promise<LandingPageConfig>;
  const pending = read();
  const fresh = structuredClone(DEFAULT_LANDING_PAGE);
  fresh.hero.title = "Baru disimpan";
  await save(fresh);
  finishRead({ value: DEFAULT_LANDING_PAGE });
  assert.equal((await pending).hero.title, fresh.hero.title);
  assert.equal((await read()).hero.title, fresh.hero.title);
});
function load(
  file: string,
  mocks: Record<string, unknown> = {},
  globals: Record<string, unknown> = {},
  extra = "",
) {
  const code = ts.transpileModule(fs.readFileSync(file, "utf8") + extra, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
    },
  }).outputText;
  const exports: Record<string, unknown> = {};
  new Function("require", "exports", ...Object.keys(globals), code)(
    (name: string) => {
      if (name in mocks) return mocks[name];
      if (name.endsWith(".module.css"))
        return { default: new Proxy({}, { get: (_, key) => key }) };
      if (name.startsWith(".")) {
        const target = path.resolve(path.dirname(file), name);
        return load(
          target + (fs.existsSync(target + ".tsx") ? ".tsx" : ".ts"),
          mocks,
          globals,
        );
      }
      if (name.startsWith("@/"))
        return load(
          `src/${name.slice(2)}${fs.existsSync(`src/${name.slice(2)}.tsx`) ? ".tsx" : ".ts"}`,
          mocks,
          globals,
        );
      return requireModule(name);
    },
    exports,
    ...Object.values(globals),
  );
  return exports;
}
const mocks = {
  "@/lib/prisma": {},
  "next/link": {
    default: (props: React.ComponentProps<"a"> & { prefetch?: boolean }) => {
      const { prefetch, ...html } = props;
      void prefetch;
      return React.createElement("a", html);
    },
  },
  "next/image": {
    default: (
      props: React.ComponentProps<"img"> & {
        unoptimized?: boolean;
        priority?: boolean;
      },
    ) => {
      const { unoptimized, priority, ...html } = props;
      void unoptimized;
      void priority;
      return React.createElement("img", html);
    },
  },
};

test("homepage honors the Super Admin hero title instead of hardcoded marketing", () => {
  const lib = load("src/lib/landing-page.ts", mocks);
  const config = structuredClone(lib.DEFAULT_LANDING_PAGE) as {
    hero: { title: string; titleHighlight: string };
  };
  config.hero.title = "Judul khusus sekolah";
  config.hero.titleHighlight = "Teks pilihan admin";
  const view = load("src/components/marketing/landing-page-view.tsx", mocks);
  const html = renderToStaticMarkup(
    React.createElement(view.LandingPageView as React.ComponentType<object>, {
      config,
    }),
  );
  assert.match(html, /Judul khusus sekolah/);
  assert.match(html, /Teks pilihan admin/);
});

function render(
  config = DEFAULT_LANDING_PAGE,
  branding?: { appName: string; logoUrl: string },
) {
  const view = load("src/components/marketing/landing-page-view.tsx", mocks);
  return renderToStaticMarkup(
    React.createElement(view.LandingPageView as React.ComponentType<object>, {
      config,
      branding,
    }),
  );
}

test("discovery buttons lead to relevant public pages instead of vague anchors or billing login", () => {
  const html = render();
  for (const href of [
    "/fitur",
    "/untuk-sekolah",
    "/aplikasi",
    "/bantuan",
    "/orangtua",
    "/panduan/siswa",
    "/fitur/kelas",
    "/fitur/zona-baca",
    "/fitur/spotlight",
    "/fitur/ai",
  ]) {
    assert.ok(
      html.includes(`href="${href}"`),
      `Missing relevant public destination ${href}`,
    );
  }
  assert.doesNotMatch(html, /href="\/dashboard\/(billing|tools)"/);
});

test("saved v2 default links upgrade without overwriting custom destinations or mutating settings", () => {
  const stored = structuredClone(DEFAULT_LANDING_PAGE);
  stored.schemaVersion = 2;
  stored.hero.primaryCta = { label: "Jelajahi Fitur", href: "#fitur" };
  stored.experience!.teacher.link = {
    label: "Lihat Paket Guru",
    href: "/dashboard/billing",
  };
  stored.experience!.reading.link = {
    label: "Hubungi pustakawan",
    href: "mailto:library@example.test",
  };
  const before = structuredClone(stored);
  const result = normalizeLandingPage(stored);
  assert.equal(result.hero.primaryCta.href, "/fitur");
  assert.equal(result.experience!.teacher.link.href, "/paket/guru");
  assert.deepEqual(
    result.experience!.reading.link,
    stored.experience!.reading.link,
  );
  assert.deepEqual(stored, before);
  assert.deepEqual(normalizeLandingPage(result), result);
});

test("legacy defaults upgrade in memory, without mutating or discarding custom settings", () => {
  const old = structuredClone(LEGACY_LANDING_PAGE);
  const before = structuredClone(old);
  assert.deepEqual(normalizeLandingPage(old), DEFAULT_LANDING_PAGE);
  assert.deepEqual(old, before);
  old.hero.title = "Judul buatan sekolah";
  old.hero.primaryCta = {
    label: "Hubungi sekolah",
    href: "mailto:school@example.test",
  };
  old.pricing.plans[1].price = 77000;
  const upgraded = normalizeLandingPage(old);
  assert.equal(upgraded.hero.title, old.hero.title);
  assert.deepEqual(upgraded.hero.primaryCta, old.hero.primaryCta);
  assert.equal(upgraded.pricing.plans[1].price, 77000);
  assert.equal(upgraded.experience?.app.androidUrl, "");
});

test("versioned admin edits can deliberately reuse legacy text; normalization is idempotent", () => {
  const current = structuredClone(DEFAULT_LANDING_PAGE);
  current.hero.title = LEGACY_LANDING_PAGE.hero.title;
  assert.equal(normalizeLandingPage(current).hero.title, current.hero.title);
  assert.deepEqual(
    normalizeLandingPage(normalizeLandingPage(current)),
    current,
  );
});

test("partial or malformed stored content recovers without taking the public page down", () => {
  const normalized = normalizeLandingPage({
    hero: null,
    features: { items: [null] },
    experience: { app: { androidUrl: null } },
    footer: { description: "Tetap tersimpan" },
  });
  assert.equal(normalized.hero.title, DEFAULT_LANDING_PAGE.hero.title);
  assert.equal(normalized.footer.description, "Tetap tersimpan");
  assert.doesNotThrow(() => render(normalized));
  assert.doesNotThrow(() => render(normalizeLandingPage(null)));
});

test("links reject scripts, protocol-relative redirects, credentials and control characters", () => {
  for (const href of [
    "javascript:alert(1)",
    "data:text/html,x",
    "//evil.test",
    "/\\evil.test",
    "/%2f%2fevil.test",
    "/%5cevil.test",
    "https://user:password@example.test",
    "https://a.test\n.evil",
    "#",
    "",
  ])
    assert.equal(isSafeLandingHref(href), false, href);
  for (const href of [
    "/login",
    "#mulai",
    "/dashboard/billing?tab=plans",
    "https://play.google.com/store/apps/details?id=example.test",
    "mailto:help@example.test",
  ])
    assert.equal(isSafeLandingHref(href), true, href);
  const config = structuredClone(DEFAULT_LANDING_PAGE);
  config.hero.primaryCta.href = "javascript:alert(1)";
  assert.equal(landingPageSchema.safeParse(config).success, false);
  assert.doesNotMatch(render(config), /href="javascript:/);
});

test("schema allows no invented hero statistics, validates Android HTTPS and nested config", () => {
  assert.equal(landingPageSchema.safeParse(DEFAULT_LANDING_PAGE).success, true);
  const config = structuredClone(DEFAULT_LANDING_PAGE);
  config.experience!.app.androidUrl = "http://insecure.example.test/app";
  assert.equal(landingPageSchema.safeParse(config).success, false);
  config.experience!.app.androidUrl =
    "https://play.google.com/store/apps/details?id=example.test";
  assert.equal(landingPageSchema.safeParse(config).success, true);
  config.features.items = [];
  assert.equal(landingPageSchema.safeParse(config).success, false);
});

test("merge cannot pollute object prototypes", () => {
  const result = mergeLandingPage(
    DEFAULT_LANDING_PAGE,
    JSON.parse(
      '{"__proto__":{"polluted":true},"constructor":{"prototype":{"polluted":true}},"hero":{"title":"Aman"}}',
    ),
  );
  assert.equal(({} as { polluted?: boolean }).polluted, undefined);
  assert.equal(
    Object.prototype.hasOwnProperty.call(result, "__proto__"),
    false,
  );
  assert.equal(result.hero.title, "Aman");
});

test("branding uses Super Admin values, escapes text, and supplies a default logo fallback", () => {
  assert.deepEqual(landingBrand(), {
    appName: "UKHUWAH SYSTEM",
    logoUrl: "/branding/ukhuwah-system-logo.png",
  });
  assert.equal(
    landingBrand({ appName: "Custom", logoUrl: "" }).logoUrl,
    "/branding/ukhuwah-system-logo.png",
  );
  const html = render(DEFAULT_LANDING_PAGE, {
    appName: "Sekolah <Hebat>",
    logoUrl: "/school-logo.png",
  });
  assert.match(html, /src="\/school-logo.png"/);
  assert.match(html, /Masuk ke Sekolah &lt;Hebat&gt;/);
  assert.doesNotMatch(html, /<Hebat>/);
  assert.doesNotMatch(html, /Guru Space/);
});

test("all default anchors exist, role routes are unchanged, and no fake pricing is published", () => {
  const html = render();
  const ids = new Set(
    [...html.matchAll(/id="([^"]+)"/g)].map((match) => match[1]),
  );
  for (const [, hash] of html.matchAll(/href="#([^"]+)"/g))
    assert.ok(ids.has(hash), hash);
  assert.equal([...html.matchAll(/<h1\b/g)].length, 1);
  for (const href of [
    "/register",
    "/login",
    "/orangtua",
    "/untuk-sekolah",
    "/fitur",
    "/privacy/siswa",
  ])
    assert.ok(html.includes(`href="${href}"`), href);
  assert.doesNotMatch(
    html,
    /Rp|49[.,]000|149[.,]000|Daftar Siswa|register\/student|ribuan buku|Hemat Waktu 95%/,
  );
  assert.match(html, /Ilustrasi tampilan/);
  assert.match(html, /Panduan akses siswa/);
});

test("custom section copy and configured Android link are rendered, not ignored", () => {
  const config = structuredClone(DEFAULT_LANDING_PAGE);
  config.experience!.reading.title = "Bacaan pilihan sekolah";
  config.experience!.app.androidUrl =
    "https://play.google.com/store/apps/details?id=example.test";
  config.hero.secondaryCta = { label: "Tombol khusus", href: "#faq" };
  const html = render(config);
  assert.match(html, /Bacaan pilihan sekolah/);
  assert.match(html, /Lihat aplikasi siswa/);
  assert.match(html, /href="https:\/\/play.google.com/);
  assert.match(html, /Tombol khusus/);
});

function apiFixture() {
  let role: string | null = "SUPER_ADMIN";
  let current = structuredClone(DEFAULT_LANDING_PAGE);
  let reads = 0,
    writes = 0,
    revalidated = 0;
  let failure = false;
  const handlers = load("src/app/api/admin/landing-page/route.ts", {
    "@/lib/auth": {
      requireSuperAdmin: async () => {
        if (!role) throw new Error("UNAUTHORIZED");
        if (role !== "SUPER_ADMIN") throw new Error("FORBIDDEN");
      },
    },
    "next/cache": {
      revalidatePath: () => {
        revalidated++;
      },
    },
    "@/lib/landing-page": {
      DEFAULT_LANDING_PAGE,
      mergeLandingPage,
      getLandingPageConfig: async () => {
        reads++;
        return current;
      },
      saveLandingPageConfig: async (value: LandingPageConfig) => {
        if (failure) throw new Error("TEST_DATABASE_UNAVAILABLE");
        writes++;
        current = value;
        return value;
      },
    },
  }) as Record<string, (req?: Request) => Promise<Response>>;
  return {
    handlers,
    setRole: (v: string | null) => {
      role = v;
    },
    fail: () => {
      failure = true;
    },
    counts: () => ({ reads, writes, revalidated }),
    current: () => current,
  };
}
const bodyRequest = (body: unknown, method = "PATCH") =>
  new Request("https://example.test/api/admin/landing-page", {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

test("all settings handlers reject anonymous and non-super-admin users before data access", async () => {
  for (const role of [
    null,
    "TEACHER",
    "STUDENT",
    "SCHOOL_ADMIN",
    "PROVINCE_ADMIN",
  ]) {
    const f = apiFixture();
    f.setRole(role);
    for (const method of ["GET", "PATCH", "POST"]) {
      const response = await f.handlers[method](
        bodyRequest(DEFAULT_LANDING_PAGE),
      );
      assert.equal(response.status, role ? 403 : 401);
    }
    assert.deepEqual(f.counts(), { reads: 0, writes: 0, revalidated: 0 });
  }
});

test("Super Admin reads/saves current settings; old clients cannot erase additive settings", async () => {
  const f = apiFixture();
  assert.equal((await f.handlers.GET()).status, 200);
  const custom = structuredClone(DEFAULT_LANDING_PAGE);
  custom.experience!.app.androidUrl = "https://example.test/android";
  assert.equal((await f.handlers.PATCH(bodyRequest(custom))).status, 200);
  const oldClient = structuredClone(LEGACY_LANDING_PAGE);
  assert.equal((await f.handlers.PATCH(bodyRequest(oldClient))).status, 200);
  assert.equal(
    f.current().experience!.app.androidUrl,
    custom.experience!.app.androidUrl,
  );
  assert.equal(f.current().schemaVersion, 5);
  const partial = {
    patch: { experience: { reading: { title: "Buku kami" } } },
  };
  assert.equal(
    (await f.handlers.POST(bodyRequest(partial, "POST"))).status,
    200,
  );
  assert.equal(f.current().experience!.reading.title, "Buku kami");
  assert.equal(
    f.current().experience!.app.androidUrl,
    custom.experience!.app.androidUrl,
  );
  assert.equal(f.counts().revalidated, 3);
});

test("invalid/null/malformed requests and unsafe nested links never save", async () => {
  const f = apiFixture();
  for (const method of ["PATCH", "POST"]) {
    for (const body of [null, [], "invalid"]) {
      assert.equal(
        (await f.handlers[method](bodyRequest(body, method))).status,
        400,
      );
    }
    assert.equal(
      (
        await f.handlers[method](
          new Request("https://example.test", { method, body: "{" }),
        )
      ).status,
      400,
    );
  }
  const bad = structuredClone(DEFAULT_LANDING_PAGE);
  bad.experience!.school.link.href = "//evil.test";
  assert.equal((await f.handlers.PATCH(bodyRequest(bad))).status, 400);
  assert.equal(f.counts().writes, 0);
});

test("explicit reset affects only landing content; failed writes never report success", async () => {
  const f = apiFixture();
  assert.equal(
    (await f.handlers.PATCH(bodyRequest({ action: "reset" }))).status,
    200,
  );
  assert.deepEqual(f.current(), DEFAULT_LANDING_PAGE);
  f.fail();
  assert.equal(
    (
      await f.handlers.POST(
        bodyRequest({ patch: { hero: { title: "Tidak tersimpan" } } }, "POST"),
      )
    ).status,
    500,
  );
  assert.equal(f.current().hero.title, DEFAULT_LANDING_PAGE.hero.title);
  assert.equal(f.counts().writes, 1);
});

test("homepage branding reads the existing setting only and defaults safely on outage", async () => {
  let writes = 0;
  const service = load("src/lib/landing-page.ts", {
    "@/lib/prisma": {
      prisma: {
        platformSetting: {
          findUnique: async ({ where }: { where: { key: string } }) => {
            assert.equal(where.key, "app_display");
            return {
              value: {
                branding: { appName: "Nama Admin", logoUrl: "/admin-logo.png" },
                privateSetting: "never returned",
              },
            };
          },
          upsert: async () => {
            writes++;
          },
        },
      },
    },
  });
  assert.deepEqual(
    await (service.getLandingBranding as () => Promise<unknown>)(),
    { appName: "Nama Admin", logoUrl: "/admin-logo.png" },
  );
  assert.equal(writes, 0);
  const outage = load("src/lib/landing-page.ts", {
    "@/lib/prisma": {
      prisma: {
        platformSetting: {
          findUnique: async () => {
            throw new Error("offline");
          },
        },
      },
    },
  });
  assert.deepEqual(
    await (outage.getLandingBranding as () => Promise<unknown>)(),
    landingBrand(),
  );
});

test("FAQ hash navigation, repeated links and unmount cleanup execute correctly (isolated DOM)", () => {
  const events = new Map<string, (event?: unknown) => void>();
  let effect: () => () => void = () => () => {};
  let scrolls = 0;
  const detail = {
    id: "panduan-baca",
    open: false,
    scrollIntoView: () => {
      scrolls++;
    },
  };
  const fakeWindow = {
    location: { hash: "#panduan-baca" },
    addEventListener: (type: string, fn: (event?: unknown) => void) =>
      events.set(type, fn),
    removeEventListener: (type: string) => events.delete(type),
  };
  class FakeElement {
    constructor(private href: string) {}
    closest() {
      return this;
    }
    getAttribute() {
      return this.href;
    }
  }
  const faq = load(
    "src/components/marketing/landing-faq.tsx",
    {
      ...mocks,
      react: {
        useEffect: (fn: () => () => void) => {
          effect = fn;
        },
        useRef: () => ({ current: { querySelectorAll: () => [detail] } }),
      },
    },
    { window: fakeWindow, document: fakeWindow, Element: FakeElement },
  );
  (faq.LandingFaq as (props: { appName: string }) => unknown)({
    appName: "GenPro",
  });
  const cleanup = effect();
  assert.equal(detail.open, true); // direct deep link on mount
  detail.open = false;
  events.get("click")!({ button: 0, target: new FakeElement("#panduan-baca") });
  assert.equal(detail.open, true); // same hash emits no hashchange
  detail.open = false;
  events.get("click")!({
    button: 0,
    ctrlKey: true,
    target: new FakeElement("#panduan-baca"),
  });
  assert.equal(detail.open, false); // leave modified navigation alone
  fakeWindow.location.hash = "#unknown";
  events.get("hashchange")!();
  assert.equal(detail.open, false);
  fakeWindow.location.hash = "#panduan-baca";
  events.get("hashchange")!();
  assert.equal(detail.open, true);
  assert.equal(scrolls, 3);
  cleanup();
  assert.equal(events.size, 0);
});

test("mobile navigation toggles, closes after a link and handles Escape (component state)", () => {
  let value = false;
  const component = load("src/components/marketing/landing-navigation.tsx", {
    ...mocks,
    react: {
      ...React,
      useState: () => [
        value,
        (next: boolean | ((previous: boolean) => boolean)) => {
          value = typeof next === "function" ? next(value) : next;
        },
      ],
    },
  });
  const build = () =>
    (component.LandingNavigation as (props: object) => React.ReactElement)({
      appName: "GenPro",
      logoUrl: "",
      loginLabel: "Masuk",
    });
  function nodes(
    node: React.ReactNode,
  ): React.ReactElement<Record<string, unknown>>[] {
    if (!React.isValidElement(node)) return [];
    const item = node as React.ReactElement<Record<string, unknown>>;
    return [
      item,
      ...React.Children.toArray(item.props.children as React.ReactNode).flatMap(
        nodes,
      ),
    ];
  }
  let tree = build();
  (
    nodes(tree).find((n) => n.props["aria-controls"] === "landing-mobile-nav")!
      .props.onClick as () => void
  )();
  assert.equal(value, true);
  tree = build();
  assert.ok(nodes(tree).some((n) => n.props.id === "landing-mobile-nav"));
  const mobile = nodes(tree).find((n) => n.props.id === "landing-mobile-nav")!;
  (nodes(mobile).find((n) => n.type === "a")!.props.onClick as () => void)();
  assert.equal(value, false);
  value = true;
  tree = build();
  (tree.props as { onKeyDown: (event: { key: string }) => void }).onKeyDown({
    key: "Escape",
  });
  assert.equal(value, false);
});

test("settings requests clear timeout on success/error and abort pending fetches", async () => {
  let timer: (() => void) | undefined;
  let cleared = 0;
  let mode = "ok";
  const globals = {
    setTimeout: (fn: () => void) => {
      timer = fn;
      return 1;
    },
    clearTimeout: () => {
      cleared++;
    },
    fetch: async (_url: string, options: { signal: AbortSignal }) => {
      if (mode === "pending")
        return new Promise<Response>((_resolve, reject) =>
          options.signal.addEventListener(
            "abort",
            () => reject(options.signal.reason),
            { once: true },
          ),
        );
      if (mode === "error")
        return new Response('{"error":"Akses ditolak"}', { status: 403 });
      return new Response(JSON.stringify({ config: DEFAULT_LANDING_PAGE }), {
        status: 200,
      });
    },
  };
  const editor = load(
    "src/components/admin/landing-page-settings-client.tsx",
    { ...mocks, "@/components/layout/admin-shell": {} },
    globals,
    "\nexport { requestConfig }; ",
  );
  const request = editor.requestConfig as (
    controller: AbortController,
  ) => Promise<LandingPageConfig>;
  assert.deepEqual(await request(new AbortController()), DEFAULT_LANDING_PAGE);
  assert.equal(cleared, 1);
  mode = "error";
  await assert.rejects(request(new AbortController()), /Akses ditolak/);
  assert.equal(cleared, 2);
  mode = "pending";
  const controller = new AbortController();
  const pending = request(controller);
  timer!();
  await assert.rejects(pending, /batas waktu/);
  assert.equal(controller.signal.aborted, true);
  assert.equal(cleared, 3);
  const unmount = new AbortController();
  const pendingUnmount = request(unmount);
  unmount.abort(new Error("unmounted"));
  await assert.rejects(pendingUnmount, /unmounted/);
  assert.equal(cleared, 4);
});

test("all public guides have substantive distinct content and existing internal destinations", () => {
  const view = load("src/components/marketing/information-page.tsx", mocks);
  const titles = new Set<string>();
  const publicPaths = new Set([
    "/fitur",
    "/untuk-sekolah",
    "/aplikasi",
    "/bantuan",
    "/panduan/siswa",
    "/login",
    "/orangtua",
    "/fitur",
    "/fitur/kelas",
    "/fitur/ai",
    "/fitur/zona-baca",
    "/fitur/spotlight",
  ]);
  for (const [key, page] of Object.entries(LANDING_INFORMATION)) {
    assert.ok(page.sections.length >= 3, key);
    assert.ok(
      page.sections.every((section) => JSON.stringify(section).length > 150),
      key,
    );
    assert.ok(!titles.has(page.title));
    titles.add(page.title);
    const html = renderToStaticMarkup(
      React.createElement(
        view.InformationContent as React.ComponentType<object>,
        { page },
      ),
    );
    assert.equal([...html.matchAll(/<h1\b/g)].length, 1);
    for (const [, href] of html.matchAll(/href="([^"]+)"/g)) {
      assert.ok(
        publicPaths.has(href) || fs.existsSync(`src/app${href}/page.tsx`),
        `${key}: ${href}`,
      );
      assert.ok(!href.startsWith("#"), `${key}: vague anchor`);
    }
  }
  for (const route of [
    "fitur",
    "untuk-sekolah",
    "aplikasi",
    "bantuan",
    "panduan/siswa",
    "paket",
    "paket/[audience]",
    "fitur/[slug]",
  ]) {
    assert.ok(fs.existsSync(`src/app/(informasi)/${route}/page.tsx`), route);
  }
});

test("Android guide renders only a configured safe official URL, otherwise useful fallback", () => {
  const view = load("src/components/marketing/information-page.tsx", mocks);
  const html = (url: string) =>
    renderToStaticMarkup(
      React.createElement(
        view.InformationContent as React.ComponentType<object>,
        { page: LANDING_INFORMATION.aplikasi, androidUrl: url },
      ),
    );
  assert.match(html(""), /Tautan unduh resmi belum dicantumkan/);
  assert.match(
    html("https://play.google.com/store/apps/details?id=test.app"),
    /Buka tautan Android resmi/,
  );
  assert.doesNotMatch(
    html("https://user:password@evil.test"),
    /href="https:\/\/user/,
  );
  assert.doesNotMatch(html("javascript:alert(1)"), /href="javascript:/);
});

function catalogService(
  teacherRead: (input: object) => Promise<unknown[]>,
  schoolRead: (input: object) => Promise<unknown[]>,
  enabled = true,
) {
  return load(
    "src/lib/landing-catalog.ts",
    {
      react: { cache: (fn: unknown) => fn },
      "@/lib/prisma": {
        prisma: {
          subscriptionPlan: { findMany: teacherRead },
          schoolPlan: { findMany: schoolRead },
        },
      },
    },
    {
      process: {
        env: { SCHOOL_COMMERCIALIZATION_ENABLED: enabled ? "true" : "false" },
      },
    },
  ).getPublicCatalog as (audience: CatalogAudience) => Promise<PublicCatalog>;
}

test("catalog reads active plans with a public projection, using real prices/credits and no checkout writes", async () => {
  const read = catalogService(
    async (input) => {
      const query = input as { where: object; select: Record<string, boolean> };
      assert.deepEqual(query.where, { isActive: true });
      assert.equal(query.select.priceMonthly, true);
      assert.equal(query.select.priceYearly, undefined); // no unsupported teacher annual checkout
      assert.equal(query.select.users, undefined);
      assert.equal(query.select.transactions, undefined);
      return [
        {
          name: "Uji Guru",
          slug: "uji-guru",
          description: "Paket uji",
          priceMonthly: "123456",
          creditsMonthly: 45,
          features: {
            monthly_credit_bonus: 5,
            export_pdf: true,
            export_docx: false,
            internal_note: "PRIVATE",
          },
        },
      ];
    },
    async (input) => {
      const query = input as { where: object; select: Record<string, boolean> };
      assert.deepEqual(query.where, { isActive: true });
      assert.equal(query.select.subscriptions, undefined);
      return [
        {
          name: "Uji Sekolah",
          slug: "uji-sekolah",
          description: null,
          priceMonthly: "987654",
          priceYearly: "9988776",
          maxTeacherSeats: 10,
          maxStudents: 250,
          monthlyAiCredits: 800,
          features: { pjj_add_on: true, scheduling: true },
        },
      ];
    },
  );
  const [teacher, school] = await Promise.all([read("guru"), read("sekolah")]);
  assert.equal(teacher.status, "ready");
  assert.equal(teacher.plans[0].monthly, 123456);
  assert.ok(teacher.plans[0].benefits.includes("Bonus 5 kredit/bulan"));
  assert.ok(teacher.plans[0].benefits.includes("Ekspor PDF"));
  assert.ok(!teacher.plans[0].benefits.includes("Ekspor DOCX"));
  assert.doesNotMatch(JSON.stringify(teacher), /PRIVATE|internal_note/);
  assert.equal(school.plans[0].yearly, 9988776);
  assert.ok(school.plans[0].benefits.includes("Kapasitas 10 guru"));
});

test("catalog distinguishes disabled, empty and failed reads; one audience failure does not hide the other", async () => {
  let schoolReads = 0;
  const disabled = catalogService(
    async () => [],
    async () => {
      schoolReads++;
      return [];
    },
    false,
  );
  assert.equal((await disabled("sekolah")).status, "disabled");
  assert.equal(schoolReads, 0);
  const read = catalogService(
    async () => {
      throw new Error("DB_PASSWORD=secret");
    },
    async () => [],
  );
  const [teacher, school] = await Promise.all([read("guru"), read("sekolah")]);
  assert.deepEqual(teacher, { status: "unavailable", plans: [] });
  assert.deepEqual(school, { status: "empty", plans: [] });
});

test("catalog UI explains failures, zero-price school periods, no fake annual teacher price and safe checkout handoff", () => {
  const view = load("src/components/marketing/package-page.tsx", mocks);
  const html = (audience: CatalogAudience, catalog: PublicCatalog) =>
    renderToStaticMarkup(
      React.createElement(view.CatalogContent as React.ComponentType<object>, {
        audience,
        catalog,
      }),
    );
  assert.match(
    html("guru", { status: "unavailable", plans: [] }),
    /belum dapat dimuat/,
  );
  assert.match(
    html("guru", { status: "empty", plans: [] }),
    /Belum ada paket guru aktif/,
  );
  assert.match(
    html("sekolah", { status: "disabled", plans: [] }),
    /belum diaktifkan/,
  );
  const zero = html("sekolah", {
    status: "ready",
    plans: [
      {
        name: "Trial",
        slug: "trial",
        description: null,
        monthly: 0,
        yearly: 0,
        benefits: [],
      },
    ],
  });
  assert.match(zero, /Pembayaran mandiri belum tersedia/);
  assert.doesNotMatch(zero, /href="\/school\/subscription"/);
  const teacher = html("guru", {
    status: "ready",
    plans: [
      {
        name: "<script>alert(1)</script>",
        slug: "paid",
        description: null,
        monthly: 123456,
        benefits: ["45 kredit/bulan"],
      },
    ],
  });
  assert.match(teacher, /123\.456/);
  assert.match(teacher, /href="\/dashboard\/billing"/);
  assert.doesNotMatch(teacher, /<script>|\/ tahun|<form|api\/payment/);
});

test("unknown feature and package routes return notFound instead of unrelated content", async () => {
  for (const [file, method, params] of [
    [
      "src/app/(informasi)/fitur/[slug]/page.tsx",
      "default",
      { slug: "does-not-exist" },
    ],
    [
      "src/app/(informasi)/paket/[audience]/page.tsx",
      "default",
      { audience: "admin" },
    ],
  ] as const) {
    const routeModule = load(file, {
      ...mocks,
      "next/navigation": {
        notFound: () => {
          throw new Error("NOT_FOUND");
        },
      },
    });
    await assert.rejects(
      (routeModule[method] as (props: object) => Promise<unknown>)({
        params: Promise.resolve(params),
      }),
      /NOT_FOUND/,
    );
  }
});

test("invalid stored prices are unavailable, never silently advertised as free", async () => {
  const read = catalogService(
    async () => [
      {
        name: "Invalid",
        slug: "invalid",
        description: null,
        priceMonthly: "NaN",
        creditsMonthly: 0,
        features: null,
      },
    ],
    async () => [],
  );
  assert.deepEqual(await read("guru"), { status: "unavailable", plans: [] });
});

test("v3 deliberate custom links stay unchanged and Spotlight guide explains required login", () => {
  const current = structuredClone(DEFAULT_LANDING_PAGE);
  current.experience!.teacher.link = {
    label: "Lihat Paket Guru",
    href: "/dashboard/billing",
  };
  assert.deepEqual(normalizeLandingPage(current), current);
  assert.match(
    JSON.stringify(LANDING_INFORMATION.spotlight),
    /tetap perlu masuk/,
  );
});
