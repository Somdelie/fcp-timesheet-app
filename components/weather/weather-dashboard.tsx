"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Sun,
  Cloud,
  CloudRain,
  CloudSnow,
  CloudLightning,
  CloudDrizzle,
  CloudFog,
  Wind,
  Droplets,
  Thermometer,
  Eye,
  Sunrise,
  Sunset,
  MapPin,
  RefreshCw,
  CloudSun,
  Loader2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

// ---------- WMO Weather Code mapping ----------

interface WeatherInfo {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  heroClass: string; // theme-aware hero styling
}

function weatherFromCode(code: number, isDay = true): WeatherInfo {
  // All hero styles use primary as base; weather conditions get subtle variation via opacity/overlay
  if (code === 0)
    return {
      label: "Clear sky",
      icon: Sun,
      heroClass: isDay ? "weather-hero-clear-day" : "weather-hero-clear-night",
    };
  if (code <= 3)
    return {
      label:
        code === 1 ? "Mostly clear" : code === 2 ? "Partly cloudy" : "Overcast",
      icon: code <= 2 ? CloudSun : Cloud,
      heroClass:
        code <= 2 ? "weather-hero-partly-cloudy" : "weather-hero-overcast",
    };
  if (code <= 49)
    return {
      label: "Foggy",
      icon: CloudFog,
      heroClass: "weather-hero-overcast",
    };
  if (code <= 59)
    return {
      label: "Drizzle",
      icon: CloudDrizzle,
      heroClass: "weather-hero-rain",
    };
  if (code <= 69)
    return { label: "Rain", icon: CloudRain, heroClass: "weather-hero-rain" };
  if (code <= 79)
    return { label: "Snow", icon: CloudSnow, heroClass: "weather-hero-snow" };
  if (code <= 84)
    return {
      label: "Rain showers",
      icon: CloudRain,
      heroClass: "weather-hero-rain",
    };
  if (code <= 86)
    return {
      label: "Snow showers",
      icon: CloudSnow,
      heroClass: "weather-hero-snow",
    };
  if (code <= 99)
    return {
      label: "Thunderstorm",
      icon: CloudLightning,
      heroClass: "weather-hero-storm",
    };
  return { label: "Unknown", icon: Cloud, heroClass: "weather-hero-overcast" };
}

function windDirection(deg: number): string {
  const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return dirs[Math.round(deg / 45) % 8];
}

