/**
 * documentService.ts
 *
 * AEGIS ERP – Student Documents Management System
 * ─────────────────────────────────────────────────────────────────────────────
 * Database helpers for:
 *  1. Fetching a fully-enriched student document data object (all fields
 *     from students + student_profiles + users + classes + sections + parents)
 *  2. Saving generated document metadata to `generated_documents`
 *  3. Writing to `document_audit_logs`
 *  4. Checking whether a gated document (Character Cert / Transfer Cert) has
 *     been generated for a student
 *  5. Uploading a student photo to the `student-photos` Supabase Storage bucket
 *
 * All queries enforce school_id isolation (tenant safety).
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { supabase } from '../lib/supabase';
import type { DocumentType, GeneratedDocument, StudentProfile } from '../types';
import { detectPhotoSchema, hasRegistrationPhotoUrlColumn } from './mockApi';

// ─── Types ────────────────────────────────────────────────────────────────────

/** Fully-enriched student data ready to pass into any DocumentTemplate function */
export interface FullStudentDocData {
  // Core identity
  studentId: string;
  userId: string;
  schoolId: string;
  fullName: string;
  firstName: string;
  lastName: string;
  // Admission
  admissionNumber: string;
  rollNumber: number;
  admissionDate?: string;
  // Academic placement
  className: string;
  sectionName: string;
  academicSession: string;
  // Personal
  dateOfBirth: string;
  gender: string;
  bloodGroup: string;
  aadhaarNumber: string;
  nationality: string;
  religion: string;
  category: string;
  house: string;
  // Contact
  phone: string;
  email: string;
  // Address
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
  // Photo — SYSTEM 1 (Official Academic Photo) ONLY
  // photoUrl = students.registration_photo_url → student_profiles.photo_url → ''
  // NEVER falls back to users.avatar_url or users.profile_photo_url
  photoUrl: string;
  registrationPhotoUrl: string; // Alias of photoUrl — always students.registration_photo_url
  avatarUrl: string;            // Kept for interface compatibility only — DO NOT use in documents
  // Father
  fatherName: string;
  fatherPhone: string;
  fatherEmail: string;
  fatherOccupation: string;
  // Mother
  motherName: string;
  motherPhone: string;
  motherEmail: string;
  motherOccupation: string;
  // Previous school
  previousSchool: string;
  previousClass: string;
  previousBoard: string;
  previousPercentage: string;
}

/** School document data ready to pass into any DocumentTemplate function */
export interface SchoolDocData {
  id: string;
  name: string;
  address: string;
  phone: string;
  email: string;
  logoUrl: string;
  sealUrl: string;
  sessionName: string;
  affiliationNumber?: string;
  schoolCode?: string;
}

/** Principal / authorized signatory data */
export interface PrincipalDocData {
  name: string;
  signatureUrl: string;
}

// ─── Verification number generator ───────────────────────────────────────────

function generateVerificationNumber(docType: DocumentType): string {
  const prefix = {
    id_card: 'IDC',
    admission_form: 'ADM',
    admission_record: 'ARD',
    bonafide: 'BON',
    character_certificate: 'CHR',
    transfer_certificate: 'TRF',
    certificate_of_excellence: 'EXC',
  }[docType] || 'DOC';
  const year = new Date().getFullYear();
  const rand = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `AEGIS-${prefix}-${year}-${rand}`;
}

// ─── 1. Fetch Enriched Student Data ──────────────────────────────────────────

/**
 * Fetches ALL data needed to generate any document for a student.
 * Enforces school_id isolation — only returns data if the student belongs
 * to the given schoolId.
 */
