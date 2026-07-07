"use client";

/*
 * SUPABASE STORAGE SETUP — run once in Supabase SQL Editor:
 *
 * INSERT INTO storage.buckets (id, name, public)
 * VALUES ('avatars', 'avatars', true);
 *
 * CREATE POLICY "Lecture publique avatars"
 * ON storage.objects FOR SELECT
 * TO public USING (bucket_id = 'avatars');
 *
 * CREATE POLICY "Upload avatar authentifié"
 * ON storage.objects FOR INSERT
 * TO authenticated
 * WITH CHECK (bucket_id = 'avatars');
 *
 * CREATE POLICY "Update avatar propriétaire"
 * ON storage.objects FOR UPDATE
 * TO authenticated
 * USING (bucket_id = 'avatars');
 */

import { useState, useRef, useCallback } from "react";
import Image from "next/image";
import ReactCrop, {
  type Crop,
  type PixelCrop,
  centerCrop,
  makeAspectCrop,
} from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";

export interface PhotoUploadProps {
  profileId?: string;
  initialPhotoUrl?: string | null;
  name?: string | null;
  profileType?: "TITULAIRE" | "REMPLACANT" | "ASSISTANT";
  onUploaded?: (url: string) => void;
  onBlobReady?: (blob: Blob) => void;
}

export function getInitials(name: string | null | undefined): string {
  if (!name) return "?";
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

export function getInitialsColor(name: string | null | undefined): string {
  const palette = [
    "bg-blue-500",
    "bg-emerald-500",
    "bg-violet-500",
    "bg-amber-500",
    "bg-rose-500",
    "bg-teal-500",
  ];
  if (!name) return palette[0];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return palette[Math.abs(hash) % palette.length];
}

function centerSquareCrop(w: number, h: number): Crop {
  return centerCrop(makeAspectCrop({ unit: "%", width: 90 }, 1, w, h), w, h);
}

async function cropAndCompress(
  img: HTMLImageElement,
  px: PixelCrop
): Promise<Blob> {
  const SIZE = 800;
  const canvas = document.createElement("canvas");
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, px.x, px.y, px.width, px.height, 0, 0, SIZE, SIZE);
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Canvas empty"))),
      "image/jpeg",
      0.85
    )
  );
}