function uvLabel(uv: number): { text: string; color: string } {
  if (uv <= 2) return { text: "Low", color: "text-primary" };
  if (uv <= 5) return { text: "Moderate", color: "text-chart-4" };
  if (uv <= 7) return { text: "High", color: "text-chart-1" };
  if (uv <= 10) return { text: "Very High", color: "text-destructive" };
  return { text: "Extreme", color: "text-destructive" };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type WeatherData = any;

// ---------- Component ----------

export function WeatherDashboard() {
  const [data, setData] = useState<WeatherData>(null);
  const [loading, setLoading] = useState(true);
  const [locationName, setLocationName] = useState("Johannesburg, SA");
  const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(
    null,
  );

  const fetchWeather = useCallback(async (lat?: number, lon?: number) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (lat !== undefined && lon !== undefined) {
        params.set("lat", lat.toFixed(4));
        params.set("lon", lon.toFixed(4));
      }
      const res = await fetch(`/api/weather?${params}`);
      if (!res.ok) throw new Error("fetch failed");
      const json = await res.json();
      setData(json);
    } catch {
      // keep last data
    } finally {
      setLoading(false);
    }
  }, []);

  const reverseGeocode = useCallback(async (lat: number, lon: number) => {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&zoom=10`,
      );
      if (!res.ok) return;
      const json = await res.json();
      const city =
        json.address?.city ||
        json.address?.town ||
        json.address?.suburb ||
        json.address?.county ||
        "";
      const country = json.address?.country_code?.toUpperCase() || "";
      if (city) setLocationName(`${city}, ${country}`);
    } catch {
      // keep default
    }
  }, []);

  useEffect(() => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude, longitude } = pos.coords;
          setCoords({ lat: latitude, lon: longitude });
          fetchWeather(latitude, longitude);
          reverseGeocode(latitude, longitude);
        },
        () => fetchWeather(),
        { timeout: 5000 },
      );
    } else {
      fetchWeather();
    }
  }, [fetchWeather, reverseGeocode]);

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center h-96 text-muted-foreground">
        Failed to load weather data
      </div>
    );
  }

  const current = data.current;
  const hourly = data.hourly;
  const daily = data.daily;
  const weather = weatherFromCode(current.weather_code, !!current.is_day);
  const WeatherIcon = weather.icon;
  const uv = uvLabel(current.uv_index);

  const now = new Date();
  const hourlyStartIdx = hourly.time.findIndex(
    (t: string) => new Date(t) >= now,
  );
  const next24 = Array.from({ length: 24 }, (_, i) => {
    const idx = hourlyStartIdx + i;
    if (idx >= hourly.time.length) return null;
    return {
      time: hourly.time[idx],
      temp: hourly.temperature_2m[idx],
      code: hourly.weather_code[idx],
      precip: hourly.precipitation_probability[idx],
      wind: hourly.wind_speed_10m[idx],
    };
  }).filter(Boolean);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Weather
          </h1>
          <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-0.5">
            <MapPin className="size-3.5" />
            {locationName}
          </p>
        </div>
        <button
          onClick={() =>
            coords ? fetchWeather(coords.lat, coords.lon) : fetchWeather()
          }
          disabled={loading}
          className="flex items-center gap-2 rounded border border-border bg-card px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors"
        >
          <RefreshCw className={cn("size-4", loading && "animate-spin")} />
          Refresh
        </button>
      </div>

      {/* Current Weather Hero */}
      <div
        className={cn(
          "rounded border border-primary/20 overflow-hidden shadow-sm",
          weather.heroClass,
        )}
      >
        <div className="p-6 md:p-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div className="flex items-center gap-5">
              <WeatherIcon className="size-20 md:size-24 text-white/80" />
              <div>
                <p className="text-6xl md:text-7xl font-light tracking-tighter text-white">
                  {Math.round(current.temperature_2m)}°
                </p>
                <p className="text-lg font-medium text-white/90 mt-1">
                  {weather.label}
                </p>
                <p className="text-sm text-white/70">
                  Feels like {Math.round(current.apparent_temperature)}°C
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm text-white/85">
              <div className="flex items-center gap-2">
                <Wind className="size-4 opacity-75" />
                <span>
                  {current.wind_speed_10m} km/h{" "}
                  {windDirection(current.wind_direction_10m)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Droplets className="size-4 opacity-75" />
                <span>{current.relative_humidity_2m}% Humidity</span>
              </div>
              <div className="flex items-center gap-2">
                <Eye className="size-4 opacity-75" />
                <span>
                  UV {current.uv_index.toFixed(1)} · {uv.text}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <CloudRain className="size-4 opacity-75" />
                <span>{current.precipitation} mm Precip</span>
              </div>
              <div className="flex items-center gap-2">
                <Sunrise className="size-4 opacity-75" />
                <span>
                  {new Date(daily.sunrise[0]).toLocaleTimeString("en-ZA", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Sunset className="size-4 opacity-75" />
                <span>
                  {new Date(daily.sunset[0]).toLocaleTimeString("en-ZA", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Hourly Forecast */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold text-foreground">
            Next 24 Hours
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 overflow-x-auto pb-2 -mx-2 px-2">
            {next24.map((h) => {
              if (!h) return null;
              const hDate = new Date(h.time);
              const hWeather = weatherFromCode(h.code);
              const HIcon = hWeather.icon;
              const isNow =
                hDate.getHours() === now.getHours() &&
                hDate.getDate() === now.getDate();
              return (
                <div
                  key={h.time}
                  className={cn(
                    "flex flex-col items-center gap-1.5 rounded-xl px-3 py-3 min-w-18 shrink-0 transition-colors",
                    isNow
                      ? "bg-primary/10 ring-1 ring-primary/30"
                      : "hover:bg-muted/50",
                  )}
                >
                  <span className="text-[11px] font-medium text-muted-foreground">
                    {isNow
                      ? "Now"
                      : hDate.toLocaleTimeString("en-ZA", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                  </span>
                  <HIcon className="size-5 text-foreground/70" />
                  <span className="text-sm font-semibold text-foreground">
                    {Math.round(h.temp)}°
                  </span>
                  {h.precip > 0 && (
                    <span className="text-[10px] text-primary">
                      {h.precip}%
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* 7-Day Forecast */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold text-foreground">
            7-Day Forecast
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          {daily.time.map((day: string, i: number) => {
            const dWeather = weatherFromCode(daily.weather_code[i]);
            const DIcon = dWeather.icon;
            const dDate = new Date(day + "T00:00:00");
            const isToday = dDate.toDateString() === now.toDateString();
            const dayName = isToday
              ? "Today"
              : dDate.toLocaleDateString("en-ZA", { weekday: "short" });
            const dateStr = dDate.toLocaleDateString("en-ZA", {
              day: "numeric",
              month: "short",
            });

            const minTemp = Math.round(daily.temperature_2m_min[i]);
            const maxTemp = Math.round(daily.temperature_2m_max[i]);

            const weekMin = Math.min(...daily.temperature_2m_min);
            const weekMax = Math.max(...daily.temperature_2m_max);
            const range = weekMax - weekMin || 1;
            const barLeft = ((minTemp - weekMin) / range) * 100;
            const barWidth = ((maxTemp - minTemp) / range) * 100;

            return (
              <div
                key={day}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors",
                  isToday ? "bg-primary/5" : "hover:bg-muted/40",
                )}
              >
                <div className="w-14 shrink-0">
                  <p className="text-sm font-medium text-foreground">
                    {dayName}
                  </p>
                  <p className="text-[11px] text-muted-foreground">{dateStr}</p>
                </div>

                <DIcon className="size-5 text-primary/60 shrink-0" />

                <div className="flex-1 min-w-0 hidden sm:flex items-center gap-2">
                  <span className="text-xs text-muted-foreground w-8 text-right shrink-0">
                    {minTemp}°
                  </span>
                  <div className="flex-1 h-1.5 rounded-full bg-muted relative">
                    <div
                      className="absolute h-full rounded-full bg-linear-to-r from-primary/40 to-primary"
                      style={{
                        left: `${barLeft}%`,
                        width: `${Math.max(barWidth, 4)}%`,
                      }}
                    />
                  </div>
                  <span className="text-xs font-medium text-foreground w-8 shrink-0">
                    {maxTemp}°
                  </span>
                </div>

                {/* Mobile: simple temp display */}
                <div className="flex-1 sm:hidden text-right">
                  <span className="text-sm">
                    <span className="text-muted-foreground">{minTemp}°</span>
                    {" / "}
                    <span className="font-medium text-foreground">
                      {maxTemp}°
                    </span>
                  </span>
                </div>

                <div className="hidden md:flex items-center gap-3 text-xs text-muted-foreground shrink-0">
                  <span className="flex items-center gap-1">
                    <Droplets className="size-3" />
                    {daily.precipitation_probability_max[i]}%
                  </span>
                  <span className="flex items-center gap-1">
                    <Thermometer className="size-3" />
                    UV {daily.uv_index_max[i].toFixed(0)}
                  </span>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Extra Detail Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <DetailCard
          icon={Wind}
          title="Wind"
          value={`${current.wind_speed_10m} km/h`}
          sub={windDirection(current.wind_direction_10m)}
        />
        <DetailCard
          icon={Droplets}
          title="Humidity"
          value={`${current.relative_humidity_2m}%`}
          sub={
            current.relative_humidity_2m > 70
              ? "High – may delay drying"
              : current.relative_humidity_2m < 30
                ? "Low – good for painting"
                : "Normal"
          }
        />
        <DetailCard
          icon={Eye}
          title="UV Index"
          value={current.uv_index.toFixed(1)}
          sub={uv.text}
          subColor={uv.color}
        />
        <DetailCard
          icon={CloudRain}
          title="Rain Today"
          value={`${daily.precipitation_sum[0].toFixed(1)} mm`}
          sub={`${daily.precipitation_probability_max[0]}% chance`}
        />
      </div>

      <p className="text-[11px] text-muted-foreground/50 text-center">
        Weather data from Open-Meteo · Refreshes every 15 minutes
      </p>
    </div>
  );
}

// ---------- Detail Card ----------

function DetailCard({
  icon: Icon,
  title,
  value,
  sub,
  subColor,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  value: string;
  sub: string;
  subColor?: string;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-primary/70 mb-2">
          <Icon className="size-4" />
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {title}
          </span>
        </div>
        <p className="text-2xl font-semibold text-foreground">{value}</p>
        <p
          className={cn("text-xs mt-0.5", subColor || "text-muted-foreground")}
        >
          {sub}
        </p>
      </CardContent>
    </Card>
  );
}
