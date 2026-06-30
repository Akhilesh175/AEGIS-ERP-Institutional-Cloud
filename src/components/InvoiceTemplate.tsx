import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { supabase } from '../lib/supabase';
import { downloadFile } from '../utils/downloadHelper';

const AEGIS_LOGO_URL = '/aegis-logo.png';

export interface InvoiceData {
  schoolId: string;
  schoolName: string;
  schoolAddress: string;
  schoolPhone: string;
  schoolEmail: string;
  schoolWebsite?: string;
  logoUrl?: string;
  sealUrl?: string;
  currencySymbol: string;
  invoiceNumber: string;
  billDate: string;
  dueDate: string;
  paymentDate?: string;
  billingCycle: string;
  academicYear: string;
  paymentMethod?: string;
  transactionId?: string;
  status: 'PAID' | 'PENDING' | 'OVERDUE' | 'UNPAID';
  studentName: string;
  studentClass: string;
  studentRollNo: string;
  studentAdmissionNo: string;
  studentId: string;
  studentPhoto?: string;
  parentName: string;
  parentPhone: string;
  parentEmail: string;
  parentRelation: string;
  amount: number;
  description?: string;
  feeItems?: {
    description: string;
    amount: number;
    discount?: number;
    lateFee?: number;
    tax?: number;
  }[];
}

function numberToWords(num: number): string {
  const a = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const g = ['', 'Thousand', 'Million', 'Billion'];
  
  const integerPart = Math.floor(num);
  if (integerPart === 0) return 'Zero Rupees Only';
  
  const helper = (n: number): string => {
    if (n < 20) return a[n];
    const digit = n % 10;
    if (n < 100) return b[Math.floor(n / 10)] + ' ' + a[digit];
    return a[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' and ' + helper(n % 100) : '');
  };
  
  const parts: string[] = [];
  let temp = integerPart;
  let idx = 0;
  while (temp > 0) {
    const chunk = temp % 1000;
    if (chunk) {
      const part = helper(chunk) + (g[idx] ? ' ' + g[idx] : '');
      parts.unshift(part);
    }
    temp = Math.floor(temp / 1000);
    idx++;
  }
  
  return 'Rupees ' + parts.join(' ') + ' Only';
}

