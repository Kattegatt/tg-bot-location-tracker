import L from "leaflet";
import "./style.css";
import { pointColorThresholds } from "./config";

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        initData?: string;
        ready?: () => void;
        expand?: () => void;
      };
    };
  }
}

function resolveDefaultApiUrl(): string {
  if (import.meta.env.DEV) {
    return "http://localhost:3001";
  }

  const { protocol, hostname, host } = window.location;
  if (hostname.startsWith("app.")) {
    return `${protocol}//api.${hostname.slice(4)}`;
  }

  return `${protocol}//${host}`;
}

const apiUrl = import.meta.env.VITE_API_URL || resolveDefaultApiUrl();
const devInitData = import.meta.env.VITE_DEV_INIT_DATA as string | undefined;

const refreshButton = document.getElementById("refresh") as HTMLButtonElement;
const panelStatus = document.getElementById("panel-status") as HTMLParagraphElement;
const commentsContainer = document.getElementById("comments") as HTMLDivElement;
const legendFreshLabel = document.getElementById("legend-fresh-label") as HTMLSpanElement | null;
const legendMidLabel = document.getElementById("legend-mid-label") as HTMLSpanElement | null;
const legendExpiringLabel = document.getElementById("legend-expiring-label") as HTMLSpanElement | null;
const defaultPanelStatus = "Select a marker to view comments.";
const pointTtlMs = pointColorThresholds.ttlMinutes * 60_000;
const freshThresholdMs = pointColorThresholds.greenThresholdMs;
const midThresholdMs = pointColorThresholds.orangeThresholdMs;

const telegramWebApp = window.Telegram?.WebApp;
if (telegramWebApp?.ready) {
  telegramWebApp.ready();
}

const map = L.map("map").setView([50.4501, 30.5234], 12);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: "&copy; OpenStreetMap contributors"
}).addTo(map);

if (telegramWebApp?.expand) {
  telegramWebApp.expand();
}

navigator.geolocation?.getCurrentPosition(
  (pos) => {
    map.setView([pos.coords.latitude, pos.coords.longitude], 13);
  },
  () => {}
);

const markers = new Map<number, any>();
let selectedPointId: number | null = null;
commentsContainer.hidden = true;

function getInitData(): string {
  return window.Telegram?.WebApp?.initData || devInitData || "";
}

type ApiError = {
  error?: string;
};

async function fetchApi(path: string): Promise<Response> {
  const initData = getInitData();
  return fetch(`${apiUrl}${path}`, {
    headers: initData ? { "x-telegram-init-data": initData } : {}
  });
}

async function readApiError(response: Response): Promise<string> {
  const data = (await response.json().catch(() => ({}))) as ApiError;
  return data.error || `HTTP ${response.status}`;
}

function ttlColor(expiresAt: string) {
  const expires = new Date(expiresAt).getTime();
  const remaining = expires - Date.now();
  if (remaining > freshThresholdMs) return "#16a34a";
  if (remaining > midThresholdMs) return "#f59e0b";
  return "#ef4444";
}

