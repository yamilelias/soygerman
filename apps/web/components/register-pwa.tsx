"use client";

import { useEffect } from "react";

type WorkboxWindow = Window & {
  workbox?: { register: () => Promise<unknown> };
};

export function RegisterPwa() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    const workbox = (window as WorkboxWindow).workbox;
    if (workbox) {
      void workbox.register();
      return;
    }

    void navigator.serviceWorker.register("/sw.js", { scope: "/" });
  }, []);

  return null;
}
