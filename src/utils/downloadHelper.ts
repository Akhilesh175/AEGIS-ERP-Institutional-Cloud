import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { Capacitor } from '@capacitor/core';

// Helper to convert blob to base64
const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.readAsDataURL(blob);
  });
};

export const downloadFile = async (urlOrBlob: string | Blob, filename: string, mimeType?: string) => {
  try {
    let blob: Blob;
    
    if (typeof urlOrBlob === 'string') {
      // If it is a string URL, fetch the file as a blob
      const res = await fetch(urlOrBlob);
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      blob = await res.blob();
    } else {
      blob = urlOrBlob;
    }

    if (Capacitor.isNativePlatform()) {
      // Convert to base64
      const base64Data = await blobToBase64(blob);
      
      // Save file to Documents directory
      const saveResult = await Filesystem.writeFile({
        path: filename,
        data: base64Data,
        directory: Directory.Documents
      });

      // Get URI of written file
      const fileUri = saveResult.uri;

      // Share/open using the native share sheet
      await Share.share({
        title: `Open ${filename}`,
        text: `Open file: ${filename}`,
        url: fileUri,
        dialogTitle: `Open ${filename}`
      });
    } else {
      // Browser fallback (Web / PWA / Desktop / Mobile Browsers)
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
    }
  } catch (err: any) {
    console.error('[DownloadHelper] Error downloading/sharing file:', err);
    throw err;
  }
};
