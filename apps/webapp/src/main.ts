import L from "leaflet";
import "./style.css";
import { pointColorThresholds } from "./config";

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        initData?: string;
        safeAreaInset?: {
          top?: number;
          bottom?: number;
          left?: number;
          right?: number;
        };
        contentSafeAreaInset?: {
          top?: number;
          bottom?: number;
          left?: number;
          right?: number;
        };
        initDataUnsafe?: {
          user?: {
            language_code?: string;
          };
        };
        onEvent?: (eventType: string, eventHandler: (...args: unknown[]) => void) => void;
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

function parsePositiveEnvNumber(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

const apiUrl = import.meta.env.VITE_API_URL || resolveDefaultApiUrl();
const devInitData = import.meta.env.VITE_DEV_INIT_DATA as string | undefined;
const telegramMobileTopInsetFallback = parsePositiveEnvNumber(
  import.meta.env.VITE_TG_MOBILE_TOP_INSET_PX as string | undefined,
  56
);
const telegramIosTopInsetFallback = parsePositiveEnvNumber(
  import.meta.env.VITE_TG_IOS_TOP_INSET_PX as string | undefined,
  72
);
const telegramTopBarHeight = parsePositiveEnvNumber(
  import.meta.env.VITE_TG_TOP_BAR_HEIGHT_PX as string | undefined,
  52
);

type UiLocale = "uk" | "en";

type UiTextSet = {
  pageTitle: string;
  panelTitle: string;
  defaultPanelStatus: string;
  loadingPoints: string;
  unableToLoadPoints: (message: string) => string;
  networkError: string;
  noActivePoints: string;
  loadingComments: string;
  unableToLoadComments: (message: string) => string;
  noComments: string;
  popupCreated: string;
  popupUpdated: string;
  popupComments: string;
  popupShowComments: string;
  legendAriaLabel: string;
  legendGreen: (maxAge: string) => string;
  legendOrange: (fromAge: string, toAge: string) => string;
  legendRed: (fromAge: string, toAge: string) => string;
  justNow: string;
  unknown: string;
};

const uiTextsByLocale: Record<UiLocale, UiTextSet> = {
  uk: {
    pageTitle: "Community Map",
    panelTitle: "Коментарі",
    defaultPanelStatus: "Оберіть точку, щоб переглянути коментарі.",
    loadingPoints: "Завантаження точок...",
    unableToLoadPoints: (message) => `Не вдалося завантажити точки (${message}).`,
    networkError: "помилка мережі",
    noActivePoints: "Ще немає активних точок.",
    loadingComments: "Завантаження коментарів...",
    unableToLoadComments: (message) => `Не вдалося завантажити коментарі (${message}).`,
    noComments: "Коментарів ще немає.",
    popupCreated: "Створено",
    popupUpdated: "Оновлено",
    popupComments: "Коментарі",
    popupShowComments: "Показати коментарі",
    legendAriaLabel: "Легенда кольорів точок",
    legendGreen: (maxAge) => `Зелений: створено/оновлено менше ${maxAge} тому`,
    legendOrange: (fromAge, toAge) => `Помаранчевий: ${fromAge} - ${toAge} тому`,
    legendRed: (fromAge, toAge) => `Червоний: ${fromAge} - ${toAge} тому`,
    justNow: "щойно",
    unknown: "невідомо"
  },
  en: {
    pageTitle: "Community Map",
    panelTitle: "Comments",
    defaultPanelStatus: "Select a marker to view comments.",
    loadingPoints: "Loading points...",
    unableToLoadPoints: (message) => `Unable to load points (${message}).`,
    networkError: "network error",
    noActivePoints: "No active points yet.",
    loadingComments: "Loading comments...",
    unableToLoadComments: (message) => `Unable to load comments (${message}).`,
    noComments: "No comments yet.",
    popupCreated: "Created",
    popupUpdated: "Updated",
    popupComments: "Comments",
    popupShowComments: "Show comments",
    legendAriaLabel: "Point color legend",
    legendGreen: (maxAge) => `Green: created/updated less than ${maxAge} ago`,
    legendOrange: (fromAge, toAge) => `Orange: ${fromAge} - ${toAge} ago`,
    legendRed: (fromAge, toAge) => `Red: ${fromAge} - ${toAge} ago`,
    justNow: "just now",
    unknown: "unknown"
  }
};

function normalizeLocale(rawLanguage: string | undefined): UiLocale {
  if (!rawLanguage) return "en";
  const normalized = rawLanguage.toLowerCase();
  if (normalized.startsWith("uk") || normalized.startsWith("ua")) {
    return "uk";
  }
  return "en";
}

function resolveUiLocale(telegramLanguage: string | undefined): UiLocale {
  const forcedLocale = import.meta.env.VITE_UI_LOCALE as string | undefined;
  if (forcedLocale === "uk" || forcedLocale === "en") {
    return forcedLocale;
  }
  return normalizeLocale(telegramLanguage || navigator.language);
}

const telegramWebApp = window.Telegram?.WebApp;
const uiLocale = resolveUiLocale(telegramWebApp?.initDataUnsafe?.user?.language_code);
const uiTexts = uiTextsByLocale[uiLocale];
const relativeTimeFormatter = new Intl.RelativeTimeFormat(uiLocale === "uk" ? "uk-UA" : "en-US", {
  numeric: "auto"
});
const defaultMapCenter: [number, number] = [16.0544, 108.2022]; // Da Nang
const defaultMapZoom = 12;

function readInsetValue(value: number | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return 0;
  }
  return value;
}

