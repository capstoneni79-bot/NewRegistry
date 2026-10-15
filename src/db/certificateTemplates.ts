import { pool } from './index.ts';
import { CertificateTemplate } from '../types.ts';
import type { PoolClient } from 'pg';

interface CertificateTemplateRow {
  code: string;
  name: string;
  template_body: string;
  template_data: unknown;
  is_active: boolean;
  updated_at: Date | string | null;
  created_at: Date | string | null;
  barangay_id: string | null;
  barangay_name: string | null;
  css_styles: unknown;
  legacy_signatories: unknown;
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function dateValue(value: Date | string | null, fallback: string): string {
  if (!value) return fallback;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? fallback : date.toISOString();
}

function mapLegacySignatories(value: unknown): CertificateTemplate['signatories'] {
  if (!Array.isArray(value)) return [];
  return value.map((item, index) => {
    const signatory = objectValue(item);
    return {
      id: String(signatory.id || `legacy-signatory-${index + 1}`),
      name: String(signatory.name || ''),
      position: String(signatory.position || ''),
      signatureImageUrl: typeof signatory.signatureImageUrl === 'string' ? signatory.signatureImageUrl : undefined,
      showSignatureImage: Boolean(signatory.signatureImageUrl),
      showSignatureLine: true,
      order: Number(signatory.order) || index + 1,
    };
  });
}

const mapTemplate = (row: CertificateTemplateRow): CertificateTemplate => {
  const parsedValue: unknown = typeof row.template_data === 'string'
    ? JSON.parse(row.template_data)
    : row.template_data;
  if (parsedValue !== null && (typeof parsedValue !== 'object' || Array.isArray(parsedValue))) {
    throw new Error(`Saved certificate template "${row.code}" has invalid configuration data.`);
  }
  const templateData = objectValue(parsedValue);
  const cssStyles = objectValue(row.css_styles);
  const createdAt = dateValue(row.created_at, new Date(0).toISOString());
  const updatedAt = dateValue(row.updated_at, createdAt);
  const barangay = row.barangay_id
    ? row.barangay_name || (typeof templateData.barangay === 'string' ? templateData.barangay : '')
    : typeof templateData.barangay === 'string' && templateData.barangay
      ? templateData.barangay
      : 'All';
  const header = objectValue(templateData.header);
  const watermark = objectValue(templateData.watermark);
  const receipt = objectValue(templateData.receipt);
  const legacySignatories = mapLegacySignatories(row.legacy_signatories);

  if (typeof row.template_body !== 'string' || !row.template_body.trim()) {
    throw new Error(`Saved certificate template "${row.code}" has no certificate body.`);
  }

  return {
    ...templateData,
    id: row.code,
    name: row.name,
    barangay,
    barangayId: row.barangay_id || undefined,
    bodyTemplate: row.template_body,
    documentType: typeof templateData.documentType === 'string'
      ? templateData.documentType
      : typeof cssStyles.documentType === 'string' ? cssStyles.documentType : '',
    documentTitle: typeof templateData.documentTitle === 'string' && templateData.documentTitle
      ? templateData.documentTitle
      : row.name,
    titleFont: templateData.titleFont === 'gothic' || templateData.titleFont === 'serif_underline' ||
      templateData.titleFont === 'sans_bold' ? templateData.titleFont : 'serif_bold',
    language: templateData.language === 'bisaya' || templateData.language === 'filipino' ||
      templateData.language === 'custom' ? templateData.language : 'english',
    pageSize: templateData.pageSize === 'A4' || templateData.pageSize === 'Letter' ? templateData.pageSize : 'Folio',
    orientation: templateData.orientation === 'landscape' ? 'landscape' : 'portrait',
    header: {
      countryText: typeof header.countryText === 'string' ? header.countryText : 'Republic of the Philippines',
      provinceText: typeof header.provinceText === 'string' ? header.provinceText : 'Province of Southern Leyte',
      municipalityText: typeof header.municipalityText === 'string' ? header.municipalityText : 'Municipality of Hinunangan',
      barangayText: typeof header.barangayText === 'string' ? header.barangayText : (barangay === 'All' ? '' : `Barangay ${barangay}`),
      ...header,
    },
    logos: Array.isArray(templateData.logos) ? templateData.logos : [],
    watermark: {
      enabled: false,
      type: 'municipality',
      opacity: 0.12,
      position: 'center',
      size: 'large',
      ...watermark,
    } as CertificateTemplate['watermark'],
    signatories: Array.isArray(templateData.signatories) ? templateData.signatories : legacySignatories,
    receipt: {
      showReceiptBox: false,
      ...receipt,
    } as CertificateTemplate['receipt'],
    isActive: row.is_active,
    createdAt,
    updatedAt,
  } as CertificateTemplate;
};

async function readStoredTemplates(client: PoolClient): Promise<CertificateTemplate[]> {
  const result = await client.query<CertificateTemplateRow>(
    `SELECT ct.code, ct.name, ct.template_body, ct.template_data, ct.css_styles,
            ct.is_active, ct.created_at, ct.updated_at, ct.barangay_id,
            b.name AS barangay_name,
            COALESCE((
              SELECT jsonb_agg(jsonb_build_object(
                'id', s.id,
                'name', s.full_name,
                'position', COALESCE(s.position_title, ''),
                'signatureImageUrl', s.signature_image_url,
                'order', cs.display_order
              ) ORDER BY cs.display_order)
              FROM public.certificate_signatories cs
              JOIN public.signatories s ON s.id = cs.signatory_id
              WHERE cs.template_id = ct.id AND s.is_active = TRUE
            ), '[]'::jsonb) AS legacy_signatories
     FROM public.certificate_templates ct
     LEFT JOIN public.barangays b ON b.id = ct.barangay_id
     WHERE ct.is_archived = FALSE
     ORDER BY ct.name`
  );
  return result.rows.map(mapTemplate);
}

export async function getCertificateTemplates(): Promise<CertificateTemplate[]> {
  const client = await pool.connect();
  try {
    const storedTemplates = await readStoredTemplates(client);
    if (storedTemplates.length > 0) return storedTemplates;

    const legacy = await client.query(
      "SELECT value FROM public.system_settings WHERE key = 'certificate_templates' LIMIT 1"
    );
    const legacyData = legacy.rows[0]?.value;
    const legacyTemplates = Array.isArray(legacyData)
      ? legacyData
      : typeof legacyData === 'string'
        ? JSON.parse(legacyData)
        : [];
    
    const templatesToSeed = legacyTemplates.length > 0 ? legacyTemplates : [
      {
        id: 'tpl-nava-official',
        name: 'Barangay Nava Official Format (English • 3 Logos)',
        barangay: 'Nava',
        documentType: 'Barangay Certification',
        documentTitle: 'Barangay Certification',
        titleFont: 'gothic',
        language: 'english',
        pageSize: 'Folio',
        orientation: 'portrait',
        header: {
          countryText: 'Republic of the Philippines',
          provinceText: 'PROVINCE OF SOUTHERN LEYTE',
          municipalityText: 'Municipality of Hinunangan',
          barangayText: 'BARANGAY NAVA',
          contactEmail: 'nava.hinunangan20@gmail.com',
          contactPhone: '09763070221',
          borderStyle: 'single',
        },
        logos: [
          {
            id: 'logo-nava-1',
            type: 'barangay',
            position: 'left',
            barangayName: 'NAVA',
            widthPx: 72,
            heightPx: 72,
            order: 1,
            visible: true,
          },
          {
            id: 'logo-nava-2',
            type: 'municipality',
            position: 'center',
            widthPx: 64,
            heightPx: 64,
            order: 2,
            visible: true,
          },
          {
            id: 'logo-nava-3',
            type: 'bagong_pilipinas',
            position: 'right',
            widthPx: 64,
            heightPx: 64,
            order: 3,
            visible: true,
          },
        ],
        watermark: {
          enabled: true,
          type: 'municipality',
          opacity: 0.12,
          position: 'center',
          size: 'large',
        },
        bodyTemplate: `TO WHOM IT MAY CONCERN:

This is to certify that {{resident_name}} is a bonifide resident of Barangay {{barangay}}, Hinunangan, Southern Leyte.

This certifies further that {{resident_name}} owned {{number_of_pigs}} heads pigs sold to {{buyer_name}} of {{destination}}. {{price_per_kilo}}

THIS CERTIFICATION is being issued upon the request of the below-named for whatever any legal purpose it may serve best.

Issued this {{date_issued}} at Barangay {{barangay}}, Hinunangan, Southern Leyte, Philippines.`,
        signatories: [
          {
            id: 'sig-nava-1',
            name: 'HON. VICENTE T. MADRONERO JR.',
            position: 'Punong Barangay',
            showSignatureImage: false,
            order: 1,
            alignment: 'center',
            section: 'left',
          },
          {
            id: 'sig-nava-2',
            name: 'RANDY N. BURLAZA, BBO',
            position: 'BBO',
            showSignatureImage: false,
            order: 2,
            alignment: 'center',
            section: 'middle',
          },
          {
            id: 'sig-nava-3',
            name: '{{resident_name}}',
            position: 'FARMER/OWNER',
            showSignatureImage: false,
            order: 3,
            alignment: 'center',
            section: 'right',
          },
        ],
        receipt: {
          showReceiptBox: true,
          formatStyle: 'nava',
          orNumber: '1675127',
          amountPaid: '100.00',
        },
        isActive: true,
        isDefaultPreset: true,
        createdAt: '2026-09-01T00:00:00.000Z',
        updatedAt: '2026-09-22T00:00:00.000Z',
      }
    ];

    await client.query('BEGIN');
    for (const template of templatesToSeed) {
      await upsertTemplate(client, {
        ...template,
        documentType: typeof template.documentType === 'string' && template.documentType.trim()
          ? template.documentType
          : 'Barangay Certification',
      }, { role: 'super_admin', assignedBarangay: '', isAdmin: true });
    }
    await client.query("DELETE FROM public.system_settings WHERE key = 'certificate_templates'");
    const migratedTemplates = await readStoredTemplates(client);
    await client.query('COMMIT');
    return migratedTemplates;
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch { /* transaction may not have started */ }
    throw error;
  } finally {
    client.release();
  }
}

export interface CertificateTemplateWriteScope {
  role: string;
  assignedBarangay: string;
  isAdmin: boolean;
}

async function upsertTemplate(
  client: PoolClient,
  template: CertificateTemplate,
  scope: CertificateTemplateWriteScope,
): Promise<CertificateTemplate> {
  if (!template || typeof template !== 'object' || Array.isArray(template)) {
    const err = new Error('A valid certificate template object is required.');
    (err as any).code = '400';
    throw err;
  }
  const templateName = template.name || (template as any).templateName;
  if (!templateName || typeof templateName !== 'string' || !templateName.trim()) {
    const err = new Error('Certificate template requires a valid templateName (or name).');
    (err as any).code = '400';
    throw err;
  }
  const htmlContent = template.bodyTemplate || (template as any).htmlContent;
  if (!htmlContent || typeof htmlContent !== 'string' || !htmlContent.trim()) {
    const err = new Error('Certificate template requires valid htmlContent (or bodyTemplate).');
    (err as any).code = '400';
    throw err;
  }
  const documentType = template.documentType || (template as any).type || 'barangay_certification';
  const signatories = Array.isArray(template.signatories) ? template.signatories : [];
  const templateId = template.id || (template as any).code || `cert-tpl-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

  const validatedTemplate = {
    ...template,
    id: templateId,
    name: templateName.trim(),
    bodyTemplate: htmlContent.trim(),
    documentType,
    signatories,
  };

  const snapshot = { ...validatedTemplate, updatedAt: new Date().toISOString() };
  const barangayName = typeof validatedTemplate.barangay === 'string' ? validatedTemplate.barangay.trim() : '';
  const barangayResult = barangayName && barangayName.toLowerCase() !== 'all'
    ? await client.query(
        'SELECT id FROM public.barangays WHERE lower(name) = lower($1) LIMIT 1',
        [barangayName]
      )
    : null;
  const barangayId = !barangayName
    ? validatedTemplate.barangayId || null
    : barangayName.toLowerCase() === 'all'
      ? null
      : barangayResult?.rows[0]?.id || validatedTemplate.barangayId || null;
  const logoSettings = objectValue(validatedTemplate.logoSettings);
  const assetPaths = [
    ...(Array.isArray(validatedTemplate.logos) ? validatedTemplate.logos.map(logo => logo.storagePath || (logo as any).url) : []),
    validatedTemplate.watermark?.storagePath || (validatedTemplate.watermark as any)?.url,
    ...(Array.isArray(validatedTemplate.signatories) ? validatedTemplate.signatories.map(signatory => signatory.signatureStoragePath || (signatory as any).signatureUrl) : []),
    logoSettings.leftLogoStoragePath,
    logoSettings.centerLogoStoragePath,
    logoSettings.rightLogoStoragePath,
    logoSettings.watermarkStoragePath,
  ].filter((path): path is string => typeof path === 'string' && path.length > 0);
  for (const path of assetPaths) {
    if (path.includes('..') || path.includes('\0')) {
      throw new Error('A certificate image path cannot contain directory traversal characters.');
    }
  }
  const existing = await client.query<{ barangay_id: string | null; updated_at: Date | string | null }>(
    'SELECT barangay_id, updated_at FROM public.certificate_templates WHERE code = $1 FOR UPDATE',
    [validatedTemplate.id]
  );
  if (!scope.isAdmin && existing.rows.length > 0 && existing.rows[0].barangay_id !== barangayId) {
    throw new Error('Focal Persons cannot modify a shared template or a template belonging to another barangay.');
  }
  await client.query(
    `INSERT INTO public.certificate_templates
      (barangay_id, code, name, template_body, template_data, is_active, is_archived, updated_at)
     VALUES ($1, $2, $3, $4, $5::jsonb, $6, FALSE, NOW())
     ON CONFLICT (code) DO UPDATE SET
       barangay_id = EXCLUDED.barangay_id,
       name = EXCLUDED.name,
       template_body = EXCLUDED.template_body,
       template_data = EXCLUDED.template_data,
       is_active = EXCLUDED.is_active,
       is_archived = FALSE,
       updated_at = NOW()`,
    [barangayId, validatedTemplate.id, validatedTemplate.name, validatedTemplate.bodyTemplate, JSON.stringify(snapshot), validatedTemplate.isActive !== false]
  );
  const saved = (await readStoredTemplates(client)).find(item => item.id === validatedTemplate.id);
  if (!saved) throw new Error('Database did not return the saved certificate template.');
  return saved;
}

export async function saveCertificateTemplate(
  template: CertificateTemplate,
  scope: CertificateTemplateWriteScope,
): Promise<CertificateTemplate> {
  if (!template || typeof template !== 'object' || Array.isArray(template)) {
    throw new Error('A certificate template is required.');
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const savedTemplate = await upsertTemplate(client, template, scope);
    await client.query('COMMIT');
    return savedTemplate;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