function formatHoursAndMinutes(durationMs: number): string {
  const totalMinutes = Math.round(durationMs / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (minutes === 0) {
    return `${hours}h`;
  }
  return `${hours}h ${minutes}m`;
}

function renderLegendLabels() {
  const greenMaxAgeMs = pointTtlMs - freshThresholdMs;
  const orangeMaxAgeMs = pointTtlMs - midThresholdMs;
  const greenMaxAge = formatHoursAndMinutes(greenMaxAgeMs);
  const orangeMaxAge = formatHoursAndMinutes(orangeMaxAgeMs);
  const ttlAge = formatHoursAndMinutes(pointTtlMs);

  if (legendFreshLabel) {
    legendFreshLabel.textContent = `Зелений: створено/оновлено менше ${greenMaxAge} тому`;
  }
  if (legendMidLabel) {
    legendMidLabel.textContent = `Помаранчевий: ${greenMaxAge} - ${orangeMaxAge} тому`;
  }
  if (legendExpiringLabel) {
    legendExpiringLabel.textContent = `Червоний: ${orangeMaxAge} - ${ttlAge} тому`;
  }
}

renderLegendLabels();

function formatElapsed(isoDate: string): string {
  const timestamp = new Date(isoDate).getTime();
  if (!Number.isFinite(timestamp)) return "unknown";

  const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (seconds < 60) return "just now";

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ago`;

  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} d ago`;

  const months = Math.floor(days / 30);
  if (months < 12) return `${months} mo ago`;

  const years = Math.floor(days / 365);
  return `${years} y ago`;
}

function clearCommentsPanel() {
  selectedPointId = null;
  commentsContainer.hidden = true;
  commentsContainer.innerHTML = "";
  panelStatus.textContent = defaultPanelStatus;
}

async function fetchPoints() {
  panelStatus.textContent = "Loading points...";
  const response = await fetchApi("/points");

  if (!response.ok) {
    const message = await readApiError(response);
    panelStatus.textContent = `Unable to load points (${message}).`;
    return;
  }

  const data = await response.json();
  const points = data.points as Array<{
    id: number;
    lat: number;
    lng: number;
    created_at: string;
    last_refreshed_at: string;
    expires_at: string;
    comments_count: number;
  }>;

  const seen = new Set<number>();

  for (const point of points) {
    seen.add(point.id);
    const color = ttlColor(point.expires_at);

    let marker = markers.get(point.id);
    if (!marker) {
      marker = L.circleMarker([point.lat, point.lng], {
        radius: 8,
        color,
        weight: 2,
        fillColor: color,
        fillOpacity: 0.9
      }).addTo(map);
      markers.set(point.id, marker);
      marker.on("popupclose", () => {
        if (selectedPointId === point.id) {
          clearCommentsPanel();
        }
      });
    } else {
      marker.setStyle({ color, fillColor: color });
    }

    const popupContent = document.createElement("div");
    popupContent.innerHTML = `
      <strong>Created:</strong> ${formatElapsed(point.created_at)}<br />
      <strong>Updated:</strong> ${formatElapsed(point.last_refreshed_at)}<br />
      <strong>Comments:</strong> ${point.comments_count}<br />
    `;
    const button = document.createElement("button");
    button.textContent = "Show comments";
    button.style.marginTop = "8px";
    button.onclick = () => {
      selectedPointId = point.id;
      loadComments(point.id);
    };
    popupContent.appendChild(button);

    marker.bindPopup(popupContent);
  }

  for (const [id, marker] of markers.entries()) {
    if (!seen.has(id)) {
      map.removeLayer(marker);
      markers.delete(id);
    }
  }

  if (selectedPointId !== null && !seen.has(selectedPointId)) {
    clearCommentsPanel();
  }

  if (points.length === 0) {
    panelStatus.textContent = "No active points yet.";
    return;
  }

  if (selectedPointId === null) {
    panelStatus.textContent = defaultPanelStatus;
  }
}

async function loadComments(pointId: number) {
  const requestedPointId = pointId;
  panelStatus.textContent = "Loading comments...";
  commentsContainer.hidden = false;
  commentsContainer.replaceChildren();

  const response = await fetchApi(`/points/${pointId}/comments`);
  if (selectedPointId !== requestedPointId) {
    return;
  }

  if (!response.ok) {
    const message = await readApiError(response);
    panelStatus.textContent = `Unable to load comments (${message}).`;
    return;
  }

  const data = await response.json();
  const comments = data.comments as Array<{ id: number; body: string; created_at: string }>;
  if (selectedPointId !== requestedPointId) {
    return;
  }

  if (comments.length === 0) {
    panelStatus.textContent = "No comments yet.";
    return;
  }

  panelStatus.textContent = "";
  for (const comment of comments) {
    const div = document.createElement("div");
    div.className = "comment";
    div.innerHTML = `
      <time>${formatElapsed(comment.created_at)}</time>
      <div>${comment.body}</div>
    `;
    commentsContainer.appendChild(div);
  }
}

refreshButton.addEventListener("click", () => fetchPoints());

fetchPoints().catch((error) => {
  panelStatus.textContent = "Unable to load points.";
  console.error("Failed to fetch points", error);
});
setInterval(() => {
  fetchPoints().catch((error) => {
    console.error("Periodic points refresh failed", error);
  });
}, 45_000);
