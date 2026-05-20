const LOGO_MIME = new Set(["image/png", "image/jpeg", "image/jpg", "image/webp"]);
const MAX_LOGO_BYTES = 2 * 1024 * 1024;

export function validateLogoFile(file: File): string | null {
  if (!LOGO_MIME.has(file.type)) {
    return "Dozvoljeni formati: PNG, JPG, WEBP";
  }
  if (file.size > MAX_LOGO_BYTES) {
    return "Logo mora biti manji od 2 MB";
  }
  return null;
}

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("Neispravan format slike"));
    };
    reader.onerror = () => reject(new Error("Čitanje fajla nije uspelo"));
    reader.readAsDataURL(file);
  });
}

export function loadImageDimensions(
  dataUrl: string,
): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () =>
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => reject(new Error("Pregled slike nije uspeo"));
    img.src = dataUrl;
  });
}

export function fitImageBox(
  width: number,
  height: number,
  maxWidth: number,
  maxHeight: number,
): { width: number; height: number } {
  if (width <= 0 || height <= 0) return { width: maxWidth, height: maxHeight };
  const ratio = Math.min(maxWidth / width, maxHeight / height, 1);
  return { width: width * ratio, height: height * ratio };
}
