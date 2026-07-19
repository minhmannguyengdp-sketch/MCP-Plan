import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const cardPath = new URL("../src/features/mcp/McpLineCard.tsx", import.meta.url);
const cardCssPath = new URL("../src/features/mcp/McpLineCard.module.css", import.meta.url);
const profilePath = new URL("../src/features/mcp/McpCustomerProfileSheet.tsx", import.meta.url);
const readOwnerPath = new URL("../apps/backend/foundation/outlet-media-read.js", import.meta.url);

test("customer card keeps seven quick actions in two rows beside an independent check-in", async () => {
  const [card, css] = await Promise.all([
    readFile(cardPath, "utf8"),
    readFile(cardCssPath, "utf8")
  ]);

  assert.match(card, /data-customer-action-rows="2"/);
  assert.match(card, /📷 Ảnh/);
  assert.match(card, /↗ Đường/);
  assert.match(card, /label: "Đơn"/);
  assert.match(card, /label: "Test"/);
  assert.match(card, /label: "Quan sát"/);
  assert.match(card, /label: "Theo dõi"/);
  assert.match(card, /label: "Bỏ qua"/);

  assert.match(css, /grid-template-columns:\s*repeat\(4, minmax\(0, 1fr\)\)/);
  assert.match(css, /grid-template-rows:\s*repeat\(2, minmax\(28px, auto\)\)/);
  assert.match(css, /"actions checkin"/);
  assert.match(css, /\.checkin\s*\{[\s\S]*?grid-area:\s*checkin;/);
  assert.match(css, /\.checkin\s*\{[\s\S]*?width:\s*74px;/);
  assert.match(css, /@media \(max-width: 520px\)[\s\S]*?\.checkin\s*\{[\s\S]*?width:\s*68px;/);
});

test("customer profile exposes full business details and private photo management", async () => {
  const [profile, readOwner] = await Promise.all([
    readFile(profilePath, "utf8"),
    readFile(readOwnerPath, "utf8")
  ]);

  assert.match(profile, /Thông tin điểm bán/);
  assert.match(profile, /Ảnh điểm bán/);
  assert.match(profile, /Điện thoại/);
  assert.match(profile, /Địa chỉ/);
  assert.match(profile, /Trạng thái ghé/);
  assert.match(profile, /Check-in/);
  assert.match(profile, /GPS điểm bán/);
  assert.match(profile, /Kết quả trong phiên/);
  assert.match(profile, /\/api\/backend\/outlet-media\/customer-profile/);
  assert.match(profile, /\/api\/backend\/outlet-media\/delete/);
  assert.match(profile, /uploadOutletPhoto/);

  assert.match(readOwner, /presignR2Get/);
  assert.match(readOwner, /status=eq\.ready/);
  assert.match(readOwner, /mediaLimit:\s*3/);
  assert.doesNotMatch(readOwner, /objectKey:\s*objectKey/);
});
