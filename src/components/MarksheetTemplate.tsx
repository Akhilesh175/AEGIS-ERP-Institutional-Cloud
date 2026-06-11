import React from 'react';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { Award, ShieldAlert, CheckCircle2 } from 'lucide-react';

interface MarksheetSubject {
  subjectId: string;
  subjectName: string;
  preMid: number;
  midTerm: number;
  postMid: number;
  annual: number;
  practical: number;
  total: number;
  grade: string;
}

interface MarksheetData {
  school: {
    id: string;
    name: string;
    address: string;
    phone: string;
    email: string;
    sessionName: string;
    logoUrl?: string;
    sealUrl?: string;
  };
  student: {
    id: string;
    name: string;
    admissionNumber: string;
    rollNumber: number;
    className: string;
    sectionName: string;
    dateOfBirth: string;
    fatherName: string;
    motherName: string;
    address: string;
    avatarUrl: string;
  };
  academic: {
    term: string;
    subjects: MarksheetSubject[];
    classRank: number;
    attendance: {
      percentage: number;
      presentDays: number;
      workingDays: number;
    };
  };
  coScholastic: {
    artEducation: { term1: string; term2: string };
    games: { term1: string; term2: string };
    healthAndFitness: { term1: string; term2: string };
    sewa: { term1: string; term2: string };
    discipline: { term1: string; term2: string };
  };
  remarks: {
    classTeacherRemarks: string;
    dateOfIssue: string;
    reopeningDate: string;
    promotedClass: string;
    resultStatus: string;
  };
  signatures: {
    classTeacherName: string;
    classTeacherSignatureUrl?: string;
    principalName: string;
    principalSignatureUrl?: string;
  };
  verificationCode: string;
}

interface MarksheetTemplateProps {
  data: MarksheetData;
}

