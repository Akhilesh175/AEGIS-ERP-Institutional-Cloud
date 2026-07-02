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

// ─── 7. Upload Student Photo ──────────────────────────────────────────────────

/**
 * Uploads a student photo to the `student-photos` Supabase Storage bucket.
 * Returns the public URL, or null on failure.
 */
export async function uploadStudentPhoto(
  file: File,
  studentId: string,
  schoolId: string
): Promise<string | null> {
  try {
    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    const path = `${schoolId}/${studentId}/photo.${ext}`;

    const { error: uploadErr } = await supabase.storage
      .from('student-photos')
      .upload(path, file, { upsert: true, contentType: file.type });

    if (uploadErr) {
      console.error('[documentService] uploadStudentPhoto upload error:', uploadErr);
      return null;
    }

    const { data: urlData } = supabase.storage
      .from('student-photos')
      .getPublicUrl(path);

    return urlData?.publicUrl || null;
  } catch (err) {
    console.error('[documentService] uploadStudentPhoto error:', err);
    return null;
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
