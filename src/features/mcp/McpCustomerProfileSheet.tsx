"use client";

import { ChangeEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BottomSheet } from "@/ui/overlay/BottomSheet";
import type { McpDayLine } from "@/features/mcp-day/mcp-day.types";
import {
  MAX_OUTLET_PHOTOS,
  buildOutletPhotoDrafts,
  outletMediaData,
  outletMediaError,
  outletMediaJson,
  uploadOutletPhoto,
  type OutletPhotoDraft
} from "./outlet-media-client";
import type { McpCustomerProfileFocus } from "./mcp-customer-profile-events";
import styles from "./McpCustomerProfileSheet.module.css";

type CustomerGeo = {
  lat: number;
  lng: number;
  accuracy?: number | null;
  capturedAt?: string | null;
  source?: string | null;
};

type CustomerProfile = {
  id: string;
  routeId?: string | null;
  customerId?: string | null;
  customerName: string;
  phone?: string | null;
  area?: string | null;
  address?: string | null;
  sortOrder?: number | null;
  active: boolean;
  note?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  geo?: CustomerGeo | null;
  googleMapsUrl?: string | null;
  syncStatus?: string | null;
};

type CustomerMedia = {
  id: string;
  sessionId?: string | null;
  mediaType: string;
  mimeType?: string | null;
  byteSize?: number | null;
  width?: number | null;
  height?: number | null;
  status: string;
  capturedBy?: string | null;
  capturedAt?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  viewUrl: string;
  viewExpiresAt: string;
};

type ProfilePayload = {
  customer: CustomerProfile;
  media: CustomerMedia[];
  mediaLimit: number;
  mediaCount: number;
};

