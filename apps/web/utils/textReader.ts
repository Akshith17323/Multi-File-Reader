export function decodeText(data: ArrayBuffer, contentType = ''): string {
    const bytes = new Uint8Array(data);
    let encoding = contentType.match(/charset\s*=\s*["']?([^\s;"']+)/i)?.[1];
    if (bytes[0] === 0xff && bytes[1] === 0xfe) encoding = 'utf-16le';
    else if (bytes[0] === 0xfe && bytes[1] === 0xff) encoding = 'utf-16be';
    else if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) encoding = 'utf-8';
    let text: string;
    try { text = new TextDecoder(encoding || 'utf-8', { fatal: true }).decode(bytes); }
    catch { text = new TextDecoder('windows-1252').decode(bytes); }
    return text.replace(/\r\n?/g, '\n');
}
