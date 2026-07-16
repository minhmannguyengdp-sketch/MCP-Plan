"use client";

import { FormEvent, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BottomSheet } from "@/ui/overlay/BottomSheet";

type AddCustomerDraft = {
  customerName: string;
  phone: string;
  area: string;
  address: string;
  note: string;
};

type CapturedLocation = {
  lat: number;
  lng: number;
  accuracy: number;
};

const EMPTY_DRAFT: AddCustomerDraft = {
  customerName: "",
  phone: "",
  area: "",
  address: "",
  note: ""
};

function responseError(payload: unknown) {
  const body = payload && typeof payload === "object" ? payload as {
    error?: string | { code?: string; message?: string };
    detail?: string;
  } : {};

  if (typeof body.error === "string") return body.error;
  return body.error?.message || body.error?.code || body.detail || "Không thêm được khách";
}

function geolocationErrorMessage(error: GeolocationPositionError) {
  if (error.code === 1) return "Điện thoại chưa cấp quyền vị trí cho phần mềm";
  if (error.code === 2) return "Thiết bị chưa xác định được vị trí";
  if (error.code === 3) return "Lấy vị trí quá lâu, vui lòng thử lại";
  return "Không lấy được vị trí hiện tại";
}

export function McpSessionAddCustomerButton({
  sessionId,
  routeName
}: {
  sessionId: string;
  routeName: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<AddCustomerDraft>(EMPTY_DRAFT);
  const [location, setLocation] = useState<CapturedLocation | null>(null);
  const [locating, setLocating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();

  function update(field: keyof AddCustomerDraft, value: string) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  function close() {
    if (saving || locating) return;
    setOpen(false);
    setMessage(null);
  }

  function captureLocation() {
    setMessage(null);
    if (!navigator.geolocation) {
      setMessage("Thiết bị hoặc trình duyệt không hỗ trợ định vị");
      return;
    }

    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy
        });
        setLocating(false);
      },
      (error) => {
        setMessage(geolocationErrorMessage(error));
        setLocating(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0
      }
    );
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft.customerName.trim()) {
      setMessage("Cần nhập tên khách");
      return;
    }

    startSaving(() => {
      void (async () => {
        try {
          setMessage(null);
          const response = await fetch("/api/backend/mcp-day/session-customer/add", {
            method: "POST",
            cache: "no-store",
            headers: {
              Accept: "application/json",
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              sessionId,
              customerName: draft.customerName.trim(),
              phone: draft.phone.trim() || undefined,
              area: draft.area.trim() || undefined,
              address: draft.address.trim() || undefined,
              note: draft.note.trim() || undefined,
              geoLat: location?.lat,
              geoLng: location?.lng,
              geoAccuracy: location?.accuracy,
              geoSource: location ? "browser" : undefined
            })
          });
          const payload = await response.json().catch(() => ({}));
          if (!response.ok) throw new Error(responseError(payload));

          setDraft(EMPTY_DRAFT);
          setLocation(null);
          setOpen(false);
          router.refresh();
        } catch (error) {
          setMessage(error instanceof Error ? error.message : "Không thêm được khách");
        }
      })();
    });
  }

  return (
    <>
      <button
        className="mcp-add-customer-fab"
        type="button"
        aria-label="Thêm khách vào phiên và tuyến"
        onClick={() => {
          setMessage(null);
          setOpen(true);
        }}
      >
        <span aria-hidden="true">＋</span>
        <b>Thêm khách</b>
      </button>

      <BottomSheet
        open={open}
        onClose={close}
        title="Thêm khách"
        description={`${routeName} · khách được lưu vào tuyến gốc và phiên hiện tại`}
        footer={(
          <div className="sheet-action-grid">
            <button className="button primary" type="submit" form="mcp-add-session-customer-form" disabled={saving || locating}>
              {saving ? "Đang thêm..." : "Thêm khách"}
            </button>
            <button className="button" type="button" onClick={close} disabled={saving || locating}>Đóng</button>
          </div>
        )}
      >
        <form id="mcp-add-session-customer-form" className="mcp-add-customer-form" onSubmit={submit}>
          <label className="form-field">
            <small>Tên khách *</small>
            <input
              autoFocus
              value={draft.customerName}
              onChange={(event) => update("customerName", event.target.value)}
              placeholder="Tên cửa hàng / điểm bán"
              disabled={saving}
            />
          </label>
          <div className="mcp-add-customer-grid">
            <label className="form-field">
              <small>Điện thoại</small>
              <input
                inputMode="tel"
                value={draft.phone}
                onChange={(event) => update("phone", event.target.value)}
                placeholder="Số điện thoại"
                disabled={saving}
              />
            </label>
            <label className="form-field">
              <small>Khu vực</small>
              <input
                value={draft.area}
                onChange={(event) => update("area", event.target.value)}
                placeholder="Ấp / xã / huyện"
                disabled={saving}
              />
            </label>
          </div>
          <label className="form-field">
            <small>Địa chỉ</small>
            <input
              value={draft.address}
              onChange={(event) => update("address", event.target.value)}
              placeholder="Địa chỉ điểm bán"
              disabled={saving}
            />
          </label>
          <section className={location ? "mcp-add-customer-location captured" : "mcp-add-customer-location"} aria-live="polite">
            <div>
              <strong>Định vị điểm bán</strong>
              <small>
                {location
                  ? `Đã lấy GPS · sai số khoảng ${Math.round(location.accuracy)}m`
                  : "Đứng tại điểm bán rồi lấy vị trí để sales có thể chỉ đường chính xác."}
              </small>
            </div>
            <button className="button" type="button" onClick={captureLocation} disabled={saving || locating}>
              {locating ? "Đang lấy vị trí..." : location ? "Lấy lại vị trí" : "⌖ Lấy vị trí hiện tại"}
            </button>
          </section>
          <label className="form-field">
            <small>Ghi chú</small>
            <textarea
              value={draft.note}
              onChange={(event) => update("note", event.target.value)}
              placeholder="Thông tin cần nhớ"
              disabled={saving}
            />
          </label>
          {message ? <p className="mcp-add-customer-message" role="alert">{message}</p> : null}
        </form>
      </BottomSheet>
    </>
  );
}