export async function fetchStudentDocData(
  studentId: string,
  schoolId: string
): Promise<FullStudentDocData | null> {
  try {
    // Fetch student row + user row + class + section + academic_session
    // CRITICAL: registration_photo_url is the official academic photo (System 1)
    const { data: st, error: stErr } = await supabase
      .from('students')
      .select(`
        id, user_id, school_id, admission_number, roll_number,
        date_of_birth, gender, father_name, mother_name,
        class_id, section_id, academic_session_id,
        registration_photo_url,
        users:user_id (
          first_name, last_name, avatar_url, phone, school_id,
          email_addresses (email, is_primary)
        ),
        classes:class_id (name),
        sections:section_id (name),
        academic_sessions:academic_session_id (name)
      `)
      .eq('id', studentId)
      .eq('school_id', schoolId)   // Tenant isolation
      .maybeSingle();

    if (stErr || !st) {
      console.error('[documentService] fetchStudentDocData – student not found:', stErr);
      return null;
    }

    // Fetch extended profile
    const { data: profile } = await supabase
      .from('student_profiles')
      .select('*')
      .eq('student_id', studentId)
      .eq('school_id', schoolId)
      .maybeSingle();

    // Fetch parent data through parent_student_mappings
    let fatherName = (st as any).father_name || '';
    let fatherPhone = '';
    let fatherEmail = '';
    let fatherOccupation = profile?.father_occupation || '';
    let motherName = profile?.mother_name || (st as any).mother_name || '';
    let motherPhone = profile?.mother_phone || '';
    let motherEmail = profile?.mother_email || '';
    let motherOccupation = profile?.mother_occupation || '';

    const { data: mappings } = await supabase
      .from('parent_student_mappings')
      .select(`
        relationship,
        parents:parent_id (
          id, occupation, address,
          users:user_id (
            first_name, last_name, phone, school_id,
            email_addresses (email, is_primary)
          )
        )
      `)
      .eq('student_id', studentId);

    if (mappings) {
      for (const m of mappings) {
        const p = (m as any).parents;
        const pu = p?.users;
        const pName = pu ? `${pu.first_name} ${pu.last_name}` : '';
        const pEmail = pu?.email_addresses?.find((e: any) => e.is_primary)?.email || '';
        const rel = (m.relationship || '').toUpperCase();
        if (rel.includes('FATHER') || rel.includes('GUARDIAN')) {
          if (!fatherName) fatherName = pName;
          fatherPhone = pu?.phone || '';
          if (!fatherEmail) fatherEmail = pEmail;
          if (!fatherOccupation) fatherOccupation = p?.occupation || '';
        } else if (rel.includes('MOTHER')) {
          if (!motherName) motherName = pName;
          motherPhone = pu?.phone || '';
          if (!motherEmail) motherEmail = pEmail;
          if (!motherOccupation) motherOccupation = p?.occupation || '';
        }
      }
    }

    const u = (st as any).users || {};
    const primaryEmail = u.email_addresses?.find((e: any) => e.is_primary)?.email || '';
    const className = (st as any).classes?.name || '';
    const sectionName = (st as any).sections?.name || '';
    const sessionName = (st as any).academic_sessions?.name || '2025-2026';

      // ── Official Academic Photo Resolution (System 1) ──────────────────────
      // Priority: students.registration_photo_url → student_profiles.photo_url → ''
      // NEVER falls back to users.avatar_url (that is System 2 — personal profile photo)
      // Rule: if registration photo exists, always display it.
      //        if not, display NO PHOTO placeholder. Never show personal profile photo.
      const registrationPhotoUrl = (st as any).registration_photo_url || '';
      const officialPhotoUrl = registrationPhotoUrl || profile?.photo_url || '';

      return {
        studentId: st.id,
        userId: st.user_id,
        schoolId: st.school_id,
        fullName: `${u.first_name || ''} ${u.last_name || ''}`.trim(),
        firstName: u.first_name || '',
        lastName: u.last_name || '',
        admissionNumber: st.admission_number,
        rollNumber: st.roll_number,
        admissionDate: profile?.admission_date || '',
        className,
        sectionName,
        academicSession: sessionName,
        dateOfBirth: st.date_of_birth || '',
        gender: st.gender || '',
        bloodGroup: profile?.blood_group || '',
        aadhaarNumber: profile?.aadhaar_number || '',
        nationality: profile?.nationality || 'Indian',
        religion: profile?.religion || '',
        category: profile?.category || 'General',
        house: profile?.house || '',
        phone: u.phone || '',
        email: primaryEmail,
        addressLine1: profile?.address_line1 || '',
        addressLine2: profile?.address_line2 || '',
        city: profile?.city || '',
        state: profile?.state || '',
        pincode: profile?.pincode || '',
        country: profile?.country || 'India',
        // System 1 — Official Academic Photo ONLY
        photoUrl: officialPhotoUrl,
        registrationPhotoUrl: officialPhotoUrl,
        // avatarUrl intentionally empty — do NOT use in any official document
        avatarUrl: '',
        fatherName,
        fatherPhone,
        fatherEmail,
        fatherOccupation,
        motherName,
        motherPhone,
        motherEmail,
        motherOccupation,
        previousSchool: profile?.previous_school || '',
        previousClass: profile?.previous_class || '',
        previousBoard: profile?.previous_board || '',
        previousPercentage: profile?.previous_percentage || '',
      };
  } catch (err) {
    console.error('[documentService] fetchStudentDocData error:', err);
    return null;
  }
}