export default function PhotoUpload({
  profileId,
  initialPhotoUrl,
  name,
  profileType,
  onUploaded,
  onBlobReady,
}: PhotoUploadProps) {
  const isCabinet = profileType === "TITULAIRE";
  const wording = isCabinet
    ? {
        label:  "Photo de mon cabinet",
        button: "Ajouter la photo du cabinet",
        tip:    "Montrez votre plateau technique ou salle de soin",
      }
    : {
        label:  "Ma photo professionnelle",
        button: "Ajouter ma photo",
        tip:    "Une photo de vous rassure les cabinets",
      };
  const [photoUrl, setPhotoUrl] = useState<string | null>(
    initialPhotoUrl ?? null
  );
  const [srcUrl, setSrcUrl] = useState<string | null>(null);
  const [crop, setCrop] = useState<Crop>();
  const [pixelCrop, setPixelCrop] = useState<PixelCrop>();
  const [uploading, setUploading] = useState(false);
  const [toast, setToast] = useState<{
    type: "success" | "error";
    msg: string;
  } | null>(null);

  const imgRef = useRef<HTMLImageElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  const showToast = useCallback(
    (type: "success" | "error", msg: string) => {
      setToast({ type, msg });
      setTimeout(() => setToast(null), 3000);
    },
    []
  );

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      showToast("error", "Fichier trop lourd (max 5 Mo)");
      return;
    }
    setSrcUrl(URL.createObjectURL(file));
    setCrop(undefined);
    e.target.value = "";
  }

  function handleImgLoad(e: React.SyntheticEvent<HTMLImageElement>) {
    const { naturalWidth: w, naturalHeight: h } = e.currentTarget;
    setCrop(centerSquareCrop(w, h));
  }

  async function handleValidate() {
    if (!imgRef.current || !pixelCrop) return;
    setUploading(true);
    try {
      const blob = await cropAndCompress(imgRef.current, pixelCrop);

      if (onBlobReady) {
        onBlobReady(blob);
        setSrcUrl(null);
        setPhotoUrl(URL.createObjectURL(blob));
        showToast("success", "Photo prête !");
        return;
      }

      if (!profileId) return;

      // Upload côté serveur (route API avec clé service_role → bypass RLS).
      // Le serveur stocke dans le bucket "avatars" ET met à jour Profile.photoUrl.
      const fd = new FormData();
      fd.append("file", blob, `${profileId}.jpg`);
      const res = await fetch(`/api/profiles/${profileId}/photo`, {
        method: "POST",
        body: fd,
      });
      const json = (await res.json().catch(() => ({}))) as {
        url?: string;
        error?: string;
      };
      if (!res.ok || !json.url) {
        throw new Error(json.error ?? `Upload échoué (${res.status})`);
      }
      const url = json.url;

      setPhotoUrl(url);
      setSrcUrl(null);
      onUploaded?.(url);
      showToast("success", "Photo mise à jour !");
    } catch (err) {
      // Log explicite du message réel renvoyé par Supabase (au lieu d'un générique)
      console.error("[PhotoUpload] Erreur Supabase:", err);
      const msg = (err as { message?: string })?.message ?? "inconnue";
      showToast("error", `Erreur: ${msg}`);
    } finally {
      setUploading(false);
    }
  }

  const color = getInitialsColor(name);
  const initials = getInitials(name);

  // ── Crop mode ────────────────────────────────────────────────────────────────
  if (srcUrl) {
    return (
      <div className="flex flex-col items-center gap-4">
        <div className="w-full max-w-xs overflow-hidden rounded-2xl border border-gray-200 bg-gray-50">
          <ReactCrop
            crop={crop}
            onChange={(_, pct) => setCrop(pct)}
            onComplete={(px) => setPixelCrop(px)}
            aspect={1}
            circularCrop
            minWidth={50}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              ref={imgRef}
              src={srcUrl}
              alt="Aperçu"
              onLoad={handleImgLoad}
              style={{ maxHeight: 260, width: "100%", objectFit: "contain" }}
            />
          </ReactCrop>
        </div>

        {toast && (
          <p
            className={`text-xs font-semibold px-3 py-1.5 rounded-xl ${
              toast.type === "success"
                ? "bg-emerald-100 text-emerald-700"
                : "bg-red-100 text-red-700"
            }`}
          >
            {toast.msg}
          </p>
        )}

        <div className="flex gap-3 w-full max-w-xs">
          <button
            type="button"
            onClick={() => setSrcUrl(null)}
            className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-500 hover:bg-gray-50 transition"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={handleValidate}
            disabled={!pixelCrop || uploading}
            className="flex-1 py-2.5 bg-kine-600 text-white rounded-xl text-sm font-semibold hover:bg-kine-700 transition disabled:opacity-40"
          >
            {uploading ? "Upload…" : "✓ Valider"}
          </button>
        </div>
      </div>
    );
  }

  // ── Default mode ──────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative w-24 h-24 rounded-full overflow-hidden border-2 border-gray-100 shadow-sm">
        {photoUrl ? (
          <Image
            src={photoUrl}
            alt="Photo de profil"
            fill
            className="object-cover"
            sizes="96px"
            unoptimized
          />
        ) : (
          <div
            className={`w-full h-full ${color} flex items-center justify-center`}
          >
            <span className="text-2xl font-black text-white">{initials}</span>
          </div>
        )}
      </div>

      {!photoUrl && (
        <p className="text-xs text-gray-400 text-center leading-tight">
          {wording.tip}
        </p>
      )}

      <div className="flex gap-2 flex-wrap justify-center">
        {!photoUrl ? (
          <button
            type="button"
            onClick={() => galleryRef.current?.click()}
            className="flex items-center gap-1.5 px-3 py-2 bg-kine-50 border border-kine-200 rounded-xl text-xs font-semibold text-kine-700 hover:bg-kine-100 transition"
          >
            <span>📁</span> {wording.button}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => galleryRef.current?.click()}
            className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-xl text-xs font-semibold text-gray-600 hover:bg-gray-50 transition"
          >
            <span>📁</span> Changer
          </button>
        )}
        <button
          type="button"
          onClick={() => cameraRef.current?.click()}
          className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-xl text-xs font-semibold text-gray-600 hover:bg-gray-50 transition"
        >
          <span>📷</span> Caméra
        </button>
      </div>

      <input
        ref={galleryRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="user"
        className="hidden"
        onChange={handleFileChange}
      />

      {toast && (
        <p
          className={`text-xs font-semibold px-3 py-1.5 rounded-xl ${
            toast.type === "success"
              ? "bg-emerald-100 text-emerald-700"
              : "bg-red-100 text-red-700"
          }`}
        >
          {toast.msg}
        </p>
      )}
    </div>
  );
}
