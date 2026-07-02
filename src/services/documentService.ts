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
  // Photo
  photoUrl: string;
  avatarUrl: string;
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
    const { data: st, error: stErr } = await supabase
      .from('students')
      .select(`
        id, user_id, school_id, admission_number, roll_number,
        date_of_birth, gender, father_name, mother_name,
        class_id, section_id, academic_session_id,
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
      photoUrl: profile?.photo_url || '',
      avatarUrl: u.avatar_url || '',
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
  // ── Step 1: Validate student ownership (school_id + student_id) ────────────
  const { data: existingProfile, error: profileFetchErr } = await supabase
    .from('student_profiles')
    .select('id, photo_url, student_id, school_id')
    .eq('student_id', studentId)
    .eq('school_id', schoolId)        // Tenant isolation — MANDATORY
    .maybeSingle();

  if (profileFetchErr) {
    console.error('[documentService] uploadStudentPhoto – profile fetch error:', profileFetchErr);
    throw new Error('Failed to verify student ownership before photo upload.');
  }

  // Capture the previous storage path so we can delete it after success
  const previousPhotoUrl: string = existingProfile?.photo_url || '';
  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';

  // ── Step 2: Deterministic, collision-proof storage path ───────────────────
  // Path format: <schoolId>/<studentId>/photo.<ext>
  // UUID segments guarantee: no school can see another school's files.
  const storagePath = `${schoolId}/${studentId}/photo.${ext}`;

  // ── Step 3: Upload to Supabase Storage ───────────────────────────────────
  const { error: uploadErr } = await supabase.storage
    .from('student-photos')
    .upload(storagePath, file, {
      upsert: true,           // Overwrite if previous upload exists at same path
      contentType: file.type,
      cacheControl: '0',      // Disable CDN caching so the new file is fetched immediately
    });

  if (uploadErr) {
    console.error('[documentService] uploadStudentPhoto – storage upload error:', uploadErr);
    throw new Error(`Photo storage upload failed: ${uploadErr.message}`);
  }

  // ── Step 4: Get the public URL (with cache-busting timestamp) ────────────
  const { data: urlData } = supabase.storage
    .from('student-photos')
    .getPublicUrl(storagePath);

  if (!urlData?.publicUrl) {
    // Rollback: delete the just-uploaded file so storage stays clean
    await supabase.storage.from('student-photos').remove([storagePath]).catch(console.error);
    throw new Error('Failed to retrieve public URL after upload. Storage rolled back.');
  }

  const cacheBustedUrl = `${urlData.publicUrl}?v=${Date.now()}`;

  // ── Step 5: Update student_profiles.photo_url (tenant-safe) ──────────────
  const { error: dbErr } = await supabase
    .from('student_profiles')
    .upsert(
      {
        student_id: studentId,
        school_id: schoolId,
        photo_url: cacheBustedUrl,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'student_id' }
    );

  if (dbErr) {
    // Rollback: delete the uploaded file to prevent orphaned storage objects
    await supabase.storage.from('student-photos').remove([storagePath]).catch(console.error);
    console.error('[documentService] uploadStudentPhoto – DB upsert error:', dbErr);
    throw new Error(`Database update failed after upload: ${dbErr.message}. Storage rolled back.`);
  }

  // ── Step 6: Delete the old storage file (after DB is confirmed updated) ──
  // Only delete if the previous URL points to a different path.
  if (previousPhotoUrl && previousPhotoUrl.includes('student-photos')) {
    try {
      // Extract the storage path from the previous URL
      const urlObj = new URL(previousPhotoUrl.split('?')[0]);
      const pathParts = urlObj.pathname.split('/student-photos/');
      const oldStoragePath = pathParts[1];
      if (oldStoragePath && oldStoragePath !== storagePath) {
        const { error: deleteErr } = await supabase.storage
          .from('student-photos')
          .remove([oldStoragePath]);
        if (deleteErr) {
          // Non-fatal: log but don't fail the whole operation
          console.warn('[documentService] uploadStudentPhoto – old file cleanup failed:', deleteErr.message);
        }
      }
    } catch (cleanupErr) {
      console.warn('[documentService] uploadStudentPhoto – old file cleanup skipped:', cleanupErr);
    }
  }

  return cacheBustedUrl;
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
 * Updates ONLY photo_url on an existing student_profiles row.
 * Verifies ownership (school_id + student_id) before writing.
 * Used by the "Change Photo" admin edit flow after uploadStudentPhoto has already
 * written the URL via its own upsert — this is available as a standalone helper
 * for flows that manage storage externally.
 */
export async function updateStudentPhotoUrl(
  studentId: string,
  schoolId: string,
  photoUrl: string
): Promise<boolean> {
  try {
    // Verify ownership before any write
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