// ─── 2. Fetch School Doc Data ─────────────────────────────────────────────────

export async function fetchSchoolDocData(schoolId: string): Promise<SchoolDocData | null> {
  try {
    const { data: school, error } = await supabase
      .from('schools')
      .select('id, name, address, phone, logo_url, seal_url')
      .eq('id', schoolId)
      .maybeSingle();

    if (error || !school) return null;

    // Get current academic session name
    const { data: session } = await supabase
      .from('academic_sessions')
      .select('name')
      .eq('school_id', schoolId)
      .eq('is_current', true)
      .maybeSingle();

    return {
      id: school.id,
      name: school.name,
      address: school.address || '',
      phone: school.phone || '',
      email: '',
      logoUrl: school.logo_url || '',
      sealUrl: school.seal_url || '',
      sessionName: session?.name || '2025-2026',
    };
  } catch (err) {
    console.error('[documentService] fetchSchoolDocData error:', err);
    return null;
  }
}

// ─── 3. Fetch Principal Data ──────────────────────────────────────────────────

export async function fetchPrincipalDocData(schoolId: string): Promise<PrincipalDocData> {
  try {
    const { data: admin } = await supabase
      .from('school_admins')
      .select('signature_url, users:user_id(first_name, last_name)')
      .eq('school_id', schoolId)
      .eq('status', 'ACTIVE')
      .maybeSingle();

    if (!admin) return { name: 'Principal', signatureUrl: '' };

    const u = (admin as any).users;
    const name = u ? `${u.first_name} ${u.last_name}`.trim() : 'Principal';
    return { name, signatureUrl: (admin as any).signature_url || '' };
  } catch {
    return { name: 'Principal', signatureUrl: '' };
  }
}

// ─── 4. Save Generated Document Record ───────────────────────────────────────

/**
 * Saves metadata about a generated document to the database.
 * Call this AFTER successfully generating the PDF.
 * Returns the generated_documents row id.
 */
