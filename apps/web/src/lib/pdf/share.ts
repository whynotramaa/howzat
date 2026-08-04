/**
 * Getting a finished PDF off the page.
 *
 * On a phone the task is almost never "put a file in Downloads" — it is "send
 * this to the group chat", which is what the native share sheet does and what
 * a download does not. So the sheet is offered first wherever the platform can
 * actually carry a file, and saving is the fallback rather than the default.
 *
 * The two outcomes are reported back because they need different words: a
 * share sheet has already told the user what happened, and a silent download
 * has not.
 */

export type PdfDelivery = 'shared' | 'downloaded';

export async function deliverPdf(
  blob: Blob,
  fileName: string,
  message: { title: string; text: string },
): Promise<PdfDelivery> {
  const file = new File([blob], fileName, { type: 'application/pdf' });

  // canShare with the file is the only reliable test: several browsers expose
  // navigator.share and then refuse anything that is not a URL.
  if (
    typeof navigator.share === 'function' &&
    typeof navigator.canShare === 'function' &&
    navigator.canShare({ files: [file] })
  ) {
    try {
      await navigator.share({ files: [file], title: message.title, text: message.text });
      return 'shared';
    } catch (error) {
      // A dismissed sheet is a decision, not a failure — and re-downloading
      // the file behind someone who just cancelled would be the wrong answer.
      if (error instanceof DOMException && error.name === 'AbortError') return 'shared';
      // Anything else (a share target that rejected the file, a permissions
      // policy) falls through to the download, which always works.
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

  // Revoking immediately races the download in Safari; a tick is enough.
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** True where a file can plausibly reach a share sheet — decides the label. */
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
