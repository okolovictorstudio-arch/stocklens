import { ChatContainer } from "@/components/chat/ChatContainer";
import { getAllFeaturesStatus } from "@/lib/env";

export default function HomePage() {
  const isDev = process.env.NODE_ENV === "development";
  const featureStatuses = getAllFeaturesStatus();

  // In development, log setup problems to the server console
  if (isDev) {
    const missing = featureStatuses.filter((f) => !f.isConfigured);
    if (missing.length > 0) {
      console.warn(
        `[StockLens Server Setup Notice] ${missing.length} service(s) unconfigured: ` +
          missing.map((f) => `${f.name} (missing: ${f.missingVars.join(", ")})`).join("; ")
      );
    }
  }

  // In production, real users must never receive or see missing-key notices
  const clientStatuses = isDev ? featureStatuses : [];

  return <ChatContainer featureStatuses={clientStatuses} />;
}
