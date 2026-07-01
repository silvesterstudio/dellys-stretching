import Image from "next/image";

// A branded placeholder that stands in for real studio photography. When photos
// are supplied, pass `src` and it renders the image; until then it shows a
// tasteful ruby/lavender gradient with the Dellys mark so the layout reads as
// intentional, never as a broken/empty image box.
export function PhotoSlot({
  src,
  alt = "Dellys",
  className = "",
  children,
}: {
  src?: string;
  alt?: string;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand-100 via-sand-50 to-mauve-100 ${className}`}
    >
      {src ? (
        <Image src={src} alt={alt} fill sizes="(max-width: 768px) 100vw, 40vw" className="object-cover" />
      ) : (
        <div className="absolute inset-0 grid place-items-center">
          <Image
            src="/dellys-logo.webp"
            alt={alt}
            width={1053}
            height={266}
            className="h-6 w-auto opacity-40 mix-blend-luminosity sm:h-7"
          />
        </div>
      )}
      {children}
    </div>
  );
}
