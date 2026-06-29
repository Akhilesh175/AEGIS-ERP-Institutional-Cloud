import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { Capacitor } from '@capacitor/core';
import { downloadFile } from '../utils/downloadHelper';

/** AEGIS ERP official logo for PDF/certificate watermark footers */
const AEGIS_LOGO_URL = '/aegis-logo.png';

/** Shared AEGIS ERP branding watermark — appended to all PDF document types */
const AEGIS_PDF_FOOTER = `
  <div style="margin-top:20px;padding-top:8px;border-top:1px dashed #cbd5e1;display:flex;align-items:center;justify-content:center;gap:8px;opacity:0.6;">
    <img src="${AEGIS_LOGO_URL}" style="height:16px;width:16px;object-fit:contain;" alt="AEGIS ERP" />
    <span style="font-size:7px;font-family:sans-serif;color:#64748b;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;">Powered by AEGIS ERP Institutional Cloud · noreply@aegiserp.xyz</span>
  </div>
`;

interface DocumentSchoolData {
  id: string;
  name: string;
  address?: string;
  phone?: string;
  email?: string;
  logoUrl?: string;
  sealUrl?: string;
  sessionName?: string;
}

interface DocumentStudentData {
  id: string;
  fullName: string;
  admissionNumber: string;
  rollNumber: number;
  className: string;
  sectionName: string;
  dateOfBirth: string;
  gender: string;
  avatarUrl?: string;
  fatherName?: string;
  motherName?: string;
  address?: string;
  phone?: string;
}

interface DocumentParentData {
  fullName: string;
  phone?: string;
  occupation?: string;
  address?: string;
}

