/**
 * Copies text that is fetched asynchronously (the value is requested once).
 *
 * Safari only allows clipboard writes during the user's click, so the pending
 * value is handed to ClipboardItem as a promise where supported. If that isn't
 * supported, it falls back to writeText once the value has arrived.
 */
export async function copyAsync(getText: () => Promise<string>): Promise<void> {
  const textPromise = getText();

  if (typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) {
    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          "text/plain": textPromise.then(
            (text) => new Blob([text], { type: "text/plain" }),
          ),
        }),
      ]);
      return;
    } catch {
      // Re-throws if fetching the value itself failed; otherwise fall back.
      await textPromise;
    }
  }
  await navigator.clipboard.writeText(await textPromise);
}

export async function copyText(text: string): Promise<void> {
  await navigator.clipboard.writeText(text);
}
