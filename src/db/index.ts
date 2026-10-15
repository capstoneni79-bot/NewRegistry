import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool, PoolConfig } from 'pg';
import { newDb } from 'pg-mem';
import crypto from 'node:crypto';
import * as schema from './schema.ts';
import { INITIAL_REGISTRY_FORM_SCHEMA } from '../data/initialFormSchema.ts';
import { HINUNANGAN_BARANGAYS } from '../data/barangays.ts';
import { toFieldKey } from '../utils/registryFieldUtils.ts';

declare global {
  var _postgresPool: any | undefined;
  var _isPgMem: boolean | undefined;
}

/**
 * Creates the application's database connection pool.
 *
 * PRODUCTION:
 *   DATABASE_URL is used when provided.
 *
 * DEVELOPMENT / TESTING:
 *   DATABASE_URL is used when provided; otherwise falls back to in-memory pg-mem database.
 */
export const createPool = () => {
  // Reuse an existing pool.
  if (global._postgresPool) {
    return global._postgresPool;
  }

  const databaseUrl = process.env.DATABASE_URL?.trim();

  // If DATABASE_URL is set, connect to PostgreSQL
  if (databaseUrl) {
    const isRemote =
      databaseUrl.includes('supabase') ||
      databaseUrl.includes('sslmode=require') ||
      process.env.NODE_ENV === 'production';

    const poolConfig: PoolConfig = {
      connectionString: databaseUrl,
      ssl: isRemote
        ? {
            rejectUnauthorized: false,
          }
        : undefined,
      max: process.env.NODE_ENV === 'production' ? 2 : 5,
      connectionTimeoutMillis: 15000,
      idleTimeoutMillis: 30000,
      keepAlive: true,
      keepAliveInitialDelayMillis: 10000,
    };

    global._postgresPool = new Pool(poolConfig);
    global._isPgMem = false;

    global._postgresPool.on('error', (err: any) => {
      // Suppress or gracefully log idle client connection termination from Supabase
      if (err?.code === 'ECONNRESET' || err?.message?.includes('Connection terminated unexpectedly')) {
        console.warn('⚠️ PostgreSQL idle connection terminated by server/network (will reconnect automatically on next query)');
      } else {
        console.warn('PostgreSQL pool error:', err?.message || err);
      }
    });

    return global._postgresPool;
  }

  // Development / sandbox fallback when DATABASE_URL is not configured
  console.log('ℹ️ DATABASE_URL not set — initializing in-memory PostgreSQL engine (pg-mem)');
  try {
    const memDb = newDb();
    memDb.public.registerFunction({
      name: 'gen_random_uuid',
      implementation: () => crypto.randomUUID(),
    });
    const pgMem = memDb.adapters.createPg();
    global._postgresPool = new pgMem.Pool();
    global._isPgMem = true;
    return global._postgresPool;
  } catch (err: any) {
    console.warn('Failed to initialize in-memory pg-mem pool:', err?.message || err);
    global._postgresPool = {
      query: async () => ({ rows: [] }),
      connect: async () => ({
        query: async () => ({ rows: [] }),
        release: () => {},
      }),
      on: () => {},
      end: async () => {},
    } as unknown as Pool;
    global._isPgMem = true;
    return global._postgresPool;
  }
};

/**
 * SINGLE application database pool.
 *
 * IMPORTANT:
 * Do not declare pool or createPool again anywhere below.
 */
export const pool = createPool();

/**
 * Drizzle database instance.
 */
export const db = drizzle(pool, { schema });

/**
 * Dynamically switches the active database connection pool
 * and re-initializes tables.
 */