// ─── STUDENT ID CARD ──────────────────────────────────────────────────────────
export const downloadStudentIdCardPdf = async (
  school: DocumentSchoolData,
  student: DocumentStudentData,
  principalSignatureUrl?: string,
  principalName: string = 'Principal'
) => {
  const container = document.createElement('div');
  container.style.position = 'absolute';
  container.style.left = '-9999px';
  container.style.top = '-9999px';
  container.style.width = '450px';
  container.style.background = '#0b1329';

  document.body.appendChild(container);

  const card = document.createElement('div');
  container.appendChild(card);

  // CRITICAL: ID Card standard layout (CR80 scale)
  card.className = "text-white p-5 border border-slate-800 rounded-3xl relative overflow-hidden shadow-2xl";
  card.style.width = '350px';
  card.style.height = '500px';
  card.style.boxSizing = 'border-box';
  card.style.fontFamily = 'system-ui, -apple-system, sans-serif';
  card.style.background = 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)';

  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(
    `${window.location.origin}/#verify/student/${student.id}`
  )}`;

  card.innerHTML = `
    <!-- Top Branding Accent Banner -->
    <div style="position: absolute; top: 0; left: 0; right: 0; height: 6px; background: linear-gradient(90deg, #4f46e5, #06b6d4);"></div>

    <!-- Header Block -->
    <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 20px;">
      <div style="width: 44px; height: 44px; border-radius: 50%; background-color: #ffffff; border: 1px solid #334155; overflow: hidden; display: flex; align-items: center; justify-content: center; shrink-0;">
        ${school.logoUrl ? `<img src="${school.logoUrl}" style="width: 100%; height: 100%; object-fit: cover;" />` : `<span style="font-weight: 800; color: #4f46e5; font-size: 18px;">${school.name.substring(0,1)}</span>`}
      </div>
      <div style="flex: 1; min-width: 0;">
        <h2 style="font-size: 13px; font-weight: 800; color: #f8fafc; margin: 0; text-transform: uppercase; letter-spacing: 0.5px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${school.name}</h2>
        <span style="font-size: 8px; color: #94a3b8; display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${school.address || 'Academic Center'}</span>
      </div>
    </div>

    <!-- Profile & Information Section -->
    <div style="display: flex; flex-direction: column; align-items: center; text-align: center; margin-bottom: 20px;">
      <div style="width: 90px; height: 90px; border-radius: 20px; border: 2.5px solid #4f46e5; overflow: hidden; background-color: #1e293b; display: flex; align-items: center; justify-content: center; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.3); margin-bottom: 12px;">
        ${student.avatarUrl ? `<img src="${student.avatarUrl}" style="width: 100%; height: 100%; object-fit: cover;" />` : `
          <svg style="width: 44px; height: 44px; color: #64748b;" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
          </svg>
        `}
      </div>
      <h3 style="font-size: 14px; font-weight: 700; color: #ffffff; margin: 0; uppercase">${student.fullName}</h3>
      <span style="font-size: 9px; font-weight: 600; color: #38bdf8; uppercase; letter-spacing: 1px; margin-top: 2px;">STUDENT CARD</span>
    </div>

    <!-- Details Grid -->
    <div style="background-color: rgba(15, 23, 42, 0.4); border: 1px solid rgba(51, 65, 85, 0.5); border-radius: 16px; padding: 12px; margin-bottom: 20px; font-size: 10px; line-height: 1.6; color: #cbd5e1;">
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="color: #64748b; font-weight: bold; width: 35%;">Admission No.</td>
          <td style="font-family: monospace; color: #ffffff;">: ${student.admissionNumber}</td>
        </tr>
        <tr>
          <td style="color: #64748b; font-weight: bold;">Class / Roll</td>
          <td style="color: #ffffff;">: ${student.className} ${student.sectionName ? `(${student.sectionName})` : ''} / #${student.rollNumber}</td>
        </tr>
        <tr>
          <td style="color: #64748b; font-weight: bold;">Date of Birth</td>
          <td style="color: #ffffff;">: ${new Date(student.dateOfBirth).toLocaleDateString('en-GB')}</td>
        </tr>
        <tr>
          <td style="color: #64748b; font-weight: bold;">Emergency No.</td>
          <td style="color: #38bdf8; font-weight: bold;">: ${student.phone || school.phone || 'N/A'}</td>
        </tr>
      </table>
    </div>

    <!-- Card Footer (QR & Signature) -->
    <div style="display: flex; align-items: flex-end; justify-content: space-between; border-top: 1px solid rgba(51, 65, 85, 0.4); padding-top: 10px;">
      <div style="width: 48px; height: 48px; display: flex; align-items: center; justify-content: center; background: white; padding: 2px; border-radius: 8px;">
        <img src="${qrUrl}" style="width: 100%; height: 100%; object-fit: contain;" />
      </div>

      <!-- Seal & Signature Overlay Container -->
      <div style="width: 130px; text-align: center; position: relative;">
        ${school.sealUrl ? `<img src="${school.sealUrl}" style="position: absolute; right: 10px; bottom: 12px; width: 36px; height: 36px; opacity: 0.4; pointer-events: none; object-fit: contain;" />` : ''}
        ${principalSignatureUrl ? `
          <div style="height: 24px; display: flex; align-items: center; justify-content: center; overflow: hidden; margin-bottom: 2px;">
            <img src="${principalSignatureUrl}" style="max-height: 100%; max-width: 100px; object-fit: contain;" />
          </div>
        ` : `
          <span style="font-family: 'Brush Script MT', cursive, sans-serif; color: #818cf8; font-size: 11px; display: block; margin-bottom: 2px;">${principalName}</span>
        `}
        <span style="font-size: 8px; color: #64748b; border-top: 1px solid rgba(226, 232, 240, 0.15); display: block; padding-top: 2px; text-transform: uppercase; font-weight: bold;">Authorized Sign</span>
      </div>
    </div>
  ${AEGIS_PDF_FOOTER}
  `;

  await new Promise(r => setTimeout(r, 800));

  try {
    const canvas = await html2canvas(card, {
      scale: 3,
      useCORS: true,
      logging: false,
      backgroundColor: null
    });

    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF({
      orientation: 'p',
      unit: 'mm',
      format: [85.6, 54] // Standard credit card size is 85.6mm x 54mm
    });

    const fileName = `idcard_${student.fullName.toLowerCase().replace(/\s+/g, '_')}.pdf`;
    if (Capacitor.isNativePlatform()) {
      const pdfBlob = pdf.output('blob');
      await downloadFile(pdfBlob, fileName);
    } else {
      pdf.save(fileName);
    }
  } catch (err) {
    console.error('Failed to export Student ID Card:', err);
    alert('An error occurred while generating the ID Card PDF.');
  } finally {
    document.body.removeChild(container);
  }
};

// ─── ADMISSION FORM ──────────────────────────────────────────────────────────
export const downloadAdmissionFormPdf = async (
  school: DocumentSchoolData,
  student: DocumentStudentData,
  parent?: DocumentParentData,
  principalSignatureUrl?: string,
  principalName: string = 'Registrar'
) => {
  const container = document.createElement('div');
  container.style.position = 'absolute';
  container.style.left = '-9999px';
  container.style.top = '-9999px';
  container.style.width = '800px';
  container.style.background = 'white';

  document.body.appendChild(container);

  const form = document.createElement('div');
  container.appendChild(form);

  form.className = "bg-white text-slate-800 p-10 border-4 border-double border-slate-400 w-[794px] min-h-[1100px] relative";
  form.style.boxSizing = 'border-box';
  form.style.fontFamily = 'Georgia, serif';

  form.innerHTML = `
    <!-- Header Block -->
    <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #334155; padding-bottom: 16px; margin-bottom: 24px;">
      <div style="width: 70px; height: 70px; display: flex; align-items: center; justify-content: center; border-radius: 50%; background-color: #f8fafc; border: 1px solid #cbd5e1; overflow: hidden;">
        ${school.logoUrl ? `<img src="${school.logoUrl}" style="width: 100%; height: 100%; object-fit: cover;" />` : `<span style="font-weight: bold; font-family: sans-serif; font-size: 26px; color: #1e293b;">${school.name.substring(0,1)}</span>`}
      </div>
      <div style="text-align: center; flex: 1; padding: 0 16px;">
        <h1 style="font-size: 22px; font-weight: 900; letter-spacing: 1px; color: #0f172a; margin: 0; font-family: sans-serif; text-transform: uppercase;">${school.name}</h1>
        <p style="font-size: 9px; color: #64748b; margin: 4px 0 0 0; font-family: sans-serif; text-transform: uppercase;">${school.address || ''}</p>
        <p style="font-size: 9px; color: #475569; margin: 2px 0 0 0; font-family: sans-serif; font-weight: 600;">Contact: ${school.phone || ''} | Email: ${school.email || ''}</p>
      </div>
      <div style="width: 90px; height: 100px; border: 1px dashed #94a3b8; display: flex; align-items: center; justify-content: center; background-color: #f8fafc; font-size: 9px; color: #64748b; text-align: center; font-family: sans-serif;">
        ${student.avatarUrl ? `<img src="${student.avatarUrl}" style="width: 100%; height: 100%; object-fit: cover;" />` : 'STUDENT<br/>PHOTO'}
      </div>
    </div>

    <!-- Title Banner -->
    <div style="background-color: #0f172a; color: white; text-align: center; padding: 8px; font-family: sans-serif; font-weight: bold; font-size: 13px; border-radius: 4px; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 24px;">
      Official Admission Registry Sheet
    </div>

    <!-- Block 1: Student Particulars -->
    <h3 style="font-size: 12px; font-weight: 800; border-bottom: 1.5px solid #0f172a; padding-bottom: 4px; color: #0f172a; text-transform: uppercase; font-family: sans-serif; margin-bottom: 12px;">1. Student Particulars</h3>
    <table style="width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 24px; line-height: 2;">
      <tr>
        <td style="width: 20%; font-weight: bold; color: #475569;">Full Name</td>
        <td style="width: 2%;">:</td>
        <td style="width: 78%; font-weight: bold; text-transform: uppercase; color: #0f172a;">${student.fullName}</td>
      </tr>
      <tr>
        <td style="font-weight: bold; color: #475569;">Admission No.</td>
        <td>:</td>
        <td style="font-family: monospace; font-weight: 600;">${student.admissionNumber}</td>
      </tr>
      <tr>
        <td style="font-weight: bold; color: #475569;">Class / Section</td>
        <td>:</td>
        <td>${student.className} ${student.sectionName ? `(${student.sectionName})` : ''} (Roll: #${student.rollNumber})</td>
      </tr>
      <tr>
        <td style="font-weight: bold; color: #475569;">Date of Birth</td>
        <td>:</td>
        <td>${new Date(student.dateOfBirth).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })}</td>
      </tr>
      <tr>
        <td style="font-weight: bold; color: #475569;">Gender Identity</td>
        <td>:</td>
        <td>${student.gender}</td>
      </tr>
      <tr>
        <td style="font-weight: bold; color: #475569;">Current Address</td>
        <td>:</td>
        <td>${student.address || 'N/A'}</td>
      </tr>
    </table>

    <!-- Block 2: Parent / Guardian Particulars -->
    <h3 style="font-size: 12px; font-weight: 800; border-bottom: 1.5px solid #0f172a; padding-bottom: 4px; color: #0f172a; text-transform: uppercase; font-family: sans-serif; margin-bottom: 12px;">2. Parent / Guardian Particulars</h3>
    <table style="width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 24px; line-height: 2;">
      <tr>
        <td style="width: 20%; font-weight: bold; color: #475569;">Father's Name</td>
        <td style="width: 2%;">:</td>
        <td style="width: 78%; font-weight: 600;">${student.fatherName || parent?.fullName || 'N/A'}</td>
      </tr>
      <tr>
        <td style="font-weight: bold; color: #475569;">Mother's Name</td>
        <td>:</td>
        <td style="font-weight: 600;">${student.motherName || 'N/A'}</td>
      </tr>
      <tr>
        <td style="font-weight: bold; color: #475569;">Occupation</td>
        <td>:</td>
        <td>${parent?.occupation || 'N/A'}</td>
      </tr>
      <tr>
        <td style="font-weight: bold; color: #475569;">Contact Phone</td>
        <td>:</td>
        <td>${student.phone || parent?.phone || 'N/A'}</td>
      </tr>
      <tr>
        <td style="font-weight: bold; color: #475569;">Home Address</td>
        <td>:</td>
        <td>${parent?.address || student.address || 'N/A'}</td>
      </tr>
    </table>

    <!-- Declaration Block -->
    <h3 style="font-size: 12px; font-weight: 800; border-bottom: 1.5px solid #0f172a; padding-bottom: 4px; color: #0f172a; text-transform: uppercase; font-family: sans-serif; margin-bottom: 12px;">3. Declaration</h3>
    <p style="font-size: 10px; line-height: 1.6; color: #334155; text-align: justify; margin-bottom: 48px;">
      I hereby declare that the information provided in this admission sheet is true and accurate to the best of my knowledge. I promise to abide by all the rules, codes of conduct, and academic regulations established by the institution's governing board.
    </p>

    <!-- Signatures Panel -->
    <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-top: 40px;">
      <div style="width: 200px; text-align: center; font-size: 10px; border-t: 1px solid #cbd5e1; padding-top: 6px;">
        <div style="height: 35px;"></div>
        <span style="font-weight: bold; color: #475569;">Parent / Guardian Signature</span>
      </div>

      <div style="width: 200px; text-align: center; position: relative; font-size: 10px;">
        ${school.sealUrl ? `<img src="${school.sealUrl}" style="position: absolute; right: 20px; bottom: 20px; width: 44px; height: 44px; opacity: 0.7; pointer-events: none; object-fit: contain;" />` : ''}
        ${principalSignatureUrl ? `
          <div style="height: 35px; display: flex; align-items: center; justify-content: center; overflow: hidden; margin-bottom: 4px;">
            <img src="${principalSignatureUrl}" style="max-height: 100%; max-width: 140px; object-fit: contain;" />
          </div>
        ` : `
          <div style="height: 35px;"></div>
        `}
        <span style="font-weight: bold; color: #475569; border-top: 1px solid #cbd5e1; display: block; padding-top: 6px;">${principalName} / Seal</span>
      </div>
    </div>
  ${AEGIS_PDF_FOOTER}
  `;

  await new Promise(r => setTimeout(r, 1000));

  try {
    const canvas = await html2canvas(form, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff'
    });

    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF({
      orientation: 'p',
      unit: 'mm',
      format: 'a4'
    });

    const fileName = `admission_${student.fullName.toLowerCase().replace(/\s+/g, '_')}.pdf`;
    if (Capacitor.isNativePlatform()) {
      const pdfBlob = pdf.output('blob');
      await downloadFile(pdfBlob, fileName);
    } else {
      pdf.save(fileName);
    }
  } catch (err) {
    console.error('Failed to export Admission Form:', err);
    alert('An error occurred while building the PDF admission form.');
  } finally {
    document.body.removeChild(container);
  }
};

// ─── TRANSFER CERTIFICATE ───────────────────────────────────────────────────
export const downloadTransferCertificatePdf = async (
  school: DocumentSchoolData,
  student: DocumentStudentData,
  principalSignatureUrl?: string,
  principalName: string = 'Principal'
) => {
  const container = document.createElement('div');
  container.style.position = 'absolute';
  container.style.left = '-9999px';
  container.style.top = '-9999px';
  container.style.width = '800px';
  container.style.background = 'white';

  document.body.appendChild(container);

  const tc = document.createElement('div');
  container.appendChild(tc);

  tc.className = "bg-white text-slate-800 p-12 border-[8px] border-double border-slate-650 w-[794px] min-h-[1100px] relative";
  tc.style.boxSizing = 'border-box';
  tc.style.fontFamily = 'Georgia, serif';

  tc.innerHTML = `
    <!-- Header Block -->
    <div style="text-align: center; border-bottom: 2px dashed #475569; padding-bottom: 16px; margin-bottom: 24px; position: relative;">
      ${school.logoUrl ? `<img src="${school.logoUrl}" style="position: absolute; left: 10px; top: 10px; width: 60px; height: 60px; object-fit: contain;" />` : ''}
      <h1 style="font-size: 22px; font-weight: bold; color: #1e293b; margin: 0; text-transform: uppercase;">${school.name}</h1>
      <p style="font-size: 9px; color: #64748b; margin: 4px 0 0 0; text-transform: uppercase;">${school.address || ''}</p>
      <p style="font-size: 9px; color: #475569; margin: 2px 0 0 0; font-weight: 600;">Contact: ${school.phone || ''} | Email: ${school.email || ''}</p>
      <div style="font-size: 14px; font-weight: 900; color: #1e293b; border: 1.5px solid #1e293b; border-radius: 4px; padding: 4px 16px; display: inline-block; margin-top: 16px; text-transform: uppercase; letter-spacing: 2px;">
        School Leaving / Transfer Certificate
      </div>
    </div>

    <!-- Details Content -->
    <div style="font-size: 12.5px; line-height: 2.2; text-align: justify; color: #1e293b;">
      <p>This is to certify that <strong style="text-transform: uppercase; font-size: 13px;">${student.fullName}</strong>, student of class <strong>${student.className}</strong> with Admission Number <strong>${student.admissionNumber}</strong>, has successfully cleared all institutional requirements and dues.</p>
      
      <table style="width: 100%; border-collapse: collapse; margin-top: 24px; margin-bottom: 24px; font-size: 11.5px; line-height: 2.5;">
        <tr>
          <td style="width: 35%; font-weight: bold; color: #475569;">1. Father's / Guardian's Name</td>
          <td style="color: #0f172a; font-weight: 600;">: ${student.fatherName || 'N/A'}</td>
        </tr>
        <tr>
          <td style="font-weight: bold; color: #475569;">2. Mother's Name</td>
          <td style="color: #0f172a; font-weight: 600;">: ${student.motherName || 'N/A'}</td>
        </tr>
        <tr>
          <td style="font-weight: bold; color: #475569;">3. Date of Birth (in Figures)</td>
          <td style="color: #0f172a;">: ${new Date(student.dateOfBirth).toLocaleDateString('en-GB')}</td>
        </tr>
        <tr>
          <td style="font-weight: bold; color: #475569;">4. Date of Admission</td>
          <td style="color: #0f172a;">: ${new Date().toLocaleDateString('en-GB')}</td>
        </tr>
        <tr>
          <td style="font-weight: bold; color: #475569;">5. Character & Conduct</td>
          <td style="color: #065f46; font-weight: bold;">: EXEMPLARY</td>
        </tr>
        <tr>
          <td style="font-weight: bold; color: #475569;">6. Reason for Leaving School</td>
          <td style="color: #0f172a; font-style: italic;">: Course Completion / Relocation</td>
        </tr>
      </table>

      <p>We wish the candidate every success and wisdom in all prospective academic aspirations.</p>
    </div>

    <!-- Signatures Panel -->
    <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-top: 80px; border-top: 1px solid #cbd5e1; padding-top: 20px;">
      <div style="width: 200px; text-align: center; font-size: 11px;">
        <span style="font-weight: bold; color: #475569; display: block; border-top: 1px solid #e2e8f0; padding-top: 6px;">Prepared By</span>
      </div>

      <div style="width: 200px; text-align: center; position: relative; font-size: 11px;">
        ${school.sealUrl ? `<img src="${school.sealUrl}" style="position: absolute; right: 20px; bottom: 20px; width: 48px; height: 48px; opacity: 0.75; pointer-events: none; object-fit: contain;" />` : ''}
        ${principalSignatureUrl ? `
          <div style="height: 38px; display: flex; align-items: center; justify-content: center; overflow: hidden; margin-bottom: 4px;">
            <img src="${principalSignatureUrl}" style="max-height: 100%; max-width: 140px; object-fit: contain;" />
          </div>
        ` : `
          <div style="height: 38px;"></div>
        `}
        <span style="font-weight: bold; color: #475569; border-top: 1px solid #cbd5e1; display: block; padding-top: 6px;">${principalName} / Seal</span>
      </div>
    </div>
  ${AEGIS_PDF_FOOTER}
  `;

  await new Promise(r => setTimeout(r, 1000));

  try {
    const canvas = await html2canvas(tc, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff'
    });

    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF({
      orientation: 'p',
      unit: 'mm',
      format: 'a4'
    });

    const fileName = `transfer_certificate_${student.fullName.toLowerCase().replace(/\s+/g, '_')}.pdf`;
    if (Capacitor.isNativePlatform()) {
      const pdfBlob = pdf.output('blob');
      await downloadFile(pdfBlob, fileName);
    } else {
      pdf.save(fileName);
    }
  } catch (err) {
    console.error('Failed to export Transfer Certificate:', err);
    alert('An error occurred while building the Transfer Certificate PDF.');
  } finally {
    document.body.removeChild(container);
  }
};

// ─── BONAFIDE CERTIFICATE ───────────────────────────────────────────────────
export const downloadBonafideCertificatePdf = async (
  school: DocumentSchoolData,
  student: DocumentStudentData,
  principalSignatureUrl?: string,
  principalName: string = 'Principal'
) => {
  const container = document.createElement('div');
  container.style.position = 'absolute';
  container.style.left = '-9999px';
  container.style.top = '-9999px';
  container.style.width = '800px';
  container.style.background = 'white';

  document.body.appendChild(container);

  const bc = document.createElement('div');
  container.appendChild(bc);

  bc.className = "bg-white text-slate-800 p-12 border-[8px] border-double border-slate-650 w-[794px] min-h-[1100px] relative";
  bc.style.boxSizing = 'border-box';
  bc.style.fontFamily = 'Georgia, serif';

  bc.innerHTML = `
    <!-- Header Block -->
    <div style="text-align: center; border-bottom: 2px dashed #475569; padding-bottom: 16px; margin-bottom: 24px; position: relative;">
      ${school.logoUrl ? `<img src="${school.logoUrl}" style="position: absolute; left: 10px; top: 10px; width: 60px; height: 60px; object-fit: contain;" />` : ''}
      <h1 style="font-size: 22px; font-weight: bold; color: #1e293b; margin: 0; text-transform: uppercase;">${school.name}</h1>
      <p style="font-size: 9px; color: #64748b; margin: 4px 0 0 0; text-transform: uppercase;">${school.address || ''}</p>
      <p style="font-size: 9px; color: #475569; margin: 2px 0 0 0; font-weight: 600;">Contact: ${school.phone || ''} | Email: ${school.email || ''}</p>
      <div style="font-size: 14px; font-weight: 900; color: #1e293b; border: 1.5px solid #1e293b; border-radius: 4px; padding: 4px 20px; display: inline-block; margin-top: 16px; text-transform: uppercase; letter-spacing: 2px;">
        Certificate of Bonafide Identity
      </div>
    </div>

    <!-- Details Content -->
    <div style="font-size: 13.5px; line-height: 2.2; text-align: justify; color: #1e293b; margin-top: 40px; margin-bottom: 40px;">
      <p>This is to officially verify and certify that <strong style="text-transform: uppercase; font-size: 14px; color: #0f172a;">${student.fullName}</strong>, son/daughter of <strong>${student.fatherName || 'N/A'}</strong>, is a bonafide student of <strong>${school.name}</strong>, enrolled in class <strong>${student.className}</strong> ${student.sectionName ? `section (${student.sectionName})` : ''} for the academic session <strong>${school.sessionName || '2025-2026'}</strong>.</p>
      
      <p>His/Her Admission Number in the master database registries is <strong>${student.admissionNumber}</strong> and his/her roll number is mapped to <strong>#${student.rollNumber}</strong>.</p>

      <p>To the best of our knowledge, the student bears a good moral character and conducts themselves with exemplary discipline in all institutional cycles.</p>

      <p>This certificate is issued at the request of the parent for verification purposes.</p>
    </div>

    <!-- Signatures Panel -->
    <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-top: 100px; border-top: 1px solid #cbd5e1; padding-top: 20px;">
      <div style="width: 200px; text-align: center; font-size: 11px;">
        <span style="font-weight: bold; color: #475569; display: block; border-top: 1px solid #e2e8f0; padding-top: 6px;">Prepared By</span>
      </div>

      <div style="width: 200px; text-align: center; position: relative; font-size: 11px;">
        ${school.sealUrl ? `<img src="${school.sealUrl}" style="position: absolute; right: 20px; bottom: 20px; width: 48px; height: 48px; opacity: 0.75; pointer-events: none; object-fit: contain;" />` : ''}
        ${principalSignatureUrl ? `
          <div style="height: 38px; display: flex; align-items: center; justify-content: center; overflow: hidden; margin-bottom: 4px;">
            <img src="${principalSignatureUrl}" style="max-height: 100%; max-width: 140px; object-fit: contain;" />
          </div>
        ` : `
          <div style="height: 38px;"></div>
        `}
        <span style="font-weight: bold; color: #475569; border-top: 1px solid #cbd5e1; display: block; padding-top: 6px;">${principalName} / Seal</span>
      </div>
    </div>
  ${AEGIS_PDF_FOOTER}
  `;

  await new Promise(r => setTimeout(r, 1000));

  try {
    const canvas = await html2canvas(bc, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff'
    });

    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF({
      orientation: 'p',
      unit: 'mm',
      format: 'a4'
    });

    const fileName = `bonafide_${student.fullName.toLowerCase().replace(/\s+/g, '_')}.pdf`;
    if (Capacitor.isNativePlatform()) {
      const pdfBlob = pdf.output('blob');
      await downloadFile(pdfBlob, fileName);
    } else {
      pdf.save(fileName);
    }
  } catch (err) {
    console.error('Failed to export Bonafide Certificate:', err);
    alert('An error occurred while building the Bonafide Certificate PDF.');
  } finally {
    document.body.removeChild(container);
  }
};

// ─── CERTIFICATE OF EXCELLENCE ──────────────────────────────────────────────
export const downloadCertificateOfExcellencePdf = async (
  school: DocumentSchoolData,
  student: DocumentStudentData,
  principalSignatureUrl?: string,
  principalName: string = 'Principal'
) => {
  const container = document.createElement('div');
  container.style.position = 'absolute';
  container.style.left = '-9999px';
  container.style.top = '-9999px';
  container.style.width = '1100px';
  container.style.background = 'white';

  document.body.appendChild(container);

  const cert = document.createElement('div');
  container.appendChild(cert);

  cert.className = "bg-white text-slate-800 p-16 border-[12px] border-double border-[#d4af37] w-[1050px] min-h-[742px] relative";
  cert.style.boxSizing = 'border-box';
  cert.style.fontFamily = 'Georgia, serif';
  cert.style.background = 'radial-gradient(circle, #ffffff 0%, #fafaf9 100%)';

  cert.innerHTML = `
    <!-- Top gold accent emblem -->
    <div style="text-align: center; margin-bottom: 20px;">
      ${school.logoUrl ? `<img src="${school.logoUrl}" style="width: 70px; height: 70px; object-fit: contain; margin-bottom: 12px;" />` : ''}
      <h2 style="font-family: sans-serif; font-size: 24px; font-weight: 800; color: #1e293b; letter-spacing: 2px; margin: 0; text-transform: uppercase;">${school.name}</h2>
      <p style="font-family: sans-serif; font-size: 9.5px; color: #64748b; margin: 4px 0 0 0; text-transform: uppercase; letter-spacing: 1px;">${school.address || ''}</p>
    </div>

    <!-- Title of Certificate -->
    <div style="text-align: center; margin-bottom: 36px; margin-top: 16px;">
      <h1 style="font-family: sans-serif; font-size: 32px; font-weight: 300; color: #b59410; margin: 0; text-transform: uppercase; letter-spacing: 6px;">Certificate of Excellence</h1>
      <div style="width: 120px; height: 2px; background-color: #d4af37; margin: 12px auto 0 auto;"></div>
    </div>

    <!-- Main citation details -->
    <div style="text-align: center; font-size: 15px; line-height: 2; color: #292524; max-width: 800px; margin: 0 auto;">
      <p style="margin: 0; font-style: italic;">This honor and recognition is proudly presented to</p>
      <h3 style="font-size: 26px; font-weight: bold; color: #1c1917; margin: 16px 0; text-transform: uppercase; letter-spacing: 2.5px;">${student.fullName}</h3>
      <p style="margin: 0; font-style: italic;">of class <strong>${student.className}</strong>, for displaying outstanding scholastic distinction, wisdom, and exemplary commitment to academic excellence in the current session cycle.</p>
    </div>

    <!-- Footer Seals & Signatures -->
    <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-top: 70px; padding: 0 48px;">
      <div style="width: 180px; text-align: center; font-size: 11px;">
        <span style="font-weight: bold; color: #475569; display: block; border-top: 1.5px solid #d4af37; padding-top: 6px;">Date of Award</span>
        <span style="font-family: monospace; font-size: 12px; font-weight: bold; color: #0f172a; display: block; margin-top: 4px;">${new Date().toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
      </div>

      <!-- Gold Certificate Emblem Seal placeholder -->
      <div style="width: 80px; height: 80px; display: flex; align-items: center; justify-content: center; border-radius: 50%; border: 3px double #d4af37; background: radial-gradient(circle, #fef08a 0%, #facc15 100%); box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
        ${school.sealUrl ? `<img src="${school.sealUrl}" style="width: 60%; height: 60%; object-fit: contain; opacity: 0.9;" />` : `
          <svg style="width: 32px; height: 32px; color: #b59410;" fill="currentColor" viewBox="0 0 20 20">
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
        `}
      </div>

      <div style="width: 180px; text-align: center; position: relative; font-size: 11px;">
        ${principalSignatureUrl ? `
          <div style="height: 38px; display: flex; align-items: center; justify-content: center; overflow: hidden; margin-bottom: 4px; z-index: 10;">
            <img src="${principalSignatureUrl}" style="max-height: 100%; max-width: 140px; object-fit: contain;" />
          </div>
        ` : `
          <div style="height: 38px;"></div>
        `}
        <span style="font-weight: bold; color: #475569; border-top: 1.5px solid #d4af37; display: block; padding-top: 6px;">${principalName} / Seal</span>
      </div>
    </div>
  ${AEGIS_PDF_FOOTER}
  `;

  await new Promise(r => setTimeout(r, 1000));

  try {
    const canvas = await html2canvas(cert, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff'
    });

    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF({
      orientation: 'l', // Landscape orientation
      unit: 'mm',
      format: 'a4'
    });

    // A4 Landscape is 297mm x 210mm
    const fileName = `excellence_certificate_${student.fullName.toLowerCase().replace(/\s+/g, '_')}.pdf`;
    if (Capacitor.isNativePlatform()) {
      const pdfBlob = pdf.output('blob');
      await downloadFile(pdfBlob, fileName);
    } else {
      pdf.save(fileName);
    }
  } catch (err) {
    console.error('Failed to export Certificate of Excellence:', err);
    alert('An error occurred while building the Certificate of Excellence.');
  } finally {
    document.body.removeChild(container);
  }
};