function formatDateTime(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function visitStatus(line: McpDayLine) {
  if (line.status === "visited") return "Đã ghé";
  if (line.status === "skipped") return "Bỏ qua / không mua";
  if (line.status === "cancelled") return "Đã hủy";
  return "Chờ ghé";
}

function sourceLabel(line: McpDayLine) {
  if (line.source === "added") return "Phát sinh";
  if (line.source === "planned") return "Tuyến gốc";
  return "Đồng bộ";
}

function activitySummary(line: McpDayLine) {
  const values = [
    line.hasOrder ? "Có đơn" : null,
    line.hasTest ? "Có thử sản phẩm" : null,
    line.hasReport ? "Có quan sát" : null,
    Number(line.followupCount || 0) > 0 ? `${line.followupCount} việc theo dõi` : null
  ].filter(Boolean);
  return values.length ? values.join(" · ") : line.result || line.note || "Chưa có kết quả";
}

function mapsUrl(customer: CustomerProfile) {
  if (customer.googleMapsUrl) return customer.googleMapsUrl;
  if (!customer.geo) return null;
  return `https://www.google.com/maps/search/?api=1&query=${customer.geo.lat},${customer.geo.lng}`;
}

export function McpCustomerProfileSheet({
  line,
  sessionId,
  routeName,
  focus,
  open,
  onClose,
  onOpenActions
}: {
  line: McpDayLine | null;
  sessionId: string;
  routeName: string;
  focus: McpCustomerProfileFocus;
  open: boolean;
  onClose: () => void;
  onOpenActions?: () => void;
}) {
  const router = useRouter();
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const draftsRef = useRef<OutletPhotoDraft[]>([]);
  const [profile, setProfile] = useState<ProfilePayload | null>(null);
  const [drafts, setDrafts] = useState<OutletPhotoDraft[]>([]);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const routeCustomerId = line?.routeCustomerId || "";
  const busy = loading || processing || saving || Boolean(deletingId);

  useEffect(() => {
    draftsRef.current = drafts;
  }, [drafts]);

  useEffect(
    () => () => {
      for (const photo of draftsRef.current) URL.revokeObjectURL(photo.previewUrl);
    },
    []
  );

  async function loadProfile() {
    if (!routeCustomerId) {
      setProfile(null);
      setMessage("Điểm bán này chưa có mã khách tuyến để tải hồ sơ ảnh.");
      return;
    }
    setLoading(true);
    setMessage(null);
    try {
      const response = await fetch(
        `/api/backend/outlet-media/customer-profile?routeCustomerId=${encodeURIComponent(routeCustomerId)}`,
        { cache: "no-store", headers: { Accept: "application/json" } }
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(outletMediaError(payload, "Không tải được hồ sơ khách"));
      setProfile(outletMediaData(payload) as unknown as ProfilePayload);
    } catch (error) {
      setProfile(null);
      setMessage(error instanceof Error ? error.message : "Không tải được hồ sơ khách");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!open || !routeCustomerId) return;
    void loadProfile();
  }, [open, routeCustomerId]);

  useEffect(() => {
    if (open) return;
    for (const photo of draftsRef.current) URL.revokeObjectURL(photo.previewUrl);
    setDrafts([]);
    setProfile(null);
    setMessage(null);
  }, [open]);

  async function addSelectedFiles(files: FileList | null) {
    if (!files?.length) return;
    const readyCount = profile?.media.length || 0;
    const available = MAX_OUTLET_PHOTOS - readyCount - drafts.length;
    if (available <= 0) {
      setMessage(`Điểm bán chỉ lưu tối đa ${MAX_OUTLET_PHOTOS} ảnh.`);
      return;
    }
    setProcessing(true);
    setMessage(null);
    try {
      const additions = await buildOutletPhotoDrafts(files, available);
      setDrafts((current) => [...current, ...additions]);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Không xử lý được ảnh");
    } finally {
      setProcessing(false);
      if (cameraInputRef.current) cameraInputRef.current.value = "";
      if (galleryInputRef.current) galleryInputRef.current.value = "";
    }
  }

  function removeDraft(clientUploadId: string) {
    setDrafts((current) => {
      const target = current.find((photo) => photo.clientUploadId === clientUploadId);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return current.filter((photo) => photo.clientUploadId !== clientUploadId);
    });
  }

  async function savePhotos() {
    if (!routeCustomerId) return;
    const pending = drafts.filter((photo) => photo.status !== "done");
    if (!pending.length) return;
    setSaving(true);
    setMessage(null);
    const succeeded = new Set<string>();
    const failed = new Set<string>();
    for (const photo of pending) {
      setDrafts((current) =>
        current.map((item) =>
          item.clientUploadId === photo.clientUploadId ? { ...item, status: "uploading" } : item
        )
      );
      try {
        await uploadOutletPhoto(photo, { routeCustomerId, sessionId });
        succeeded.add(photo.clientUploadId);
      } catch {
        failed.add(photo.clientUploadId);
      }
    }

    setDrafts((current) => {
      for (const photo of current) {
        if (succeeded.has(photo.clientUploadId)) URL.revokeObjectURL(photo.previewUrl);
      }
      return current
        .filter((photo) => !succeeded.has(photo.clientUploadId))
        .map((photo) =>
          failed.has(photo.clientUploadId) ? { ...photo, status: "error" as const } : photo
        );
    });

    await loadProfile();
    router.refresh();
    setSaving(false);
    setMessage(
      failed.size
        ? `Đã tải ${succeeded.size} ảnh. Còn ${failed.size} ảnh lỗi, bấm Thử lại.`
        : `Đã bổ sung ${succeeded.size} ảnh cho điểm bán.`
    );
  }

  async function deletePhoto(mediaId: string) {
    if (!window.confirm("Xóa ảnh này khỏi điểm bán? Ảnh trên R2 cũng sẽ được xóa.")) return;
    setDeletingId(mediaId);
    setMessage(null);
    try {
      await outletMediaJson("/api/backend/outlet-media/delete", { mediaId });
      await loadProfile();
      router.refresh();
      setMessage("Đã xóa ảnh điểm bán.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Không xóa được ảnh");
    } finally {
      setDeletingId(null);
    }
  }

  function close() {
    if (busy) return;
    onClose();
  }

  function openActions() {
    if (busy || !onOpenActions) return;
    onClose();
    queueMicrotask(onOpenActions);
  }

  const customer = profile?.customer;
  const media = profile?.media || [];
  const limit = profile?.mediaLimit || MAX_OUTLET_PHOTOS;
  const remaining = Math.max(0, limit - media.length - drafts.length);
  const mapLink = customer ? mapsUrl(customer) : null;

  const mediaSection = (
    <section className={styles.section} data-customer-media-section="true">
      <div className={styles.sectionHead}>
        <div>
          <strong>Ảnh điểm bán</strong>
          <small>{media.length}/{limit} ảnh đã lưu · URL xem ảnh tự hết hạn sau 5 phút</small>
        </div>
        <span className={media.length ? styles.readyBadge : styles.missingBadge}>
          {media.length ? `${media.length} ảnh` : "Chưa có ảnh"}
        </span>
      </div>

      {media.length ? (
        <div className={styles.mediaGrid}>
          {media.map((item, index) => (
            <figure className={styles.mediaCard} key={item.id}>
              <a href={item.viewUrl} target="_blank" rel="noreferrer" aria-label={`Mở ảnh điểm bán ${index + 1}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={item.viewUrl} alt={`Ảnh điểm bán ${index + 1}`} />
              </a>
              <figcaption>
                <span>{formatDateTime(item.capturedAt)}</span>
                <button
                  type="button"
                  onClick={() => void deletePhoto(item.id)}
                  disabled={busy}
                  aria-label={`Xóa ảnh điểm bán ${index + 1}`}
                >
                  {deletingId === item.id ? "Đang xóa" : "Xóa"}
                </button>
              </figcaption>
            </figure>
          ))}
        </div>
      ) : loading ? (
        <div className={styles.empty}>Đang tải ảnh…</div>
      ) : (
        <div className={styles.empty}>Khách này chưa có ảnh cửa hàng.</div>
      )}

      {drafts.length ? (
        <div className={styles.draftGrid}>
          {drafts.map((photo) => (
            <figure className={styles.draftCard} key={photo.clientUploadId}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photo.previewUrl} alt="Ảnh điểm bán đang chờ tải" />
              <figcaption>
                <span>
                  {photo.status === "uploading"
                    ? "Đang tải"
                    : photo.status === "error"
                      ? "Lỗi tải"
                      : "Chờ tải"}
                </span>
                {photo.status !== "uploading" ? (
                  <button type="button" onClick={() => removeDraft(photo.clientUploadId)} disabled={busy}>
                    Bỏ
                  </button>
                ) : null}
              </figcaption>
            </figure>
          ))}
        </div>
      ) : null}

      <div className={styles.mediaActions}>
        <button
          className="button"
          type="button"
          onClick={() => cameraInputRef.current?.click()}
          disabled={busy || remaining <= 0}
        >
          📷 Chụp
        </button>
        <button
          className="button"
          type="button"
          onClick={() => galleryInputRef.current?.click()}
          disabled={busy || remaining <= 0}
        >
          ▧ Thư viện
        </button>
        {drafts.length ? (
          <button className="button primary" type="button" onClick={() => void savePhotos()} disabled={busy}>
            {saving ? "Đang tải…" : drafts.some((photo) => photo.status === "error") ? "Thử lại" : `Lưu ${drafts.length} ảnh`}
          </button>
        ) : null}
      </div>
      <input
        ref={cameraInputRef}
        className={styles.fileInput}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={(event: ChangeEvent<HTMLInputElement>) => void addSelectedFiles(event.target.files)}
      />
      <input
        ref={galleryInputRef}
        className={styles.fileInput}
        type="file"
        accept="image/*"
        multiple
        onChange={(event: ChangeEvent<HTMLInputElement>) => void addSelectedFiles(event.target.files)}
      />
    </section>
  );

  const detailSection = (
    <section className={styles.section}>
      <div className={styles.sectionHead}>
        <div>
          <strong>Thông tin điểm bán</strong>
          <small>{routeName} · #{customer?.sortOrder || line?.sortOrder || "—"}</small>
        </div>
        <span className={customer?.active === false ? styles.missingBadge : styles.readyBadge}>
          {customer?.active === false ? "Ngừng hoạt động" : "Đang hoạt động"}
        </span>
      </div>
      {loading && !customer ? <div className={styles.empty}>Đang tải hồ sơ…</div> : null}
      {customer ? (
        <div className={styles.profileGrid}>
          <div><small>Tên điểm bán</small><strong>{customer.customerName}</strong></div>
          <div><small>Điện thoại</small>{customer.phone ? <a href={`tel:${customer.phone}`}>{customer.phone}</a> : <span>Chưa có</span>}</div>
          <div className={styles.wide}><small>Địa chỉ</small><strong>{customer.address || "Chưa có địa chỉ"}</strong></div>
          <div><small>Khu vực</small><strong>{customer.area || line?.area || "Chưa có"}</strong></div>
          <div><small>Nguồn khách</small><strong>{line ? sourceLabel(line) : "—"}</strong></div>
          <div><small>Trạng thái ghé</small><strong>{line ? visitStatus(line) : "—"}</strong></div>
          <div><small>Check-in</small><strong>{line?.checkedIn ? formatDateTime(line.checkinAt) : "Chưa check-in"}</strong></div>
          <div><small>GPS điểm bán</small><strong>{customer.geo ? `Có · sai số ${Math.round(customer.geo.accuracy || 0)}m` : "Chưa có"}</strong></div>
          <div className={styles.wide}><small>Kết quả trong phiên</small><strong>{line ? activitySummary(line) : "—"}</strong></div>
          <div className={styles.wide}><small>Ghi chú khách</small><strong>{customer.note || line?.note || "Chưa có ghi chú"}</strong></div>
          <div><small>Cập nhật</small><strong>{formatDateTime(customer.updatedAt)}</strong></div>
          <div><small>Đồng bộ</small><strong>{customer.syncStatus || "—"}</strong></div>
        </div>
      ) : null}
      {mapLink ? (
        <a className={styles.mapLink} href={mapLink} target="_blank" rel="noreferrer">
          ↗ Mở vị trí điểm bán trên Google Maps
        </a>
      ) : null}
    </section>
  );

  return (
    <BottomSheet
      variant="compact"
      open={open}
      onClose={close}
      title={line?.accountName || "Hồ sơ điểm bán"}
      description={focus === "media" ? "Bổ sung và quản lý ảnh điểm bán" : "Toàn bộ thông tin và ảnh điểm bán"}
      footer={
        <div className={styles.footer}>
          {onOpenActions ? (
            <button className="button primary" type="button" onClick={openActions} disabled={busy}>
              Thao tác bán hàng
            </button>
          ) : null}
          <button className="button" type="button" onClick={close} disabled={busy}>
            Đóng
          </button>
        </div>
      }
    >
      <div className={styles.content}>
        {focus === "media" ? mediaSection : detailSection}
        {focus === "media" ? detailSection : mediaSection}
        {message ? <p className={styles.message} role="status">{message}</p> : null}
      </div>
    </BottomSheet>
  );
}