export const MarksheetTemplate: React.FC<MarksheetTemplateProps> = ({ data }) => {
  const verificationUrl = `${window.location.origin}/#verify/marksheet/${data.verificationCode}`;
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(verificationUrl)}`;

  // CBSE 8-points scale reference rows
  const gradingScale = [
    { range: '91-100', grade: 'A1' },
    { range: '81-90', grade: 'A2' },
    { range: '71-80', grade: 'B1' },
    { range: '61-70', grade: 'B2' },
    { range: '51-60', grade: 'C1' },
    { range: '41-50', grade: 'C2' },
    { range: '33-40', grade: 'D' },
    { range: '0-32', grade: 'E' }
  ];

  return (
    <div 
      id="marksheet-print-container" 
      className="bg-white text-slate-800 p-8 border-4 border-double border-slate-400 font-serif max-w-[800px] mx-auto shadow-2xl relative"
      style={{ boxSizing: 'border-box' }}
    >
      {/* HEADER SECTION */}
      <div className="flex justify-between items-center border-b border-slate-350 pb-4 mb-4">
        {/* School Logo */}
        <div className="w-16 h-16 shrink-0 flex items-center justify-center rounded-full bg-slate-100 border border-slate-300 overflow-hidden">
          {data.school.logoUrl ? (
            <img src={data.school.logoUrl} alt="Logo" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-gradient-to-tr from-brand-650 to-brand-450 flex items-center justify-center font-bold text-white text-2xl">
              {data.school.name.substring(0, 1)}
            </div>
          )}
        </div>

        {/* School Identity */}
        <div className="text-center flex-1 px-4">
          <h1 className="text-2xl font-black tracking-wider text-slate-900 font-sans uppercase">
            {data.school.name}
          </h1>
          <p className="text-[9px] text-slate-500 font-sans mt-0.5 max-w-[400px] mx-auto uppercase">
            {data.school.address}
          </p>
          <p className="text-[9.5px] text-slate-600 font-sans font-semibold mt-0.5">
            Contact: {data.school.phone} | Email: {data.school.email}
          </p>
          <p className="text-[10.5px] text-slate-800 font-bold uppercase mt-2 tracking-wide font-sans">
            ACADEMIC SESSION : {data.school.sessionName}
          </p>
          <p className="text-[11.5px] text-slate-900 font-bold uppercase tracking-widest font-sans underline mt-0.5">
            REPORT CARD : {data.student.className.toUpperCase()}
          </p>
        </div>

        {/* CBSE Logo / emblem */}
        <div className="w-16 h-16 shrink-0 flex items-center justify-center overflow-hidden">
          <img 
            src={qrCodeUrl} 
            alt="Verification QR" 
            className="w-16 h-16 border border-slate-300"
            title="Scan to Verify Marksheet"
          />
        </div>
      </div>

      {/* STUDENT PROFILE BOX */}
      <div className="border border-slate-400 p-3 mb-4 text-[11px] leading-relaxed">
        <div className="grid grid-cols-2 gap-x-6 gap-y-1">
          <div className="flex">
            <span className="w-28 font-bold text-slate-700">Name of Student</span>
            <span className="mr-2">:</span>
            <span className="font-bold text-slate-900 uppercase">{data.student.name}</span>
          </div>
          <div className="flex">
            <span className="w-28 font-bold text-slate-700">Admission No.</span>
            <span className="mr-2">:</span>
            <span className="font-mono text-slate-900">{data.student.admissionNumber}</span>
          </div>

          <div className="flex">
            <span className="w-28 font-bold text-slate-700">Father's Name</span>
            <span className="mr-2">:</span>
            <span className="text-slate-900 font-semibold">{data.student.fatherName}</span>
          </div>
          <div className="flex">
            <span className="w-28 font-bold text-slate-700">Attendance</span>
            <span className="mr-2">:</span>
            <span className="font-semibold text-slate-900">
              {data.academic.attendance.presentDays}/{data.academic.attendance.workingDays} ({data.academic.attendance.percentage}%)
            </span>
          </div>

          <div className="flex">
            <span className="w-28 font-bold text-slate-700">Mother's Name</span>
            <span className="mr-2">:</span>
            <span className="text-slate-900 font-semibold">{data.student.motherName}</span>
          </div>
          <div className="flex">
            <span className="w-28 font-bold text-slate-700">Address</span>
            <span className="mr-2">:</span>
            <span className="text-slate-700 truncate max-w-[200px]" title={data.student.address}>
              {data.student.address}
            </span>
          </div>

          <div className="flex">
            <span className="w-28 font-bold text-slate-700">Roll Number / Class</span>
            <span className="mr-2">:</span>
            <span className="font-semibold text-slate-900">
              {data.student.rollNumber} / {data.student.className} {data.student.sectionName ? `(${data.student.sectionName})` : ''}
            </span>
          </div>
          <div className="flex">
            <span className="w-28 font-bold text-slate-700">Date of Birth</span>
            <span className="mr-2">:</span>
            <span className="font-semibold text-slate-900">
              {new Date(data.student.dateOfBirth).toLocaleDateString('en-GB')}
            </span>
          </div>
        </div>
      </div>

      {/* SCHOLASTIC PERFORMANCE TABLE */}
      <div className="mb-4">
        <table className="w-full border-collapse border border-slate-400 text-center text-[10.5px]">
          <thead>
            {/* Main header row */}
            <tr className="bg-[#ffeb3b]/25 text-slate-900 border-b border-slate-400 font-sans font-bold">
              <th className="border border-slate-400 py-2 w-[28%] text-left pl-3">Scholastic</th>
              <th className="border border-slate-400 py-2" colSpan={2}>Term-1</th>
              <th className="border border-slate-400 py-2" colSpan={2}>Term-2</th>
              <th className="border border-slate-400 py-2 w-[12%]">Practical</th>
              <th className="border border-slate-400 py-2 w-[12%]">Total</th>
            </tr>
            {/* Sub headers */}
            <tr className="bg-[#e8f5e9] text-slate-800 border-b border-slate-400 font-sans text-[9.5px]">
              <th className="border border-slate-400 py-1.5 text-left pl-3">Subject</th>
              <th className="border border-slate-400 py-1.5 w-[12%]">Pre-Mid</th>
              <th className="border border-slate-400 py-1.5 w-[12%]">Mid-Term</th>
              <th className="border border-slate-400 py-1.5 w-[12%]">Post-Mid</th>
              <th className="border border-slate-400 py-1.5 w-[12%]">Annual</th>
              <th className="border border-slate-400 py-1.5">Marks</th>
              <th className="border border-slate-400 py-1.5">Marks</th>
            </tr>
            {/* Max marks */}
            <tr className="bg-[#f1f8e9] text-slate-600 border-b border-slate-400 font-mono text-[9px]">
              <td className="border border-slate-400 py-1 text-left pl-3 font-bold">Max Marks</td>
              <td className="border border-slate-400 py-1">10</td>
              <td className="border border-slate-400 py-1">30</td>
              <td className="border border-slate-400 py-1">10</td>
              <td className="border border-slate-400 py-1">30</td>
              <td className="border border-slate-400 py-1">20 / 50*</td>
              <td className="border border-slate-400 py-1 font-bold">100</td>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-400 font-sans text-slate-800">
            {data.academic.subjects.map(sub => (
              <tr key={sub.subjectId} className="hover:bg-slate-50/50">
                <td className="border border-slate-400 py-2 text-left pl-3 font-semibold text-slate-900">{sub.subjectName}</td>
                <td className="border border-slate-400 py-2 font-mono">{sub.preMid}</td>
                <td className="border border-slate-400 py-2 font-mono">{sub.midTerm}</td>
                <td className="border border-slate-400 py-2 font-mono">{sub.postMid}</td>
                <td className="border border-slate-400 py-2 font-mono">{sub.annual}</td>
                <td className="border border-slate-400 py-2 font-mono">
                  {sub.practical}
                  <span className="text-[8px] text-slate-400">{sub.subjectName === 'Info. Tech.' ? '*' : ''}</span>
                </td>
                <td className="border border-slate-400 py-2 font-mono font-bold text-slate-900">
                  {sub.total} <span className="text-[9px] font-normal text-brand-600">({sub.grade})</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-[7.5px] text-slate-500 italic mt-1 pl-1">
          * Note: Information Technology (Info. Tech.) has Practical Max Marks: 50, and Theory components scaled accordingly.
        </p>
      </div>

      {/* CO-SCHOLASTIC ACTIVITIES */}
      <div className="mb-4">
        <table className="w-full border-collapse border border-slate-400 text-center text-[10px]">
          <thead>
            <tr className="bg-[#ffeb3b]/25 text-slate-900 border-b border-slate-400 font-sans font-bold">
              <th className="border border-slate-400 py-1.5 w-[50%] text-left pl-3">Co-Scholastic Activities</th>
              <th className="border border-slate-400 py-1.5">Term I Grade</th>
              <th className="border border-slate-400 py-1.5">Term II Grade</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-400 font-sans text-slate-800">
            <tr>
              <td className="border border-slate-400 py-1.5 text-left pl-3">Art Education</td>
              <td className="border border-slate-400 py-1.5 font-bold">{data.coScholastic.artEducation.term1}</td>
              <td className="border border-slate-400 py-1.5 font-bold">{data.coScholastic.artEducation.term2}</td>
            </tr>
            <tr>
              <td className="border border-slate-400 py-1.5 text-left pl-3">Games</td>
              <td className="border border-slate-400 py-1.5 font-bold">{data.coScholastic.games.term1}</td>
              <td className="border border-slate-400 py-1.5 font-bold">{data.coScholastic.games.term2}</td>
            </tr>
            <tr>
              <td className="border border-slate-400 py-1.5 text-left pl-3">Health & Fitness</td>
              <td className="border border-slate-400 py-1.5 font-bold">{data.coScholastic.healthAndFitness.term1}</td>
              <td className="border border-slate-400 py-1.5 font-bold">{data.coScholastic.healthAndFitness.term2}</td>
            </tr>
            <tr>
              <td className="border border-slate-400 py-1.5 text-left pl-3">Sewa</td>
              <td className="border border-slate-400 py-1.5 font-bold">{data.coScholastic.sewa.term1}</td>
              <td className="border border-slate-400 py-1.5 font-bold">{data.coScholastic.sewa.term2}</td>
            </tr>
            <tr>
              <td className="border border-slate-400 py-1.5 text-left pl-3">Discipline</td>
              <td className="border border-slate-400 py-1.5 font-bold">{data.coScholastic.discipline.term1}</td>
              <td className="border border-slate-400 py-1.5 font-bold">{data.coScholastic.discipline.term2}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* RESULT OUTCOME SECTION */}
      <div className="flex justify-between items-center font-sans font-bold text-slate-900 text-xs px-2 mb-4">
        <div>
          <span>Promoted To Class: </span>
          <span className="underline text-brand-700">{data.remarks.promotedClass}</span>
        </div>
        <div>
          <span>Class Rank: </span>
          <span className="font-mono bg-slate-100 border border-slate-300 rounded px-1.5 py-0.5">{data.academic.classRank}</span>
        </div>
        <div>
          <span>Result: </span>
          <span className={`px-2 py-0.5 rounded ${data.remarks.resultStatus.toLowerCase() === 'pass' ? 'bg-emerald-100 text-emerald-800 border border-emerald-250' : 'bg-red-100 text-red-800'}`}>
            {data.remarks.resultStatus}
          </span>
        </div>
      </div>

      <div className="text-[11px] font-bold text-slate-800 mb-4 bg-slate-50 border border-slate-300 rounded p-2.5">
        School Will Re-Open On : <span className="text-brand-650">{data.remarks.reopeningDate}</span>
      </div>

      {/* REMARKS & SIGNATURE BLOCK */}
      <div className="border border-slate-400 mb-4 text-[11px]">
        {/* Remarks Row */}
        <div className="flex border-b border-slate-400">
          <div className="w-[28%] bg-[#ffeb3b]/15 border-r border-slate-400 p-3 flex items-center font-sans font-bold text-slate-700">
            Class Teacher's Remarks
          </div>
          <div className="flex-1 p-3 font-semibold text-slate-800 italic leading-relaxed">
            "{data.remarks.classTeacherRemarks}"
          </div>
        </div>
        {/* Signatures Row */}
        <div className="flex text-center">
          <div className="w-[28%] bg-[#ffeb3b]/15 border-r border-slate-400 p-3 flex flex-col justify-between h-20">
            <span className="font-bold text-slate-650 text-[10px]">Date of Issue</span>
            <span className="font-mono text-slate-900 font-semibold">{data.remarks.dateOfIssue}</span>
          </div>
          <div className="flex-1 border-r border-slate-400 p-3 flex flex-col justify-between h-20 relative">
            {data.signatures.classTeacherSignatureUrl ? (
              <div className="h-10 flex items-center justify-center overflow-hidden">
                <img src={data.signatures.classTeacherSignatureUrl} alt="Class Teacher Signature" className="max-h-full max-w-[150px] object-contain" />
              </div>
            ) : (
              <span className="font-cursive text-indigo-800 text-lg leading-none pt-2">{data.signatures.classTeacherName}</span>
            )}
            <span className="text-[10px] font-bold text-slate-500 border-t border-slate-200 pt-1">Signature of Class Teacher</span>
          </div>
          <div className="flex-1 p-3 flex flex-col justify-between h-20 relative overflow-visible">
            {data.school.sealUrl && (
              <img 
                src={data.school.sealUrl} 
                alt="School Seal" 
                className="absolute right-2 top-1 w-12 h-12 opacity-80 pointer-events-none object-contain" 
              />
            )}
            {data.signatures.principalSignatureUrl ? (
              <div className="h-10 flex items-center justify-center overflow-hidden">
                <img src={data.signatures.principalSignatureUrl} alt="Principal Signature" className="max-h-full max-w-[150px] object-contain" />
              </div>
            ) : (
              <span className="font-cursive text-indigo-800 text-lg leading-none pt-2">{data.signatures.principalName}</span>
            )}
            <span className="text-[10px] font-bold text-slate-500 border-t border-slate-200 pt-1">Signature of Principal</span>
          </div>
        </div>
      </div>

      {/* RULES & REFERENCE */}
      <div className="text-[8px] text-slate-500 font-sans leading-relaxed border-t border-slate-300 pt-3">
        <p className="font-bold text-slate-700 uppercase mb-1">Rules:-</p>
        <ol className="list-decimal pl-4 space-y-0.5">
          <li>The students are expected to keep this card neat and clean.</li>
          <li>In case the card is lost the duplicate card will be issued on payment of extra report card fee.</li>
          <li>Promotion will be granted on the weight of both examinations. To pass the monthly tests is also compulsory.</li>
          <li>For any complaint at any point, kindly contact personally.</li>
        </ol>

        <p className="font-bold text-slate-700 uppercase mt-3 mb-1">Grading scale for scholastic areas: Grades are awarded on an 8-points grading scale as follows-</p>
        <table className="w-full border-collapse border border-slate-300 text-center font-mono">
          <thead>
            <tr className="bg-[#ffeb3b]/10 text-[7.5px] font-bold">
              <th className="border border-slate-350 p-1 w-[20%] text-left pl-2 font-serif uppercase">Marks Range (%)</th>
              {gradingScale.map(item => (
                <th key={item.grade} className="border border-slate-350 p-1">{item.range}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className="text-[7.5px]">
              <td className="border border-slate-350 p-1 text-left pl-2 font-bold font-serif uppercase bg-[#ffeb3b]/10">Grade</td>
              {gradingScale.map(item => (
                <td key={item.grade} className="border border-slate-350 p-1 font-bold text-brand-650">{item.grade}</td>
              ))}
            </tr>
          </tbody>
        </table>
        
        {/* Verification Info */}
        <div className="mt-4 flex items-center justify-between border-t border-slate-200 pt-2 text-[7.5px] text-slate-400">
          <span>Verification Code: <strong className="font-mono text-slate-600">{data.verificationCode}</strong></span>
          <span>Officially generated by Aegis institutional ERP cloud security pipelines</span>
        </div>
      </div>
    </div>
  );
};

// HELPER FUNCTION TO GENERATE AND DOWNLOAD PDF CLIENT SIDE
export const downloadMarksheetPdf = async (studentName: string, term: string, marksheetData: MarksheetData) => {
  const container = document.createElement('div');
  container.style.position = 'absolute';
  container.style.left = '-9999px';
  container.style.top = '-9999px';
  container.style.width = '800px';
  container.style.background = 'white';

  document.body.appendChild(container);

  // Render wrapper component
  const root = document.createElement('div');
  container.appendChild(root);

  // We will temporarily render the marksheet using React's render or simple dynamic rendering
  // Since we want this to execute smoothly synchronously, we render inside portal or directly clone
  // Wait, let's render the HTML structure matching MarksheetTemplate manually to avoid react-dom portal issues
  const verificationUrl = `${window.location.origin}/#verify/marksheet/${marksheetData.verificationCode}`;
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(verificationUrl)}`;

  const gradingScale = [
    { range: '91-100', grade: 'A1' },
    { range: '81-90', grade: 'A2' },
    { range: '71-80', grade: 'B1' },
    { range: '61-70', grade: 'B2' },
    { range: '51-60', grade: 'C1' },
    { range: '41-50', grade: 'C2' },
    { range: '33-40', grade: 'D' },
    { range: '0-32', grade: 'E' }
  ];

  root.className = "bg-white text-slate-800 p-8 border-4 border-double border-slate-400 font-serif w-[794px] min-h-[1120px] relative";
  root.style.boxSizing = 'border-box';
  root.style.fontFamily = 'Georgia, serif';

  const dateOfBirthStr = new Date(marksheetData.student.dateOfBirth).toLocaleDateString('en-GB');

  root.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #cbd5e1; padding-bottom: 16px; margin-bottom: 16px;">
      <div style="width: 64px; height: 64px; display: flex; align-items: center; justify-content: center; border-radius: 50%; background-color: #f1f5f9; border: 1px solid #cbd5e1; overflow: hidden; font-weight: bold; font-family: sans-serif; color: #059669; font-size: 24px;">
        ${marksheetData.school.logoUrl ? `<img src="${marksheetData.school.logoUrl}" style="width: 100%; height: 100%; object-fit: cover;" />` : marksheetData.school.name.substring(0, 1)}
      </div>
      <div style="text-align: center; flex: 1; padding: 0 16px;">
        <h1 style="font-size: 20px; font-weight: 900; letter-spacing: 1.5px; color: #0f172a; margin: 0; font-family: sans-serif; text-transform: uppercase;">
          ${marksheetData.school.name}
        </h1>
        <p style="font-size: 8.5px; color: #64748b; margin: 2px 0 0 0; font-family: sans-serif; text-transform: uppercase;">
          ${marksheetData.school.address}
        </p>
        <p style="font-size: 9px; color: #475569; margin: 2px 0 0 0; font-family: sans-serif; font-weight: 600;">
          Contact: ${marksheetData.school.phone} | Email: ${marksheetData.school.email}
        </p>
        <p style="font-size: 10px; color: #1e293b; font-weight: bold; text-transform: uppercase; margin: 8px 0 0 0; font-family: sans-serif; letter-spacing: 0.5px;">
          ACADEMIC SESSION : ${marksheetData.school.sessionName}
        </p>
        <p style="font-size: 11px; color: #0f172a; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; font-family: sans-serif; text-decoration: underline; margin: 2px 0 0 0;">
          REPORT CARD : ${marksheetData.student.className.toUpperCase()}
        </p>
      </div>
      <div style="width: 64px; height: 64px; display: flex; align-items: center; justify-content: center;">
        <img src="${qrCodeUrl}" style="width: 64px; height: 64px; border: 1px solid #cbd5e1;" />
      </div>
    </div>

    <div style="border: 1px solid #94a3b8; padding: 12px; margin-bottom: 16px; font-size: 10.5px; line-height: 1.6;">
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="width: 15%; font-weight: bold; color: #334155;">Name of Student</td>
          <td style="width: 2%;">:</td>
          <td style="width: 33%; font-weight: bold; color: #0f172a; text-transform: uppercase;">${marksheetData.student.name}</td>
          <td style="width: 15%; font-weight: bold; color: #334155;">Admission No.</td>
          <td style="width: 2%;">:</td>
          <td style="width: 33%; font-family: monospace; color: #0f172a;">${marksheetData.student.admissionNumber}</td>
        </tr>
        <tr>
          <td style="font-weight: bold; color: #334155;">Father's Name</td>
          <td>:</td>
          <td style="color: #0f172a; font-weight: 600;">${marksheetData.student.fatherName}</td>
          <td style="font-weight: bold; color: #334155;">Attendance</td>
          <td>:</td>
          <td style="color: #0f172a; font-weight: 600;">${marksheetData.academic.attendance.presentDays}/${marksheetData.academic.attendance.workingDays} (${marksheetData.academic.attendance.percentage}%)</td>
        </tr>
        <tr>
          <td style="font-weight: bold; color: #334155;">Mother's Name</td>
          <td>:</td>
          <td style="color: #0f172a; font-weight: 600;">${marksheetData.student.motherName}</td>
          <td style="font-weight: bold; color: #334155;">Address</td>
          <td>:</td>
          <td style="color: #475569; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 180px;">${marksheetData.student.address}</td>
        </tr>
        <tr>
          <td style="font-weight: bold; color: #334155;">Roll Number / Class</td>
          <td>:</td>
          <td style="color: #0f172a; font-weight: 600;">${marksheetData.student.rollNumber} / ${marksheetData.student.className} ${marksheetData.student.sectionName ? `(${marksheetData.student.sectionName})` : ''}</td>
          <td style="font-weight: bold; color: #334155;">Date of Birth</td>
          <td>:</td>
          <td style="color: #0f172a; font-weight: 600;">${dateOfBirthStr}</td>
        </tr>
      </table>
    </div>

    <div style="margin-bottom: 16px;">
      <table style="width: 100%; border-collapse: collapse; border: 1px solid #94a3b8; text-align: center; font-size: 10px;">
        <thead>
          <tr style="background-color: rgba(255, 235, 59, 0.15); color: #0f172a; border-bottom: 1px solid #94a3b8; font-family: sans-serif; font-weight: bold;">
            <th style="border: 1px solid #94a3b8; padding: 6px; text-align: left; padding-left: 12px; width: 28%;">Scholastic</th>
            <th style="border: 1px solid #94a3b8; padding: 6px;" colspan="2">Term-1</th>
            <th style="border: 1px solid #94a3b8; padding: 6px;" colspan="2">Term-2</th>
            <th style="border: 1px solid #94a3b8; padding: 6px; width: 12%;">Practical</th>
            <th style="border: 1px solid #94a3b8; padding: 6px; width: 12%;">Total</th>
          </tr>
          <tr style="background-color: #e8f5e9; color: #1e293b; border-bottom: 1px solid #94a3b8; font-family: sans-serif; font-size: 9px;">
            <th style="border: 1px solid #94a3b8; padding: 4px; text-align: left; padding-left: 12px;">Subject</th>
            <th style="border: 1px solid #94a3b8; padding: 4px; width: 12%;">Pre-Mid</th>
            <th style="border: 1px solid #94a3b8; padding: 4px; width: 12%;">Mid-Term</th>
            <th style="border: 1px solid #94a3b8; padding: 4px; width: 12%;">Post-Mid</th>
            <th style="border: 1px solid #94a3b8; padding: 4px; width: 12%;">Annual</th>
            <th style="border: 1px solid #94a3b8; padding: 4px;">Marks</th>
            <th style="border: 1px solid #94a3b8; padding: 4px;">Marks</th>
          </tr>
          <tr style="background-color: #f1f8e9; color: #475569; border-bottom: 1px solid #94a3b8; font-family: monospace; font-size: 8.5px;">
            <td style="border: 1px solid #94a3b8; padding: 3px; text-align: left; padding-left: 12px; font-weight: bold; font-family: serif;">Max Marks</td>
            <td style="border: 1px solid #94a3b8; padding: 3px;">10</td>
            <td style="border: 1px solid #94a3b8; padding: 3px;">30</td>
            <td style="border: 1px solid #94a3b8; padding: 3px;">10</td>
            <td style="border: 1px solid #94a3b8; padding: 3px;">30</td>
            <td style="border: 1px solid #94a3b8; padding: 3px;">20/50*</td>
            <td style="border: 1px solid #94a3b8; padding: 3px; font-weight: bold;">100</td>
          </tr>
        </thead>
        <tbody style="font-family: sans-serif; color: #334155;">
          ${marksheetData.academic.subjects.map(sub => `
            <tr>
              <td style="border: 1px solid #94a3b8; padding: 6px; text-align: left; padding-left: 12px; font-weight: 600; color: #0f172a;">${sub.subjectName}</td>
              <td style="border: 1px solid #94a3b8; padding: 6px; font-family: monospace;">${sub.preMid}</td>
              <td style="border: 1px solid #94a3b8; padding: 6px; font-family: monospace;">${sub.midTerm}</td>
              <td style="border: 1px solid #94a3b8; padding: 6px; font-family: monospace;">${sub.postMid}</td>
              <td style="border: 1px solid #94a3b8; padding: 6px; font-family: monospace;">${sub.annual}</td>
              <td style="border: 1px solid #94a3b8; padding: 6px; font-family: monospace;">${sub.practical}${sub.subjectName === 'Info. Tech.' ? '*' : ''}</td>
              <td style="border: 1px solid #94a3b8; padding: 6px; font-family: monospace; font-weight: bold; color: #0f172a;">
                ${sub.total} <span style="font-size: 8px; font-family: sans-serif; font-weight: normal; color: #4f46e5;">(${sub.grade})</span>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      <p style="font-size: 7px; color: #64748b; margin: 4px 0 0 2px; font-style: italic;">
        * Note: Information Technology (Info. Tech.) has Practical Max Marks: 50, and Theory components scaled accordingly.
      </p>
    </div>

    <div style="margin-bottom: 16px;">
      <table style="width: 100%; border-collapse: collapse; border: 1px solid #94a3b8; text-align: center; font-size: 9px;">
        <thead>
          <tr style="background-color: rgba(255, 235, 59, 0.15); color: #0f172a; border-bottom: 1px solid #94a3b8; font-family: sans-serif; font-weight: bold;">
            <th style="border: 1px solid #94a3b8; padding: 4px; width: 50%; text-align: left; padding-left: 12px;">Co-Scholastic Activities</th>
            <th style="border: 1px solid #94a3b8; padding: 4px;">Term I Grade</th>
            <th style="border: 1px solid #94a3b8; padding: 4px;">Term II Grade</th>
          </tr>
        </thead>
        <tbody style="font-family: sans-serif; color: #334155;">
          <tr>
            <td style="border: 1px solid #94a3b8; padding: 4px; text-align: left; padding-left: 12px;">Art Education</td>
            <td style="border: 1px solid #94a3b8; padding: 4px; font-weight: bold;">${marksheetData.coScholastic.artEducation.term1}</td>
            <td style="border: 1px solid #94a3b8; padding: 4px; font-weight: bold;">${marksheetData.coScholastic.artEducation.term2}</td>
          </tr>
          <tr>
            <td style="border: 1px solid #94a3b8; padding: 4px; text-align: left; padding-left: 12px;">Games</td>
            <td style="border: 1px solid #94a3b8; padding: 4px; font-weight: bold;">${marksheetData.coScholastic.games.term1}</td>
            <td style="border: 1px solid #94a3b8; padding: 4px; font-weight: bold;">${marksheetData.coScholastic.games.term2}</td>
          </tr>
          <tr>
            <td style="border: 1px solid #94a3b8; padding: 4px; text-align: left; padding-left: 12px;">Health & Fitness</td>
            <td style="border: 1px solid #94a3b8; padding: 4px; font-weight: bold;">${marksheetData.coScholastic.healthAndFitness.term1}</td>
            <td style="border: 1px solid #94a3b8; padding: 4px; font-weight: bold;">${marksheetData.coScholastic.healthAndFitness.term2}</td>
          </tr>
          <tr>
            <td style="border: 1px solid #94a3b8; padding: 4px; text-align: left; padding-left: 12px;">Sewa</td>
            <td style="border: 1px solid #94a3b8; padding: 4px; font-weight: bold;">${marksheetData.coScholastic.sewa.term1}</td>
            <td style="border: 1px solid #94a3b8; padding: 4px; font-weight: bold;">${marksheetData.coScholastic.sewa.term2}</td>
          </tr>
          <tr>
            <td style="border: 1px solid #94a3b8; padding: 4px; text-align: left; padding-left: 12px;">Discipline</td>
            <td style="border: 1px solid #94a3b8; padding: 4px; font-weight: bold;">${marksheetData.coScholastic.discipline.term1}</td>
            <td style="border: 1px solid #94a3b8; padding: 4px; font-weight: bold;">${marksheetData.coScholastic.discipline.term2}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div style="display: flex; justify-content: space-between; align-items: center; font-family: sans-serif; font-weight: bold; color: #0f172a; font-size: 11px; padding: 0 4px; margin-bottom: 16px;">
      <div>
        <span>Promoted To Class: </span>
        <span style="text-decoration: underline; color: #312e81;">${marksheetData.remarks.promotedClass}</span>
      </div>
      <div>
        <span>Class Rank: </span>
        <span style="font-family: monospace; background-color: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 4px; padding: 1px 6px;">${marksheetData.academic.classRank}</span>
      </div>
      <div>
        <span>Result: </span>
        <span style="padding: 1px 8px; border-radius: 4px; background-color: #d1fae5; color: #065f46; border: 1px solid #a7f3d0;">${marksheetData.remarks.resultStatus}</span>
      </div>
    </div>

    <div style="font-size: 10px; font-weight: bold; color: #1e293b; margin-bottom: 16px; background-color: #f8fafc; border: 1px solid #cbd5e1; border-radius: 4px; padding: 8px;">
      School Will Re-Open On : <span style="color: #4338ca;">${marksheetData.remarks.reopeningDate}</span>
    </div>

    <div style="border: 1px solid #94a3b8; margin-bottom: 16px; font-size: 10px;">
      <div style="display: flex; border-bottom: 1px solid #94a3b8;">
        <div style="width: 28%; background-color: rgba(255, 235, 59, 0.08); border-right: 1px solid #94a3b8; padding: 10px; display: flex; align-items: center; font-family: sans-serif; font-weight: bold; color: #475569;">
          Class Teacher's Remarks
        </div>
        <div style="flex: 1; padding: 10px; font-weight: 600; color: #1e293b; font-style: italic; line-height: 1.4;">
          "${marksheetData.remarks.classTeacherRemarks}"
        </div>
      </div>
      <div style="display: flex; text-align: center;">
        <div style="width: 28%; background-color: rgba(255, 235, 59, 0.08); border-right: 1px solid #94a3b8; padding: 10px; display: flex; flex-direction: column; justify-content: space-between; height: 70px; box-sizing: border-box;">
          <span style="font-weight: bold; color: #475569; font-size: 9px; font-family: sans-serif;">Date of Issue</span>
          <span style="font-family: monospace; color: #0f172a; font-weight: 600;">${marksheetData.remarks.dateOfIssue}</span>
        </div>
        <div style="flex: 1; border-right: 1px solid #94a3b8; padding: 10px; display: flex; flex-direction: column; justify-content: space-between; height: 70px; box-sizing: border-box; position: relative;">
          ${marksheetData.signatures.classTeacherSignatureUrl ? `
            <div style="height: 32px; display: flex; align-items: center; justify-content: center; overflow: hidden; margin-top: 4px;">
              <img src="${marksheetData.signatures.classTeacherSignatureUrl}" style="max-height: 100%; max-width: 120px; object-fit: contain;" />
            </div>
          ` : `
            <span style="font-family: 'Brush Script MT', cursive, sans-serif; color: #312e81; font-size: 16px; padding-top: 4px;">${marksheetData.signatures.classTeacherName}</span>
          `}
          <span style="font-size: 9px; font-weight: bold; color: #64748b; border-top: 1px solid #e2e8f0; padding-top: 4px; font-family: sans-serif;">Signature of Class Teacher</span>
        </div>
        <div style="flex: 1; padding: 10px; display: flex; flex-direction: column; justify-content: space-between; height: 70px; box-sizing: border-box; position: relative;">
          ${marksheetData.school.sealUrl ? `
            <img src="${marksheetData.school.sealUrl}" style="position: absolute; right: 8px; top: 4px; width: 44px; height: 44px; opacity: 0.8; pointer-events: none; object-fit: contain;" />
          ` : ''}
          ${marksheetData.signatures.principalSignatureUrl ? `
            <div style="height: 32px; display: flex; align-items: center; justify-content: center; overflow: hidden; margin-top: 4px;">
              <img src="${marksheetData.signatures.principalSignatureUrl}" style="max-height: 100%; max-width: 120px; object-fit: contain;" />
            </div>
          ` : `
            <span style="font-family: 'Brush Script MT', cursive, sans-serif; color: #312e81; font-size: 16px; padding-top: 4px;">${marksheetData.signatures.principalName}</span>
          `}
          <span style="font-size: 9px; font-weight: bold; color: #64748b; border-top: 1px solid #e2e8f0; padding-top: 4px; font-family: sans-serif;">Signature of Principal</span>
        </div>
      </div>
    </div>

    <div style="font-size: 7.5px; color: #64748b; font-family: sans-serif; line-height: 1.5; border-top: 1px solid #e2e8f0; padding-top: 12px;">
      <p style="font-weight: bold; color: #334155; margin: 0 0 4px 0; text-transform: uppercase;">Rules:-</p>
      <ol style="margin: 0; padding-left: 16px;">
        <li style="margin-bottom: 2px;">The students are expected to keep this card neat and clean.</li>
        <li style="margin-bottom: 2px;">In case the card is lost the duplicate card will be issued on payment of extra report card fee.</li>
        <li style="margin-bottom: 2px;">Promotion will be granted on the weight of both examinations. To pass the monthly tests is also compulsory.</li>
        <li style="margin-bottom: 2px;">For any complaint at any point, kindly contact personally.</li>
      </ol>

      <p style="font-weight: bold; color: #334155; margin: 10px 0 4px 0; text-transform: uppercase;">Grading scale for scholastic areas: Grades are awarded on an 8-points grading scale as follows-</p>
      <table style="width: 100%; border-collapse: collapse; border: 1px solid #cbd5e1; text-align: center; font-family: monospace;">
        <thead>
          <tr style="background-color: rgba(255, 235, 59, 0.05); font-size: 7.5px; font-weight: bold;">
            <th style="border: 1px solid #cbd5e1; padding: 3px; text-align: left; padding-left: 8px; font-family: serif; text-transform: uppercase;">Marks Range (%)</th>
            ${gradingScale.map(item => `<th style="border: 1px solid #cbd5e1; padding: 3px;">${item.range}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          <tr style="font-size: 7.5px;">
            <td style="border: 1px solid #cbd5e1; padding: 3px; text-align: left; padding-left: 8px; font-weight: bold; font-family: serif; text-transform: uppercase; background-color: rgba(255, 235, 59, 0.05);">Grade</td>
            ${gradingScale.map(item => `<td style="border: 1px solid #cbd5e1; padding: 3px; font-weight: bold; color: #4338ca;">${item.grade}</td>`).join('')}
          </tr>
        </tbody>
      </table>
      
      <div style="margin-top: 16px; display: flex; justify-content: space-between; border-top: 1px solid #e2e8f0; padding-top: 8px; font-size: 7.5px; color: #94a3b8;">
        <span>Verification Code: <strong style="font-family: monospace; color: #475569;">${marksheetData.verificationCode}</strong></span>
        <span>Officially generated by Aegis institutional ERP cloud security pipelines</span>
      </div>
    </div>
  `;

  // Wait a small moment for styles & images to be fully ready
  await new Promise(r => setTimeout(r, 1000));

  try {
    const canvas = await html2canvas(root, {
      scale: 2, // High resolution capture
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

    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();
    const topMargin = 12;
    const bottomMargin = 12;
    const leftMargin = 10;
    const rightMargin = 10;

    const imgWidth = pdfWidth - leftMargin - rightMargin;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    const contentHeightPerPage = pdfHeight - topMargin - bottomMargin;

    let heightLeft = imgHeight;
    let pageIndex = 0;

    while (heightLeft > 0) {
      if (pageIndex > 0) {
        pdf.addPage();
      }

      const position = topMargin - (pageIndex * contentHeightPerPage);
      pdf.addImage(imgData, 'PNG', leftMargin, position, imgWidth, imgHeight);

      // Draw protective white rectangles over margins to cover any image overflow
      pdf.setFillColor(255, 255, 255);
      // Top margin cover
      pdf.rect(0, 0, pdfWidth, topMargin, 'F');
      // Bottom margin cover
      pdf.rect(0, pdfHeight - bottomMargin, pdfWidth, bottomMargin, 'F');
      // Left margin cover
      pdf.rect(0, 0, leftMargin, pdfHeight, 'F');
      // Right margin cover
      pdf.rect(pdfWidth - rightMargin, 0, rightMargin, pdfHeight, 'F');

      // Draw subtle border around content area for a premium feel
      pdf.setDrawColor(226, 232, 240);
      pdf.setLineWidth(0.2);
      pdf.rect(leftMargin, topMargin, imgWidth, contentHeightPerPage, 'S');

      // Draw page number in the bottom margin
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(8);
      pdf.setTextColor(148, 163, 184); // slate-400
      pdf.text(`Page ${pageIndex + 1}`, pdfWidth / 2, pdfHeight - 6, { align: 'center' });

      heightLeft -= contentHeightPerPage;
      pageIndex++;
    }

    pdf.save(`marksheet_${studentName.toLowerCase().replace(/\s+/g, '_')}_${term.toLowerCase().replace(/\s+/g, '_')}.pdf`);
  } catch (err) {
    console.error('Failed to export PDF:', err);
    alert('An error occurred while building the PDF marksheet. Please try again.');
  } finally {
    document.body.removeChild(container);
  }
};