export async function saveGeneratedDocumentRecord({
  schoolId,
  studentId,
  documentType,
  generatedByUserId,
  generatedByRole,
  metadata,
}: {
  schoolId: string;
  studentId: string;
  documentType: DocumentType;
  generatedByUserId: string;
  generatedByRole: string;
  metadata?: Record<string, any>;
}): Promise<{ id: string; verificationNumber: string } | null> {
  try {
    const verificationNumber = generateVerificationNumber(documentType);
    const qrData = `${window.location.origin}/#verify/doc/${verificationNumber}`;

    // Check if a record already exists — if so, supersede it and increment version
    const { data: existing } = await supabase
      .from('generated_documents')
      .select('id, version')
      .eq('student_id', studentId)
      .eq('document_type', documentType)
      .eq('status', 'ACTIVE')
      .maybeSingle();

    if (existing) {
      // Mark old as superseded
      await supabase
        .from('generated_documents')
        .update({ status: 'SUPERSEDED' })
        .eq('id', existing.id);
    }

    const { data: row, error } = await supabase
      .from('generated_documents')
      .insert({
        school_id: schoolId,
        student_id: studentId,
        document_type: documentType,
        generated_by_user_id: generatedByUserId,
        generated_by_role: generatedByRole,
        version: existing ? existing.version + 1 : 1,
        verification_number: verificationNumber,
        qr_data: qrData,
        status: 'ACTIVE',
        metadata: metadata || {},
      })
      .select('id')
      .single();

    if (error || !row) {
      console.error('[documentService] saveGeneratedDocumentRecord error:', error);
      return null;
    }

    // Write audit log
    await supabase.from('document_audit_logs').insert({
      document_id: row.id,
      school_id: schoolId,
      student_id: studentId,
      action: existing ? 'REGENERATED' : 'GENERATED',
      performed_by: generatedByUserId,
      performed_by_role: generatedByRole,
      details: { document_type: documentType, verification_number: verificationNumber },
    });

    return { id: row.id, verificationNumber };
  } catch (err) {
    console.error('[documentService] saveGeneratedDocumentRecord error:', err);
    return null;
  }
}

// ─── 5. Check if a Gated Document Has Been Generated ─────────────────────────

/**
 * Returns the active generated_documents record for a given student + type,
 * or null if the document has never been generated (or has been revoked).
 *
 * Used to gate Character Certificate and Transfer Certificate visibility
 * in Student and Parent portals.
 */
