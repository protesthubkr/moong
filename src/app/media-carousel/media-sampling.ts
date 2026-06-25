import {
  MEDIA_BACKGROUND_SURFACE_RGB,
  SAMPLE_CANVAS_SIZE,
} from "./media-constants";
import { shouldFrameShortMedia } from "./media-layout";
import { getImageSamplingUrl } from "./media-urls";

type NaturalMediaMeasurement = {
  element: HTMLElement;
  height: number;
  width: number;
};

const sampledImageColors = new Map<string, Promise<string | null>>();

export function handleMediaImageLoad(image: HTMLImageElement) {
  applyNaturalMediaFrames(image);
  applySampledImageBackground(image);
}

function applyNaturalMediaFrames(image: HTMLImageElement) {
  const strip = image.closest<HTMLElement>(".moong-media-strip");

  if (!strip) {
    return false;
  }

  const measurements = getNaturalMediaMeasurements(strip);

  if (measurements.length <= 1) {
    return false;
  }

  const targetFrameHeight = Math.max(
    ...measurements.map((measurement) => measurement.height),
  );
  let currentImageFramed = false;

  for (const measurement of measurements) {
    const shouldFrame = shouldFrameShortMedia(
      measurement.height,
      targetFrameHeight,
    );

    if (shouldFrame) {
      applyNaturalFrameStyle(measurement, targetFrameHeight);

      if (measurement.element.contains(image)) {
        currentImageFramed = true;
      }
    } else if (
      measurement.element.classList.contains("moong-media--natural-framed")
    ) {
      clearNaturalFrameStyle(measurement.element);
    }
  }

  return currentImageFramed;
}

function getNaturalMediaMeasurements(strip: HTMLElement) {
  return Array.from(
    strip.querySelectorAll<HTMLElement>(".moong-media:not(.moong-media--video)"),
  )
    .map(getNaturalMediaMeasurement)
    .filter(
      (measurement): measurement is NaturalMediaMeasurement =>
        measurement !== null,
    );
}

function getNaturalMediaMeasurement(
  element: HTMLElement,
): NaturalMediaMeasurement | null {
  const image = element.querySelector("img");
  const width = element.getBoundingClientRect().width;
  const naturalWidth = image?.naturalWidth ?? 0;
  const naturalHeight = image?.naturalHeight ?? 0;

  if (!image || width <= 0 || naturalWidth <= 0 || naturalHeight <= 0) {
    return null;
  }

  return {
    element,
    height: width / (naturalWidth / naturalHeight),
    width,
  };
}

function applyNaturalFrameStyle(
  measurement: NaturalMediaMeasurement,
  targetFrameHeight: number,
) {
  measurement.element.classList.add(
    "moong-media--sized",
    "moong-media--framed",
    "moong-media--natural-framed",
  );
  measurement.element.style.aspectRatio = `${measurement.width} / ${targetFrameHeight}`;
  measurement.element.style.flexBasis = `${measurement.width}px`;
  measurement.element.style.maxHeight = `${targetFrameHeight}px`;
  measurement.element.style.width = `${measurement.width}px`;
  measurement.element.style.setProperty(
    "--moong-media-aspect",
    String(measurement.width / targetFrameHeight),
  );
  measurement.element.style.setProperty(
    "--moong-media-frame-height",
    `${targetFrameHeight}px`,
  );
}

function clearNaturalFrameStyle(element: HTMLElement) {
  element.classList.remove(
    "moong-media--sized",
    "moong-media--framed",
    "moong-media--natural-framed",
  );
  element.style.removeProperty("aspect-ratio");
  element.style.removeProperty("flex-basis");
  element.style.removeProperty("max-height");
  element.style.removeProperty("width");
  element.style.removeProperty("--moong-media-aspect");
  element.style.removeProperty("--moong-media-frame-height");
  element.style.removeProperty("--moong-media-bg");
}

function applySampledImageBackground(image: HTMLImageElement) {
  const mediaElement = image.closest<HTMLElement>(".moong-media");
  const imageUrl = image.currentSrc || image.src;

  if (!mediaElement || !imageUrl) {
    return;
  }

  getSampledImageColor(imageUrl).then((color) => {
    if (color && mediaElement.isConnected) {
      mediaElement.style.setProperty("--moong-media-bg", color);
    }
  });
}

function getSampledImageColor(imageUrl: string) {
  const cachedColor = sampledImageColors.get(imageUrl);

  if (cachedColor) {
    return cachedColor;
  }

  const colorPromise = new Promise<string | null>((resolve) => {
    const image = new Image();

    image.crossOrigin = "anonymous";
    image.decoding = "async";
    image.onload = () => resolve(sampleLoadedImageColor(image));
    image.onerror = () => resolve(null);
    image.src = getImageSamplingUrl(imageUrl);
  });

  sampledImageColors.set(imageUrl, colorPromise);

  return colorPromise;
}

function sampleLoadedImageColor(image: HTMLImageElement) {
  if (!image.naturalWidth || !image.naturalHeight) {
    return null;
  }

  try {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d", {
      willReadFrequently: true,
    });

    if (!context) {
      return null;
    }

    canvas.height = SAMPLE_CANVAS_SIZE;
    canvas.width = SAMPLE_CANVAS_SIZE;
    context.drawImage(image, 0, 0, SAMPLE_CANVAS_SIZE, SAMPLE_CANVAS_SIZE);

    return getSoftAverageColor(
      context.getImageData(0, 0, SAMPLE_CANVAS_SIZE, SAMPLE_CANVAS_SIZE).data,
    );
  } catch {
    return null;
  }
}

function getSoftAverageColor(data: Uint8ClampedArray) {
  let b = 0;
  let count = 0;
  let g = 0;
  let r = 0;

  for (let index = 0; index < data.length; index += 4) {
    const alpha = data[index + 3] / 255;

    if (alpha < 0.08) {
      continue;
    }

    r += data[index] * alpha;
    g += data[index + 1] * alpha;
    b += data[index + 2] * alpha;
    count += alpha;
  }

  if (count <= 0) {
    return null;
  }

  return `rgb(${softenColorChannel(r / count, MEDIA_BACKGROUND_SURFACE_RGB.r)}, ${softenColorChannel(
    g / count,
    MEDIA_BACKGROUND_SURFACE_RGB.g,
  )}, ${softenColorChannel(b / count, MEDIA_BACKGROUND_SURFACE_RGB.b)})`;
}

function softenColorChannel(value: number, surfaceValue: number) {
  return Math.round(value * 0.82 + surfaceValue * 0.18);
}
