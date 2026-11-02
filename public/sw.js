
self.addEventListener("push", (event) => {
  let data = {};

  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }

  event.waitUntil(
    self.registration.showNotification(data.title || "LocalPro", {
      body: data.message || data.body || "You have a new notification.",
      icon: "/favicon.ico",
      badge: "/favicon.ico",
      tag: data.tag || "localpro-notification",
      data: {
        url: data.url || "/user/attendance",
      },
      requireInteraction: true,
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  event.waitUntil(
    (async () => {
      const path = event.notification.data?.url || "/user/attendance";
      const target = new URL(path, self.location.origin).href;

      try {
        const windows = await self.clients.matchAll({
          type: "window",
          includeUncontrolled: true,
        });

        for (const client of windows) {
          if (new URL(client.url).origin === self.location.origin) {
            const navigated = await client.navigate(target);

            if (navigated) {
              await navigated.focus();
              return;
            }
          }
        }
      } catch (error) {
        console.error("Attendance navigation failed:", error);
      }

      await self.clients.openWindow(target);
    })()
  );
});