export async function updateDatabaseConnection(
  connectionString: string
): Promise<{ success: boolean; message: string }> {
  try {
    const cleanedConnectionString = connectionString?.trim();

    if (!cleanedConnectionString) {
      return {
        success: false,
        message: 'Database connection string is empty.',
      };
    }

    const testResult = await testDatabaseConnection(
      cleanedConnectionString
    );

    if (!testResult.success) {
      return {
        success: false,
        message: testResult.message,
      };
    }

    const isRemote =
      cleanedConnectionString.includes('supabase') ||
      cleanedConnectionString.includes('sslmode=require') ||
      process.env.NODE_ENV === 'production';

    const newPool = new Pool({
      connectionString: cleanedConnectionString,

      ssl: isRemote
        ? {
            rejectUnauthorized: false,
          }
        : undefined,

      // Keep the pool small for serverless.
      max: 1,

      connectionTimeoutMillis: 15000,

      idleTimeoutMillis: 30000,
      keepAlive: true,
      keepAliveInitialDelayMillis: 10000,
    });

    // Close old PostgreSQL pool.
    if (global._postgresPool && !global._isPgMem) {
      try {
        await global._postgresPool.end();
      } catch {
        // Ignore old pool shutdown errors.
      }
    }

    global._postgresPool = newPool;
    global._isPgMem = false;

    process.env.DATABASE_URL = cleanedConnectionString;

    await initPostgresTables();

    return {
      success: true,
      message:
        'Switched to new PostgreSQL connection successfully!',
    };
  } catch (err: any) {
    return {
      success: false,
      message:
        err?.message ||
        'Failed to switch database pool',
    };
  }
}

/**
 * Test a PostgreSQL connection without replacing
 * the application's current pool.
 */
export async function testDatabaseConnection(
  connectionString: string
): Promise<{
  success: boolean;
  message: string;
  errorCode?: string;
  errorKind?: string;
}> {
  let testPool: Pool | null = null;

  try {
    const cleanedConnectionString =
      connectionString?.trim();

    if (!cleanedConnectionString) {
      return {
        success: false,
        message: 'Database connection string is empty.',
        errorKind: 'configuration',
      };
    }

    const isSupabase =
      cleanedConnectionString.includes('supabase');

    testPool = new Pool({
      connectionString: cleanedConnectionString,

      ssl: isSupabase
        ? {
            rejectUnauthorized: false,
          }
        : undefined,

      max: 1,

      connectionTimeoutMillis: 15000,

      idleTimeoutMillis: 30000,
    });

    const client = await testPool.connect();

    try {
      await client.query('SELECT 1');

      return {
        success: true,
        message:
          'PostgreSQL database connection successful.',
      };
    } finally {
      client.release();
    }
  } catch (err: any) {
    const errorCode = err?.code || undefined;
    const message =
      err?.message ||
      'Unable to connect to PostgreSQL database.';

    let errorKind = 'unknown';

    if (
      errorCode === '28P01' ||
      errorCode === '28000'
    ) {
      errorKind = 'authentication';
    } else if (
      errorCode === 'ENOTFOUND' ||
      errorCode === 'EAI_AGAIN'
    ) {
      errorKind = 'dns';
    } else if (
      errorCode === 'ETIMEDOUT' ||
      errorCode === 'ECONNREFUSED'
    ) {
      errorKind = 'network';
    } else if (
      message.toLowerCase().includes('password')
    ) {
      errorKind = 'authentication';
    } else if (
      message.toLowerCase().includes('timeout')
    ) {
      errorKind = 'timeout';
    }

    return {
      success: false,
      message,
      errorCode,
      errorKind,
    };
  } finally {
    if (testPool) {
      try {
        await testPool.end();
      } catch {
        // Ignore cleanup errors.
      }
    }
  }
}

/**
 * No-op retained for backwards compatibility.
 * Local in-memory persistence is disabled; all data uses PostgreSQL.
 */
export async function persistLocalDatabase(): Promise<void> {}

/**
 * Initializes all required PostgreSQL tables
 * on Supabase or local PostgreSQL.
 */
