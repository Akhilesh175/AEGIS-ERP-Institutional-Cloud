import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { supabase } from '../lib/supabase';

interface ReceiptData {
  schoolId: string;
  schoolName: string;
  schoolAddress: string;
  schoolPhone: string;
  schoolEmail: string;
  logoUrl?: string;
  sealUrl?: string;
  currencySymbol: string;
  studentName: string;
  studentId: string;
  admissionNumber?: string;
  className?: string;
  sectionName?: string;
  feeDescription: string;
  amount: number;
  paymentDate: string;
  paymentMethod: string;
  transactionId?: string;
}

export const downloadReceiptPdf = async (data: ReceiptData) => {
  // 1. Fetch Principal/School Admin Signature & Details dynamically from database
  let principalSignatureUrl = '';
  let principalName = 'Principal / School Admin';
  try {
    const { data: dbAdmin } = await supabase
      .from('school_admins')
      .select('signature_url, users(first_name, last_name)')
      .eq('school_id', data.schoolId)
      .eq('status', 'ACTIVE')
      .maybeSingle();
    if (dbAdmin) {
      if (dbAdmin.signature_url) {
        principalSignatureUrl = dbAdmin.signature_url;
      }
      if (dbAdmin.users) {
        const u = dbAdmin.users as any;
        principalName = `${u.first_name} ${u.last_name}`;
      }
    }
  } catch (err) {
    console.error('Failed to fetch principal signature for receipt:', err);
  }

  const container = document.createElement('div');
  container.style.position = 'absolute';
  container.style.left = '-9999px';
  container.style.top = '-9999px';
  container.style.width = '800px';
  container.style.background = 'white';

  document.body.appendChild(container);

  const root = document.createElement('div');
  container.appendChild(root);

  root.className = "bg-white text-slate-800 p-8 border-4 border-double border-slate-400 font-serif w-[794px] min-h-[500px] relative";
  root.style.boxSizing = 'border-box';
  root.style.fontFamily = 'Georgia, serif';

  const dateStr = new Date(data.paymentDate || Date.now()).toLocaleString();
  const receiptNo = data.transactionId || `REC-${Math.floor(100000 + Math.random() * 900000)}`;

  root.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #cbd5e1; padding-bottom: 16px; margin-bottom: 20px;">
      <div style="width: 64px; height: 64px; display: flex; align-items: center; justify-content: center; border-radius: 50%; background-color: #f1f5f9; border: 1px solid #cbd5e1; overflow: hidden; font-weight: bold; font-family: sans-serif; color: #0f172a; font-size: 24px;">
        ${data.logoUrl ? `<img src="${data.logoUrl}" style="width: 100%; height: 100%; object-fit: cover;" />` : data.schoolName.substring(0, 1)}
      </div>
      <div style="text-align: center; flex: 1; padding: 0 16px;">
        <h1 style="font-size: 20px; font-weight: 900; letter-spacing: 1.5px; color: #0f172a; margin: 0; font-family: sans-serif; text-transform: uppercase;">
          ${data.schoolName}
        </h1>
        <p style="font-size: 8.5px; color: #64748b; margin: 2px 0 0 0; font-family: sans-serif; text-transform: uppercase;">
          ${data.schoolAddress}
        </p>
        <p style="font-size: 9px; color: #475569; margin: 2px 0 0 0; font-family: sans-serif; font-weight: 600;">
          Contact: ${data.schoolPhone} | Email: ${data.schoolEmail}
        </p>
        <p style="font-size: 11px; color: #1e293b; font-weight: bold; text-transform: uppercase; margin: 8px 0 0 0; font-family: sans-serif; letter-spacing: 0.5px; text-decoration: underline;">
          Official Payment Receipt
        </p>
      </div>
      <div style="text-align: right; font-family: monospace; font-size: 10px; color: #475569;">
        <div style="font-weight: bold; color: #0f172a; font-size: 12px; margin-bottom: 4px;">RECEIPT</div>
        <div>No: ${receiptNo}</div>
        <div>Date: ${dateStr}</div>
      </div>
    </div>

    <div style="border: 1px solid #cbd5e1; padding: 12px; margin-bottom: 20px; font-size: 11px; line-height: 1.6; background-color: #f8fafc;">
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="width: 18%; font-weight: bold; color: #475569;">Student Name</td>
          <td style="width: 2%;">:</td>
          <td style="width: 30%; font-weight: bold; color: #0f172a; text-transform: uppercase;">${data.studentName}</td>
          <td style="width: 18%; font-weight: bold; color: #475569;">Student ID / Adm No.</td>
          <td style="width: 2%;">:</td>
          <td style="width: 30%; font-family: monospace; color: #0f172a;">${data.admissionNumber || data.studentId}</td>
        </tr>
        <tr>
          <td style="font-weight: bold; color: #475569;">Class & Section</td>
          <td>:</td>
          <td style="color: #0f172a; font-weight: 600;">${data.className || 'N/A'} ${data.sectionName ? `(${data.sectionName})` : ''}</td>
          <td style="font-weight: bold; color: #475569;">Payment Method</td>
          <td>:</td>
          <td style="color: #0f172a; font-weight: 600; font-family: monospace;">${data.paymentMethod}</td>
        </tr>
      </table>
    </div>

    <div style="margin-bottom: 20px;">
      <table style="width: 100%; border-collapse: collapse; border: 1px solid #cbd5e1; text-align: left; font-size: 11px;">
        <thead>
          <tr style="background-color: #f1f5f9; color: #0f172a; border-bottom: 1px solid #cbd5e1; font-family: sans-serif; font-weight: bold;">
            <th style="border: 1px solid #cbd5e1; padding: 8px;">Billing Component</th>
            <th style="border: 1px solid #cbd5e1; padding: 8px; text-align: right; width: 25%;">Amount Paid</th>
          </tr>
        </thead>
        <tbody style="font-family: sans-serif; color: #334155;">
          <tr>
            <td style="border: 1px solid #cbd5e1; padding: 12px; font-weight: 600; color: #0f172a;">${data.feeDescription}</td>
            <td style="border: 1px solid #cbd5e1; padding: 12px; text-align: right; font-family: monospace; font-weight: bold; color: #16a34a; font-size: 12px;">
              ${data.currencySymbol}${data.amount.toFixed(2)}
            </td>
          </tr>
          <tr style="background-color: #f8fafc; font-weight: bold; color: #0f172a;">
            <td style="border: 1px solid #cbd5e1; padding: 10px; text-align: right;">Total Amount Received:</td>
            <td style="border: 1px solid #cbd5e1; padding: 10px; text-align: right; font-family: monospace; color: #16a34a; font-size: 13px;">
              ${data.currencySymbol}${data.amount.toFixed(2)}
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-top: 40px; padding-top: 12px; border-top: 1px solid #e2e8f0;">
      <div style="font-size: 9px; color: #64748b; font-family: sans-serif; line-height: 1.4; max-w: 60%;">
        <p style="font-weight: bold; color: #475569; margin: 0 0 4px 0; text-transform: uppercase;">Disclaimer & Notes:</p>
        <p style="margin: 0;">This is an officially certified, system-generated payment receipt. For any billing queries, please contact the institution accounts division directly.</p>
        <p style="margin: 2px 0 0 0;">Transaction Ref: <strong style="font-family: monospace; color: #334155;">${receiptNo}</strong></p>
      </div>
      <div style="width: 200px; text-align: center; display: flex; flex-direction: column; align-items: center; justify-content: space-between; height: 75px; position: relative;">
        ${data.sealUrl ? `
          <img src="${data.sealUrl}" style="position: absolute; left: 10px; top: -10px; width: 48px; height: 48px; opacity: 0.75; pointer-events: none; object-fit: contain;" />
        ` : ''}
        ${principalSignatureUrl ? `
          <div style="height: 36px; display: flex; align-items: center; justify-content: center; overflow: hidden; z-index: 10;">
            <img src="${principalSignatureUrl}" style="max-height: 100%; max-width: 140px; object-fit: contain;" />
          </div>
        ` : `
          <span style="font-family: 'Brush Script MT', cursive, sans-serif; color: #312e81; font-size: 18px; padding-top: 8px;">${principalName}</span>
        `}
        <span style="font-size: 9px; font-weight: bold; color: #64748b; border-top: 1px solid #cbd5e1; padding-top: 4px; font-family: sans-serif; width: 100%;">Authorized Signature / Seal</span>
      </div>
    </div>
  `;

  await new Promise(r => setTimeout(r, 1000));

  try {
    const canvas = await html2canvas(root, {
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

    const imgWidth = 210;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
    pdf.save(`receipt_${receiptNo}.pdf`);
  } catch (err) {
    console.error('Failed to export Receipt PDF:', err);
    alert('An error occurred while building the Receipt PDF. Please try again.');
  } finally {
    document.body.removeChild(container);
  }
};