export const downloadInvoicePdf = async (data: InvoiceData, isReceipt: boolean = false) => {
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
    console.error('Failed to fetch principal signature:', err);
  }

  const container = document.createElement('div');
  container.style.position = 'absolute';
  container.style.left = '-9999px';
  container.style.top = '-9999px';
  container.style.width = '794px';
  container.style.background = 'white';

  document.body.appendChild(container);

  const root = document.createElement('div');
  container.appendChild(root);

  root.className = "bg-white text-slate-800 p-8 border border-slate-200 font-sans w-[794px] min-h-[1123px] relative";
  root.style.boxSizing = 'border-box';
  root.style.fontFamily = 'Inter, system-ui, sans-serif';

  const isPaid = data.status === 'PAID';
  
  const items = data.feeItems && data.feeItems.length > 0 
    ? data.feeItems 
    : [{ description: data.description || 'Institutional Tuition Fee', amount: data.amount, discount: 0, lateFee: 0, tax: 0 }];

  let tableRowsHtml = '';
  let subtotal = 0;
  let totalDiscount = 0;
  let totalLateFee = 0;
  let totalTax = 0;

  items.forEach((item, index) => {
    const itemAmount = Number(item.amount) || 0;
    const itemDiscount = Number(item.discount) || 0;
    const itemLateFee = Number(item.lateFee) || 0;
    const itemTax = Number(item.tax) || 0;
    const itemTotal = itemAmount - itemDiscount + itemLateFee + itemTax;

    subtotal += itemAmount;
    totalDiscount += itemDiscount;
    totalLateFee += itemLateFee;
    totalTax += itemTax;

    tableRowsHtml += `
      <tr style="border-bottom: 1px solid #f1f5f9;">
        <td style="padding: 10px;">${index + 1}</td>
        <td style="padding: 10px; font-weight: bold; color: #1e293b;">${item.description}</td>
        <td style="padding: 10px; text-align: right;">${itemAmount.toFixed(2)}</td>
        <td style="padding: 10px; text-align: right;">${itemDiscount.toFixed(2)}</td>
        <td style="padding: 10px; text-align: right;">${itemLateFee.toFixed(2)}</td>
        <td style="padding: 10px; text-align: right;">${itemTax.toFixed(2)}</td>
        <td style="padding: 10px; text-align: right; font-weight: bold; color: #0f172a;">${itemTotal.toFixed(2)}</td>
      </tr>
    `;
  });

  const grandTotal = subtotal - totalDiscount + totalLateFee + totalTax;

  root.innerHTML = `
    <!-- Top Branding Header -->
    <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #10b981; padding-bottom: 16px; margin-bottom: 20px;">
      <div style="display: flex; align-items: center; gap: 12px;">
        <div style="width: 56px; height: 56px; border-radius: 12px; overflow: hidden; display: flex; align-items: center; justify-content: center; background: #ecfdf5; border: 1px solid #a7f3d0;">
          ${data.logoUrl ? `<img src="${data.logoUrl}" style="width: 100%; height: 100%; object-fit: cover;" />` : `<span style="font-size: 24px; font-weight: bold; color: #047857;">${data.schoolName.substring(0, 1)}</span>`}
        </div>
        <div>
          <h1 style="font-size: 18px; font-weight: 800; color: #064e3b; margin: 0; text-transform: uppercase;">${data.schoolName}</h1>
          <p style="font-size: 9px; color: #047857; font-weight: 500; margin: 2px 0 0 0; text-transform: uppercase; letter-spacing: 0.5px;">Reference Invoice Layout</p>
        </div>
      </div>
      <div style="text-align: right;">
        <span style="font-size: 9px; font-weight: 800; letter-spacing: 1px; color: white; background: ${isPaid ? '#10b981' : '#f59e0b'}; padding: 4px 10px; border-radius: 6px; text-transform: uppercase;">
          ${data.status}
        </span>
        <h2 style="font-size: 13px; font-weight: 800; color: #0f172a; margin: 10px 0 0 0; text-transform: uppercase;">
          ${isReceipt ? 'Receipt' : 'Invoice'}
        </h2>
        <p style="font-size: 10px; font-family: monospace; color: #64748b; margin: 2px 0 0 0;">
          #${data.invoiceNumber}
        </p>
      </div>
    </div>

    <!-- Contact & Meta block Grid -->
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 24px;">
      <div style="font-size: 10px; color: #475569; line-height: 1.5;">
        <p style="display: flex; align-items: center; gap: 6px; margin: 0;"><span style="color: #10b981;">📍</span> ${data.schoolAddress}</p>
        <p style="display: flex; align-items: center; gap: 6px; margin: 2px 0 0 0;"><span style="color: #10b981;">📞</span> ${data.schoolPhone}</p>
        <p style="display: flex; align-items: center; gap: 6px; margin: 2px 0 0 0;"><span style="color: #10b981;">✉️</span> ${data.schoolEmail}</p>
        ${data.schoolWebsite ? `<p style="display: flex; align-items: center; gap: 6px; margin: 2px 0 0 0;"><span style="color: #10b981;">🌐</span> ${data.schoolWebsite}</p>` : ''}
      </div>
      <div style="border-left: 2px solid #ecfdf5; padding-left: 20px; display: grid; grid-template-columns: 1.2fr 1.8fr; gap: 4px; font-size: 10px;">
        <span style="font-weight: 700; color: #64748b;">Bill Date</span>
        <span style="color: #0f172a;">: ${new Date(data.billDate).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })}</span>
        
        <span style="font-weight: 700; color: #64748b;">Due Date</span>
        <span style="color: #0f172a;">: ${new Date(data.dueDate).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })}</span>
        
        ${isPaid && data.paymentDate ? `
          <span style="font-weight: 700; color: #64748b;">Payment Date</span>
          <span style="color: #0f172a;">: ${new Date(data.paymentDate).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })}</span>
        ` : ''}

        <span style="font-weight: 700; color: #64748b;">Billing Cycle</span>
        <span style="color: #0f172a;">: ${data.billingCycle}</span>

        <span style="font-weight: 700; color: #64748b;">Academic Year</span>
        <span style="color: #0f172a;">: ${data.academicYear}</span>

        ${isPaid && data.paymentMethod ? `
          <span style="font-weight: 700; color: #64748b;">Payment Mode</span>
          <span style="color: #0f172a;">: ${data.paymentMethod}</span>
        ` : ''}

        ${isPaid && data.transactionId ? `
          <span style="font-weight: 700; color: #64748b;">Transaction ID</span>
          <span style="color: #0f172a; font-family: monospace;">: ${data.transactionId}</span>
        ` : ''}
      </div>
    </div>

    <!-- Billing Details Split Cards -->
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; border-top: 1px solid #e2e8f0; border-bottom: 1px solid #e2e8f0; padding: 16px 0; margin-bottom: 24px;">
      <div>
        <h3 style="font-size: 10px; font-weight: 800; letter-spacing: 0.5px; color: #047857; text-transform: uppercase; margin: 0 0 10px 0;">Billed To</h3>
        <div style="display: flex; gap: 10px; align-items: center;">
          <div style="width: 44px; height: 44px; border-radius: 50%; background: #ecfdf5; border: 1px solid #a7f3d0; overflow: hidden; display: flex; align-items: center; justify-content: center;">
            ${data.studentPhoto ? `<img src="${data.studentPhoto}" style="width: 100%; height: 100%; object-fit: cover;" />` : `<span style="font-size: 16px; font-weight: bold; color: #047857;">${data.studentName.substring(0, 1)}</span>`}
          </div>
          <div style="font-size: 10px; line-height: 1.4; color: #334155;">
            <strong style="font-size: 11px; color: #0f172a; text-transform: uppercase;">${data.studentName}</strong>
            <p style="margin: 1px 0 0 0;">Class: ${data.studentClass}</p>
            <p style="margin: 1px 0 0 0;">Roll No: ${data.studentRollNo}</p>
            <p style="margin: 1px 0 0 0;">Admission No: ${data.studentAdmissionNo}</p>
            <p style="margin: 1px 0 0 0; font-family: monospace; color: #64748b;">Student ID: ${data.studentId}</p>
          </div>
        </div>
      </div>
      <div style="border-left: 1px solid #f1f5f9; padding-left: 20px;">
        <h3 style="font-size: 10px; font-weight: 800; letter-spacing: 0.5px; color: #047857; text-transform: uppercase; margin: 0 0 10px 0;">Parent / Guardian</h3>
        <div style="font-size: 10px; line-height: 1.4; color: #334155;">
          <strong style="font-size: 11px; color: #0f172a;">${data.parentName}</strong>
          <span style="font-size: 9px; color: #64748b; margin-left: 4px;">(${data.parentRelation})</span>
          <p style="margin: 4px 0 0 0;">📞 ${data.parentPhone}</p>
          <p style="margin: 2px 0 0 0;">✉️ ${data.parentEmail}</p>
        </div>
      </div>
    </div>

    <!-- Fee details Table -->
    <div style="margin-bottom: 24px;">
      <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 10px;">
        <thead>
          <tr style="background: #f8fafc; color: #0f172a; border-bottom: 2px solid #cbd5e1; font-weight: bold;">
            <th style="padding: 10px; width: 6%;">#</th>
            <th style="padding: 10px;">DESCRIPTION</th>
            <th style="padding: 10px; text-align: right; width: 14%;">AMOUNT (${data.currencySymbol})</th>
            <th style="padding: 10px; text-align: right; width: 14%;">DISCOUNT (${data.currencySymbol})</th>
            <th style="padding: 10px; text-align: right; width: 14%;">LATE FEE (${data.currencySymbol})</th>
            <th style="padding: 10px; text-align: right; width: 12%;">TAX (${data.currencySymbol})</th>
            <th style="padding: 10px; text-align: right; width: 16%;">TOTAL (${data.currencySymbol})</th>
          </tr>
        </thead>
        <tbody style="color: #475569;">
          ${tableRowsHtml}
        </tbody>
      </table>
    </div>

    <!-- Subtotals and calculations -->
    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 30px;">
      <div style="max-width: 50%; font-size: 10px; color: #475569; line-height: 1.5;">
        <strong style="color: #0f172a; text-transform: uppercase;">Amount In Words</strong>
        <p style="margin: 4px 0 0 0; font-style: italic; font-weight: 600; color: #047857;">${numberToWords(grandTotal)}</p>
      </div>
      <div style="width: 240px; font-size: 10px; display: grid; grid-template-columns: 1.4fr 1fr; gap: 6px; text-align: right;">
        <span style="color: #64748b;">Subtotal</span>
        <span style="font-weight: 600; color: #0f172a;">${data.currencySymbol}${subtotal.toFixed(2)}</span>

        <span style="color: #64748b;">Discount</span>
        <span style="font-weight: 600; color: #0f172a;">${totalDiscount.toFixed(2)}</span>

        <span style="color: #64748b;">Late Fee</span>
        <span style="font-weight: 600; color: #0f172a;">${totalLateFee.toFixed(2)}</span>

        <span style="color: #64748b;">Tax</span>
        <span style="font-weight: 600; color: #0f172a;">${totalTax.toFixed(2)}</span>

        <span style="font-weight: 800; color: #047857; font-size: 11px; border-top: 1px solid #e2e8f0; padding-top: 6px;">Grand Total</span>
        <span style="font-weight: 800; color: #047857; font-size: 11px; border-top: 1px solid #e2e8f0; padding-top: 6px;">${data.currencySymbol}${grandTotal.toFixed(2)}</span>

        <span style="color: #64748b; font-weight: bold;">Paid Amount</span>
        <span style="font-weight: bold; color: #10b981;">${data.currencySymbol}${isPaid ? grandTotal.toFixed(2) : '0.00'}</span>

        <span style="color: #64748b; font-weight: bold;">Pending Amount</span>
        <span style="font-weight: bold; color: #ef4444;">${data.currencySymbol}${isPaid ? '0.00' : grandTotal.toFixed(2)}</span>
      </div>
    </div>

    <!-- Footer Verification & Signatory -->
    <div style="border-top: 1px solid #cbd5e1; padding-top: 16px; display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
      <div style="display: flex; align-items: center; gap: 12px; max-width: 50%;">
        <div style="width: 56px; height: 56px; border: 1px solid #e2e8f0; padding: 2px; background: white;">
          <img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent('https://www.aegiserp.xyz/verify/invoice/' + data.invoiceNumber)}" style="width: 100%; height: 100%;" />
        </div>
        <div style="font-size: 8.5px; color: #64748b; line-height: 1.4;">
          <strong style="color: #475569;">QR Code for Verification</strong>
          <p style="margin: 2px 0 0 0;">Scan to verify the authenticity of this official invoice on the AEGIS verification registry.</p>
        </div>
      </div>

      <div style="display: flex; gap: 16px; align-items: flex-end;">
        <div style="width: 130px; text-align: center; display: flex; flex-direction: column; align-items: center; font-size: 9px; position: relative;">
          ${data.sealUrl ? `
            <img src="${data.sealUrl}" style="position: absolute; left: 40px; top: -25px; width: 44px; height: 44px; opacity: 0.8; object-fit: contain; pointer-events: none;" />
          ` : ''}
          ${principalSignatureUrl ? `
            <div style="height: 30px; overflow: hidden; display: flex; align-items: center; justify-content: center; z-index: 10;">
              <img src="${principalSignatureUrl}" style="max-height: 100%; max-width: 110px; object-fit: contain;" />
            </div>
          ` : `
            <span style="font-family: 'Brush Script MT', cursive, sans-serif; color: #047857; font-size: 16px; height: 30px; line-height: 30px;">${principalName}</span>
          `}
          <span style="border-top: 1px solid #cbd5e1; padding-top: 4px; font-weight: bold; color: #64748b; width: 100%; margin-top: 4px; text-transform: uppercase;">Authorized Signatory</span>
        </div>
      </div>
    </div>

    <!-- Terms Disclaimer -->
    <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px; text-align: center; font-size: 9px; color: #64748b; margin-bottom: 24px; line-height: 1.4;">
      Thank you for choosing ${data.schoolName}.<br/>
      This is a computer generated invoice, does not require manual signature.
    </div>

    <!-- AEGIS ERP Watermark Footer -->
    <div style="border-top: 1px dashed #cbd5e1; padding-top: 10px; display: flex; align-items: center; justify-content: space-between; font-size: 8px; color: #94a3b8; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">
      <div style="display: flex; align-items: center; gap: 6px;">
        <img src="${AEGIS_LOGO_URL}" style="height: 14px; width: 14px; object-fit: contain;" />
        <span>Powered by AEGIS ERP - Institutional Cloud</span>
      </div>
      <span>&copy; 2026 AEGIS ERP. All Rights Reserved.</span>
    </div>
  `;

  await new Promise(r => setTimeout(r, 600));

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

    const pdfBlob = pdf.output('blob');
    const filename = isReceipt 
      ? `Receipt_${data.invoiceNumber.replace('INV-', 'RCP-')}.pdf`
      : `Invoice_${data.invoiceNumber}.pdf`;

    await downloadFile(pdfBlob, filename);
  } catch (err) {
    console.error('Failed to export Invoice A4 PDF:', err);
    alert('An error occurred while building the invoice PDF. Please try again.');
  } finally {
    document.body.removeChild(container);
  }
};
