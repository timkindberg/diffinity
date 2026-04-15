/**
 * Creates (or resets) dedicated visual-regression users in the local DB.
 *
 * Run: npm run setup-users
 *
 * Creates two users via direct SQL to the postgres docker container:
 *   - vr-employer@visual-regression.local (role=2, employer)
 *   - vr-vendor@visual-regression.local (role=3, vendor)
 *
 * Password is hashed using Django's pbkdf2_sha256 format so the login API works.
 * No Django environment needed — just docker and python3.
 */
import { execSync } from 'child_process'
import { writeFileSync, unlinkSync } from 'fs'
import { config } from './config.js'

const DB_NAME = 'cruise'
const SCHEMA = 'cruise'

const USERS = [
  {
    username: config.users.employer,
    role: '2', // employer
    firstName: 'VR',
    lastName: 'Employer',
  },
  {
    username: config.users.vendor,
    role: '3', // vendor
    firstName: 'VR',
    lastName: 'Vendor',
  },
]

/**
 * Generate a Django-compatible pbkdf2_sha256 password hash.
 * Uses python3 (available on macOS) to match Django's exact hashing.
 */
function hashPassword(password: string): string {
  // Write a temp Python script to avoid shell interpolation of $ signs
  const scriptPath = '/tmp/vr-hash-password.py'
  const scriptContent = `
import hashlib, base64, secrets
password = '${password}'
salt = secrets.token_hex(12)
dk = hashlib.pbkdf2_hmac('sha256', password.encode(), salt.encode(), 720000)
h = 'pbkdf2_sha256$720000$' + salt + '$' + base64.b64encode(dk).decode()
print(h, end='')
`.trim()

  writeFileSync(scriptPath, scriptContent)
  const result = execSync(`python3 ${scriptPath}`, {
    encoding: 'utf-8',
    timeout: 10000,
  }).trim()
  unlinkSync(scriptPath)
  return result
}

function runSql(sql: string): string {
  // Pipe SQL via stdin to avoid shell interpolation mangling $ signs in password hashes
  const cmd = `docker exec -i db psql -U postgres -d ${DB_NAME} -t -A`
  try {
    return execSync(cmd, { input: sql, encoding: 'utf-8', timeout: 10000 }).trim()
  } catch (err) {
    const msg = err instanceof Error ? (err as any).stderr || err.message : String(err)
    throw new Error(`SQL failed: ${msg}`)
  }
}

function setupUser(user: (typeof USERS)[number], passwordHash: string) {
  console.log(`\nSetting up: ${user.username} (role=${user.role})`)

  // Check if user exists
  const existing = runSql(
    `SELECT id FROM ${SCHEMA}.accounts_user WHERE username = '${user.username}'`
  )

  if (existing) {
    console.log(`  User exists (id=${existing}), updating password and fields...`)
    runSql(`
      UPDATE ${SCHEMA}.accounts_user SET
        password = '${passwordHash}',
        is_active = true,
        role = '${user.role}',
        first_name = '${user.firstName}',
        last_name = '${user.lastName}'
      WHERE username = '${user.username}'
    `)
    console.log(`  Updated.`)
  } else {
    console.log(`  Creating new user...`)
    const id = runSql(`
      INSERT INTO ${SCHEMA}.accounts_user (
        username, password, is_active, is_staff, is_superuser,
        role, first_name, last_name, email,
        date_joined, receive_newsletter, is_email_verified,
        has_ever_received_password_email, is_erased,
        facebook_id, activation_key, reset_password_key, key_expires,
        metadata, preferences, identity_id
      ) VALUES (
        '${user.username}', '${passwordHash}', true, false, false,
        '${user.role}', '${user.firstName}', '${user.lastName}', '${user.username}',
        NOW(), false, true, false, false,
        '', '', '', NOW(),
        '{}', '{}', gen_random_uuid()
      ) RETURNING id
    `)
    console.log(`  Created (id=${id}).`)
  }
}

function main() {
  console.log('Visual Regression - User Setup')
  console.log('==============================')
  console.log(`Password: ${config.password}`)
  console.log(`Base URL: ${config.baseUrl}`)
  console.log(`DB: ${DB_NAME} (schema: ${SCHEMA})`)

  // Verify docker is accessible
  try {
    runSql('SELECT 1')
  } catch {
    console.error('\nERROR: Cannot connect to postgres via docker.')
    console.error('Make sure docker is running: make stack-up')
    process.exit(1)
  }

  // Hash password once (same for both users)
  console.log('\nHashing password...')
  const passwordHash = hashPassword(config.password)
  console.log(`  Hash: ${passwordHash.slice(0, 30)}...`)

  for (const user of USERS) {
    setupUser(user, passwordHash)
  }

  console.log('\nDone! Users are ready for visual regression capture.')
  console.log('Run: npm run capture:before')
}

main()
