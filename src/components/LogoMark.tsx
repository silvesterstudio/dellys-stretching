import Image from "next/image";

// The Dellys brand lockup (stretching figure + "DELLYS STRECHING" wordmark).
// `height` drives the size; width follows the artwork's 3.96:1 aspect ratio.
const RATIO = 1053 / 266;

export function LogoMark({ height = 34, priority = false }: { height?: number; priority?: boolean }) {
  return (
    <Image
      src="/dellys-logo.png"
      alt="Dellys"
      width={Math.round(height * RATIO)}
      height={height}
      priority={priority}
      style={{ height, width: "auto", display: "block" }}
    />
  );
}
