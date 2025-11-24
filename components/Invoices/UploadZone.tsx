'use client';

import React, { useCallback, useState } from 'react';
import { UploadCloud, FileText, Loader2, CheckCircle } from 'lucide-react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

import { useOrganization } from '@/hooks/useOrganization';

export default function UploadZone({ onUploadComplete }: { onUploadComplete: () => void }) {
  const supabase = createClientComponentClient();
  const { orgId } = useOrganization();
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // Gestion du Drag & Drop
  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setIsDragging(true);
    } else if (e.type === 'dragleave') {
      setIsDragging(false);
    }
  }, []);

  // Gestion du Drop (Lâcher le fichier)
  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      await uploadFile(files[0]);
    }
  }, []);

  // Gestion du Click (Ouvrir explorateur)
  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      await uploadFile(e.target.files[0]);
    }
  };

  // La logique d'Upload
  const uploadFile = async (file: File) => {
    if (!orgId) {
      alert("Organisation non détectée. Veuillez recharger la page.");
      return;
    }

    setIsUploading(true);

    try {
      // 1. Upload vers Supabase Storage
      const fileName = `${Date.now()}-${file.name}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('invoices')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      // 2. Récupérer l'URL publique
      const { data: { publicUrl } } = supabase.storage
        .from('invoices')
        .getPublicUrl(fileName);

      // 3. Créer l'entrée en Base de Données (En attente d'IA)
      // Note: On met un montant à 0 en attendant que l'IA le lise
      const { error: dbError } = await supabase
        .from('invoices')
        .insert({
          invoice_number: 'DRAFT-' + Date.now().toString().slice(-4),
          client_name: 'Analyse en cours...',
          date_issued: new Date().toISOString(),
          total_amount: 0,
          status: 'NEEDS_APPROVAL', // Déclenchera l'IA plus tard
          file_url: publicUrl,
          org_id: orgId,
        });

      if (dbError) throw dbError;

      // 4. Succès !
      onUploadComplete();

    } catch (error) {
      console.error("Upload failed:", error);
      alert("Erreur d'upload. Vérifiez la console.");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="mb-8">
      <label
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        className={`
          relative flex flex-col items-center justify-center w-full h-40 rounded-2xl
          border-2 border-dashed transition-all duration-300 cursor-pointer group
          ${isDragging
            ? 'border-teal-400 bg-teal-400/5 scale-[1.01]'
            : 'border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20'
          }
        `}
      >
        <div className="flex flex-col items-center justify-center pt-5 pb-6 text-center">
          {isUploading ? (
            <>
              <div className="p-3 bg-teal-500/20 rounded-full mb-3 animate-pulse">
                <Loader2 className="w-8 h-8 text-teal-400 animate-spin" />
              </div>
              <p className="text-sm text-slate-300">Téléchargement vers le Cloud...</p>
            </>
          ) : (
            <>
              <div className={`p-3 rounded-full mb-3 transition-colors ${isDragging ? 'bg-teal-500/20 text-teal-400' : 'bg-white/5 text-slate-400 group-hover:text-white'}`}>
                <UploadCloud className="w-8 h-8" />
              </div>
              <p className="mb-2 text-sm text-slate-300">
                <span className="font-semibold text-white">Cliquez pour uploader</span> ou glissez le PDF ici
              </p>
              <p className="text-xs text-slate-500">PDF, PNG, JPG (Max 10MB)</p>
            </>
          )}
        </div>
        <input
          type="file"
          className="hidden"
          accept=".pdf,.png,.jpg,.jpeg"
          onChange={handleChange}
          disabled={isUploading}
        />
      </label>
    </div>
  );
}
