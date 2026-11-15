// Saves text as a file through the browser's own download, so nothing is sent anywhere (issue 63).
export function downloadFile(name: string, type: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  // Revoke after the click has started the download; revoking at once can cancel it in some browsers.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
