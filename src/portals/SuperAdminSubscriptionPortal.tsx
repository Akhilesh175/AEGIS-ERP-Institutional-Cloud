import React, { useState, useEffect, useCallback } from 'react';
import { supabase, supabaseAdmin } from '../lib/supabase';
import { useStore } from '../store/useStore';
import { 
  CreditCard, Sparkles, Zap, Shield, ShieldCheck, Trash2, Edit2, PlusCircle, 
  Search, RefreshCw, Eye, Tag, Calendar, Download, Mail, Play, AlertTriangle, 
  Clock, CheckCircle2, XCircle, Ban, History, BarChart2, Coins, Percent, FileText, 
  User, ArrowUpRight, Award, Plus, Filter, ChevronRight
} from 'lucide-react';
import { 
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, 
  PieChart, Pie, Cell, BarChart, Bar, Legend
} from 'recharts';
import { GlassCard } from '../components/GlassCard';
import { PLAN_DEFINITIONS, normalizePlanCode, formatDate, formatCycle, calculateGST, verifyAndApplyCoupon } from '../services/subscriptionService';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

interface SuperAdminSubscriptionPortalProps {
  activeTab: string;
}

export const SuperAdminSubscriptionPortal: React.FC<SuperAdminSubscriptionPortalProps> = ({ activeTab }) => {
  const { session } = useStore();
  const superAdminId = session?.user?.id;

  // Local States
  const [loading, setLoading] = useState(false);
  const [schools, setSchools] = useState<any[]>([]);
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [coupons, setCoupons] = useState<any[]>([]);
  const [discounts, setDiscounts] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);

  // Search/Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSchoolId, setSelectedSchoolId] = useState('');
  const [filterPlan, setFilterPlan] = useState('all');

  // Modals
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [editingPlan, setEditingPlan] = useState<any | null>(null);
  const [showOverrideModal, setShowOverrideModal] = useState(false);
  const [showCouponModal, setShowCouponModal] = useState(false);
  const [showControlModal, setShowControlModal] = useState(false);
  const [selectedSchoolControl, setSelectedSchoolControl] = useState<any | null>(null);

  // Form inputs
  const [overrideForm, setOverrideForm] = useState({
    schoolId: '',
    planCode: 'pro',
    monthlyPrice: '',
    yearlyPrice: '',
    discountPercent: '',
    discountAmount: '',
    reason: '',
    startDate: '',
    expiryDate: ''
  });

  const [couponForm, setCouponForm] = useState({
    code: '',
    discountPercent: '',
    discountAmount: '',
    applicablePlans: [] as string[],
    applicableSchools: [] as string[],
    maxUses: '',
    expiryDate: ''
  });

  const [controlForm, setControlForm] = useState({
    action: 'activate', // activate, suspend, resume, extend, upgrade, cancel, refund, trial
    planCode: 'pro',
    billingCycle: 'MONTHLY',
    extendDays: '30',
    reason: '',
    amountPaid: '0'
  });

  // Telemetry stats
  const [stats, setStats] = useState({
    totalSchools: 0,
    activeSchools: 0,
    trialSchools: 0,
    expiredSchools: 0,
    graceSchools: 0,
    monthlyRevenue: 0,
    yearlyRevenue: 0,
    pendingRenewals: 0,
    totalDiscounts: 0,
    totalGST: 0,
    totalEnterprise: 0
  });

  // Load basic datasets
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      
      // Query schools list
      const { data: schoolsData } = await supabaseAdmin.from('schools').select('*').order('name');
      setSchools(schoolsData || []);

      // Query active plans
      const { data: plansData } = await supabaseAdmin.from('subscription_plans').select('*');
      setPlans(plansData || PLAN_DEFINITIONS);

      // Query subscriptions
      const { data: subsData } = await supabaseAdmin.from('subscriptions').select('*, schools(name)');
      setSubscriptions(subsData || []);

      // Query successful payments
      const { data: paymentsData } = await supabaseAdmin.from('payments').select('*, schools(name)').order('created_at', { ascending: false });
      setPayments(paymentsData || []);

      // Query coupons
      try {
        const { data: couponsData } = await supabaseAdmin.from('subscription_coupons').select('*');
        setCoupons(couponsData || []);
      } catch (e) {
        console.warn('coupons table load error:', e);
      }

      // Query custom discounts
      try {
        const { data: discountsData } = await supabaseAdmin.from('subscription_discounts').select('*, schools(name)');
        setDiscounts(discountsData || []);
      } catch (e) {
        console.warn('discounts table load error:', e);
      }

      // Query invoices
      const { data: invoicesData } = await supabaseAdmin.from('subscription_invoices').select('*, schools(name)').order('created_at', { ascending: false });
      setInvoices(invoicesData || []);

      // Query audit logs
      const { data: auditsData } = await supabaseAdmin.from('subscription_audit_logs').select('*, schools(name)').order('created_at', { ascending: false });
      setAuditLogs(auditsData || []);

      setLoading(false);
    } catch (e) {
      console.error('Error loading subscription dashboard data:', e);
      setLoading(false);
    }
  }, []);

  // Compute live dashboard metrics
  useEffect(() => {
    if (schools.length === 0) return;

    const trialCount = subscriptions.filter(s => s.status === 'TRIAL' || s.subscription_status === 'trial').length;
    const activeCount = subscriptions.filter(s => s.status === 'ACTIVE' || s.subscription_status === 'active').length;
    const expiredCount = subscriptions.filter(s => s.status === 'EXPIRED' || s.subscription_status === 'expired').length;
    const graceCount = subscriptions.filter(s => s.subscription_status === 'grace_period').length;
    const enterpriseCount = schools.filter(s => s.subscription_plan === 'ENTERPRISE' || s.subscription_plan === 'enterprise').length;

    // Revenue calculations
    const successPayments = payments.filter(p => p.status === 'SUCCESS');
    const totalRev = successPayments.reduce((sum, p) => sum + Number(p.amount), 0);
    const gstTotal = Math.round(totalRev * 0.18);

    // Filter current month payments for monthly revenue
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    const startOfMonthIso = startOfMonth.toISOString();
    const monthlyRev = successPayments
      .filter(p => p.created_at >= startOfMonthIso)
      .reduce((sum, p) => sum + Number(p.amount), 0);

    // Yearly revenue
    const startOfYear = new Date();
    startOfYear.setMonth(0);
    startOfYear.setDate(1);
    startOfYear.setHours(0, 0, 0, 0);
    const startOfYearIso = startOfYear.toISOString();
    const yearlyRev = successPayments
      .filter(p => p.created_at >= startOfYearIso)
      .reduce((sum, p) => sum + Number(p.amount), 0);

    // Pending renewals (expiring in < 30 days)
    const today = new Date();
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(today.getDate() + 30);
    const thirtyDaysStr = thirtyDaysFromNow.toISOString().split('T')[0];
    const todayStr = today.toISOString().split('T')[0];

    const pendingCount = subscriptions.filter(s => 
      s.expiry_date && s.expiry_date >= todayStr && s.expiry_date <= thirtyDaysStr && s.status === 'ACTIVE'
    ).length;

    // Sum discounts given
    const totalDis = invoices.reduce((sum, inv) => sum + Number(inv.discount_amount || 0), 0);

    setStats({
      totalSchools: schools.length,
      activeSchools: activeCount,
      trialSchools: trialCount,
      expiredSchools: expiredCount,
      graceSchools: graceCount,
      monthlyRevenue: monthlyRev,
      yearlyRevenue: yearlyRev,
      pendingRenewals: pendingCount,
      totalDiscounts: totalDis,
      totalGST: gstTotal,
      totalEnterprise: enterpriseCount
    });
  }, [schools, subscriptions, payments, invoices]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handle plan edit modal save
  const handleSavePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPlan) return;

    try {
      setLoading(true);
      const { error } = await supabaseAdmin
        .from('subscription_plans')
        .update({
          name: editingPlan.name,
          price_monthly: Number(editingPlan.price_monthly),
          price_yearly: Number(editingPlan.price_yearly),
          display_order: Number(editingPlan.display_order || 0),
          is_recommended: !!editingPlan.is_recommended,
          is_popular: !!editingPlan.is_popular,
          color_theme: editingPlan.color_theme || 'brand',
          max_students: Number(editingPlan.max_students || 100),
          max_teachers: Number(editingPlan.max_teachers || 10),
          max_parents: Number(editingPlan.max_parents || 200),
          max_storage_gb: Number(editingPlan.max_storage_gb || 5),
          notification_limits: Number(editingPlan.notification_limits || 1000),
          has_ptm_access: !!editingPlan.has_ptm_access,
          has_transport_access: !!editingPlan.has_transport_access,
          has_library_access: !!editingPlan.has_library_access,
          has_finance_access: !!editingPlan.has_finance_access,
          has_hostel_access: !!editingPlan.has_hostel_access,
          has_analytics_access: !!editingPlan.has_analytics_access,
          has_coach_portal: !!editingPlan.has_coach_portal,
          has_warden_portal: !!editingPlan.has_warden_portal,
          features: Array.isArray(editingPlan.features) ? editingPlan.features : JSON.parse(editingPlan.features || '[]')
        })
        .eq('code', editingPlan.code);

      if (error) throw error;

      // Log audit trail
      await supabaseAdmin.from('subscription_audit_logs').insert({
        school_id: schools[0]?.id || '11111111-1111-1111-1111-111111111111', // global fallback
        admin_id: superAdminId,
        action: 'PRICE_CHANGED',
        plan: editingPlan.code,
        metadata: { plan_name: editingPlan.name, price_monthly: editingPlan.price_monthly, price_yearly: editingPlan.price_yearly }
      });

      setShowPlanModal(false);
      setEditingPlan(null);
      await loadData();
      alert('Plan overrides applied successfully across all school clusters.');
    } catch (err: any) {
      alert('Failed to save plan: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Apply school pricing overrides
  const handleCreateOverride = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!overrideForm.schoolId || !overrideForm.planCode) {
      alert('Please select a school and plan code.');
      return;
    }

    try {
      setLoading(true);
      const { error } = await supabaseAdmin
        .from('subscription_discounts')
        .insert({
          school_id: overrideForm.schoolId,
          plan_code: overrideForm.planCode,
          monthly_price_override: overrideForm.monthlyPrice ? Number(overrideForm.monthlyPrice) : null,
          yearly_price_override: overrideForm.yearlyPrice ? Number(overrideForm.yearlyPrice) : null,
          discount_percent: overrideForm.discountPercent ? Number(overrideForm.discountPercent) : null,
          discount_amount: overrideForm.discountAmount ? Number(overrideForm.discountAmount) : null,
          reason: overrideForm.reason,
          start_date: overrideForm.startDate || new Date().toISOString().split('T')[0],
          expiry_date: overrideForm.expiryDate || null,
          created_by: superAdminId
        });

      if (error) throw error;

      // Log audit trail
      await supabaseAdmin.from('subscription_audit_logs').insert({
        school_id: overrideForm.schoolId,
        admin_id: superAdminId,
        action: 'DISCOUNT_CHANGED',
        plan: overrideForm.planCode,
        metadata: { override: overrideForm }
      });

      setShowOverrideModal(false);
      setOverrideForm({
        schoolId: '',
        planCode: 'pro',
        monthlyPrice: '',
        yearlyPrice: '',
        discountPercent: '',
        discountAmount: '',
        reason: '',
        startDate: '',
        expiryDate: ''
      });
      await loadData();
      alert('School-wise override pricing saved.');
    } catch (err: any) {
      alert('Failed to save override: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Create coupon
  const handleCreateCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!couponForm.code) {
      alert('Please specify coupon code.');
      return;
    }

    try {
      setLoading(true);
      const { error } = await supabaseAdmin
        .from('subscription_coupons')
        .insert({
          code: couponForm.code.toUpperCase().trim(),
          discount_percent: couponForm.discountPercent ? Number(couponForm.discountPercent) : null,
          discount_amount: couponForm.discountAmount ? Number(couponForm.discountAmount) : null,
          applicable_plans: couponForm.applicablePlans.length > 0 ? couponForm.applicablePlans : null,
          applicable_schools: couponForm.applicableSchools.length > 0 ? couponForm.applicableSchools : null,
          max_uses: couponForm.maxUses ? Number(couponForm.maxUses) : null,
          expiry_date: couponForm.expiryDate || null,
          created_by: superAdminId
        });

      if (error) throw error;

      setShowCouponModal(false);
      setCouponForm({
        code: '',
        discountPercent: '',
        discountAmount: '',
        applicablePlans: [],
        applicableSchools: [],
        maxUses: '',
        expiryDate: ''
      });
      await loadData();
      alert('New Coupon generated and enabled.');
    } catch (err: any) {
      alert('Failed to generate coupon: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Manual actions control submit
  const handleControlSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSchoolControl) return;
    const schoolId = selectedSchoolControl.id;

    try {
      setLoading(true);

      const today = new Date();
      const todayStr = today.toISOString().split('T')[0];
      
      let expiry = new Date();
      if (controlForm.action === 'extend') {
        const days = parseInt(controlForm.extendDays) || 30;
        expiry.setDate(today.getDate() + days);
      } else if (controlForm.billingCycle === 'YEARLY') {
        expiry.setFullYear(today.getFullYear() + 1);
      } else {
        expiry.setMonth(today.getMonth() + 1);
      }
      const expiryStr = expiry.toISOString().split('T')[0];

      if (controlForm.action === 'activate' || controlForm.action === 'renew' || controlForm.action === 'trial') {
        const planCode = controlForm.planCode.toLowerCase();
        const cycle = controlForm.action === 'trial' ? 'TRIAL' : controlForm.billingCycle;
        
        // Upsert to subscriptions
        const { data: subData, error: subErr } = await supabaseAdmin
          .from('subscriptions')
          .insert({
            school_id: schoolId,
            plan_code: planCode,
            status: controlForm.action === 'trial' ? 'TRIAL' : 'ACTIVE',
            billing_cycle: cycle,
            start_date: todayStr,
            expiry_date: expiryStr,
            subscription_status: controlForm.action === 'trial' ? 'trial' : 'active',
            amount_paid: Number(controlForm.amountPaid || 0),
            purchase_date: new Date().toISOString()
          })
          .select()
          .single();

        if (subErr) throw subErr;

        // Update schools subscription plan
        await supabaseAdmin
          .from('schools')
          .update({ subscription_plan: planCode.toUpperCase() })
          .eq('id', schoolId);

        // Audit Log
        await supabaseAdmin.from('subscription_audit_logs').insert({
          school_id: schoolId,
          admin_id: superAdminId,
          action: controlForm.action === 'trial' ? 'GRANT_TRIAL' : controlForm.action === 'renew' ? 'RENEWED' : 'MANUAL_ACTIVATION',
          plan: planCode,
          billing_cycle: cycle,
          amount: Number(controlForm.amountPaid || 0),
          start_date: todayStr,
          end_date: expiryStr,
          metadata: { reason: controlForm.reason }
        });
      } 
      else if (controlForm.action === 'suspend') {
        await supabaseAdmin
          .from('subscriptions')
          .update({ subscription_status: 'expired', status: 'EXPIRED' })
          .eq('school_id', schoolId)
          .eq('status', 'ACTIVE');

        await supabaseAdmin
          .from('schools')
          .update({ subscription_plan: 'FREEMIUM' })
          .eq('id', schoolId);

        await supabaseAdmin.from('subscription_audit_logs').insert({
          school_id: schoolId,
          admin_id: superAdminId,
          action: 'MANUAL_SUSPENSION',
          plan: 'freemium',
          metadata: { reason: controlForm.reason }
        });
      }
      else if (controlForm.action === 'resume') {
        const { data: lastSub } = await supabaseAdmin
          .from('subscriptions')
          .select('*')
          .eq('school_id', schoolId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (lastSub) {
          await supabaseAdmin
            .from('subscriptions')
            .update({ subscription_status: 'active', status: 'ACTIVE' })
            .eq('id', lastSub.id);

          await supabaseAdmin
            .from('schools')
            .update({ subscription_plan: lastSub.plan_code.toUpperCase() })
            .eq('id', schoolId);
        }

        await supabaseAdmin.from('subscription_audit_logs').insert({
          school_id: schoolId,
          admin_id: superAdminId,
          action: 'MANUAL_EXTENSION', // Resume
          plan: lastSub?.plan_code || 'unknown',
          metadata: { reason: controlForm.reason }
        });
      }
      else if (controlForm.action === 'extend') {
        const { data: lastSub } = await supabaseAdmin
          .from('subscriptions')
          .select('*')
          .eq('school_id', schoolId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (lastSub) {
          const currentExpiry = new Date(lastSub.expiry_date);
          currentExpiry.setDate(currentExpiry.getDate() + (parseInt(controlForm.extendDays) || 30));
          const newExpiryStr = currentExpiry.toISOString().split('T')[0];

          await supabaseAdmin
            .from('subscriptions')
            .update({ expiry_date: newExpiryStr, subscription_status: 'active', status: 'ACTIVE' })
            .eq('id', lastSub.id);
        }

        await supabaseAdmin.from('subscription_audit_logs').insert({
          school_id: schoolId,
          admin_id: superAdminId,
          action: 'MANUAL_EXTENSION',
          plan: lastSub?.plan_code || 'unknown',
          metadata: { reason: controlForm.reason, days: controlForm.extendDays }
        });
      }
      else if (controlForm.action === 'cancel') {
        await supabaseAdmin
          .from('subscriptions')
          .update({ subscription_status: 'cancelled', status: 'INACTIVE' })
          .eq('school_id', schoolId);

        await supabaseAdmin.from('subscription_audit_logs').insert({
          school_id: schoolId,
          admin_id: superAdminId,
          action: 'CANCELLED',
          plan: 'cancelled',
          metadata: { reason: controlForm.reason }
        });
      }
      else if (controlForm.action === 'refund') {
        await supabaseAdmin.from('subscription_audit_logs').insert({
          school_id: schoolId,
          admin_id: superAdminId,
          action: 'REFUNDED',
          plan: 'refund',
          metadata: { reason: controlForm.reason }
        });
      }

      setShowControlModal(false);
      setSelectedSchoolControl(null);
      await loadData();
      alert('Subscription manual override configuration updated.');
    } catch (err: any) {
      alert('Failed manual action: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Generate and Download Invoice PDF client-side
  const downloadInvoicePDF = async (inv: any) => {
    try {
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'pt',
        format: 'a4'
      });

      const schoolName = inv.schools?.name || 'Your School';
      const amt = Number(inv.amount || 0);
      const tax = Number(inv.tax_amount || 0);
      const discount = Number(inv.discount_amount || 0);
      const total = Number(inv.total_amount || 0);
      const invoiceNo = inv.invoice_number;
      const issueDate = new Date(inv.created_at).toLocaleDateString('en-IN');
      const planCode = inv.plan_code || 'pro';
      const cycle = inv.billing_cycle || 'MONTHLY';

      // Simple premium PDF Layout
      doc.setFillColor(7, 10, 19); // dark header banner
      doc.rect(0, 0, 595, 120, 'F');

      // Title
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(22);
      doc.setFont('Helvetica', 'bold');
      doc.text('AEGIS ERP INSTITUTIONAL CLOUD', 40, 55);
      doc.setFontSize(10);
      doc.setFont('Helvetica', 'normal');
      doc.setTextColor(150, 150, 150);
      doc.text('Advanced Multi-Tenant SaaS Platform', 40, 75);

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(18);
      doc.setFont('Helvetica', 'bold');
      doc.text('INVOICE', 460, 55);
      doc.setFontSize(9);
      doc.setFont('Helvetica', 'normal');
      doc.text(`#${invoiceNo}`, 460, 75);

      // Section: Billing Info
      doc.setTextColor(30, 30, 30);
      doc.setFontSize(11);
      doc.setFont('Helvetica', 'bold');
      doc.text('BILLED TO:', 40, 170);
      doc.setFont('Helvetica', 'normal');
      doc.text(schoolName, 40, 190);
      doc.text('Institutional Administrator', 40, 205);
      doc.text(inv.billing_email || 'billing@aegiserp.xyz', 40, 220);

      // Section: Invoice details
      doc.setFont('Helvetica', 'bold');
      doc.text('INVOICE DETAILS:', 380, 170);
      doc.setFont('Helvetica', 'normal');
      doc.text(`Issue Date: ${issueDate}`, 380, 190);
      doc.text(`Billing Cycle: ${cycle}`, 380, 205);
      doc.text(`Plan Code: ${planCode.toUpperCase()}`, 380, 220);

      // Table Header
      doc.setFillColor(240, 243, 248);
      doc.rect(40, 260, 515, 25, 'F');
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(9);
      doc.text('Item Description', 50, 276);
      doc.text('Billing Cycle', 280, 276);
      doc.text('Original Price', 380, 276);
      doc.text('Paid Amount', 480, 276);

      // Table Row
      doc.setFont('Helvetica', 'normal');
      doc.text(`AEGIS ERP Subscription - ${planCode.toUpperCase()} Plan`, 50, 310);
      doc.text(cycle, 280, 310);
      doc.text(`INR ${amt.toLocaleString()}`, 380, 310);
      doc.text(`INR ${total.toLocaleString()}`, 480, 310);

      // Subtotals & Totals
      doc.line(40, 340, 555, 340);

      doc.text('Subtotal:', 380, 370);
      doc.text(`INR ${amt.toLocaleString()}`, 480, 370);

      if (discount > 0) {
        doc.setTextColor(220, 50, 50);
        doc.text('Discount Applied:', 380, 390);
        doc.text(`- INR ${discount.toLocaleString()}`, 480, 390);
        doc.setTextColor(30, 30, 30);
      }

      doc.text('GST (18%):', 380, 410);
      doc.text(`INR ${tax.toLocaleString()}`, 480, 410);

      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(11);
      doc.text('Total Paid:', 380, 440);
      doc.text(`INR ${total.toLocaleString()}`, 480, 440);

      // Footer
      doc.setFillColor(245, 247, 250);
      doc.rect(40, 490, 515, 50, 'F');
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(100, 100, 100);
      doc.text('Note: This is a system-generated invoice for your cloud subscription renewal. All payments are verified securely.', 50, 510);
      doc.text('For queries, write to billing@aegiserp.xyz. Thank you for choosing AEGIS ERP Institutional Cloud.', 50, 525);

      doc.save(`Invoice-${invoiceNo}.pdf`);
    } catch (e) {
      console.error(e);
      alert('Failed to generate PDF invoice.');
    }
  };

  // Export reports to CSV
  const exportReportCSV = (reportType: string) => {
    let headers: string[] = [];
    let rows: any[] = [];
    let filename = '';

    if (reportType === 'revenue') {
      headers = ['Payment ID', 'School Name', 'Amount', 'Currency', 'Payment Method', 'Created At'];
      rows = payments.map(p => [p.id, p.schools?.name || 'Unknown', p.amount, p.currency, p.payment_method || 'CARD', p.created_at]);
      filename = 'AEGIS-SaaS-Revenue-Report.csv';
    } 
    else if (reportType === 'subscriptions') {
      headers = ['Subscription ID', 'School Name', 'Plan Code', 'Billing Cycle', 'Status', 'Expiry Date'];
      rows = subscriptions.map(s => [s.id, s.schools?.name || 'Unknown', s.plan_code, s.billing_cycle, s.subscription_status || s.status, s.expiry_date]);
      filename = 'AEGIS-SaaS-Subscription-Report.csv';
    }
    else if (reportType === 'gst') {
      headers = ['Invoice Number', 'School Name', 'Amount', 'GST Collected', 'Total Amount', 'Issue Date'];
      rows = invoices.map(i => [i.invoice_number, i.schools?.name || 'Unknown', i.amount, i.tax_amount, i.total_amount, i.created_at]);
      filename = 'AEGIS-SaaS-GST-Collected-Report.csv';
    }

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map((val: any) => `"${String(val).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 animate-fade-in text-slate-200">
      
      {/* ── Tab 1: Dashboard ── */}
      {activeTab === 'sub-dashboard' && (
        <div className="space-y-6">
          {/* Metrics grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <GlassCard className="p-4 flex flex-col justify-between h-28 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-[3px] bg-brand-500 opacity-60" />
              <div>
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Total Schools</span>
                <h3 className="text-3xl font-extrabold text-white mt-1 font-mono">{stats.totalSchools}</h3>
              </div>
              <p className="text-[10px] text-slate-500">Platform deployed nodes</p>
            </GlassCard>

            <GlassCard className="p-4 flex flex-col justify-between h-28 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-[3px] bg-emerald-500 opacity-60" />
              <div>
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Active / Trial</span>
                <h3 className="text-3xl font-extrabold text-emerald-400 mt-1 font-mono">
                  {stats.activeSchools} <span className="text-xs font-normal text-slate-500">/ {stats.trialSchools}</span>
                </h3>
              </div>
              <p className="text-[10px] text-slate-500">Paying vs trial licenses</p>
            </GlassCard>

            <GlassCard className="p-4 flex flex-col justify-between h-28 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-[3px] bg-orange-500 opacity-60" />
              <div>
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Expired / Grace</span>
                <h3 className="text-3xl font-extrabold text-orange-400 mt-1 font-mono">
                  {stats.expiredSchools} <span className="text-xs font-normal text-slate-500">/ {stats.graceSchools}</span>
                </h3>
              </div>
              <p className="text-[10px] text-slate-500">Action required</p>
            </GlassCard>

            <GlassCard className="p-4 flex flex-col justify-between h-28 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-[3px] bg-indigo-500 opacity-60" />
              <div>
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Monthly Revenue</span>
                <h3 className="text-2xl font-extrabold text-green-400 mt-1.5 font-mono">₹{stats.monthlyRevenue.toLocaleString()}</h3>
              </div>
              <p className="text-[10px] text-slate-500">This calendar month</p>
            </GlassCard>

            <GlassCard className="p-4 flex flex-col justify-between h-28 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-[3px] bg-purple-500 opacity-60" />
              <div>
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Yearly Revenue</span>
                <h3 className="text-2xl font-extrabold text-violet-400 mt-1.5 font-mono">₹{stats.yearlyRevenue.toLocaleString()}</h3>
              </div>
              <p className="text-[10px] text-slate-500">This calendar year</p>
            </GlassCard>

            <GlassCard className="p-4 flex flex-col justify-between h-28 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-[3px] bg-red-500 opacity-60" />
              <div>
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">GST Tax Collected</span>
                <h3 className="text-2xl font-extrabold text-red-400 mt-1.5 font-mono">₹{stats.totalGST.toLocaleString()}</h3>
              </div>
              <p className="text-[10px] text-slate-500">18% GST ledger component</p>
            </GlassCard>

            <GlassCard className="p-4 flex flex-col justify-between h-28 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-[3px] bg-amber-500 opacity-60" />
              <div>
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Discounts Given</span>
                <h3 className="text-2xl font-extrabold text-amber-400 mt-1.5 font-mono">₹{stats.totalDiscounts.toLocaleString()}</h3>
              </div>
              <p className="text-[10px] text-slate-500">Coupons & overrides sum</p>
            </GlassCard>

            <GlassCard className="p-4 flex flex-col justify-between h-28 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-[3px] bg-pink-500 opacity-60" />
              <div>
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Enterprise Customers</span>
                <h3 className="text-3xl font-extrabold text-pink-400 mt-1 font-mono">{stats.totalEnterprise}</h3>
              </div>
              <p className="text-[10px] text-slate-500">Schools on Enterprise tier</p>
            </GlassCard>
          </div>

          {/* Revenue Analytics charts & Quick Actions */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <GlassCard className="lg:col-span-2 p-5 space-y-4">
              <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                <BarChart2 className="text-brand-500" size={16} /> Revenue Growth & Historical Ledger
              </h3>
              <div className="h-60 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={payments.filter(p => p.status === 'SUCCESS').slice(0, 10).reverse()}>
                    <defs>
                      <linearGradient id="revColor" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.25}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="created_at" tickFormatter={(str) => new Date(str).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} stroke="#64748b" fontSize={10} />
                    <YAxis stroke="#64748b" fontSize={10} />
                    <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px', color: '#f8fafc' }} />
                    <Area type="monotone" dataKey="amount" stroke="#10b981" fillOpacity={1} fill="url(#revColor)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </GlassCard>

            <GlassCard className="p-5 flex flex-col justify-between">
              <h3 className="text-sm font-bold text-slate-200 pb-2 border-b border-slate-800">Direct Actions & Controls</h3>
              <div className="space-y-3 mt-4 flex-1">
                <p className="text-[11px] text-slate-400">Apply real-time modifications directly to any school node, bypass Razorpay, or issue manual renewals/extensions.</p>
                <div className="space-y-2">
                  <button 
                    onClick={() => setShowOverrideModal(true)}
                    className="w-full flex items-center justify-between p-2.5 bg-slate-900 border border-slate-800 hover:border-brand-500/30 rounded-xl transition-all text-xs font-semibold text-slate-350 hover:text-white"
                  >
                    <span>Custom Price Override</span>
                    <Plus size={14} className="text-brand-500" />
                  </button>
                  <button 
                    onClick={() => setShowCouponModal(true)}
                    className="w-full flex items-center justify-between p-2.5 bg-slate-900 border border-slate-800 hover:border-brand-500/30 rounded-xl transition-all text-xs font-semibold text-slate-350 hover:text-white"
                  >
                    <span>Create Promo Coupon</span>
                    <Tag size={12} className="text-indigo-400" />
                  </button>
                </div>
              </div>
              <div className="pt-4 border-t border-slate-850 mt-4 text-[10px] text-slate-500 font-mono">
                System Context: Super-Admin master scope
              </div>
            </GlassCard>
          </div>

          {/* School Status & Manual Gating lists */}
          <GlassCard className="p-5 space-y-4">
            <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
              <ShieldCheck className="text-brand-500" size={16} /> Multi-Tenant Active Nodes & Direct Licensing Panel
            </h3>
            <div className="overflow-x-auto border border-slate-850 rounded-xl">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-850 text-slate-450 font-bold uppercase tracking-wider text-[10px] bg-slate-900/30">
                    <th className="py-2.5 px-3">Institution Name</th>
                    <th className="py-2.5 px-3">Plan</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Billing Cycle</th>
                    <th className="py-2.5 px-3">Renewal Date</th>
                    <th className="py-2.5 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-850/60 text-slate-300">
                  {schools.map(sch => {
                    const sub = subscriptions.find(s => s.school_id === sch.id);
                    const status = sub?.subscription_status || 'trial';
                    return (
                      <tr key={sch.id} className="hover:bg-slate-900/10 transition-colors">
                        <td className="py-2.5 px-3 font-semibold text-slate-200">{sch.name}</td>
                        <td className="py-2.5 px-3 font-mono text-[10px] uppercase text-brand-400">{sch.subscription_plan || 'FREEMIUM'}</td>
                        <td className="py-2.5 px-3">
                          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                            status === 'active' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/10' :
                            status === 'trial' ? 'bg-brand-500/10 text-brand-400 border border-brand-500/10' :
                            status === 'grace_period' ? 'bg-orange-500/10 text-orange-400 border border-orange-500/10' :
                            'bg-red-500/10 text-red-400 border border-red-500/10'
                          }`}>
                            {status}
                          </span>
                        </td>
                        <td className="py-2.5 px-3">{sub?.billing_cycle || 'TRIAL'}</td>
                        <td className="py-2.5 px-3 font-mono text-slate-450">{sub?.expiry_date ? formatDate(sub.expiry_date) : 'N/A'}</td>
                        <td className="py-2.5 px-3 text-right">
                          <button
                            onClick={() => {
                              setSelectedSchoolControl(sch);
                              setControlForm(prev => ({ ...prev, planCode: sch.subscription_plan?.toLowerCase() || 'pro' }));
                              setShowControlModal(true);
                            }}
                            className="bg-brand-650/10 hover:bg-brand-650/20 border border-brand-500/25 text-brand-400 font-bold px-2.5 py-1 rounded-lg text-[10px] transition-all"
                          >
                            Licensing Control
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </GlassCard>
        </div>
      )}

      {/* ── Tab 2: Plan Management ── */}
      {activeTab === 'sub-plans' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {plans.map(p => {
              const featuresList = Array.isArray(p.features) ? p.features : JSON.parse(p.features || '[]');
              return (
                <GlassCard key={p.code} className="p-5 flex flex-col justify-between space-y-4 relative overflow-hidden border-slate-850 hover:border-slate-750 transition-all">
                  <div className="absolute top-0 left-0 w-full h-[3px] bg-brand-500 opacity-60" />
                  <div className="space-y-2">
                    <div className="flex justify-between items-start">
                      <h4 className="font-extrabold text-slate-200 text-sm">{p.name}</h4>
                      {p.is_recommended && <span className="bg-brand-500/15 border border-brand-500/30 text-brand-400 text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase">Recommend</span>}
                    </div>
                    <p className="text-[11px] text-slate-400 font-mono uppercase font-bold">Code: {p.code}</p>
                    <div className="space-y-1 py-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-500">Monthly Price:</span>
                        <span className="font-bold font-mono text-emerald-400">₹{Number(p.price_monthly).toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-500">Yearly Price:</span>
                        <span className="font-bold font-mono text-emerald-400">₹{Number(p.price_yearly).toLocaleString()}</span>
                      </div>
                    </div>
                    
                    <div className="border-t border-slate-900 pt-2 space-y-1.5 text-[11px]">
                      <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Resource Quotas</p>
                      <div className="flex justify-between text-slate-400">
                        <span>Students:</span>
                        <span className="font-semibold text-slate-200">{p.max_students >= 999999 ? 'Unlimited' : p.max_students}</span>
                      </div>
                      <div className="flex justify-between text-slate-400">
                        <span>Teachers:</span>
                        <span className="font-semibold text-slate-200">{p.max_teachers >= 999999 ? 'Unlimited' : p.max_teachers}</span>
                      </div>
                      <div className="flex justify-between text-slate-400">
                        <span>Storage GB:</span>
                        <span className="font-semibold text-slate-200">{p.max_storage_gb} GB</span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setEditingPlan({
                        ...p,
                        features: JSON.stringify(featuresList)
                      });
                      setShowPlanModal(true);
                    }}
                    className="w-full py-2 bg-slate-900 border border-slate-800 hover:border-brand-500/40 text-brand-400 font-bold text-xs rounded-xl transition-all"
                  >
                    Configure Plan
                  </button>
                </GlassCard>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Tab 3: School Pricing Overrides ── */}
      {activeTab === 'sub-pricing' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center border-b border-slate-850 pb-3">
            <div>
              <h3 className="font-bold text-slate-100 flex items-center gap-2">
                <Coins className="text-brand-500" size={18} />
                School Pricing Overrides & Custom Discounts
              </h3>
              <p className="text-xs text-slate-400 mt-1">Manage school-specific pricing configurations, structural coupon discounts, or temporal trial extensions.</p>
            </div>
            <button 
              onClick={() => setShowOverrideModal(true)}
              className="bg-brand-600 hover:bg-brand-500 text-white font-bold text-xs px-3 py-2 rounded-xl transition-all flex items-center gap-1.5"
            >
              <PlusCircle size={14} /> Add Override
            </button>
          </div>

          <GlassCard className="p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-850 text-slate-450 font-bold uppercase tracking-wider text-[10px] bg-slate-900/30">
                    <th className="py-2.5 px-3">School Node</th>
                    <th className="py-2.5 px-3">Plan Code</th>
                    <th className="py-2.5 px-3">Monthly Custom</th>
                    <th className="py-2.5 px-3">Yearly Custom</th>
                    <th className="py-2.5 px-3">Discount Percent</th>
                    <th className="py-2.5 px-3">Reason</th>
                    <th className="py-2.5 px-3 text-right">Created At</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-850/60 text-slate-350">
                  {discounts.map(d => (
                    <tr key={d.id} className="hover:bg-slate-900/10 transition-colors">
                      <td className="py-2.5 px-3 font-semibold text-slate-200">{d.schools?.name || 'Global'}</td>
                      <td className="py-2.5 px-3 font-mono text-[10px] uppercase text-brand-400">{d.plan_code}</td>
                      <td className="py-2.5 px-3 font-mono text-emerald-400">₹{d.monthly_price_override ? Number(d.monthly_price_override).toLocaleString() : '—'}</td>
                      <td className="py-2.5 px-3 font-mono text-emerald-400">₹{d.yearly_price_override ? Number(d.yearly_price_override).toLocaleString() : '—'}</td>
                      <td className="py-2.5 px-3 font-mono text-amber-400">{d.discount_percent ? `${d.discount_percent}%` : d.discount_amount ? `₹${d.discount_amount}` : '—'}</td>
                      <td className="py-2.5 px-3 italic">{d.reason || 'No description'}</td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-500">{new Date(d.created_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                  {discounts.length === 0 && (
                    <tr>
                      <td colSpan={7} className="text-center py-8 text-slate-500 italic">No custom pricing overrides applied to schools yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </GlassCard>
        </div>
      )}

      {/* ── Tab 4: Coupons ── */}
      {activeTab === 'sub-coupons' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center border-b border-slate-850 pb-3">
            <div>
              <h3 className="font-bold text-slate-100 flex items-center gap-2">
                <Tag className="text-indigo-400" size={18} />
                Promo Coupon System
              </h3>
              <p className="text-xs text-slate-400 mt-1">Configure structural discounts applied dynamically during payment checkouts.</p>
            </div>
            <button 
              onClick={() => setShowCouponModal(true)}
              className="bg-brand-600 hover:bg-brand-500 text-white font-bold text-xs px-3 py-2 rounded-xl transition-all flex items-center gap-1.5"
            >
              <PlusCircle size={14} /> Create Coupon
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {coupons.map(c => (
              <GlassCard key={c.id} className="p-4 space-y-3 relative overflow-hidden border-slate-850">
                <div className="absolute top-0 left-0 w-full h-[3px] bg-indigo-500 opacity-60" />
                <div className="flex justify-between items-center">
                  <span className="font-black font-mono text-slate-100 text-sm tracking-wider bg-slate-900 border border-slate-800 px-3 py-1 rounded-xl">{c.code}</span>
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${c.is_active ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                    {c.is_active ? 'Active' : 'Expired'}
                  </span>
                </div>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Discount:</span>
                    <span className="font-bold text-emerald-400">{c.discount_percent ? `${c.discount_percent}% Off` : `₹${c.discount_amount} Off`}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Usages limit:</span>
                    <span className="text-slate-300 font-mono">{c.current_uses} / {c.max_uses || 'Unlimited'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Expiry:</span>
                    <span className="text-slate-350">{c.expiry_date ? formatDate(c.expiry_date) : 'Never'}</span>
                  </div>
                </div>
              </GlassCard>
            ))}
            {coupons.length === 0 && (
              <p className="text-xs text-slate-500 italic col-span-3 py-4 text-center">No coupon promo campaigns configured.</p>
            )}
          </div>
        </div>
      )}

      {/* ── Tab 5: Purchase History ── */}
      {activeTab === 'sub-purchases' && (
        <div className="space-y-6">
          <GlassCard className="p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-850 text-slate-450 font-bold uppercase tracking-wider text-[10px] bg-slate-900/30">
                    <th className="py-2.5 px-3">Institution</th>
                    <th className="py-2.5 px-3">Payment ID</th>
                    <th className="py-2.5 px-3">Billing Cycle</th>
                    <th className="py-2.5 px-3">Original Price</th>
                    <th className="py-2.5 px-3">Paid Amount</th>
                    <th className="py-2.5 px-3">Method</th>
                    <th className="py-2.5 px-3 text-right">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-850/60 text-slate-300">
                  {payments.map(p => (
                    <tr key={p.id} className="hover:bg-slate-900/10 transition-colors">
                      <td className="py-2.5 px-3 font-semibold text-slate-200">{p.schools?.name || 'Global'}</td>
                      <td className="py-2.5 px-3 font-mono text-[10px] text-slate-500">{p.id}</td>
                      <td className="py-2.5 px-3 font-semibold text-slate-400">{p.billing_cycle || 'MONTHLY'}</td>
                      <td className="py-2.5 px-3 font-mono">₹{Number(p.amount).toLocaleString()}</td>
                      <td className="py-2.5 px-3 font-mono text-green-400 font-bold">₹{Number(p.amount).toLocaleString()}</td>
                      <td className="py-2.5 px-3 uppercase text-[10px] text-slate-450">{p.payment_method || 'CARD'}</td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-500">{new Date(p.created_at).toLocaleDateString('en-IN')}</td>
                    </tr>
                  ))}
                  {payments.length === 0 && (
                    <tr>
                      <td colSpan={7} className="text-center py-8 text-slate-500 italic">No purchase transactions logged yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </GlassCard>
        </div>
      )}

      {/* ── Tab 6: Timeline ── */}
      {activeTab === 'sub-timeline' && (
        <div className="space-y-6">
          <div className="flex gap-4 items-center p-4 bg-slate-900/40 border border-slate-850 rounded-2xl">
            <span className="text-xs font-bold text-slate-400">Select School Cluster Node:</span>
            <select
              value={selectedSchoolId}
              onChange={(e) => setSelectedSchoolId(e.target.value)}
              className="bg-slate-950 border border-slate-800 text-slate-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-brand-500 max-w-xs w-full"
            >
              <option value="">-- Choose Institution --</option>
              {schools.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          {selectedSchoolId ? (
            <GlassCard className="p-6 space-y-6">
              <h4 className="font-bold text-slate-100 text-sm border-b border-slate-850 pb-2">Active School Subscription Lifecycle History</h4>
              
              <div className="relative pl-6 border-l-2 border-slate-800 space-y-6 ml-3 py-2">
                {auditLogs.filter(log => log.school_id === selectedSchoolId).map((log, i) => (
                  <div key={log.id || i} className="relative">
                    <span className="absolute -left-[31px] top-1 w-4 h-4 rounded-full bg-slate-950 border-2 border-brand-500 flex items-center justify-center">
                      <span className="w-1.5 h-1.5 rounded-full bg-brand-500" />
                    </span>
                    <div className="bg-slate-900/20 border border-slate-850 rounded-xl p-3.5 space-y-1">
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-brand-400 uppercase font-mono text-[10px] tracking-wider bg-brand-500/5 px-2 py-0.5 rounded border border-brand-500/10">
                          {log.action?.replace('_', ' ')}
                        </span>
                        <span className="text-[10px] text-slate-500 font-mono">{new Date(log.created_at).toLocaleString()}</span>
                      </div>
                      <p className="text-[11px] text-slate-350 mt-1">Plan: <span className="font-semibold text-slate-250 uppercase font-mono">{log.plan}</span></p>
                      {log.amount && <p className="text-[11px] text-slate-400 font-mono mt-0.5">Payment amount: ₹{Number(log.amount).toLocaleString()}</p>}
                      {log.metadata && <pre className="text-[9px] text-slate-500 bg-slate-950/40 p-1.5 rounded font-mono mt-2 overflow-x-auto">{JSON.stringify(log.metadata, null, 2)}</pre>}
                    </div>
                  </div>
                ))}
                {auditLogs.filter(log => log.school_id === selectedSchoolId).length === 0 && (
                  <p className="text-xs text-slate-500 italic py-4">No logged lifecycle transition entries found for this school cluster node.</p>
                )}
              </div>
            </GlassCard>
          ) : (
            <div className="p-6 text-center text-slate-500 italic bg-slate-900/10 border border-dashed border-slate-850 rounded-2xl">
              Please choose a school to inspect its licensing lifecycle transition milestones.
            </div>
          )}
        </div>
      )}

      {/* ── Tab 7: Invoices ── */}
      {activeTab === 'sub-invoices' && (
        <div className="space-y-6">
          <GlassCard className="p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-850 text-slate-450 font-bold uppercase tracking-wider text-[10px] bg-slate-900/30">
                    <th className="py-2.5 px-3">Invoice #</th>
                    <th className="py-2.5 px-3">Institution Name</th>
                    <th className="py-2.5 px-3">Subtotal</th>
                    <th className="py-2.5 px-3">GST Tax</th>
                    <th className="py-2.5 px-3">Total Amount</th>
                    <th className="py-2.5 px-3">Date issued</th>
                    <th className="py-2.5 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-850/60 text-slate-350">
                  {invoices.map(inv => (
                    <tr key={inv.id} className="hover:bg-slate-900/10 transition-colors">
                      <td className="py-2.5 px-3 font-mono font-bold text-slate-100">{inv.invoice_number}</td>
                      <td className="py-2.5 px-3 font-semibold text-slate-200">{inv.schools?.name || 'Global'}</td>
                      <td className="py-2.5 px-3 font-mono">₹{Number(inv.amount).toLocaleString()}</td>
                      <td className="py-2.5 px-3 font-mono text-slate-450">₹{Number(inv.tax_amount || 0).toLocaleString()}</td>
                      <td className="py-2.5 px-3 font-mono text-green-400 font-bold">₹{Number(inv.total_amount).toLocaleString()}</td>
                      <td className="py-2.5 px-3 text-slate-500 font-mono">{new Date(inv.created_at).toLocaleDateString('en-IN')}</td>
                      <td className="py-2.5 px-3 text-right flex items-center justify-end gap-2">
                        <button
                          onClick={() => downloadInvoicePDF(inv)}
                          className="p-1 hover:text-brand-400 transition-colors"
                          title="Download PDF"
                        >
                          <Download size={13} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {invoices.length === 0 && (
                    <tr>
                      <td colSpan={7} className="text-center py-8 text-slate-500 italic">No billings invoices generated.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </GlassCard>
        </div>
      )}

      {/* ── Tab 8: Audits ── */}
      {activeTab === 'sub-audits' && (
        <div className="space-y-6">
          <GlassCard className="p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-850 text-slate-450 font-bold uppercase tracking-wider text-[10px] bg-slate-900/30">
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Institution Name</th>
                    <th className="py-2.5 px-3">Action Event</th>
                    <th className="py-2.5 px-3">Plan Mapped</th>
                    <th className="py-2.5 px-3">Operator ID</th>
                    <th className="py-2.5 px-3 text-right">Details Payload</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-850/60 text-slate-350">
                  {auditLogs.map((log, idx) => (
                    <tr key={log.id || idx} className="hover:bg-slate-900/10 transition-colors">
                      <td className="py-2.5 px-3 font-mono text-slate-500 text-[10px]">{new Date(log.created_at).toLocaleString()}</td>
                      <td className="py-2.5 px-3 font-semibold text-slate-200">{log.schools?.name || 'Global context'}</td>
                      <td className="py-2.5 px-3 font-mono font-bold text-brand-400">{log.action}</td>
                      <td className="py-2.5 px-3 uppercase text-[10px] text-slate-400 font-mono">{log.plan || '—'}</td>
                      <td className="py-2.5 px-3 font-mono text-[9px] text-slate-500">{log.admin_id?.slice(0, 8) || 'SYSTEM'}</td>
                      <td className="py-2.5 px-3 text-right font-mono text-[10px] text-slate-450 italic truncate max-w-xs">{JSON.stringify(log.metadata || {})}</td>
                    </tr>
                  ))}
                  {auditLogs.length === 0 && (
                    <tr>
                      <td colSpan={6} className="text-center py-8 text-slate-500 italic">No security activity log trail recorded.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </GlassCard>
        </div>
      )}

      {/* ── Tab 9: Reports ── */}
      {activeTab === 'sub-reports' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Revenue report card */}
            <GlassCard className="p-4 space-y-4 border border-brand-500/15">
              <h4 className="font-extrabold text-slate-200 text-sm">Revenue Ledger Summary</h4>
              <p className="text-xs text-slate-400">Generates total successful subscription payment transaction items, invoices, and totals.</p>
              <div className="flex gap-2">
                <button 
                  onClick={() => exportReportCSV('revenue')}
                  className="flex-1 py-2 rounded-xl bg-slate-900 border border-slate-800 hover:border-brand-500/40 text-brand-400 font-bold text-xs flex items-center justify-center gap-1.5"
                >
                  <Download size={12} /> CSV Excel Export
                </button>
              </div>
            </GlassCard>

            {/* Subscriptions report card */}
            <GlassCard className="p-4 space-y-4 border border-brand-500/15">
              <h4 className="font-extrabold text-slate-200 text-sm">Licensing Status Report</h4>
              <p className="text-xs text-slate-400">Generates active plan distribution summaries, expiry countdown milestones, and grace period lists.</p>
              <div className="flex gap-2">
                <button 
                  onClick={() => exportReportCSV('subscriptions')}
                  className="flex-1 py-2 rounded-xl bg-slate-900 border border-slate-800 hover:border-brand-500/40 text-brand-400 font-bold text-xs flex items-center justify-center gap-1.5"
                >
                  <Download size={12} /> CSV Excel Export
                </button>
              </div>
            </GlassCard>

            {/* Tax / GST Ledger report card */}
            <GlassCard className="p-4 space-y-4 border border-brand-500/15">
              <h4 className="font-extrabold text-slate-200 text-sm">GST Ledger Component</h4>
              <p className="text-xs text-slate-400">Generates tax component audit lists with subtotal breakdowns (18% GST collected for reporting audits).</p>
              <div className="flex gap-2">
                <button 
                  onClick={() => exportReportCSV('gst')}
                  className="flex-1 py-2 rounded-xl bg-slate-900 border border-slate-800 hover:border-brand-500/40 text-brand-400 font-bold text-xs flex items-center justify-center gap-1.5"
                >
                  <Download size={12} /> CSV Excel Export
                </button>
              </div>
            </GlassCard>
          </div>
        </div>
      )}

      {/* Plan Configuration Modal Overlay */}
      {showPlanModal && editingPlan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fade-in text-xs overflow-y-auto">
          <GlassCard className="w-full max-w-2xl max-h-[90vh] overflow-y-auto border-brand-500/30 p-6 space-y-4 relative">
            <h4 className="font-black text-slate-100 text-sm border-b border-slate-850 pb-2">Plan Quotas Configuration: {editingPlan.name}</h4>
            <form onSubmit={handleSavePlan} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Monthly Price (INR)</label>
                  <input type="number" value={editingPlan.price_monthly} onChange={(e) => setEditingPlan({ ...editingPlan, price_monthly: e.target.value })} className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-slate-200 focus:outline-none" required />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Yearly Price (INR)</label>
                  <input type="number" value={editingPlan.price_yearly} onChange={(e) => setEditingPlan({ ...editingPlan, price_yearly: e.target.value })} className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-slate-200 focus:outline-none" required />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Max Students</label>
                  <input type="number" value={editingPlan.max_students} onChange={(e) => setEditingPlan({ ...editingPlan, max_students: e.target.value })} className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-slate-200 focus:outline-none" required />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Max Teachers</label>
                  <input type="number" value={editingPlan.max_teachers} onChange={(e) => setEditingPlan({ ...editingPlan, max_teachers: e.target.value })} className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-slate-200 focus:outline-none" required />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Max Parents</label>
                  <input type="number" value={editingPlan.max_parents} onChange={(e) => setEditingPlan({ ...editingPlan, max_parents: e.target.value })} className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-slate-200 focus:outline-none" required />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Storage Limit (GB)</label>
                  <input type="number" value={editingPlan.max_storage_gb} onChange={(e) => setEditingPlan({ ...editingPlan, max_storage_gb: e.target.value })} className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-slate-200 focus:outline-none" required />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Notifications Limit</label>
                  <input type="number" value={editingPlan.notification_limits} onChange={(e) => setEditingPlan({ ...editingPlan, notification_limits: e.target.value })} className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-slate-200 focus:outline-none" required />
                </div>
              </div>

              {/* Module access toggles */}
              <div className="space-y-2 border-t border-slate-900 pt-3">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Gate Module Features access</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {[
                    { key: 'has_ptm_access', label: 'PTM Meetings' },
                    { key: 'has_transport_access', label: 'Transit Registry' },
                    { key: 'has_library_access', label: 'Library Catalog' },
                    { key: 'has_finance_access', label: 'Finance Office' },
                    { key: 'has_hostel_access', label: 'Hostel Registry' },
                    { key: 'has_analytics_access', label: 'Telemetry Analytics' },
                    { key: 'has_coach_portal', label: 'Coach Portal' },
                    { key: 'has_warden_portal', label: 'Warden Portal' },
                  ].map(feature => (
                    <label key={feature.key} className="flex items-center gap-2 text-slate-300 select-none cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={!!editingPlan[feature.key]} 
                        onChange={(e) => setEditingPlan({ ...editingPlan, [feature.key]: e.target.checked })} 
                        className="rounded border-slate-800 bg-slate-900 text-brand-500 focus:ring-0 focus:ring-offset-0"
                      />
                      <span>{feature.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-850">
                <button type="button" onClick={() => { setShowPlanModal(false); setEditingPlan(null); }} className="glass-btn-secondary py-2 text-xs">Cancel</button>
                <button type="submit" className="glass-btn-primary py-2 text-xs">Apply Config</button>
              </div>
            </form>
          </GlassCard>
        </div>
      )}

      {/* Pricing Override Modal Overlay */}
      {showOverrideModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fade-in text-xs">
          <GlassCard className="w-full max-w-md border-brand-500/30 p-6 space-y-4">
            <h4 className="font-black text-slate-100 text-sm border-b border-slate-850 pb-2">Apply Custom Pricing / Discount Override</h4>
            <form onSubmit={handleCreateOverride} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Select Target School Node</label>
                <select
                  value={overrideForm.schoolId}
                  onChange={(e) => setOverrideForm({ ...overrideForm, schoolId: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-slate-200 focus:outline-none"
                  required
                >
                  <option value="">-- Choose School --</option>
                  {schools.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Target Plan Code</label>
                  <select
                    value={overrideForm.planCode}
                    onChange={(e) => setOverrideForm({ ...overrideForm, planCode: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-slate-200 focus:outline-none"
                  >
                    <option value="basic">Basic</option>
                    <option value="pro">Pro</option>
                    <option value="enterprise">Enterprise</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Discount Percent (%)</label>
                  <input type="number" placeholder="e.g. 15" value={overrideForm.discountPercent} onChange={(e) => setOverrideForm({ ...overrideForm, discountPercent: e.target.value })} className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-slate-200 focus:outline-none" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Monthly Price Override (INR)</label>
                  <input type="number" placeholder="e.g. 1999" value={overrideForm.monthlyPrice} onChange={(e) => setOverrideForm({ ...overrideForm, monthlyPrice: e.target.value })} className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-slate-200 focus:outline-none" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Yearly Price Override (INR)</label>
                  <input type="number" placeholder="e.g. 19999" value={overrideForm.yearlyPrice} onChange={(e) => setOverrideForm({ ...overrideForm, yearlyPrice: e.target.value })} className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-slate-200 focus:outline-none" />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Reason / Justification</label>
                <input type="text" placeholder="e.g. Pilot client structural promo discount" value={overrideForm.reason} onChange={(e) => setOverrideForm({ ...overrideForm, reason: e.target.value })} className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-slate-200 focus:outline-none" required />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-850">
                <button type="button" onClick={() => setShowOverrideModal(false)} className="glass-btn-secondary py-2 text-xs">Cancel</button>
                <button type="submit" className="glass-btn-primary py-2 text-xs">Deploy Override</button>
              </div>
            </form>
          </GlassCard>
        </div>
      )}

      {/* Coupon Modal Overlay */}
      {showCouponModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fade-in text-xs">
          <GlassCard className="w-full max-w-md border-brand-500/30 p-6 space-y-4">
            <h4 className="font-black text-slate-100 text-sm border-b border-slate-850 pb-2">Generate Promo Coupon Code</h4>
            <form onSubmit={handleCreateCoupon} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Coupon Code (Uppercase)</label>
                <input type="text" placeholder="e.g. AEGISPRO50" value={couponForm.code} onChange={(e) => setCouponForm({ ...couponForm, code: e.target.value })} className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-slate-200 focus:outline-none font-mono tracking-widest font-black uppercase" required />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Discount Percent (%)</label>
                  <input type="number" placeholder="e.g. 50" value={couponForm.discountPercent} onChange={(e) => setCouponForm({ ...couponForm, discountPercent: e.target.value })} className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-slate-200 focus:outline-none" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Fixed Amount Discount (INR)</label>
                  <input type="number" placeholder="e.g. 1000" value={couponForm.discountAmount} onChange={(e) => setCouponForm({ ...couponForm, discountAmount: e.target.value })} className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-slate-200 focus:outline-none" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Max Usages Limit</label>
                  <input type="number" placeholder="e.g. 100" value={couponForm.maxUses} onChange={(e) => setCouponForm({ ...couponForm, maxUses: e.target.value })} className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-slate-200 focus:outline-none" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Expiry Date</label>
                  <input type="date" value={couponForm.expiryDate} onChange={(e) => setCouponForm({ ...couponForm, expiryDate: e.target.value })} className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-slate-200 focus:outline-none" />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-850">
                <button type="button" onClick={() => setShowCouponModal(false)} className="glass-btn-secondary py-2 text-xs">Cancel</button>
                <button type="submit" className="glass-btn-primary py-2 text-xs">Publish Coupon</button>
              </div>
            </form>
          </GlassCard>
        </div>
      )}

      {/* Licensing Control Modal Overlay */}
      {showControlModal && selectedSchoolControl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fade-in text-xs">
          <GlassCard className="w-full max-w-md border-brand-500/30 p-6 space-y-4">
            <h4 className="font-black text-slate-100 text-sm border-b border-slate-850 pb-2">Manual Licensing Override Control</h4>
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-slate-500 uppercase block">School Node Selected</span>
              <p className="text-xs font-bold text-slate-200">{selectedSchoolControl.name}</p>
            </div>
            
            <form onSubmit={handleControlSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Licensing Action Override</label>
                <select
                  value={controlForm.action}
                  onChange={(e) => setControlForm({ ...controlForm, action: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-slate-200 focus:outline-none"
                  required
                >
                  <option value="activate">Manual Activation (Grant / Overwrite)</option>
                  <option value="suspend">Manual Suspension (Deactivate Access)</option>
                  <option value="resume">Resume Suspended Subscription</option>
                  <option value="extend">Extend Expiry Date (Add Days)</option>
                  <option value="cancel">Force Cancel Subscription</option>
                  <option value="refund">Mark Refund Transaction</option>
                  <option value="trial">Grant Trial Period</option>
                </select>
              </div>

              {(controlForm.action === 'activate' || controlForm.action === 'trial') && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">Target Subscription Plan</label>
                    <select
                      value={controlForm.planCode}
                      onChange={(e) => setControlForm({ ...controlForm, planCode: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-slate-200 focus:outline-none"
                    >
                      <option value="basic">Basic</option>
                      <option value="pro">Pro</option>
                      <option value="enterprise">Enterprise</option>
                    </select>
                  </div>
                  {controlForm.action !== 'trial' && (
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase">Billing Cycle</label>
                      <select
                        value={controlForm.billingCycle}
                        onChange={(e) => setControlForm({ ...controlForm, billingCycle: e.target.value })}
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-slate-200 focus:outline-none"
                      >
                        <option value="MONTHLY">Monthly Billing</option>
                        <option value="YEARLY">Yearly Billing</option>
                      </select>
                    </div>
                  )}
                </div>
              )}

              {controlForm.action === 'extend' && (
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Extend Limit (Days)</label>
                  <input type="number" placeholder="e.g. 30" value={controlForm.extendDays} onChange={(e) => setControlForm({ ...controlForm, extendDays: e.target.value })} className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-slate-200 focus:outline-none" required />
                </div>
              )}

              {controlForm.action === 'activate' && (
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Amount Paid (INR)</label>
                  <input type="number" placeholder="e.g. 49999" value={controlForm.amountPaid} onChange={(e) => setControlForm({ ...controlForm, amountPaid: e.target.value })} className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-slate-200 focus:outline-none" required />
                </div>
              )}

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Operator Audit Justification</label>
                <input type="text" placeholder="e.g. Manual renewal for banking transfer verification" value={controlForm.reason} onChange={(e) => setControlForm({ ...controlForm, reason: e.target.value })} className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-slate-200 focus:outline-none" required />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-850">
                <button type="button" onClick={() => { setShowControlModal(false); setSelectedSchoolControl(null); }} className="glass-btn-secondary py-2 text-xs">Cancel</button>
                <button type="submit" className="glass-btn-primary py-2 text-xs">Apply licensing</button>
              </div>
            </form>
          </GlassCard>
        </div>
      )}

    </div>
  );
};
export default SuperAdminSubscriptionPortal;
