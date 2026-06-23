import React from 'react';
import { Building } from 'lucide-react';
import { useStore } from '../store/useStore';
import { mockDb } from '../services/mockDb';

export const AdminPortalHeader: React.FC = () => {
  const { session } = useStore();
  const adminSchoolName = mockDb.schools.find(s => s.id === session?.user.schoolId)?.name || 'Aegis Academy';

  return (
    <div className="bg-gradient-to-r from-brand-950 to-slate-900 border border-slate-800 rounded-3xl p-5 md:p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-brand-500/10 border border-brand-500/25 flex items-center justify-center">
          <Building className="text-brand-400" size={20} />
        </div>
        <div>
          <h2 className="text-lg font-bold text-slate-100 font-sans leading-none">School Administrator Portal</h2>
          <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-widest font-mono">Institution: {adminSchoolName}</p>
        </div>
      </div>
    </div>
  );
};
