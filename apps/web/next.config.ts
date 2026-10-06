import type { NextConfig } from "next";
import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
  cacheOnFrontEndNav: true,
  reloadOnOnline: true,
  dynamicStartUrl: true,
  // /dashboard manda a /login si no hay sesión. El SW guarda ese destino.
  dynamicStartUrlRedirect: "/login",
});

const nextConfig: NextConfig = {
  // next-pwa adds a webpack config. Dev stays on Turbopack; the PWA
  // build opts into webpack via `next build --webpack`.
  turbopack: {},
};

export default withPWA(nextConfig);
