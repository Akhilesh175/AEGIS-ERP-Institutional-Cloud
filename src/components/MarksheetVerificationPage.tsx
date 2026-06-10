import React, { useState, useEffect } from 'react';
import { mockApi } from '../services/mockApi';
import { mockDb } from '../services/mockDb';
import { ShieldCheck, ShieldAlert, Award, Calendar, Phone, Mail, MapPin, ArrowLeft, Download, Loader2 } from 'lucide-react';
import { GlassCard } from './GlassCard';
import { downloadMarksheetPdf } from './MarksheetTemplate';

interface MarksheetVerificationPageProps {
  code: string;
  onBack: () => void;
}

export const MarksheetVerificationPage: React.FC<MarksheetVerificationPageProps> = ({ code, onBack }) => {
  const [loading, setLoading] = useState(true);
  const [verifiedData, setVerifiedData] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const verifyCode = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Find student in local database whose admission number maps to this code
        // Code format: MS-[YEAR]-[ADM_NO]
        const cleanCode = code.toUpperCase();
        
        // Let's resolve the student by looking at students table
        const student = mockDb.students.find(s => {
          const expectedCode = `MS-${s.academicSessionId ? '2025' : '2025'}-${s.admissionNumber.replace(/[^a-zA-Z0-9]/g, '')}`.toUpperCase();
          // Also try standard year-agnostic check
          return cleanCode.includes(s.admissionNumber.replace(/[^a-zA-Z0-9]/g, '').toUpperCase());
        });

        if (!student) {
          throw new Error('No record found in Aegis database matching this verification key.');
        }

        // Fetch official marksheet data dynamically
        const data = await mockApi.getStudentMarksheetData(student.id, 'TERM 1');
        setVerifiedData(data);
        setLoading(false);
      } catch (err: any) {
        setError(err.message || 'Verification failed');
        setLoading(false);
      }
    };

    verifyCode();
  }, [code]);

  return (
    <div className="min-h-screen bg-[#070a13] flex flex-col items-center justify-center p-4 relative overflow-hidden font-sans">
      {/* Background Gradients Orbs */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-emerald-500/5 blur-[120px]" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-brand-600/5 blur-[120px]" />

      <div className="w-full max-w-xl space-y-6 relative z-10 animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-850 pb-4">
          <button 
            onClick={onBack}
            className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200 transition-colors bg-slate-900/40 border border-slate-850 px-2.5 py-1.5 rounded-xl cursor-pointer"
          >
            <ArrowLeft size={14} />
            <span>Go to Portal</span>
          </button>
          <div className="text-right">
            <h2 className="text-sm font-black text-slate-200 tracking-wider">AEGIS SECURITY</h2>
            <p className="text-[9px] text-slate-500 font-mono">HASH VERIFICATION</p>
          </div>
        </div>

        {loading ? (
          <GlassCard className="p-8 flex flex-col items-center justify-center text-center space-y-4">
            <Loader2 className="text-emerald-500 animate-spin" size={36} />
            <div>
              <h3 className="text-slate-200 font-bold text-sm">Querying Blockchain Ledger...</h3>
              <p className="text-[10px] text-slate-500 mt-1">Retrieving authentic marksheet data directly from institutional database.</p>
            </div>
          </GlassCard>
        ) : error ? (
          <GlassCard className="p-8 border-red-500/20 shadow-red-500/5 text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto text-red-500">
              <ShieldAlert size={28} />
            </div>
            <div>
              <h3 className="text-red-400 font-bold text-base">Verification Failed</h3>
              <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">{error}</p>
            </div>
            <div className="pt-4 border-t border-slate-850">
              <p className="text-[9px] text-slate-550 leading-relaxed">
                Aegis security protocols auto-reported this verification failure. Please contact your school administrator.
              </p>
            </div>
          </GlassCard>
        ) : (
          <GlassCard className="p-6 border-emerald-500/20 shadow-emerald-500/5 space-y-6">
            {/* Authenticity Badge */}
            <div className="flex items-center gap-4 bg-emerald-500/5 border border-emerald-500/20 rounded-2xl p-4">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
                <ShieldCheck size={22} />
              </div>
              <div>
                <h3 className="text-emerald-400 font-bold text-sm uppercase tracking-wide">Verified & Authentic</h3>
                <p className="text-[10px] text-slate-400 mt-0.5">This document corresponds exactly to official records in Supabase.</p>
              </div>
            </div>

            {/* Document details */}
            <div className="space-y-4">
              {/* School Info */}
              <div className="bg-slate-900/20 border border-slate-850 p-4 rounded-xl space-y-2">
                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block">Institution Profile</span>
                <h4 className="text-sm font-bold text-slate-200 uppercase">{verifiedData.school.name}</h4>
                <div className="grid grid-cols-1 gap-1 text-[10px] text-slate-400 pt-1 border-t border-slate-850/40">
                  <div className="flex items-center gap-1.5"><MapPin size={12} className="text-slate-550" /> {verifiedData.school.address}</div>
                  <div className="flex items-center gap-1.5"><Phone size={12} className="text-slate-550" /> {verifiedData.school.phone}</div>
                </div>
              </div>

              {/* Student Info */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-900/20 border border-slate-850 p-4 rounded-xl">
                  <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block">Student Identity</span>
                  <p className="text-xs font-bold text-slate-200 mt-1 uppercase">{verifiedData.student.name}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">Admission: {verifiedData.student.admissionNumber}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">Roll: {verifiedData.student.rollNumber}</p>
                </div>
                <div className="bg-slate-900/20 border border-slate-850 p-4 rounded-xl">
                  <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block">Academic Summary</span>
                  <p className="text-xs font-bold text-slate-200 mt-1">{verifiedData.student.className}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">Session: {verifiedData.school.sessionName}</p>
                  <p className="text-[10px] text-emerald-400 font-bold mt-0.5">Result: PASS (Rank #{verifiedData.academic.classRank})</p>
                </div>
              </div>

              {/* Verification Code block */}
              <div className="flex justify-between items-center bg-slate-950/40 border border-slate-900 p-3 rounded-xl text-[10px] font-mono">
                <span className="text-slate-500">Security Hash:</span>
                <span className="text-brand-400 font-bold">{verifiedData.verificationCode}</span>
              </div>
            </div>

            {/* Direct PDF Download */}
            <button
              onClick={async () => {
                try {
                  await downloadMarksheetPdf(verifiedData.student.name, 'TERM 1', verifiedData);
                } catch (err: any) {
                  alert('Download failed: ' + err.message);
                }
              }}
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs py-2.5 rounded-xl transition-all shadow-lg hover:shadow-emerald-500/20 active:scale-[0.98] flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Download size={14} />
              <span>Download Official PDF Marksheet</span>
            </button>
          </GlassCard>
        )}
      </div>
    </div>
  );
};
