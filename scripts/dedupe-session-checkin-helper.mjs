import { readFile, writeFile } from "node:fs/promises";

const path = "src/features/mcp/McpSessionCompactViewFinal2.tsx";
let source = await readFile(path, "utf8");
const duplicate = `type CheckinNotice = { kind: "success" | "error"; message: string };

function currentSalesPosition() {
  return new Promise<GeolocationPosition>((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new Error("Thiết bị hoặc trình duyệt không hỗ trợ định vị."));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 0
    });
  });
}

function geolocationMessage(error: unknown) {
  if (error instanceof GeolocationPositionError) {
    if (error.code === error.PERMISSION_DENIED) return "Chưa được cấp quyền định vị. Hãy bật quyền vị trí rồi bấm check-in lại.";
    if (error.code === error.POSITION_UNAVAILABLE) return "Thiết bị chưa lấy được vị trí hiện tại. Hãy đứng nơi thoáng và thử lại.";
    if (error.code === error.TIMEOUT) return "Lấy vị trí quá thời gian. Hãy thử lại tại điểm bán.";
  }
  return error instanceof Error ? error.message : "Không lấy được vị trí hiện tại.";
}

async function saveManualCheckin(line: McpDayLine, checkedIn: boolean, position?: GeolocationPosition) {
  const sessionCustomerId = line.sessionCustomerId || line.id;
  const response = await idempotentMutationFetch(
    "/api/backend/mcp-day/session-customer/checkin",
    {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify(checkedIn ? {
        sessionCustomerId,
        checkedIn: true,
        geoLat: position?.coords.latitude,
        geoLng: position?.coords.longitude,
        geoAccuracy: position?.coords.accuracy,
        geoSource: "browser_manual"
      } : {
        sessionCustomerId,
        checkedIn: false
      })
    },
    { operation: "session-customer.checkin.set" }
  );
  const payload = await response.json().catch(() => ({})) as { error?: { message?: string }; detail?: string };
  if (!response.ok) throw new Error(payload.error?.message || payload.detail || "Không lưu được check-in.");
  return payload;
}

`;

const count = source.split(duplicate).length - 1;
if (count === 1) source = source.replace(duplicate, "");
else if (count !== 0) throw new Error(`duplicate_block_count:${count}`);

if ((source.match(/type CheckinNotice/g) || []).length !== 1) throw new Error("checkin_notice_count_invalid");
if ((source.match(/function currentSalesPosition/g) || []).length !== 1) throw new Error("current_position_count_invalid");
if ((source.match(/async function saveManualCheckin/g) || []).length !== 1) throw new Error("save_checkin_count_invalid");

await writeFile(path, source, "utf8");
console.log("session_checkin_helpers_deduped");
