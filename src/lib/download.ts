/** A storage signed link that the browser saves as a file instead of playing it: phones (Chrome on Android, Safari on
 *  iPhone) ignore the `download` attribute on links to another domain, so the server is asked to send the file as an
 *  attachment (Supabase Storage `download` parameter). */
export function asDownload(signedUrl: string, fileName: string) {
  const name = (fileName.replace(/[^\p{L}\p{N} ._-]/gu, '').trim().slice(0, 80) || 'video.mp4');
  return `${signedUrl}${signedUrl.includes('?') ? '&' : '?'}download=${encodeURIComponent(name)}`;
}