function applyTelegramTopInset() {
  if (!telegramWebApp) {
    return;
  }

  const safeTop = readInsetValue(telegramWebApp.safeAreaInset?.top);
  const contentSafeTop = readInsetValue(telegramWebApp.contentSafeAreaInset?.top);
  const reportedTop = Math.max(safeTop, contentSafeTop);
  const safeAwareTop = reportedTop > 0 ? reportedTop + telegramTopBarHeight : 0;
  const isIOSDevice = /iPhone|iPad|iPod/i.test(navigator.userAgent);
  const isMobileLikeDevice = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || navigator.maxTouchPoints > 1;
  const mobileFallbackTop = isMobileLikeDevice
    ? (isIOSDevice ? telegramIosTopInsetFallback : telegramMobileTopInsetFallback)
    : 0;
  const effectiveTop = Math.max(safeAwareTop, mobileFallbackTop);

  document.documentElement.style.setProperty("--tg-runtime-safe-top", `${effectiveTop}px`);
}

const pageTitle = document.getElementById("page-title") as HTMLHeadingElement | null;
const panelTitle = document.getElementById("panel-title") as HTMLHeadingElement | null;
const legendSection = document.getElementById("point-color-legend") as HTMLElement | null;
const panelStatus = document.getElementById("panel-status") as HTMLParagraphElement;
const commentsContainer = document.getElementById("comments") as HTMLDivElement;
const legendFreshLabel = document.getElementById("legend-fresh-label") as HTMLSpanElement | null;
const legendMidLabel = document.getElementById("legend-mid-label") as HTMLSpanElement | null;
const legendExpiringLabel = document.getElementById("legend-expiring-label") as HTMLSpanElement | null;
const defaultPanelStatus = uiTexts.defaultPanelStatus;
const pointTtlMs = pointColorThresholds.ttlMinutes * 60_000;
const freshThresholdMs = pointColorThresholds.greenThresholdMs;
const midThresholdMs = pointColorThresholds.orangeThresholdMs;

if (pageTitle) {
  pageTitle.textContent = uiTexts.pageTitle;
}
if (panelTitle) {
  panelTitle.textContent = uiTexts.panelTitle;
}
if (legendSection) {
  legendSection.setAttribute("aria-label", uiTexts.legendAriaLabel);
}
document.title = uiTexts.pageTitle;
document.documentElement.lang = uiLocale === "uk" ? "uk" : "en";
if (telegramWebApp) {
  document.documentElement.classList.add("is-telegram-webapp");
  applyTelegramTopInset();
  window.addEventListener("resize", applyTelegramTopInset);
  telegramWebApp.onEvent?.("viewportChanged", applyTelegramTopInset);
  telegramWebApp.onEvent?.("safeAreaChanged", applyTelegramTopInset);
  telegramWebApp.onEvent?.("contentSafeAreaChanged", applyTelegramTopInset);
}

if (telegramWebApp?.ready) {
  telegramWebApp.ready();
}

const map = L.map("map").setView(defaultMapCenter, defaultMapZoom);
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
  () => {
    map.setView(defaultMapCenter, defaultMapZoom);
  }
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
  if (hours === 0) {
    return uiLocale === "uk" ? `${minutes} хв` : `${minutes}m`;
  }
  if (minutes === 0) {
    return uiLocale === "uk" ? `${hours} г` : `${hours}h`;
  }
  return uiLocale === "uk" ? `${hours} г ${minutes} хв` : `${hours}h ${minutes}m`;
}

