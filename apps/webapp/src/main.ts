import L from "leaflet";
import "./style.css";

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
const initData = window.Telegram?.WebApp?.initData || devInitData || "";

const refreshButton = document.getElementById("refresh") as HTMLButtonElement;
const panelStatus = document.getElementById("panel-status") as HTMLParagraphElement;
const commentsContainer = document.getElementById("comments") as HTMLDivElement;

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

function ttlColor(expiresAt: string) {
  const expires = new Date(expiresAt).getTime();
  const remaining = expires - Date.now();
  const ratio = Math.max(0, Math.min(1, remaining / (5 * 60 * 60 * 1000)));
  if (ratio > 0.66) return "#16a34a";
  if (ratio > 0.33) return "#f59e0b";
  return "#ef4444";
}

async function fetchPoints() {
  if (!initData) {
    panelStatus.textContent = "Open this map from Telegram bot to load points.";
    return;
  }

  const response = await fetch(`${apiUrl}/points`, {
    headers: initData ? { "x-telegram-init-data": initData } : {}
  });

  if (!response.ok) {
    panelStatus.textContent = "Unable to load points. Check access.";
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
    } else {
      marker.setStyle({ color, fillColor: color });
    }

    const popupContent = document.createElement("div");
    popupContent.innerHTML = `
      <strong>Created:</strong> ${new Date(point.created_at).toLocaleString()}<br />
      <strong>Updated:</strong> ${new Date(point.last_refreshed_at).toLocaleString()}<br />
      <strong>Comments:</strong> ${point.comments_count}<br />
    `;
    const button = document.createElement("button");
    button.textContent = "Show comments";
    button.style.marginTop = "8px";
    button.onclick = () => loadComments(point.id);
    popupContent.appendChild(button);

    marker.bindPopup(popupContent);
  }

  for (const [id, marker] of markers.entries()) {
    if (!seen.has(id)) {
      map.removeLayer(marker);
      markers.delete(id);
    }
  }
}

async function loadComments(pointId: number) {
  panelStatus.textContent = "Loading comments...";
  commentsContainer.innerHTML = "";

  const response = await fetch(`${apiUrl}/points/${pointId}/comments`, {
    headers: initData ? { "x-telegram-init-data": initData } : {}
  });

  if (!response.ok) {
    panelStatus.textContent = "Unable to load comments.";
    return;
  }

  const data = await response.json();
  const comments = data.comments as Array<{ id: number; body: string; created_at: string }>;

  if (comments.length === 0) {
    panelStatus.textContent = "No comments yet.";
    return;
  }

  panelStatus.textContent = "";
  for (const comment of comments) {
    const div = document.createElement("div");
    div.className = "comment";
    div.innerHTML = `
      <time>${new Date(comment.created_at).toLocaleString()}</time>
      <div>${comment.body}</div>
    `;
    commentsContainer.appendChild(div);
  }
}

refreshButton.addEventListener("click", () => fetchPoints());

fetchPoints();
setInterval(fetchPoints, 45_000);
