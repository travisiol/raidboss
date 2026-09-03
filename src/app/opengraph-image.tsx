import { ImageResponse } from "next/og";
import { raidRules, siteConfig } from "@/lib/site-config";

export const alt = `${siteConfig.name} — ${siteConfig.tagline}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * The card is the health bar, three quarters drained, at the size a timeline
 * renders it. Anything more detailed loses to the scale a preview is shown
 * at; a red bar on black at 1200px wide survives being a thumbnail.
 */
export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          backgroundColor: "#04060a",
          padding: 64,
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize: 22,
            color: "#5f6c79",
            letterSpacing: 8,
          }}
        >
          RAID BOSS · {raidRules.feeBps / 100}% OF EVERY BUY · ROBINHOOD CHAIN
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              display: "flex",
              fontSize: 116,
              color: "#e9eef2",
              letterSpacing: 1,
              lineHeight: 1,
            }}
          >
            EVERY BUY IS A HIT
          </div>

          <div
            style={{
              display: "flex",
              marginTop: 40,
              height: 46,
              background: "#0b0f15",
              border: "1px solid #151d28",
            }}
          >
            <div style={{ display: "flex", width: "27%", background: "#ff3a5e" }} />
          </div>

          <div
            style={{
              display: "flex",
              marginTop: 22,
              justifyContent: "space-between",
              fontSize: 26,
              color: "#97a5b2",
            }}
          >
            <div style={{ display: "flex", color: "#aef23f" }}>
              {siteConfig.name} {siteConfig.ticker}
            </div>
            <div style={{ display: "flex" }}>
              KILL IT · SPLIT THE POT IN USDG
            </div>
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
