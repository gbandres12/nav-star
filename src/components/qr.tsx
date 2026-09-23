"use client";

import { QRCodeSVG } from "qrcode.react";

export function QR({ value, size = 128 }: { value: string; size?: number }) {
  return <QRCodeSVG value={value} size={size} level="M" fgColor="#000000" />;
}
