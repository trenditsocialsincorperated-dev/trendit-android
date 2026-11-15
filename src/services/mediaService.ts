import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { storage } from './firebase';
import type { MediaType } from '@/types';

export interface UploadedMediaResult {
  url: string;
  mediaType: MediaType;
}

export function detectMediaType(file: File): MediaType {
  if (file.type.startsWith('video/')) return 'video';
  if (file.type.startsWith('audio/')) return 'audio';
  return 'image';
}

/**
 * Compresses images client-side using HTML5 Canvas to keep uploads snappy on mobile
 * and ensure fallback compatibility if Storage rules disallow direct writes.
 */
async function compressImageFile(file: File, maxDimension = 1440, quality = 0.84): Promise<Blob> {
  if (!file.type.startsWith('image/') || file.type === 'image/gif') {
    return file;
  }

  return new Promise((resolve) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      let { width, height } = img;
      if (width > maxDimension || height > maxDimension) {
        const ratio = Math.min(maxDimension / width, maxDimension / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(file);
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          resolve(blob || file);
        },
        'image/jpeg',
        quality
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(file);
    };

    img.src = objectUrl;
  });
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Failed to read media file.'));
    reader.readAsDataURL(blob);
  });
}

/**
 * Uploads user media to Firebase Storage (`trend-it-c7ea4.firebasestorage.app`).
 * If Firebase Storage rules restrict direct client writes, falls back to an optimized
 * Data URL (preserving backwards compatibility with existing Trendit Firestore media posts
 * while guarding against the 1MB Firestore document limit).
 */
export async function uploadMediaAsset(
  file: File,
  folder: 'posts' | 'avatars' | 'covers' | 'stories' | 'dms',
  uid: string,
  onProgress?: (pct: number) => void
): Promise<UploadedMediaResult> {
  const mediaType = detectMediaType(file);
  const maxDim = folder === 'avatars' ? 512 : folder === 'covers' ? 1400 : 1280;
  const processedBlob = mediaType === 'image' ? await compressImageFile(file, maxDim, 0.82) : file;

  const ext = mediaType === 'image' ? 'jpg' : file.name.split('.').pop() || 'bin';
  const safeName = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const storagePath = `${folder}/${uid}/${safeName}`;
  const storageRef = ref(storage, storagePath);

  try {
    const uploadTask = uploadBytesResumable(storageRef, processedBlob, {
      contentType: mediaType === 'image' ? 'image/jpeg' : file.type,
    });

    const downloadUrl = await new Promise<string>((resolve, reject) => {
      // Timeout Storage attempt if bucket CORS/rules hang so UI never stalls
      const safetyTimer = setTimeout(() => {
        uploadTask.cancel();
        reject(new Error('Storage upload timed out'));
      }, 18000);

      uploadTask.on(
        'state_changed',
        (snapshot) => {
          if (onProgress && snapshot.totalBytes > 0) {
            onProgress(Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100));
          }
        },
        (err) => {
          clearTimeout(safetyTimer);
          reject(err);
        },
        async () => {
          clearTimeout(safetyTimer);
          try {
            const url = await getDownloadURL(uploadTask.snapshot.ref);
            resolve(url);
          } catch (urlErr) {
            reject(urlErr);
          }
        }
      );
    });

    onProgress?.(100);
    return { url: downloadUrl, mediaType };
  } catch (storageError) {
    console.warn('Firebase Storage direct upload unavailable, trying inline fallback:', storageError);

    // For images, re-compress tighter if needed to fit comfortably inside Firestore's 1MB doc limit
    let fallbackBlob = processedBlob;
    if (mediaType === 'image' && fallbackBlob.size > 580_000) {
      fallbackBlob = await compressImageFile(file, 900, 0.68);
    }

    if (fallbackBlob.size > 720_000) {
      throw new Error(
        'This video/audio file exceeds 700 KB and Firebase Storage write permissions are restricted on the bucket. Please choose a shorter clip or enable Firebase Storage write rules.'
      );
    }

    const dataUrl = await blobToDataUrl(fallbackBlob);
    onProgress?.(100);
    return { url: dataUrl, mediaType };
  }
}