function renderLegendLabels() {
  const greenMaxAgeMs = pointTtlMs - freshThresholdMs;
  const orangeMaxAgeMs = pointTtlMs - midThresholdMs;
  const greenMaxAge = formatHoursAndMinutes(greenMaxAgeMs);
  const orangeMaxAge = formatHoursAndMinutes(orangeMaxAgeMs);
  const ttlAge = formatHoursAndMinutes(pointTtlMs);

  if (legendFreshLabel) {
    legendFreshLabel.textContent = uiTexts.legendGreen(greenMaxAge);
  }
  if (legendMidLabel) {
    legendMidLabel.textContent = uiTexts.legendOrange(greenMaxAge, orangeMaxAge);
  }
  if (legendExpiringLabel) {
    legendExpiringLabel.textContent = uiTexts.legendRed(orangeMaxAge, ttlAge);
  }
}

renderLegendLabels();

function formatElapsed(isoDate: string): string {
  const timestamp = new Date(isoDate).getTime();
  if (!Number.isFinite(timestamp)) return uiTexts.unknown;

  const diffSeconds = Math.round((timestamp - Date.now()) / 1000);
  if (Math.abs(diffSeconds) < 60) return uiTexts.justNow;

  const diffMinutes = Math.round(diffSeconds / 60);
  if (Math.abs(diffMinutes) < 60) {
    return relativeTimeFormatter.format(diffMinutes, "minute");
  }

  const diffHours = Math.round(diffSeconds / 3_600);
  if (Math.abs(diffHours) < 24) {
    return relativeTimeFormatter.format(diffHours, "hour");
  }

  const diffDays = Math.round(diffSeconds / 86_400);
  if (Math.abs(diffDays) < 30) {
    return relativeTimeFormatter.format(diffDays, "day");
  }

  const diffMonths = Math.round(diffSeconds / 2_592_000);
  if (Math.abs(diffMonths) < 12) {
    return relativeTimeFormatter.format(diffMonths, "month");
  }

  const diffYears = Math.round(diffSeconds / 31_536_000);
  return relativeTimeFormatter.format(diffYears, "year");
}

function clearCommentsPanel() {
  selectedPointId = null;
  commentsContainer.hidden = true;
  commentsContainer.innerHTML = "";
  panelStatus.textContent = defaultPanelStatus;
}

async function fetchPoints() {
  panelStatus.textContent = uiTexts.loadingPoints;
  const response = await fetchApi("/points");

  if (!response.ok) {
    const message = await readApiError(response);
    panelStatus.textContent = uiTexts.unableToLoadPoints(message);
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
      <strong>${uiTexts.popupCreated}:</strong> ${formatElapsed(point.created_at)}<br />
      <strong>${uiTexts.popupUpdated}:</strong> ${formatElapsed(point.last_refreshed_at)}<br />
      <strong>${uiTexts.popupComments}:</strong> ${point.comments_count}<br />
    `;
    const button = document.createElement("button");
    button.textContent = uiTexts.popupShowComments;
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
    panelStatus.textContent = uiTexts.noActivePoints;
    return;
  }

  if (selectedPointId === null) {
    panelStatus.textContent = defaultPanelStatus;
  }
}

async function loadComments(pointId: number) {
  const requestedPointId = pointId;
  panelStatus.textContent = uiTexts.loadingComments;
  commentsContainer.hidden = false;
  commentsContainer.replaceChildren();

  const response = await fetchApi(`/points/${pointId}/comments`);
  if (selectedPointId !== requestedPointId) {
    return;
  }

  if (!response.ok) {
    const message = await readApiError(response);
    panelStatus.textContent = uiTexts.unableToLoadComments(message);
    return;
  }

  const data = await response.json();
  const comments = data.comments as Array<{ id: number; body: string; created_at: string }>;
  if (selectedPointId !== requestedPointId) {
    return;
  }

  if (comments.length === 0) {
    panelStatus.textContent = uiTexts.noComments;
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

fetchPoints().catch((error) => {
  panelStatus.textContent = uiTexts.unableToLoadPoints(uiTexts.networkError);
  console.error("Failed to fetch points", error);
});
setInterval(() => {
  fetchPoints().catch((error) => {
    console.error("Periodic points refresh failed", error);
  });
}, 45_000);