export async function initPostgresTables(): Promise<boolean> {
  try {
    const client = await pool.connect();

    try {
      await client.query(`
        -- =====================================================
        -- 0. BARANGAYS
        -- =====================================================

        CREATE TABLE IF NOT EXISTS barangays (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          code TEXT NOT NULL UNIQUE,
          name TEXT NOT NULL,
          municipality TEXT DEFAULT 'Hinunangan',
          province TEXT DEFAULT 'Southern Leyte',
          region TEXT DEFAULT 'Region VIII',
          latitude DOUBLE PRECISION,
          longitude DOUBLE PRECISION,
          is_active BOOLEAN NOT NULL DEFAULT true,
          metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        ALTER TABLE barangays ADD COLUMN IF NOT EXISTS code TEXT;
        ALTER TABLE barangays ADD COLUMN IF NOT EXISTS name TEXT;
        ALTER TABLE barangays ADD COLUMN IF NOT EXISTS municipality TEXT DEFAULT 'Hinunangan';
        ALTER TABLE barangays ADD COLUMN IF NOT EXISTS province TEXT DEFAULT 'Southern Leyte';
        ALTER TABLE barangays ADD COLUMN IF NOT EXISTS region TEXT DEFAULT 'Region VIII';
        ALTER TABLE barangays ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;
        ALTER TABLE barangays ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;
        ALTER TABLE barangays ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;
        ALTER TABLE barangays ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;
        ALTER TABLE barangays ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
        ALTER TABLE barangays ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

        -- =====================================================
        -- 1. USERS
        -- =====================================================

        CREATE TABLE IF NOT EXISTS users (
          id UUID PRIMARY KEY,
          uid TEXT NOT NULL UNIQUE,
          email TEXT NOT NULL,
          name TEXT,
          role TEXT NOT NULL DEFAULT 'focal',
          assigned_barangay TEXT,
          phone TEXT,
          auth_user_id UUID,
          active BOOLEAN NOT NULL DEFAULT TRUE,
          is_active BOOLEAN NOT NULL DEFAULT TRUE,
          permissions JSONB NOT NULL DEFAULT '[]'::jsonb,
          status TEXT NOT NULL DEFAULT 'active',
          created_at TIMESTAMP DEFAULT now()
        );

        ALTER TABLE users
          ADD COLUMN IF NOT EXISTS uid TEXT;

        ALTER TABLE users
          ADD COLUMN IF NOT EXISTS email TEXT;

        ALTER TABLE users
          ADD COLUMN IF NOT EXISTS name TEXT;

        ALTER TABLE users
          ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'focal';

        ALTER TABLE users
          ADD COLUMN IF NOT EXISTS assigned_barangay TEXT;

        ALTER TABLE users
          ADD COLUMN IF NOT EXISTS phone TEXT;

        ALTER TABLE users DROP COLUMN IF EXISTS password;

        ALTER TABLE users
          ADD COLUMN IF NOT EXISTS auth_user_id UUID;

        ALTER TABLE users
          ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT TRUE;

        ALTER TABLE users
          ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

        ALTER TABLE users
          ADD COLUMN IF NOT EXISTS permissions JSONB NOT NULL DEFAULT '[]'::jsonb;

        ALTER TABLE users
          ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';

        ALTER TABLE users
          ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT now();


        -- =====================================================
        -- 1.5 FARMERS
        -- =====================================================

        CREATE TABLE IF NOT EXISTS farmers (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          barangay_id UUID,
          first_name TEXT NOT NULL,
          middle_name TEXT,
          last_name TEXT NOT NULL,
          suffix TEXT,
          farm_name TEXT,
          farm_address TEXT,
          contact_number TEXT,
          email TEXT,
          gender TEXT,
          is_active BOOLEAN NOT NULL DEFAULT true,
          is_archived BOOLEAN NOT NULL DEFAULT false,
          metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );


        -- =====================================================
        -- 2. SWINE RECORDS
        -- =====================================================

        CREATE TABLE IF NOT EXISTS swine_records (
          id TEXT PRIMARY KEY,
          computed_pig_id TEXT NOT NULL,
          pig_id_tag TEXT,
          ear_tag_no TEXT,
          farmer_id UUID,
          barangay_id UUID,
          farmer_name TEXT NOT NULL,
          farm_name TEXT,
          farmer_contact TEXT,
          barangay TEXT NOT NULL,
          birth_date TEXT,
          age_days INTEGER,
          age_months TEXT,
          estimated_weight_kg TEXT,
          actual_weight_kg TEXT,
          swine_type TEXT NOT NULL DEFAULT 'FATTER_GROWER',
          farm_scale TEXT NOT NULL DEFAULT 'BACKYARD',
          asf_zone TEXT NOT NULL DEFAULT 'RED',
          biosecurity_warning BOOLEAN NOT NULL DEFAULT FALSE,
          status TEXT NOT NULL DEFAULT 'HEALTHY',
          ready_to_sell BOOLEAN NOT NULL DEFAULT FALSE,
          price_estimate TEXT,
          photo_url TEXT,
          is_archived BOOLEAN NOT NULL DEFAULT FALSE,
          registered_at TEXT NOT NULL,
          custom_fields JSONB,
          created_at TIMESTAMP DEFAULT now()
        );

        ALTER TABLE swine_records
          ADD COLUMN IF NOT EXISTS farmer_id UUID;

        ALTER TABLE swine_records
          ADD COLUMN IF NOT EXISTS barangay_id UUID;

        ALTER TABLE swine_records
          ADD COLUMN IF NOT EXISTS computed_pig_id TEXT;

        ALTER TABLE swine_records
          ADD COLUMN IF NOT EXISTS pig_id_tag TEXT;

        ALTER TABLE swine_records
          ADD COLUMN IF NOT EXISTS ear_tag_no TEXT;

        ALTER TABLE swine_records
          ADD COLUMN IF NOT EXISTS farmer_name TEXT;

        ALTER TABLE swine_records
          ADD COLUMN IF NOT EXISTS farm_name TEXT;

        ALTER TABLE swine_records
          ADD COLUMN IF NOT EXISTS farmer_contact TEXT;

        ALTER TABLE swine_records
          ADD COLUMN IF NOT EXISTS barangay TEXT;

        ALTER TABLE swine_records
          ADD COLUMN IF NOT EXISTS birth_date TEXT;

        ALTER TABLE swine_records
          ADD COLUMN IF NOT EXISTS age_days INTEGER;

        ALTER TABLE swine_records
          ADD COLUMN IF NOT EXISTS age_months TEXT;

        ALTER TABLE swine_records
          ADD COLUMN IF NOT EXISTS estimated_weight_kg TEXT;

        ALTER TABLE swine_records
          ADD COLUMN IF NOT EXISTS actual_weight_kg TEXT;

        ALTER TABLE swine_records
          ADD COLUMN IF NOT EXISTS swine_type TEXT
          DEFAULT 'FATTER_GROWER';

        ALTER TABLE swine_records
          ADD COLUMN IF NOT EXISTS farm_scale TEXT
          DEFAULT 'BACKYARD';

        ALTER TABLE swine_records
          ADD COLUMN IF NOT EXISTS asf_zone TEXT
          DEFAULT 'RED';

        ALTER TABLE swine_records
          ADD COLUMN IF NOT EXISTS biosecurity_warning BOOLEAN
          DEFAULT FALSE;

        ALTER TABLE swine_records
          ADD COLUMN IF NOT EXISTS status TEXT
          DEFAULT 'HEALTHY';

        ALTER TABLE swine_records
          ADD COLUMN IF NOT EXISTS ready_to_sell BOOLEAN
          DEFAULT FALSE;

        ALTER TABLE swine_records
          ADD COLUMN IF NOT EXISTS price_estimate TEXT;

        ALTER TABLE swine_records
          ADD COLUMN IF NOT EXISTS photo_url TEXT;

        ALTER TABLE swine_records
          ADD COLUMN IF NOT EXISTS is_archived BOOLEAN
          DEFAULT FALSE;

        ALTER TABLE swine_records
          ADD COLUMN IF NOT EXISTS registered_at TEXT;

        ALTER TABLE swine_records
          ADD COLUMN IF NOT EXISTS custom_fields JSONB;

        ALTER TABLE swine_records
          ADD COLUMN IF NOT EXISTS created_at TIMESTAMP
          DEFAULT now();


        -- =====================================================
        -- 3. ISSUED CERTIFICATES
        -- =====================================================

        CREATE TABLE IF NOT EXISTS issued_certificates (
          id TEXT PRIMARY KEY,
          control_number TEXT NOT NULL,
          swine_id TEXT,
          farmer_name TEXT NOT NULL,
          barangay TEXT NOT NULL,
          issue_date TEXT NOT NULL,
          purpose TEXT NOT NULL,
          destination TEXT,
          inspected_by TEXT NOT NULL,
          qr_payload TEXT,
          valid_until TEXT,
          status TEXT NOT NULL DEFAULT 'VALID',
          metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
          created_at TIMESTAMP DEFAULT now()
        );

        ALTER TABLE issued_certificates
          ADD COLUMN IF NOT EXISTS control_number TEXT;

        ALTER TABLE issued_certificates
          ADD COLUMN IF NOT EXISTS swine_id TEXT;

        ALTER TABLE issued_certificates
          ADD COLUMN IF NOT EXISTS farmer_name TEXT;

        ALTER TABLE issued_certificates
          ADD COLUMN IF NOT EXISTS barangay TEXT;

        ALTER TABLE issued_certificates
          ADD COLUMN IF NOT EXISTS issue_date TEXT;

        ALTER TABLE issued_certificates
          ADD COLUMN IF NOT EXISTS purpose TEXT;

        ALTER TABLE issued_certificates
          ADD COLUMN IF NOT EXISTS destination TEXT;

        ALTER TABLE issued_certificates
          ADD COLUMN IF NOT EXISTS inspected_by TEXT;

        ALTER TABLE issued_certificates
          ADD COLUMN IF NOT EXISTS qr_payload TEXT;

        ALTER TABLE issued_certificates
          ADD COLUMN IF NOT EXISTS valid_until TEXT;

        ALTER TABLE issued_certificates
          ADD COLUMN IF NOT EXISTS status TEXT
          DEFAULT 'VALID';

        ALTER TABLE issued_certificates
          ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

        ALTER TABLE issued_certificates
          ADD COLUMN IF NOT EXISTS created_at TIMESTAMP
          DEFAULT now();


        -- =====================================================
        -- 4. MESSAGES
        -- =====================================================

        CREATE TABLE IF NOT EXISTS messages (
          id TEXT PRIMARY KEY,
          sender_id TEXT NOT NULL,
          sender_name TEXT NOT NULL,
          sender_role TEXT NOT NULL DEFAULT 'focal',
          receiver_id TEXT,
          receiver_role TEXT,
          barangay TEXT,
          text TEXT NOT NULL,
          attachments JSONB,
          is_read BOOLEAN NOT NULL DEFAULT FALSE,
          created_at TIMESTAMP DEFAULT now()
        );


        -- =====================================================
        -- 5. MEDIA FILES
        -- =====================================================

        CREATE TABLE IF NOT EXISTS media_files (
          id TEXT PRIMARY KEY,
          file_name TEXT NOT NULL,
          file_path TEXT,
          file_url TEXT NOT NULL,
          mime_type TEXT,
          file_size INTEGER,
          category TEXT NOT NULL DEFAULT 'OTHER',
          alt_text TEXT,
          uploaded_by TEXT,
          created_at TIMESTAMP DEFAULT now()
        );


        -- =====================================================
        -- 6. SYSTEM SETTINGS
        -- =====================================================

        CREATE TABLE IF NOT EXISTS system_settings (
          key TEXT PRIMARY KEY,
          value JSONB,
          updated_at TIMESTAMP DEFAULT now()
        );


        -- =====================================================
        -- 7. AUDIT LOGS
        -- =====================================================

        CREATE TABLE IF NOT EXISTS audit_logs (
          id SERIAL PRIMARY KEY,
          action TEXT NOT NULL,
          entity TEXT NOT NULL,
          entity_id TEXT,
          user_id TEXT,
          username TEXT,
          user_role TEXT,
          barangay TEXT,
          details TEXT,
          timestamp TIMESTAMP DEFAULT now()
        );


        -- =====================================================
        -- 8. REGISTRY SCHEMA
        -- =====================================================

        CREATE TABLE IF NOT EXISTS registry_schema (
          id TEXT PRIMARY KEY,
          field_key TEXT NOT NULL,
          label TEXT NOT NULL,
          field_type TEXT NOT NULL DEFAULT 'text',
          required BOOLEAN NOT NULL DEFAULT FALSE,
          visible BOOLEAN NOT NULL DEFAULT TRUE,
          options JSONB,
          field_order INTEGER NOT NULL DEFAULT 0,
          section_id TEXT,
          section_title TEXT,
          help_text TEXT,
          placeholder TEXT,
          default_value TEXT,
          is_fixed BOOLEAN DEFAULT FALSE,
          fixed_value TEXT,
          is_auto_generated BOOLEAN DEFAULT FALSE,
          auto_gen_type TEXT,
          auto_gen_pattern TEXT,
          auto_gen_prefix TEXT,
          created_at TIMESTAMP DEFAULT now(),
          updated_at TIMESTAMP DEFAULT now()
        );


        -- =====================================================
        -- 9. CERTIFICATE TEMPLATES
        -- =====================================================

        CREATE TABLE IF NOT EXISTS certificate_templates (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          barangay_id UUID,
          code TEXT NOT NULL UNIQUE,
          name TEXT NOT NULL,
          template_body TEXT NOT NULL,
          css_styles JSONB NOT NULL DEFAULT '{}'::jsonb,
          template_data JSONB NOT NULL DEFAULT '{}'::jsonb,
          is_active BOOLEAN NOT NULL DEFAULT TRUE,
          is_archived BOOLEAN NOT NULL DEFAULT FALSE,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        ALTER TABLE certificate_templates
          ADD COLUMN IF NOT EXISTS barangay_id UUID;
        ALTER TABLE certificate_templates
          ADD COLUMN IF NOT EXISTS code TEXT;
        ALTER TABLE certificate_templates
          ADD COLUMN IF NOT EXISTS name TEXT;
        ALTER TABLE certificate_templates
          ADD COLUMN IF NOT EXISTS template_body TEXT;
        ALTER TABLE certificate_templates
          ADD COLUMN IF NOT EXISTS css_styles JSONB NOT NULL DEFAULT '{}'::jsonb;
        ALTER TABLE certificate_templates
          ADD COLUMN IF NOT EXISTS template_data JSONB NOT NULL DEFAULT '{}'::jsonb;
        ALTER TABLE certificate_templates
          ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;
        ALTER TABLE certificate_templates
          ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT FALSE;


        -- =====================================================
        -- PERFORMANCE INDEXES
        -- =====================================================

        CREATE INDEX IF NOT EXISTS idx_barangays_code
          ON barangays(code);

        CREATE INDEX IF NOT EXISTS idx_swine_barangay
          ON swine_records(barangay);

        CREATE INDEX IF NOT EXISTS idx_swine_status
          ON swine_records(status);

        CREATE INDEX IF NOT EXISTS idx_swine_ready
          ON swine_records(ready_to_sell);

        CREATE INDEX IF NOT EXISTS idx_certs_barangay
          ON issued_certificates(barangay);

        CREATE INDEX IF NOT EXISTS idx_certs_control
          ON issued_certificates(control_number);

        CREATE INDEX IF NOT EXISTS idx_messages_created
          ON messages(created_at DESC);

        CREATE INDEX IF NOT EXISTS idx_media_category
          ON media_files(category);

        CREATE INDEX IF NOT EXISTS idx_reg_schema_key
          ON registry_schema(field_key);

        CREATE INDEX IF NOT EXISTS idx_reg_schema_order
          ON registry_schema(field_order);
      `);

      // =======================================================
      // INITIALIZE REGISTRY FORM SCHEMA
      // =======================================================

      const schemaCountRes =
        await client.query(
          'SELECT COUNT(*) as count FROM registry_schema'
        );

      const count = parseInt(
        schemaCountRes.rows[0]?.count || '0',
        10
      );

      if (count === 0) {
        let order = 0;

        for (
          const sec of INITIAL_REGISTRY_FORM_SCHEMA.sections
        ) {
          for (const f of sec.fields) {
            order++;

            await client.query(
              `
              INSERT INTO registry_schema (
                id,
                field_key,
                label,
                field_type,
                required,
                visible,
                options,
                field_order,
                section_id,
                section_title,
                help_text,
                placeholder,
                default_value,
                is_fixed,
                fixed_value,
                is_auto_generated,
                auto_gen_type,
                auto_gen_pattern,
                auto_gen_prefix
              )
              VALUES (
                $1, $2, $3, $4, $5, $6, $7,
                $8, $9, $10, $11, $12, $13,
                $14, $15, $16, $17, $18, $19
              )
              ON CONFLICT (id) DO NOTHING
              `,
              [
                f.id,

                f.fieldKey ||
                  toFieldKey(f.label, f.id),

                f.label,

                f.type,

                Boolean(f.required),

                f.visible !== false,

                f.options
                  ? JSON.stringify(f.options)
                  : null,

                order,

                sec.id,

                sec.title,

                f.helpText || null,

                f.placeholder || null,

                f.defaultValue
                  ? String(f.defaultValue)
                  : null,

                Boolean(f.isFixed),

                f.fixedValue || null,

                Boolean(f.isAutoGenerated),

                f.autoGenType || null,

                f.autoGenPattern || null,

                f.autoGenPrefix || null,
              ]
            );
          }
        }

        await client.query(
          `
          INSERT INTO system_settings
            (key, value)
          VALUES ($1, $2)
          ON CONFLICT (key) DO NOTHING
          `,
          [
            'registry_form_schema',
            JSON.stringify(
              INITIAL_REGISTRY_FORM_SCHEMA
            ),
          ]
        );
      }

      // Seed official Hinunangan barangays if empty
      try {
        const brgyCountRes = await client.query('SELECT COUNT(*) as count FROM barangays');
        const brgyCount = parseInt(brgyCountRes.rows[0]?.count || '0', 10);
        if (brgyCount === 0) {
          for (const barangay of HINUNANGAN_BARANGAYS) {
            const metadata = {
              riskLevel: barangay.defaultRiskLevel,
              focalPerson: barangay.focalPersonName,
              focalPersonName: barangay.focalPersonName,
              contactNo: barangay.contactNumber,
              isUrban: barangay.isUrban,
            };
            await client.query(
              `INSERT INTO barangays (code, name, municipality, latitude, longitude, is_active, metadata)
               VALUES ($1, $2, $3, $4, $5, TRUE, $6::jsonb)
               ON CONFLICT (code) DO NOTHING`,
              [barangay.code, barangay.name, 'Hinunangan', barangay.latitude, barangay.longitude, JSON.stringify(metadata)]
            );
          }
          console.log('✅ Initialized 40 Hinunangan barangays in database.');
        }
      } catch (brgySeedErr: any) {
        console.warn('Barangay seed notice:', brgySeedErr?.message || brgySeedErr);
      }

      console.log(
        '✅ PostgreSQL / Supabase tables verified.'
      );

      return true;
    } finally {
      client.release();
    }
  } catch (err: any) {
    console.warn(
      'PostgreSQL connection notice:',
      err?.message || err
    );

    return false;
  }
}