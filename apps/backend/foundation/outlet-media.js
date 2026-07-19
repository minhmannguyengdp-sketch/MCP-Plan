import { supabaseRest, supabaseRpc } from "./supabase-adapter.js";
import { presignR2Put, signedR2HeadRequest } from "./r2-storage.js";

const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/webp", "image/png"]);
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

function text(value) {
  const normalized = String(value ?? "").trim();
  return normalized || null;
}

function fail(code, statusCode = 400) {
  const error = new Error(code);
  error.code = code;
  error.statusCode = statusCode;
  throw error;
}

function number(value) {
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function contextPayload(context) {
  return {
    requestId: context.requestId,
    receivedAt: context.receivedAt || null,
    installationId: context.installation.id,
    nppCode: context.installation.nppCode,
    actorId: context.actor.id,
    actorType: context.actor.type,
    actorAuthentication: context.actor.authentication || null
  };
}

function requireR2(config) {
  if (!config.r2?.configured) fail("r2_not_configured", 503);
  return config.r2;
}

export async function prepareOutletMediaUpload(body, context, config, { fetchImpl = fetch } = {}) {
  const routeCustomerId = text(body.routeCustomerId || body.route_customer_id);
  const sessionId = text(body.sessionId || body.session_id);
  const clientUploadId = text(body.clientUploadId || body.client_upload_id);
  const mimeType = text(body.mimeType || body.mime_type)?.toLowerCase();
  const byteSize = number(body.byteSize ?? body.byte_size);
  const geoLat = number(body.geoLat ?? body.geo_lat);
  const geoLng = number(body.geoLng ?? body.geo_lng);
  const geoAccuracy = number(body.geoAccuracy ?? body.geo_accuracy);

  if (!routeCustomerId) fail("route_customer_id_required");
  if (!sessionId) fail("session_id_required");
  if (!clientUploadId) fail("client_upload_id_required");
  if (!ALLOWED_MIME_TYPES.has(mimeType)) fail("invalid_media_mime_type");
  if (!Number.isInteger(byteSize) || byteSize < 1 || byteSize > MAX_IMAGE_BYTES) fail("invalid_media_byte_size");
  if ((geoLat === null) !== (geoLng === null)) fail("geo_coordinates_incomplete");

  const media = await supabaseRpc(config, "mcp_prepare_outlet_media_upload", {
    p_installation_id: context.installation.id,
    p_route_customer_id: routeCustomerId,
    p_session_id: sessionId,
    p_client_upload_id: clientUploadId,
    p_mime_type: mimeType,
    p_expected_byte_size: byteSize,
    p_geo_lat: geoLat,
    p_geo_lng: geoLng,
    p_geo_accuracy: geoAccuracy,
    p_context: contextPayload(context)
  }, { fetchImpl });

  const signed = presignR2Put(requireR2(config), media.object_key, mimeType);
  return {
    mediaId: media.id,
    objectKey: media.object_key,
    mimeType: media.mime_type,
    status: media.status,
    ...signed
  };
}

export async function finalizeOutletMediaUpload(body, context, config, { fetchImpl = fetch } = {}) {
  const mediaId = text(body.mediaId || body.media_id);
  const width = number(body.width);
  const height = number(body.height);
  if (!mediaId) fail("media_id_required");

  const rows = await supabaseRest(
    config,
    `mcp_outlet_media?select=id,object_key,mime_type,status&installation_id=eq.${encodeURIComponent(context.installation.id)}&id=eq.${encodeURIComponent(mediaId)}&limit=1`,
    { fetchImpl }
  );
  const media = Array.isArray(rows) ? rows[0] : null;
  if (!media) fail("outlet_media_not_found", 404);

  const headRequest = signedR2HeadRequest(requireR2(config), media.object_key);
  const headResponse = await fetchImpl(headRequest.url, headRequest.init);
  if (!headResponse.ok) fail("r2_object_not_found", headResponse.status === 404 ? 409 : 502);

  const contentType = text(headResponse.headers.get("content-type"))?.split(";")[0]?.toLowerCase();
  const actualByteSize = Number(headResponse.headers.get("content-length"));
  if (contentType !== media.mime_type) fail("outlet_media_content_type_mismatch", 409);
  if (!Number.isInteger(actualByteSize) || actualByteSize < 1 || actualByteSize > MAX_IMAGE_BYTES) {
    fail("invalid_media_byte_size", 409);
  }

  return supabaseRpc(config, "mcp_finalize_outlet_media_upload", {
    p_media_id: mediaId,
    p_etag: text(headResponse.headers.get("etag")),
    p_actual_byte_size: actualByteSize,
    p_content_type: contentType,
    p_width: Number.isInteger(width) && width > 0 ? width : null,
    p_height: Number.isInteger(height) && height > 0 ? height : null,
    p_context: contextPayload(context)
  }, { fetchImpl });
}
