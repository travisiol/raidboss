import { ImageResponse } from "next/og";

export const size = { width: 64, height: 64 };
export const contentType = "image/png";

/**
 * A health bar, most of the way gone. At 64px the beast is unreadable and the
 * bar is not — and the bar is the product anyway.
 */
export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#04060a",
        }}
      >
        <div
          style={{
            display: "flex",
            width: 44,
            height: 20,
            background: "#0b0f15",
            border: "2px solid #151d28",
          }}
        >
          <div style={{ display: "flex", width: 15, background: "#ff3a5e" }} />
        </div>
      </div>
    ),
    { ...size },
  );
}
