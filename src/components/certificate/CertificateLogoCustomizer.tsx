import React, { useState, useEffect } from 'react';
import {
  Image,
  Upload,
  Check,
  X,
  Sliders,
  Eye,
  Printer,
  Trash2,
  AlertCircle,
  Save,
} from 'lucide-react';
import {
  SealBagongPilipinas,
  SealBarangay,
  SealDA,
  SealMunicipality,
  SealProvince,
} from '../common/OfficialSeals';
import { HINUNANGAN_BARANGAYS } from '../../data/barangays';
import { mediaApi } from '../../services/api';
import type { CertificateLogoSettings } from '../../types';

export type { CertificateLogoSettings } from '../../types';

export interface CertificateLogoCustomizerProps {
  settings: CertificateLogoSettings;
  onChange: (updated: CertificateLogoSettings) => void;
  onSave?: (updated: CertificateLogoSettings) => Promise<void> | void;
  isOpen: boolean;
  onClose: () => void;
}

export const CertificateLogoCustomizer: React.FC<CertificateLogoCustomizerProps> = ({
  settings,
  onChange,
  onSave,
  isOpen,
  onClose,
}) => {
  const [localSettings, setLocalSettings] = useState<CertificateLogoSettings>({
    ...settings,
    printLogoSize: settings.printLogoSize ?? 72,
    printShowWatermark: settings.printShowWatermark ?? settings.showWatermark,
    printWatermarkOpacity: settings.printWatermarkOpacity ?? settings.watermarkOpacity,
    printGrayscale: settings.printGrayscale ?? false,
    printHideCenterLogo: settings.printHideCenterLogo ?? false,
  });

  const [activeTab, setActiveTab] = useState<'general' | 'print'>('general');
  const [uploadingField, setUploadingField] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setLocalSettings({
        ...settings,
        printLogoSize: settings.printLogoSize ?? 72,
        printShowWatermark: settings.printShowWatermark ?? settings.showWatermark,
        printWatermarkOpacity: settings.printWatermarkOpacity ?? settings.watermarkOpacity,
        printGrayscale: settings.printGrayscale ?? false,
        printHideCenterLogo: settings.printHideCenterLogo ?? false,
      });
      setSaveError(null);
      setSaveSuccess(false);
    }
  }, [isOpen, settings]);

  if (!isOpen) return null;

  const updateSetting = <K extends keyof CertificateLogoSettings>(
    key: K,
    value: CertificateLogoSettings[K]
  ) => {
    const updated = { ...localSettings, [key]: value };
    setLocalSettings(updated);
    onChange(updated);
  };

  // Preset Configurations matching authentic municipal certificates
  const applyPreset = (presetName: 'nava' | 'nueva_esperanza' | 'tuburan' | 'da_mao') => {
    let updated: CertificateLogoSettings = { ...localSettings };
    if (presetName === 'nava') {
      updated = {
        ...localSettings,
        leftLogoType: 'barangay',
        leftBarangayName: 'NAVA',
        leftLogoUrl: undefined,
        centerLogoType: 'municipality',
        centerLogoUrl: undefined,
        rightLogoType: 'bagong_pilipinas',
        rightLogoUrl: undefined,
        showWatermark: true,
        watermarkType: 'municipality',
        watermarkUrl: undefined,
        watermarkOpacity: 0.12,
        barangayEmail: 'nava.hinunangan20@gmail.com',
        barangayPhone: '09763070221',
        headerMotto: '',
        printLogoSize: 72,
        printShowWatermark: true,
        printWatermarkOpacity: 0.10,
        printHideCenterLogo: false,
      };
    } else if (presetName === 'nueva_esperanza') {
      updated = {
        ...localSettings,
        leftLogoType: 'barangay',
        leftBarangayName: 'NUEVA ESPERANZA',
        leftLogoUrl: undefined,
        centerLogoType: 'none',
        centerLogoUrl: undefined,
        rightLogoType: 'none',
        rightLogoUrl: undefined,
        showWatermark: true,
        watermarkType: 'municipality',
        watermarkUrl: undefined,
        watermarkOpacity: 0.15,
        barangayEmail: 'brgy.nuevaesperanza@hinunangan.gov.ph',
        barangayPhone: '(053) 578-2011',
        headerMotto: 'o0o\nOFFICE OF THE PUNONG BARANGAY',
        printLogoSize: 84,
        printShowWatermark: true,
        printWatermarkOpacity: 0.12,
        printHideCenterLogo: true,
      };
    } else if (presetName === 'tuburan') {
      updated = {
        ...localSettings,
        leftLogoType: 'barangay',
        leftBarangayName: 'TUBURAN',
        leftLogoUrl: undefined,
        centerLogoType: 'none',
        centerLogoUrl: undefined,
        rightLogoType: 'municipality',
        rightLogoUrl: undefined,
        showWatermark: false,
        watermarkType: 'municipality',
        watermarkUrl: undefined,
        watermarkOpacity: 0.10,
        barangayEmail: 'tuburan.hinunangan@gmail.com',
        barangayPhone: '0917-888-9999',
        headerMotto: 'OFFICE OF THE PUNONG BARANGAY',
        printLogoSize: 76,
        printShowWatermark: false,
        printWatermarkOpacity: 0.08,
        printHideCenterLogo: true,
      };
    } else if (presetName === 'da_mao') {
      updated = {
        ...localSettings,
        leftLogoType: 'da',
        leftBarangayName: 'POBLACION',
        leftLogoUrl: undefined,
        centerLogoType: 'municipality',
        centerLogoUrl: undefined,
        rightLogoType: 'bagong_pilipinas',
        rightLogoUrl: undefined,
        showWatermark: true,
        watermarkType: 'municipality',
        watermarkUrl: undefined,
        watermarkOpacity: 0.12,
        barangayEmail: 'agri.hinunangan@gmail.com',
        barangayPhone: '(053) 578-2011',
        headerMotto: 'OFFICE OF THE MUNICIPAL AGRICULTURAL SERVICES (OMAS)',
        printLogoSize: 72,
        printShowWatermark: true,
        printWatermarkOpacity: 0.09,
        printHideCenterLogo: false,
      };
    }
    setLocalSettings(updated);
    onChange(updated);
  };

  const handleFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    field: 'leftLogoUrl' | 'centerLogoUrl' | 'rightLogoUrl' | 'watermarkUrl'
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    let typeFieldKey: keyof CertificateLogoSettings | null = null;
    if (field === 'leftLogoUrl') typeFieldKey = 'leftLogoType';
    if (field === 'centerLogoUrl') typeFieldKey = 'centerLogoType';
    if (field === 'rightLogoUrl') typeFieldKey = 'rightLogoType';
    if (field === 'watermarkUrl') typeFieldKey = 'watermarkType';

    // 1. Instant local preview using FileReader Data URL (zero latency, offline-friendly)
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          if (typeof reader.result === 'string') resolve(reader.result);
          else reject(new Error('Failed to read image.'));
        };
        reader.onerror = () => reject(new Error('Failed to read image.'));
        reader.readAsDataURL(file);
      });

      const immediateUpdate = {
        ...localSettings,
        [field]: dataUrl,
        ...(typeFieldKey ? { [typeFieldKey]: 'custom' } : {}),
      };
      setLocalSettings(immediateUpdate);
      onChange(immediateUpdate);
    } catch {
      // Continue to try upload
    }

    // 2. Upload to server storage if reachable
    try {
      setUploadingField(field);
      const asset = await mediaApi.uploadCertificateAsset(file).catch(() => null);
      if (asset?.fileUrl) {
        const storagePathField = `${field.replace('Url', '')}StoragePath` as
          | 'leftLogoStoragePath'
          | 'centerLogoStoragePath'
          | 'rightLogoStoragePath'
          | 'watermarkStoragePath';

        const serverUpdate = {
          ...localSettings,
          [field]: asset.fileUrl,
          [storagePathField]: asset.filePath,
          ...(typeFieldKey ? { [typeFieldKey]: 'custom' } : {}),
        };
        setLocalSettings(serverUpdate);
        onChange(serverUpdate);
      }
    } catch {
      // In-memory data URL remains fully active and usable
    } finally {
      setUploadingField(null);
      e.target.value = '';
    }
  };

  const handleClearCustomLogo = (field: 'leftLogoUrl' | 'centerLogoUrl' | 'rightLogoUrl' | 'watermarkUrl') => {
    let typeFieldKey: keyof CertificateLogoSettings | null = null;
    let defaultType = 'da';
    if (field === 'leftLogoUrl') {
      typeFieldKey = 'leftLogoType';
      defaultType = 'barangay';
    } else if (field === 'centerLogoUrl') {
      typeFieldKey = 'centerLogoType';
      defaultType = 'municipality';
    } else if (field === 'rightLogoUrl') {
      typeFieldKey = 'rightLogoType';
      defaultType = 'bagong_pilipinas';
    } else if (field === 'watermarkUrl') {
      typeFieldKey = 'watermarkType';
      defaultType = 'municipality';
    }

    const updated = {
      ...localSettings,
      [field]: undefined,
      ...(typeFieldKey ? { [typeFieldKey]: defaultType } : {}),
    };
    setLocalSettings(updated);
    onChange(updated);
  };

  const handleSave = async () => {
    if (isSaving) return;
    setSaveError(null);
    if (onSave) {
      try {
        setIsSaving(true);
        await onSave(localSettings);
        setSaveSuccess(true);
        setTimeout(() => {
          setSaveSuccess(false);
          onClose();
        }, 500);
      } catch (err) {
        setSaveError(err instanceof Error ? err.message : 'Unable to save certificate logo settings.');
      } finally {
        setIsSaving(false);
      }
    } else {
      onChange(localSettings);
      onClose();
    }
  };

  const handleApplyPreviewOnly = () => {
    onChange(localSettings);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
      <div className="bg-white max-w-2xl w-full rounded-2xl p-6 shadow-2xl border border-stone-200 space-y-5 max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-stone-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900">
                Official Seals & Logo Customizer
              </h3>
              <p className="text-xs text-stone-500">
                Configure screen display, print seals, background watermarks, and header info
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-800 hover:bg-slate-100 cursor-pointer"
            title="Close without saving"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switching: General Setup vs Print Customizer */}
        <div className="flex rounded-xl bg-slate-100 p-1 border border-stone-200">
          <button
            type="button"
            onClick={() => setActiveTab('general')}
            className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'general'
                ? 'bg-white text-blue-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            Logos & Content
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('print')}
            className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'print'
                ? 'bg-white text-blue-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Printer className="w-3.5 h-3.5" />
            Print Calibration & Sizing
          </button>
        </div>

        {activeTab === 'general' ? (
          <>
            {/* Quick Municipal Certificate Presets */}
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-wider text-slate-500 block">
                ⚡ QUICK OFFICIAL PRESETS (FROM AUTHENTIC PHOTO FORMATS)
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <button
                  type="button"
                  onClick={() => applyPreset('nava')}
                  className="p-2.5 rounded-xl border border-blue-200 bg-blue-50/60 hover:bg-blue-100 text-left transition cursor-pointer flex flex-col items-center text-center"
                >
                  <div className="flex items-center gap-1 mb-1">
                    <SealBarangay barangayName="NAVA" className="w-5 h-5" />
                    <SealMunicipality className="w-5 h-5" />
                    <SealBagongPilipinas className="w-5 h-5" />
                  </div>
                  <span className="text-[11px] font-bold text-blue-900">Barangay Nava</span>
                  <span className="text-[9px] text-blue-600">3 Seals (Nava + Mun + BP)</span>
                </button>

                <button
                  type="button"
                  onClick={() => applyPreset('nueva_esperanza')}
                  className="p-2.5 rounded-xl border border-amber-200 bg-amber-50/60 hover:bg-amber-100 text-left transition cursor-pointer flex flex-col items-center text-center"
                >
                  <div className="flex items-center gap-1 mb-1">
                    <SealBarangay barangayName="NUEVA ESPERANZA" className="w-6 h-6" />
                  </div>
                  <span className="text-[11px] font-bold text-amber-900">Nueva Esperanza</span>
                  <span className="text-[9px] text-amber-700">1 Seal + Watermark</span>
                </button>

                <button
                  type="button"
                  onClick={() => applyPreset('tuburan')}
                  className="p-2.5 rounded-xl border border-emerald-200 bg-emerald-50/60 hover:bg-emerald-100 text-left transition cursor-pointer flex flex-col items-center text-center"
                >
                  <div className="flex items-center gap-1 mb-1">
                    <SealBarangay barangayName="TUBURAN" className="w-5 h-5" />
                    <SealMunicipality className="w-5 h-5" />
                  </div>
                  <span className="text-[11px] font-bold text-emerald-900">Barangay Tuburan</span>
                  <span className="text-[9px] text-emerald-700">Tuburan + Mun Seals</span>
                </button>

                <button
                  type="button"
                  onClick={() => applyPreset('da_mao')}
                  className="p-2.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-left transition cursor-pointer flex flex-col items-center text-center"
                >
                  <div className="flex items-center gap-1 mb-1">
                    <SealDA className="w-5 h-5" />
                    <SealMunicipality className="w-5 h-5" />
                  </div>
                  <span className="text-[11px] font-bold text-slate-900">MAO / DA Office</span>
                  <span className="text-[9px] text-slate-600">DA + Mun + BP</span>
                </button>
              </div>
            </div>

            {/* 1. Left Logo Settings */}
            <div className="bg-slate-50 p-3.5 rounded-xl border border-stone-200 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase text-slate-800">
                  1. Left Logo / Seal
                </span>
                <div className="w-9 h-9 rounded-full flex items-center justify-center bg-white shadow-2xs border border-stone-200 overflow-hidden shrink-0">
                  {localSettings.leftLogoType === 'custom' && localSettings.leftLogoUrl ? (
                    <img
                      src={localSettings.leftLogoUrl}
                      alt="Left Seal"
                      className="w-8 h-8 object-contain rounded-full"
                    />
                  ) : localSettings.leftLogoType === 'barangay' ? (
                    <SealBarangay
                      barangayName={localSettings.leftBarangayName}
                      className="w-8 h-8"
                      customUrl={localSettings.leftLogoUrl}
                    />
                  ) : localSettings.leftLogoType === 'da' ? (
                    <SealDA className="w-8 h-8" customUrl={localSettings.leftLogoUrl} />
                  ) : localSettings.leftLogoType === 'municipality' ? (
                    <SealMunicipality className="w-8 h-8" customUrl={localSettings.leftLogoUrl} />
                  ) : localSettings.leftLogoType === 'province' ? (
                    <SealProvince className="w-8 h-8" customUrl={localSettings.leftLogoUrl} />
                  ) : localSettings.leftLogoType === 'bagong_pilipinas' ? (
                    <SealBagongPilipinas className="w-8 h-8" customUrl={localSettings.leftLogoUrl} />
                  ) : localSettings.leftLogoUrl ? (
                    <img
                      src={localSettings.leftLogoUrl}
                      alt="Left Seal"
                      className="w-8 h-8 object-contain rounded-full"
                    />
                  ) : (
                    <span className="text-[10px] font-bold text-slate-400">None</span>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 mb-1">Seal Type</label>
                  <select
                    value={localSettings.leftLogoType}
                    onChange={e => updateSetting('leftLogoType', e.target.value)}
                    className="w-full bg-white border border-stone-300 rounded-lg p-2 font-semibold text-slate-800"
                  >
                    <option value="barangay">Barangay Official Seal (Customizable)</option>
                    <option value="da">Department of Agriculture (DA)</option>
                    <option value="municipality">Municipality of Hinunangan</option>
                    <option value="province">Province of Southern Leyte</option>
                    <option value="bagong_pilipinas">Bagong Pilipinas</option>
                    <option value="custom">Custom Uploaded Image</option>
                    <option value="none">None / Hidden</option>
                  </select>
                </div>

                {localSettings.leftLogoType === 'barangay' && (
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 mb-1">
                      Select Barangay
                    </label>
                    <select
                      value={localSettings.leftBarangayName}
                      onChange={e => updateSetting('leftBarangayName', e.target.value)}
                      className="w-full bg-white border border-stone-300 rounded-lg p-2 font-bold text-slate-800"
                    >
                      {HINUNANGAN_BARANGAYS.map(b => (
                        <option key={b.name} value={b.name}>
                          Barangay {b.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Custom Image Controls */}
              <div className="space-y-1.5 pt-1 border-t border-stone-200">
                <label className="block text-[10px] font-bold text-slate-600">
                  Custom Left Seal Image (File Upload or URL)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={localSettings.leftLogoUrl || ''}
                    onChange={e => {
                      const url = e.target.value;
                      const updated = {
                        ...localSettings,
                        leftLogoUrl: url || undefined,
                        leftLogoType: url ? 'custom' : localSettings.leftLogoType,
                      };
                      setLocalSettings(updated);
                      onChange(updated);
                    }}
                    placeholder="/icon.svg or https://..."
                    className="flex-1 px-2.5 py-1.5 bg-white border border-stone-300 rounded-lg text-xs font-mono text-slate-800"
                  />
                  <label className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold rounded-lg text-xs flex items-center gap-1 cursor-pointer transition border border-blue-200 shrink-0">
                    <Upload className="w-3.5 h-3.5" />
                    <span>{uploadingField === 'leftLogoUrl' ? 'Reading…' : 'Upload File'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={e => handleFileUpload(e, 'leftLogoUrl')}
                      disabled={uploadingField === 'leftLogoUrl'}
                      className="hidden"
                    />
                  </label>
                  {localSettings.leftLogoUrl && (
                    <button
                      type="button"
                      onClick={() => handleClearCustomLogo('leftLogoUrl')}
                      className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg border border-rose-200 cursor-pointer"
                      title="Clear custom logo"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* 2. Center Logo Settings */}
            <div className="bg-slate-50 p-3.5 rounded-xl border border-stone-200 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase text-slate-800">
                  2. Center Logo / Seal
                </span>
                <div className="w-9 h-9 rounded-full flex items-center justify-center bg-white shadow-2xs border border-stone-200 overflow-hidden shrink-0">
                  {localSettings.centerLogoType === 'custom' && localSettings.centerLogoUrl ? (
                    <img
                      src={localSettings.centerLogoUrl}
                      alt="Center Seal"
                      className="w-8 h-8 object-contain rounded-full"
                    />
                  ) : localSettings.centerLogoType === 'municipality' ? (
                    <SealMunicipality className="w-8 h-8" customUrl={localSettings.centerLogoUrl} />
                  ) : localSettings.centerLogoType === 'da' ? (
                    <SealDA className="w-8 h-8" customUrl={localSettings.centerLogoUrl} />
                  ) : localSettings.centerLogoType === 'bagong_pilipinas' ? (
                    <SealBagongPilipinas className="w-8 h-8" customUrl={localSettings.centerLogoUrl} />
                  ) : localSettings.centerLogoType === 'province' ? (
                    <SealProvince className="w-8 h-8" customUrl={localSettings.centerLogoUrl} />
                  ) : localSettings.centerLogoType === 'barangay' ? (
                    <SealBarangay
                      barangayName={localSettings.leftBarangayName}
                      className="w-8 h-8"
                      customUrl={localSettings.centerLogoUrl}
                    />
                  ) : localSettings.centerLogoUrl ? (
                    <img
                      src={localSettings.centerLogoUrl}
                      alt="Center Seal"
                      className="w-8 h-8 object-contain rounded-full"
                    />
                  ) : (
                    <span className="text-[10px] font-bold text-slate-400">None</span>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 mb-1">Seal Type</label>
                  <select
                    value={localSettings.centerLogoType}
                    onChange={e => updateSetting('centerLogoType', e.target.value)}
                    className="w-full bg-white border border-stone-300 rounded-lg p-2 font-semibold text-slate-800"
                  >
                    <option value="municipality">Municipality of Hinunangan</option>
                    <option value="da">Department of Agriculture (DA)</option>
                    <option value="bagong_pilipinas">Bagong Pilipinas</option>
                    <option value="province">Province of Southern Leyte</option>
                    <option value="barangay">Barangay Official Seal</option>
                    <option value="custom">Custom Uploaded Image</option>
                    <option value="none">None / Hidden</option>
                  </select>
                </div>
              </div>

              {/* Custom Image Controls */}
              <div className="space-y-1.5 pt-1 border-t border-stone-200">
                <label className="block text-[10px] font-bold text-slate-600">
                  Custom Center Seal Image (File Upload or URL)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={localSettings.centerLogoUrl || ''}
                    onChange={e => {
                      const url = e.target.value;
                      const updated = {
                        ...localSettings,
                        centerLogoUrl: url || undefined,
                        centerLogoType: url ? 'custom' : localSettings.centerLogoType,
                      };
                      setLocalSettings(updated);
                      onChange(updated);
                    }}
                    placeholder="/icon.svg or https://..."
                    className="flex-1 px-2.5 py-1.5 bg-white border border-stone-300 rounded-lg text-xs font-mono text-slate-800"
                  />
                  <label className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold rounded-lg text-xs flex items-center gap-1 cursor-pointer transition border border-blue-200 shrink-0">
                    <Upload className="w-3.5 h-3.5" />
                    <span>{uploadingField === 'centerLogoUrl' ? 'Reading…' : 'Upload File'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={e => handleFileUpload(e, 'centerLogoUrl')}
                      disabled={uploadingField === 'centerLogoUrl'}
                      className="hidden"
                    />
                  </label>
                  {localSettings.centerLogoUrl && (
                    <button
                      type="button"
                      onClick={() => handleClearCustomLogo('centerLogoUrl')}
                      className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg border border-rose-200 cursor-pointer"
                      title="Clear custom logo"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* 3. Right Logo Settings */}
            <div className="bg-slate-50 p-3.5 rounded-xl border border-stone-200 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase text-slate-800">
                  3. Right Logo / Seal
                </span>
                <div className="w-9 h-9 rounded-full flex items-center justify-center bg-white shadow-2xs border border-stone-200 overflow-hidden shrink-0">
                  {localSettings.rightLogoType === 'custom' && localSettings.rightLogoUrl ? (
                    <img
                      src={localSettings.rightLogoUrl}
                      alt="Right Seal"
                      className="w-8 h-8 object-contain rounded-full"
                    />
                  ) : localSettings.rightLogoType === 'bagong_pilipinas' ? (
                    <SealBagongPilipinas
                      className="w-8 h-8"
                      customUrl={localSettings.rightLogoUrl}
                    />
                  ) : localSettings.rightLogoType === 'municipality' ? (
                    <SealMunicipality className="w-8 h-8" customUrl={localSettings.rightLogoUrl} />
                  ) : localSettings.rightLogoType === 'province' ? (
                    <SealProvince className="w-8 h-8" customUrl={localSettings.rightLogoUrl} />
                  ) : localSettings.rightLogoType === 'da' ? (
                    <SealDA className="w-8 h-8" customUrl={localSettings.rightLogoUrl} />
                  ) : localSettings.rightLogoType === 'barangay' ? (
                    <SealBarangay
                      barangayName={localSettings.leftBarangayName}
                      className="w-8 h-8"
                      customUrl={localSettings.rightLogoUrl}
                    />
                  ) : localSettings.rightLogoUrl ? (
                    <img
                      src={localSettings.rightLogoUrl}
                      alt="Right Seal"
                      className="w-8 h-8 object-contain rounded-full"
                    />
                  ) : (
                    <span className="text-[10px] font-bold text-slate-400">None</span>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 mb-1">Seal Type</label>
                  <select
                    value={localSettings.rightLogoType}
                    onChange={e => updateSetting('rightLogoType', e.target.value)}
                    className="w-full bg-white border border-stone-300 rounded-lg p-2 font-semibold text-slate-800"
                  >
                    <option value="bagong_pilipinas">Bagong Pilipinas</option>
                    <option value="municipality">Municipality of Hinunangan</option>
                    <option value="province">Province of Southern Leyte</option>
                    <option value="da">Department of Agriculture (DA)</option>
                    <option value="barangay">Barangay Official Seal</option>
                    <option value="custom">Custom Uploaded Image</option>
                    <option value="none">None / Hidden</option>
                  </select>
                </div>
              </div>

              {/* Custom Image Controls */}
              <div className="space-y-1.5 pt-1 border-t border-stone-200">
                <label className="block text-[10px] font-bold text-slate-600">
                  Custom Right Seal Image (File Upload or URL)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={localSettings.rightLogoUrl || ''}
                    onChange={e => {
                      const url = e.target.value;
                      const updated = {
                        ...localSettings,
                        rightLogoUrl: url || undefined,
                        rightLogoType: url ? 'custom' : localSettings.rightLogoType,
                      };
                      setLocalSettings(updated);
                      onChange(updated);
                    }}
                    placeholder="/icon.svg or https://..."
                    className="flex-1 px-2.5 py-1.5 bg-white border border-stone-300 rounded-lg text-xs font-mono text-slate-800"
                  />
                  <label className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold rounded-lg text-xs flex items-center gap-1 cursor-pointer transition border border-blue-200 shrink-0">
                    <Upload className="w-3.5 h-3.5" />
                    <span>{uploadingField === 'rightLogoUrl' ? 'Reading…' : 'Upload File'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={e => handleFileUpload(e, 'rightLogoUrl')}
                      disabled={uploadingField === 'rightLogoUrl'}
                      className="hidden"
                    />
                  </label>
                  {localSettings.rightLogoUrl && (
                    <button
                      type="button"
                      onClick={() => handleClearCustomLogo('rightLogoUrl')}
                      className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg border border-rose-200 cursor-pointer"
                      title="Clear custom logo"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* 4. Background Watermark */}
            <div className="bg-slate-50 p-3.5 rounded-xl border border-stone-200 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase text-slate-800">
                  4. Background Watermark Seal
                </span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={localSettings.showWatermark}
                    onChange={e => updateSetting('showWatermark', e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>

              {localSettings.showWatermark && (
                <div className="space-y-3 text-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 mb-1">
                        Watermark Opacity: {Math.round(localSettings.watermarkOpacity * 100)}%
                      </label>
                      <input
                        type="range"
                        min="0.05"
                        max="0.30"
                        step="0.01"
                        value={localSettings.watermarkOpacity}
                        onChange={e => updateSetting('watermarkOpacity', parseFloat(e.target.value))}
                        className="w-full accent-blue-600 cursor-pointer"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 mb-1">
                        Watermark Insignia
                      </label>
                      <select
                        value={localSettings.watermarkType}
                        onChange={e => updateSetting('watermarkType', e.target.value)}
                        className="w-full bg-white border border-stone-300 rounded-lg p-2 font-semibold text-slate-800"
                      >
                        <option value="municipality">Municipality of Hinunangan</option>
                        <option value="da">Department of Agriculture (DA)</option>
                        <option value="barangay">Barangay Seal</option>
                        <option value="province">Province of Southern Leyte</option>
                        <option value="bagong_pilipinas">Bagong Pilipinas</option>
                        <option value="custom">Custom Uploaded Image</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 mb-1">
                      Custom Watermark Image (File Upload or URL)
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={localSettings.watermarkUrl || ''}
                        onChange={e => {
                          const url = e.target.value;
                          const updated = {
                            ...localSettings,
                            watermarkUrl: url || undefined,
                            watermarkType: url ? 'custom' : localSettings.watermarkType,
                          };
                          setLocalSettings(updated);
                          onChange(updated);
                        }}
                        placeholder="/icon.svg or https://..."
                        className="flex-1 px-2.5 py-1.5 bg-white border border-stone-300 rounded-lg text-xs font-mono text-slate-800"
                      />
                      <label className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold rounded-lg text-xs flex items-center gap-1 cursor-pointer transition border border-blue-200 shrink-0">
                        <Upload className="w-3.5 h-3.5" />
                        <span>{uploadingField === 'watermarkUrl' ? 'Reading…' : 'Upload File'}</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={e => handleFileUpload(e, 'watermarkUrl')}
                          disabled={uploadingField === 'watermarkUrl'}
                          className="hidden"
                        />
                      </label>
                      {localSettings.watermarkUrl && (
                        <button
                          type="button"
                          onClick={() => handleClearCustomLogo('watermarkUrl')}
                          className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg border border-rose-200 cursor-pointer"
                          title="Clear custom watermark"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* 5. Contact Info in Header */}
            <div className="bg-slate-50 p-3.5 rounded-xl border border-stone-200 space-y-3">
              <span className="text-xs font-black uppercase text-slate-800">
                5. Header Contact Details (e.g. Nava Style)
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 mb-1">
                    📧 Barangay Email
                  </label>
                  <input
                    type="email"
                    value={localSettings.barangayEmail || ''}
                    onChange={e => updateSetting('barangayEmail', e.target.value)}
                    placeholder="e.g. nava.hinunangan20@gmail.com"
                    className="w-full bg-white border border-stone-300 rounded-lg p-2 font-bold text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 mb-1">
                    📞 Barangay Phone / Mobile
                  </label>
                  <input
                    type="text"
                    value={localSettings.barangayPhone || ''}
                    onChange={e => updateSetting('barangayPhone', e.target.value)}
                    placeholder="e.g. 09763070221"
                    className="w-full bg-white border border-stone-300 rounded-lg p-2 font-bold text-slate-800"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-600 mb-1">
                  Header Motto / Subtitle (Optional)
                </label>
                <textarea
                  rows={2}
                  value={localSettings.headerMotto || ''}
                  onChange={e => updateSetting('headerMotto', e.target.value)}
                  placeholder="e.g. OFFICE OF THE PUNONG BARANGAY"
                  className="w-full bg-white border border-stone-300 rounded-lg p-2 text-xs font-medium text-slate-800"
                />
              </div>
            </div>
          </>
        ) : (
          /* Print Calibration Tab */
          <div className="space-y-4">
            <div className="bg-blue-50/70 border border-blue-200 rounded-xl p-3 text-xs text-blue-900 leading-relaxed">
              <strong>Print Calibration Mode:</strong> Adjust the physical scale and ink distribution of the seals when sending certificates to thermal, inkjet, or laser printers.
            </div>

            {/* Print Logo Size */}
            <div className="bg-slate-50 p-3.5 rounded-xl border border-stone-200 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-black uppercase text-slate-800">
                    Printed Seal Dimensions
                  </span>
                  <p className="text-[11px] text-slate-500">
                    Current Print Target: {localSettings.printLogoSize || 72}px
                  </p>
                </div>
                <div
                  style={{ width: `${(localSettings.printLogoSize || 72) / 2}px`, height: `${(localSettings.printLogoSize || 72) / 2}px` }}
                  className="rounded-full bg-blue-100 border border-blue-300 flex items-center justify-center transition-all shrink-0"
                >
                  <Printer className="w-3.5 h-3.5 text-blue-600" />
                </div>
              </div>
              <input
                type="range"
                min="48"
                max="120"
                step="4"
                value={localSettings.printLogoSize || 72}
                onChange={e => updateSetting('printLogoSize', parseInt(e.target.value, 10))}
                className="w-full accent-blue-600 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-400 font-semibold">
                <span>Compact (48px)</span>
                <span>Standard Official (72px)</span>
                <span>Large Seal (120px)</span>
              </div>
            </div>

            {/* Print Watermark Controls */}
            <div className="bg-slate-50 p-3.5 rounded-xl border border-stone-200 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-black uppercase text-slate-800">
                    Include Watermark on Print
                  </span>
                  <p className="text-[11px] text-slate-500">
                    Control background seal ink to prevent obscuring text on printed paper
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={localSettings.printShowWatermark ?? true}
                    onChange={e => updateSetting('printShowWatermark', e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>

              {localSettings.printShowWatermark && (
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 mb-1">
                    Printer Watermark Density: {Math.round((localSettings.printWatermarkOpacity ?? 0.10) * 100)}%
                  </label>
                  <input
                    type="range"
                    min="0.03"
                    max="0.25"
                    step="0.01"
                    value={localSettings.printWatermarkOpacity ?? 0.10}
                    onChange={e => updateSetting('printWatermarkOpacity', parseFloat(e.target.value))}
                    className="w-full accent-blue-600 cursor-pointer"
                  />
                  <span className="text-[10px] text-slate-400">
                    Recommended 8%–12% for crisp black-text legibility
                  </span>
                </div>
              )}
            </div>

            {/* Print Layout Toggles */}
            <div className="bg-slate-50 p-3.5 rounded-xl border border-stone-200 space-y-3">
              <span className="text-xs font-black uppercase text-slate-800">
                Print Output Adjustments
              </span>

              <div className="flex items-center justify-between py-1">
                <div>
                  <span className="text-xs font-bold text-slate-800">Black & White Print Optimization</span>
                  <p className="text-[10px] text-slate-500">Render all logos in high-contrast monochrome</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={localSettings.printGrayscale ?? false}
                    onChange={e => updateSetting('printGrayscale', e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>

              <div className="flex items-center justify-between py-1 border-t border-stone-200">
                <div>
                  <span className="text-xs font-bold text-slate-800">Hide Center Logo on Print</span>
                  <p className="text-[10px] text-slate-500">Leave space for traditional 2-seal (Left / Right) certificates</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={localSettings.printHideCenterLogo ?? false}
                    onChange={e => updateSetting('printHideCenterLogo', e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>
            </div>
          </div>
        )}

        {saveError && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{saveError}</span>
          </div>
        )}

        {saveSuccess && (
          <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Logo settings saved successfully!</span>
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex flex-wrap justify-between items-center gap-2 pt-3 border-t border-stone-100">
          <div className="text-[11px] text-stone-500 flex items-center gap-1">
            <Check className="w-3.5 h-3.5 text-emerald-600" />
            Preview updates live
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="px-4 py-2 rounded-xl border border-stone-300 text-stone-700 hover:bg-stone-100 font-bold cursor-pointer text-xs transition disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleApplyPreviewOnly}
              disabled={isSaving}
              className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold cursor-pointer text-xs transition border border-stone-300 disabled:opacity-50"
            >
              Apply to Preview
            </button>
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={isSaving}
              className="px-5 py-2 rounded-xl bg-blue-700 hover:bg-blue-800 text-white font-bold cursor-pointer text-xs shadow-sm transition flex items-center gap-1.5 disabled:cursor-wait disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Saving…</span>
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  <span>Save Logos</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
