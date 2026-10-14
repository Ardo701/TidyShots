import type { MetadataRoute } from "next";
import { APP_NAME } from "@/lib/brand";

// Name and icons used when the page is added to a home screen or installed.
// The PNGs in public/icons are rendered from the same artwork as icon.svg.
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: APP_NAME,
    short_name: APP_NAME,
    description: "Triez un dossier de photos au clavier ou d’un geste, directement dans le navigateur.",
    lang: "fr",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f4f4f2",
    theme_color: "#f4f4f2",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
