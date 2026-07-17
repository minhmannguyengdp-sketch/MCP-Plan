import { readFile, writeFile } from "node:fs/promises";

const path = "src/features/mcp/McpSessionCompactViewFinal2.tsx";
let source = await readFile(path, "utf8");

const replacements = [
  [
    `function geolocationMessage(error: unknown) {
  if (error instanceof GeolocationPositionError) {
    if (error.code === error.PERMISSION_DENIED) return "Chưa được cấp quyền định vị. Hãy bật quyền vị trí rồi bấm check-in lại.";
    if (error.code === error.POSITION_UNAVAILABLE) return "Thiết bị chưa lấy được vị trí hiện tại. Hãy đứng nơi thoáng và thử lại.";
    if (error.code === error.TIMEOUT) return "Lấy vị trí quá thời gian. Hãy thử lại tại điểm bán.";
  }
  return error instanceof Error ? error.message : "Không lấy được vị trí hiện tại.";
}
`,
    `function geolocationMessage(error: unknown) {
  const geolocationError = error as Partial<GeolocationPositionError>;
  if (typeof geolocationError?.code === "number") {
    if (geolocationError.code === 1) return "Chưa được cấp quyền định vị. Hãy bật quyền vị trí rồi bấm check-in lại.";
    if (geolocationError.code === 2) return "Thiết bị chưa lấy được vị trí hiện tại. Hãy đứng nơi thoáng và thử lại.";
    if (geolocationError.code === 3) return "Lấy vị trí quá thời gian. Hãy thử lại tại điểm bán.";
  }
  return error instanceof Error ? error.message : "Không lấy được vị trí hiện tại.";
}
`
  ],
  [
    '<div className="visit-sheet-content"><div className="visit-focus-card"><span>Trạng thái</span><strong>{statusLabel(line.status)}</strong><small>{line.note || "Chưa ghi kết quả chi tiết"}</small></div></div>',
    '<div className={`visit-sheet-content ${popupStyles.content}`}><div className="visit-focus-card"><span>Trạng thái</span><strong>{statusLabel(line.status)}</strong><small>{line.note || "Chưa ghi kết quả chi tiết"}</small></div></div>'
  ]
];

for (const [before, after] of replacements) {
  if (source.includes(after)) continue;
  const count = source.split(before).length - 1;
  if (count !== 1) throw new Error(`source_mismatch:${count}:${before.slice(0, 80)}`);
  source = source.replace(before, after);
}

await writeFile(path, source, "utf8");
console.log("session_checkin_ui_fix=OK");
