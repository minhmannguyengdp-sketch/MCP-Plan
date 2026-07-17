import { readFile, writeFile } from "node:fs/promises";

const fileReplacements = {
  "apps/backend/foundation/field-check-mutations.test.js": [
    ["mcp_update_field_check_result", "mcp_idempotent_update_field_check_result"]
  ],
  "apps/backend/foundation/report-setting-mutations.test.js": [
    ["mcp_create_report_setting_group", "mcp_idempotent_create_report_setting_group"],
    ["mcp_update_report_setting_group", "mcp_idempotent_update_report_setting_group"],
    ["mcp_create_report_setting_item", "mcp_idempotent_create_report_setting_item"],
    ["mcp_update_report_setting_item", "mcp_idempotent_update_report_setting_item"]
  ],
  "apps/backend/foundation/report-setting-transitional-api.test.js": [
    ["mcp_create_report_setting_group", "mcp_idempotent_create_report_setting_group"],
    ["mcp_update_report_setting_group", "mcp_idempotent_update_report_setting_group"],
    ["mcp_create_report_setting_item", "mcp_idempotent_create_report_setting_item"],
    ["mcp_update_report_setting_item", "mcp_idempotent_update_report_setting_item"]
  ],
  "apps/backend/foundation/session-customer-location.test.js": [
    ["mcp_add_session_customer", "mcp_idempotent_add_session_customer"]
  ],
  "apps/backend/foundation/session-report-mutations.test.js": [
    ["mcp_create_session_report_snapshot", "mcp_idempotent_create_session_report_snapshot"],
    ["mcp_save_session_report_ai_result", "mcp_idempotent_save_session_report_ai_result"]
  ],
  "apps/backend/foundation/session-report-transitional-api.test.js": [
    ["mcp_create_session_report_snapshot", "mcp_idempotent_create_session_report_snapshot"],
    ["mcp_save_session_report_ai_result", "mcp_idempotent_save_session_report_ai_result"]
  ],
  "apps/backend/foundation/transitional-api.test.js": [
    ["mcp_record_session_customer_result", "mcp_idempotent_record_session_customer_result"],
    ["mcp_add_session_customer", "mcp_idempotent_add_session_customer"],
    ["mcp_update_field_check_result", "mcp_idempotent_update_field_check_result"]
  ],
  "apps/backend/foundation/gateway.test.js": [
    ["/mcp_record_session_customer_result", "/mcp_idempotent_record_session_customer_result"],
    ["/mcp_add_session_customer", "/mcp_idempotent_add_session_customer"],
    [
      '    "content-type": "application/json"\n  };',
      '    "content-type": "application/json",\n    "idempotency-key": "gateway-business-error-12345678"\n  };'
    ]
  ]
};

for (const [path, replacements] of Object.entries(fileReplacements)) {
  let source = await readFile(path, "utf8");
  let changed = false;

  for (const [before, after] of replacements) {
    if (source.includes(after)) continue;
    const count = source.split(before).length - 1;
    if (count < 1) throw new Error(`${path}: missing source token ${before}`);
    source = source.split(before).join(after);
    changed = true;
  }

  if (changed) await writeFile(path, source, "utf8");
}

console.log("a551_backend_test_patch_complete");
