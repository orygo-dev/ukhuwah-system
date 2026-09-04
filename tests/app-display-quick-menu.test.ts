import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_APP_DISPLAY,
  QUICK_MENU_ICON_KEYS,
  mergeAppDisplay,
} from "../src/lib/app-display.shared";

test("konfigurasi lama tetap mendapat delapan fallback ikon menu", () => {
  const merged = mergeAppDisplay(DEFAULT_APP_DISPLAY, {
    branding: { appName: "GenPro" },
  });

  assert.equal(merged.branding.appName, "GenPro");
  assert.equal(QUICK_MENU_ICON_KEYS.length, 8);
  assert.deepEqual(Object.keys(merged.quickMenuIcons.icons).sort(), [
    ...QUICK_MENU_ICON_KEYS,
  ].sort());
  assert.ok(Object.values(merged.quickMenuIcons.icons).every((url) => url === ""));
});

test("patch ikon tidak mengubah konfigurasi banner dan popup", () => {
  const merged = mergeAppDisplay(DEFAULT_APP_DISPLAY, {
    quickMenuIcons: {
      revision: "menu-v2",
      icons: {
        attendance: "/uploads/app-display/quick-menu-icon/attendance.png",
      },
    },
  });

  assert.equal(merged.quickMenuIcons.revision, "menu-v2");
  assert.equal(
    merged.quickMenuIcons.icons.attendance,
    "/uploads/app-display/quick-menu-icon/attendance.png",
  );
  assert.equal(merged.quickMenuIcons.icons.assignments, "");
  assert.deepEqual(merged.banners, DEFAULT_APP_DISPLAY.banners);
  assert.deepEqual(merged.popup, DEFAULT_APP_DISPLAY.popup);
});
