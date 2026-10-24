"use client";

import { useEffect } from "react";

export function RegisterPwa() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    let registration: ServiceWorkerRegistration | undefined;
    let hadController = Boolean(navigator.serviceWorker.controller);
    let reloading = false;

    const onControllerChange = () => {
      if (hadController && !reloading) {
        reloading = true;
        window.location.reload();
      }
      hadController = true;
    };

    const checkForUpdate = () => {
      if (document.visibilityState === "visible") {
        void registration?.update().catch(() => {});
      }
    };

    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);
    document.addEventListener("visibilitychange", checkForUpdate);
    window.addEventListener("pageshow", checkForUpdate);

    void navigator.serviceWorker.register("/sw.js", { scope: "/" })
      .then((registered) => {
        registration = registered;
        checkForUpdate();
      })
      .catch(() => {});

    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
      document.removeEventListener("visibilitychange", checkForUpdate);
      window.removeEventListener("pageshow", checkForUpdate);
    };
  }, []);

  return null;
}
