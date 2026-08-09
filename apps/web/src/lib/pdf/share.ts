export type PdfDelivery = 'shared' | 'downloaded';

export async function deliverPdf(
  blob: Blob,
  fileName: string,
  message: { title: string; text: string },
): Promise<PdfDelivery> {
  const file = new File([blob], fileName, { type: 'application/pdf' });

  if (
    typeof navigator.share === 'function' &&
    typeof navigator.canShare === 'function' &&
    navigator.canShare({ files: [file] })
  ) {
    try {
      await navigator.share({ files: [file], title: message.title, text: message.text });
      return 'shared';
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return 'shared';
    }
  }

  download(blob, fileName);
  return 'downloaded';
}

function download(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');

  anchor.href = url;
  anchor.download = fileName;
  anchor.rel = 'noopener';
  document.body.append(anchor);
  anchor.click();
  anchor.remove();

  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export function canShareFiles(): boolean {
  if (typeof navigator.share !== 'function' || typeof navigator.canShare !== 'function') {
    return false;
  }

  try {
    return navigator.canShare({
      files: [new File([new Blob(['.'])], 'probe.pdf', { type: 'application/pdf' })],
    });
  } catch {
    return false;
  }
}
