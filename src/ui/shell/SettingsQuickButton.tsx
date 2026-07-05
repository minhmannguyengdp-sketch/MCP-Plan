"use client";

import { usePathname, useRouter } from "next/navigation";

export function SettingsQuickButton() {
  const pathname = usePathname();
  const router = useRouter();
  const isSettings = pathname === "/settings";

  return (
    <button
      aria-label={isSettings ? "Đóng cài đặt" : "Cài đặt"}
      className={isSettings ? "mobile-settings-link active" : "mobile-settings-link"}
      type="button"
      onClick={() => {
        if (isSettings) {
          if (window.history.length > 1) router.back();
          else router.push("/");
        } else {
          router.push("/settings");
        }
      }}
    >
      {"⚙"}
    </button>
  );
}