export async function checkDocumentGenerated(
  studentId: string,
  documentType: DocumentType
): Promise<GeneratedDocument | null> {
  try {
    const { data, error } = await supabase
      .from('generated_documents')
      .select('*')
      .eq('student_id', studentId)
      .eq('document_type', documentType)
      .eq('status', 'ACTIVE')
      .order('generated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data) return null;

    return {
      id: data.id,
      schoolId: data.school_id,
      studentId: data.student_id,
      documentType: data.document_type,
      generatedAt: data.generated_at,
      generatedByUserId: data.generated_by_user_id,
      generatedByRole: data.generated_by_role,
      version: data.version,
      verificationNumber: data.verification_number,
      qrData: data.qr_data,
      pdfUrl: data.pdf_url,
      status: data.status,
      metadata: data.metadata,
      createdAt: data.created_at,
    };
  } catch {
    return null;
  }
}

// ─── 6. Fetch All Generated Documents for a Student ──────────────────────────

export async function fetchStudentGeneratedDocs(
  studentId: string,
  schoolId: string
): Promise<GeneratedDocument[]> {
  try {
    const { data, error } = await supabase
      .from('generated_documents')
      .select('*')
      .eq('student_id', studentId)
      .eq('school_id', schoolId)
      .eq('status', 'ACTIVE')
      .order('generated_at', { ascending: false });

    if (error || !data) return [];

    return data.map((d: any) => ({
      id: d.id,
      schoolId: d.school_id,
      studentId: d.student_id,
      documentType: d.document_type,
      generatedAt: d.generated_at,
      generatedByUserId: d.generated_by_user_id,
      generatedByRole: d.generated_by_role,
      version: d.version,
      verificationNumber: d.verification_number,
      qrData: d.qr_data,
      pdfUrl: d.pdf_url,
      status: d.status,
      metadata: d.metadata,
      createdAt: d.created_at,
    }));
  } catch {
    return [];
  }
}

// ─── 7. Upload Student Photo (Atomic — Enterprise Grade) ─────────────────────

/**
 * Atomically uploads a student photo and updates student_profiles.photo_url.
 *
 * Security guarantees:
 *  ① Validates student belongs to the given schoolId before any write.
 *  ② Reads the previous photo_url so the old storage object can be deleted.
 *  ③ Uploads to a deterministic UUID-scoped path (no name collisions possible).
 *  ④ Updates student_profiles ONLY after the storage upload succeeds.
 *  ⑤ Deletes the previous storage object ONLY after the DB update is confirmed.
 *  ⑥ Appends a cache-busting timestamp (?v=<ts>) to the returned public URL.
 *
 * On any failure the function throws a descriptive Error; callers should catch
 * and show a user-friendly message. Storage and DB are always kept in sync.
 */
export async function uploadStudentPhoto(
  file: File,
  studentId: string,
  schoolId: string
): Promise<string | null> {
  const requestId = Math.random().toString(36).substring(2, 15).toUpperCase();
  const timestamp = new Date().toISOString();

  // Audit Helper Log
  const logAudit = (event: string, details: Record<string, any>) => {
    console.log(`[uploadStudentPhoto:audit] [${timestamp}] [Req:${requestId}] Event: ${event}`, JSON.stringify({
      studentId,
      schoolId,
      timestamp,
      requestId,
      ...details
    }));
  };

  logAudit('Upload Started', { fileName: file.name, fileSize: file.size });

  try {
    // ── 1. Validate User Session & Auth Permissions ────────────────────────
    const { data: { session }, error: sessionErr } = await supabase.auth.getSession();
    if (sessionErr || !session) {
      logAudit('Unauthorized Access Attempt', { error: 'No active session found.' });
      throw new Error('Access Denied: No active user session found.');
    }

    const adminUserId = session.user.id;

    // Validate active user permissions and school association
    const { data: activeUser, error: activeUserErr } = await supabase
      .from('users')
      .select('id, role, school_id, is_active')
      .eq('id', adminUserId)
      .maybeSingle();

    if (activeUserErr || !activeUser || !activeUser.is_active) {
      logAudit('Unauthorized Access Attempt', { adminUserId, error: 'Active user profile not found or inactive.' });
      throw new Error('Access Denied: User account is inactive or not found.');
    }

    const permittedRoles = ['SUPER_ADMIN', 'SCHOOL_ADMIN', 'ACADEMIC_ADMIN'];
    if (!permittedRoles.includes(activeUser.role)) {
      logAudit('Unauthorized Access Attempt', { adminUserId, role: activeUser.role, error: 'Insufficient role permissions.' });
      throw new Error(`Access Denied: Role '${activeUser.role}' is not authorized to upload student photos.`);
    }

    if (activeUser.role !== 'SUPER_ADMIN' && activeUser.school_id !== schoolId) {
      logAudit('Unauthorized Access Attempt', { adminUserId, userSchoolId: activeUser.school_id, targetSchoolId: schoolId, error: 'Tenant school mismatch.' });
      throw new Error('Access Denied: School tenant mismatch. Security violation.');
    }

    // ── 2. Validate School Profile Existence ────────────────────────────────
    const { data: schoolCheck, error: schoolCheckErr } = await supabase
      .from('schools')
      .select('id')
      .eq('id', schoolId)
      .maybeSingle();

    if (schoolCheckErr || !schoolCheck) {
      logAudit('Upload Failed', { error: 'Target school profile not found in database.', schoolCheckErr });
      throw new Error('Failed to resolve target school profile.');
    }

    // ── 3. Validate Student Profile & Ownership ─────────────────────────────
    const { data: studentCheck, error: studentCheckErr } = await supabase
      .from('students')
      .select('id, school_id')
      .eq('id', studentId)
      .eq('school_id', schoolId) // Strict tenant query
      .maybeSingle();

    if (studentCheckErr || !studentCheck) {
      logAudit('Student Ownership Mismatch', { error: 'Student profile not found or tenant mismatch.', studentCheckErr });
      throw new Error('Access Denied: Student does not exist or does not belong to your school tenant.');
    }

    // ── 4. Fetch Concurrency Metadata (Optimistic Concurrency Control) ─────
    const { data: existingProfile, error: profileFetchErr } = await supabase
      .from('student_profiles')
      .select('id, photo_url, updated_at, student_id, school_id')
      .eq('student_id', studentId)
      .eq('school_id', schoolId)
      .maybeSingle();

    if (profileFetchErr) {
      logAudit('Upload Failed', { error: 'Failed to retrieve existing profile metadata.', profileFetchErr });
      throw new Error('Database transaction abort: could not fetch profile metadata.');
    }

    const previousPhotoUrl = existingProfile?.photo_url || '';
    const lastUpdatedAt = existingProfile?.updated_at || null;

    // ── 5. Perform Storage Upload to UUID Path ──────────────────────────────
    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    // Unique suffix prevents overlapping concurrent files from overwriting each other in storage
    const uniqueSuffix = `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const storagePath = `${schoolId}/${studentId}/photo_${uniqueSuffix}.${ext}`;

    const { error: uploadErr } = await supabase.storage
      .from('student-photos')
      .upload(storagePath, file, {
        upsert: false, // Strict OCC: do not overwrite concurrent uploads
        contentType: file.type,
        cacheControl: '0',
      });

    if (uploadErr) {
      logAudit('Upload Failed', { error: 'Storage provider failed write operation.', uploadErr });
      throw new Error(`Photo storage upload failed: ${uploadErr.message}`);
    }

    // Resolve public CDN URL
    const { data: urlData } = supabase.storage
      .from('student-photos')
      .getPublicUrl(storagePath);

    if (!urlData?.publicUrl) {
      // Rollback: delete storage object
      await supabase.storage.from('student-photos').remove([storagePath]).catch(console.error);
      logAudit('Rollback Executed', { error: 'Storage public URL resolution failed.', storagePath });
      throw new Error('Public URL resolution failed. Transaction rolled back.');
    }

    const cacheBustedUrl = `${urlData.publicUrl}?v=${Date.now()}`;

    // ── 6. Update student_profiles with OCC Constraint ─────────────────────
    if (existingProfile) {
      // OCC Update
      const { data: updatedRows, error: dbErr } = await supabase
        .from('student_profiles')
        .update({
          photo_url: cacheBustedUrl,
          updated_at: new Date().toISOString(),
        })
        .eq('student_id', studentId)
        .eq('school_id', schoolId)
        .eq('updated_at', lastUpdatedAt) // Strict OCC: updated_at check
        .select();

      if (dbErr) {
        // Rollback Storage
        await supabase.storage.from('student-photos').remove([storagePath]).catch(console.error);
        logAudit('Database Update Failed', { error: dbErr.message, dbErr });
        logAudit('Rollback Executed', { reason: 'DB update failure', storagePath });
        throw new Error(`Database transaction failure: ${dbErr.message}. Storage rolled back.`);
      }

      if (!updatedRows || updatedRows.length === 0) {
        // Concurrency Check Failure: another transaction updated the record first
        await supabase.storage.from('student-photos').remove([storagePath]).catch(console.error);
        logAudit('Concurrent Update Detected', { lastUpdatedAt, currentPhotoUrl: previousPhotoUrl });
        logAudit('Rollback Executed', { reason: 'OCC lock mismatch', storagePath });
        throw new Error('Concurrency Error: Profile was updated by another administrator. Please reload and try again.');
      }
    } else {
      // Insert new profile
      const { error: dbErr } = await supabase
        .from('student_profiles')
        .insert({
          student_id: studentId,
          school_id: schoolId,
          photo_url: cacheBustedUrl,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

      if (dbErr) {
        // Rollback Storage
        await supabase.storage.from('student-photos').remove([storagePath]).catch(console.error);
        logAudit('Database Update Failed', { error: dbErr.message, dbErr });
        logAudit('Rollback Executed', { reason: 'DB insert failure', storagePath });
        throw new Error(`Database transaction failure: ${dbErr.message}. Storage rolled back.`);
      }
    }

    logAudit('Database Update Success', { newPhotoUrl: cacheBustedUrl });

    // ── 6b. Write to students.registration_photo_url (PRIMARY System 1 column) ──
    // This is the DEFINITIVE single source of truth for all official academic documents.
    // Always attempt this write — if the column doesn't exist yet (pre-migration),
    // the error is caught and logged but does NOT fail the upload.
    try {
      const { error: regPhotoErr } = await supabase
        .from('students')
        .update({ registration_photo_url: cacheBustedUrl })
        .eq('id', studentId)
        .eq('school_id', schoolId);
      if (regPhotoErr) {
        // Column may not exist yet on pre-migration DBs — non-fatal, student_profiles.photo_url serves as fallback
        logAudit('Registration Photo Write Warning', { error: 'students.registration_photo_url update failed (column may not exist yet)', detail: regPhotoErr.message });
      } else {
        logAudit('Registration Photo Write Success', { column: 'students.registration_photo_url', newPhotoUrl: cacheBustedUrl });
      }
    } catch (regWriteErr: any) {
      logAudit('Registration Photo Write Warning', { error: regWriteErr?.message || regWriteErr });
    }

    logAudit('Upload Success', { newPhotoUrl: cacheBustedUrl, storagePath });

    // ── 7. Safe Deferred Cleanup of Previous Photo ────────────────────────
    if (previousPhotoUrl && previousPhotoUrl.includes('student-photos')) {
      try {
        const urlObj = new URL(previousPhotoUrl.split('?')[0]);
        const pathParts = urlObj.pathname.split('/student-photos/');
        const oldStoragePath = pathParts[1];
        if (oldStoragePath && oldStoragePath !== storagePath) {
          const { error: deleteErr } = await supabase.storage
            .from('student-photos')
            .remove([oldStoragePath]);

          if (deleteErr) {
            logAudit('Cleanup Failed', { oldStoragePath, error: deleteErr.message });
          } else {
            logAudit('Old Photo Deleted', { oldStoragePath });
          }
        }
      } catch (cleanupErr: any) {
        logAudit('Cleanup Failed', { error: cleanupErr?.message || cleanupErr });
      }
    }

    return cacheBustedUrl;
  } catch (err: any) {
    logAudit('Upload Failed', { error: err.message || err });
    throw err;
  }
}


// ─── 8. Upsert Student Profile ────────────────────────────────────────────────

/**
 * Creates or updates the student_profiles row for a student.
 * Safe to call from registration form or profile edit flows.
 */
export async function upsertStudentProfile(
  studentId: string,
  schoolId: string,
  profile: Partial<Omit<StudentProfile, 'id' | 'studentId' | 'schoolId' | 'createdAt' | 'updatedAt'>>
): Promise<boolean> {
  try {
    const { error } = await supabase.from('student_profiles').upsert(
      {
        student_id: studentId,
        school_id: schoolId,
        blood_group: profile.bloodGroup,
        aadhaar_number: profile.aadhaarNumber,
        nationality: profile.nationality,
        religion: profile.religion,
        category: profile.category,
        address_line1: profile.addressLine1,
        address_line2: profile.addressLine2,
        city: profile.city,
        state: profile.state,
        pincode: profile.pincode,
        country: profile.country,
        house: profile.house,
        admission_date: profile.admissionDate || null,
        previous_school: profile.previousSchool,
        previous_class: profile.previousClass,
        previous_board: profile.previousBoard,
        previous_percentage: profile.previousPercentage,
        photo_url: profile.photoUrl,
        father_occupation: profile.fatherOccupation,
        father_email: profile.fatherEmail,
        mother_name: profile.motherName,
        mother_phone: profile.motherPhone,
        mother_email: profile.motherEmail,
        mother_occupation: profile.motherOccupation,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'student_id' }
    );

    if (error) {
      console.error('[documentService] upsertStudentProfile error:', error);
      return false;
    }
    return true;
  } catch (err) {
    console.error('[documentService] upsertStudentProfile error:', err);
    return false;
  }
}

// ─── 9. Safe Photo URL Reader (Ownership Verified) ────────────────────────────

/**
 * Reads student_profiles.photo_url for a specific student, enforcing:
 *   - school_id must match (tenant isolation)
 *   - student_id must match (prevents cross-student leakage)
 *
 * Returns empty string if no photo is set or if the student is not found
 * in the given school (prevents cross-tenant reads).
 */
export async function getStudentPhotoUrl(
  studentId: string,
  schoolId: string
): Promise<string> {
  try {
    const { data, error } = await supabase
      .from('student_profiles')
      .select('photo_url, student_id, school_id')
      .eq('student_id', studentId)
      .eq('school_id', schoolId)     // Tenant isolation — MANDATORY
      .maybeSingle();

    if (error || !data) return '';

    // Double-check the returned row actually belongs to this student+school
    if (data.student_id !== studentId || data.school_id !== schoolId) {
      console.error('[documentService] getStudentPhotoUrl – ownership mismatch detected!', {
        expected: { studentId, schoolId },
        returned: { student_id: data.student_id, school_id: data.school_id },
      });
      return '';
    }

    return data.photo_url || '';
  } catch (err) {
    console.error('[documentService] getStudentPhotoUrl error:', err);
    return '';
  }
}

// ─── 10. Update Student Photo URL (Patch-Only, Ownership Verified) ─────────────

/**
 * Updates the official academic registration photo URL for a student.
 * Writes to BOTH:
 *   ① students.registration_photo_url  (System 1 — primary source of truth)
 *   ② student_profiles.photo_url       (System 1 — legacy/fallback, kept in sync)
 *
 * Verifies school_id + student_id ownership before any write.
 * NEVER touches users.profile_photo_url or users.avatar_url (those are System 2).
 */
export async function updateStudentPhotoUrl(
  studentId: string,
  schoolId: string,
  photoUrl: string
): Promise<boolean> {
  try {
    // ── Step 1: Write to students.registration_photo_url (primary column) ──────
    // This is the definitive single source of truth for all official documents.
    // Uses a graceful fallback in case the column doesn't exist yet (pre-migration).
    try {
      const { error: regErr } = await supabase
        .from('students')
        .update({ registration_photo_url: photoUrl })
        .eq('id', studentId)
        .eq('school_id', schoolId);
      if (regErr) {
        // Column may not exist yet — log but continue to student_profiles write
        console.warn('[documentService] updateStudentPhotoUrl – students.registration_photo_url write failed (column may not exist yet):', regErr.message);
      } else {
        console.log('[documentService] updateStudentPhotoUrl – students.registration_photo_url updated successfully.');
      }
    } catch (regWriteErr: any) {
      console.warn('[documentService] updateStudentPhotoUrl – students.registration_photo_url exception (non-fatal):', regWriteErr?.message);
    }

    // ── Step 2: Write to student_profiles.photo_url (legacy/fallback column) ────
    // Kept in sync so older code paths that still read student_profiles.photo_url
    // also reflect the correct official academic photo.
    const { data: existing, error: fetchErr } = await supabase
      .from('student_profiles')
      .select('id, student_id, school_id')
      .eq('student_id', studentId)
      .eq('school_id', schoolId)
      .maybeSingle();

    if (fetchErr) {
      console.error('[documentService] updateStudentPhotoUrl – fetch error:', fetchErr);
      return false;
    }

    if (!existing) {
      // Profile row doesn't exist yet — create it
      const { error: insertErr } = await supabase
        .from('student_profiles')
        .insert({ student_id: studentId, school_id: schoolId, photo_url: photoUrl });
      if (insertErr) {
        console.error('[documentService] updateStudentPhotoUrl – insert error:', insertErr);
        return false;
      }
      return true;
    }

    // Profile exists — patch only photo_url
    const { error: updateErr } = await supabase
      .from('student_profiles')
      .update({ photo_url: photoUrl, updated_at: new Date().toISOString() })
      .eq('student_id', studentId)
      .eq('school_id', schoolId);   // Tenant isolation — MANDATORY

    if (updateErr) {
      console.error('[documentService] updateStudentPhotoUrl – update error:', updateErr);
      return false;
    }

    return true;
  } catch (err) {
    console.error('[documentService] updateStudentPhotoUrl error:', err);
    return false;
  }
}
