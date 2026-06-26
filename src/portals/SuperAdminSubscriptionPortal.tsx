import React, { useState, useEffect, useCallback } from 'react';
import { supabase, supabaseAdmin } from '../lib/supabase';
import { useStore } from '../store/useStore';
import { 
  CreditCard, Sparkles, Zap, Shield, ShieldCheck, Trash2, Edit2, PlusCircle, 
  Search, RefreshCw, Eye, Tag, Calendar, Download, Mail, Play, AlertTriangle, 
  Clock, CheckCircle2, XCircle, Ban, History, BarChart2, Coins, Percent, FileText, 
  User, ArrowUpRight, Award, Plus, Filter, ChevronRight, Copy, Power
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
  const { session, fetchPlans } = useStore();
  const superAdminId = session?.user?.id;

  // Local States
  const [loading, setLoading] = useState(false);
  const [schools, setSchools] = useState<any[]>([]);
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [coupons, setCoupons] = useState<any[]>([]);
  const [couponUsages, setCouponUsages] = useState<any[]>([]);
  const [discounts, setDiscounts] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);

  // Search/Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSchoolId, setSelectedSchoolId] = useState('');
  const [filterPlan, setFilterPlan] = useState('all');

  // Coupon modal / state variables
  const [showCouponModal, setShowCouponModal] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<any | null>(null); // null means creating
  const [showDeleteCouponModal, setShowDeleteCouponModal] = useState(false);
  const [selectedCouponToDelete, setSelectedCouponToDelete] = useState<any | null>(null);
  const [showUsageDetailsModal, setShowUsageDetailsModal] = useState(false);
  const [selectedCouponForUsage, setSelectedCouponForUsage] = useState<any | null>(null);
  const [couponUsageHistory, setCouponUsageHistory] = useState<any[]>([]);

  // Advanced search/filters for coupons
  const [couponSearch, setCouponSearch] = useState('');
  const [couponFilterStatus, setCouponFilterStatus] = useState('all');
  const [couponFilterType, setCouponFilterType] = useState('all');
  const [couponFilterPlan, setCouponFilterPlan] = useState('all');
  const [showDeletedCoupons, setShowDeletedCoupons] = useState(false);

  // Pagination for coupons
  const [couponPage, setCouponPage] = useState(1);
  const couponPageSize = 5;

  // Modals
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [editingPlan, setEditingPlan] = useState<any | null>(null);
  const [showOverrideModal, setShowOverrideModal] = useState(false);
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
    name: '',
    description: '',
    discountType: 'PERCENTAGE',
    discountValue: '',
    maxDiscount: '',
    minPurchase: '',
    maxUses: '',
    perUserRedemption: '1',
    expiryDate: '',
    activationDate: '',
    applicablePlans: [] as string[],
    applicableSchools: [] as string[],
    status: 'ACTIVE',
    color: 'brand',
    tag: '',
    priority: '0',
    notes: '',
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

      // Query subscriptions — exclude in-flight PENDING checkout rows
      const { data: subsData } = await supabaseAdmin
        .from('subscriptions')
        .select('*, schools(name)')
        .not('status', 'eq', 'PENDING')
        .order('created_at', { ascending: false });
      setSubscriptions(subsData || []);

      // Query successful payments
      const { data: paymentsData } = await supabaseAdmin.from('payments').select('*, schools(name)').order('created_at', { ascending: false });
      setPayments(paymentsData || []);

      // Query coupons
      try {
        const { data: couponsData } = await supabaseAdmin
          .from('subscription_coupons')
          .select('*')
          .order('priority', { ascending: false })
          .order('created_at', { ascending: false });
        setCoupons(couponsData || []);
      } catch (e) {
        console.warn('coupons table load error:', e);
      }

      // Query coupon usages
      try {
        const { data: usagesData } = await supabaseAdmin
          .from('subscription_coupon_usages')
          .select('*');
        setCouponUsages(usagesData || []);
      } catch (e) {
        console.warn('usages table load error:', e);
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
      // Invalidate the global Zustand plans store so all portals see the latest data
      await fetchPlans();
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

  // Fetch coupon usages for reporting details
  const fetchCouponUsage = async (couponId: string) => {
    try {
      const { data, error } = await supabaseAdmin
        .from('subscription_coupon_usages')
        .select('*, schools(name), users(email, first_name, last_name)')
        .eq('coupon_id', couponId)
        .order('redeemed_at', { ascending: false });
      if (error) throw error;
      setCouponUsageHistory(data || []);
    } catch (e) {
      console.error('Failed to load coupon usage history:', e);
    }
  };

  // Reset coupon form inputs
  const resetCouponForm = () => {
    setCouponForm({
      code: '',
      name: '',
      description: '',
      discountType: 'PERCENTAGE',
      discountValue: '',
      maxDiscount: '',
      minPurchase: '',
      maxUses: '',
      perUserRedemption: '1',
      expiryDate: '',
      activationDate: '',
      applicablePlans: [],
      applicableSchools: [],
      status: 'ACTIVE',
      color: 'brand',
      tag: '',
      priority: '0',
      notes: '',
    });
  };

  // Save Coupon (Create or Edit)
  const handleSaveCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!couponForm.code) {
      alert('Please specify coupon code.');
      return;
    }

    const codeVal = couponForm.code.toUpperCase().trim();

    // Validate uniqueness for new coupons
    if (!editingCoupon) {
      const isDuplicate = coupons.some(c => c.code.toUpperCase() === codeVal && !c.is_deleted);
      if (isDuplicate) {
        alert('A coupon with this code already exists.');
        return;
      }
    }

    const discountPercent = couponForm.discountType === 'PERCENTAGE' ? Number(couponForm.discountValue) : null;
    const discountAmount = couponForm.discountType === 'FIXED' ? Number(couponForm.discountValue) : null;

    const couponPayload = {
      code: codeVal,
      name: couponForm.name || `Promo Campaign ${codeVal}`,
      description: couponForm.description || '',
      discount_type: couponForm.discountType,
      discount_value: Number(couponForm.discountValue || 0),
      max_discount: couponForm.maxDiscount ? Number(couponForm.maxDiscount) : null,
      min_purchase: couponForm.minPurchase ? Number(couponForm.minPurchase) : 0,
      max_uses: couponForm.maxUses ? Number(couponForm.maxUses) : null,
      per_user_redemption: Number(couponForm.perUserRedemption || 1),
      expiry_date: couponForm.expiryDate || null,
      activation_date: couponForm.activationDate || null,
      applicable_plans: couponForm.applicablePlans.length > 0 ? couponForm.applicablePlans : null,
      applicable_schools: couponForm.applicableSchools.length > 0 ? couponForm.applicableSchools : null,
      status: couponForm.status,
      color: couponForm.color,
      tag: couponForm.tag || null,
      priority: Number(couponForm.priority || 0),
      notes: couponForm.notes || '',
      is_active: couponForm.status === 'ACTIVE',
      // backward compatibility maps
      discount_percent: discountPercent,
      discount_amount: discountAmount,
    };

    try {
      setLoading(true);
      let error;
      if (editingCoupon) {
        const { error: err } = await supabaseAdmin
          .from('subscription_coupons')
          .update({
            ...couponPayload,
            updated_at: new Date().toISOString(),
            updated_by: superAdminId
          })
          .eq('id', editingCoupon.id);
        error = err;
      } else {
        const { error: err } = await supabaseAdmin
          .from('subscription_coupons')
          .insert({
            ...couponPayload,
            created_by: superAdminId
          });
        error = err;
      }

      if (error) throw error;

      // Create Audit Log
      await supabaseAdmin.from('subscription_audit_logs').insert({
        school_id: schools[0]?.id || '11111111-1111-1111-1111-111111111111',
        admin_id: superAdminId,
        action: editingCoupon ? 'COUPON_UPDATED' : 'COUPON_CREATED',
        plan: couponForm.applicablePlans[0] || 'all',
        metadata: { code: codeVal, discount_type: couponForm.discountType, discount_value: couponForm.discountValue }
      });

      setShowCouponModal(false);
      setEditingCoupon(null);
      resetCouponForm();
      await loadData();
      alert(editingCoupon ? 'Coupon updated successfully.' : 'New Coupon published successfully.');
    } catch (err: any) {
      alert('Failed to save coupon: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Toggle status (Activate / Deactivate)
  const handleToggleCouponActive = async (coupon: any) => {
    const nextStatus = coupon.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    try {
      setLoading(true);
      const { error } = await supabaseAdmin
        .from('subscription_coupons')
        .update({
          status: nextStatus,
          is_active: nextStatus === 'ACTIVE',
          updated_at: new Date().toISOString(),
          updated_by: superAdminId
        })
        .eq('id', coupon.id);
      if (error) throw error;

      // Log audit trail
      await supabaseAdmin.from('subscription_audit_logs').insert({
        school_id: schools[0]?.id || '11111111-1111-1111-1111-111111111111',
        admin_id: superAdminId,
        action: nextStatus === 'ACTIVE' ? 'COUPON_ACTIVATED' : 'COUPON_DEACTIVATED',
        plan: coupon.applicable_plans?.[0] || 'all',
        metadata: { code: coupon.code, status: nextStatus }
      });

      await loadData();
    } catch (err: any) {
      alert('Failed to toggle coupon status: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Soft delete / permanent delete
  const handleDeleteCoupon = async (softDelete: boolean) => {
    if (!selectedCouponToDelete) return;
    try {
      setLoading(true);
      let error;
      if (softDelete) {
        const { error: err } = await supabaseAdmin
          .from('subscription_coupons')
          .update({
            is_deleted: true,
            status: 'DISABLED',
            is_active: false,
            deleted_at: new Date().toISOString(),
            deleted_by: superAdminId
          })
          .eq('id', selectedCouponToDelete.id);
        error = err;
      } else {
        const { error: err } = await supabaseAdmin
          .from('subscription_coupons')
          .delete()
          .eq('id', selectedCouponToDelete.id);
        error = err;
      }

      if (error) throw error;

      // Log audit trail
      await supabaseAdmin.from('subscription_audit_logs').insert({
        school_id: schools[0]?.id || '11111111-1111-1111-1111-111111111111',
        admin_id: superAdminId,
        action: softDelete ? 'COUPON_SOFT_DELETED' : 'COUPON_PERMANENTLY_DELETED',
        plan: selectedCouponToDelete.applicable_plans?.[0] || 'all',
        metadata: { code: selectedCouponToDelete.code }
      });

      setShowDeleteCouponModal(false);
      setSelectedCouponToDelete(null);
      await loadData();
      alert(softDelete ? 'Coupon soft-deleted successfully.' : 'Coupon permanently deleted.');
    } catch (err: any) {
      alert('Failed to delete coupon: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Restore coupon
  const handleRestoreCoupon = async (coupon: any) => {
    try {
      setLoading(true);
      const { error } = await supabaseAdmin
        .from('subscription_coupons')
        .update({
          is_deleted: false,
          status: 'ACTIVE',
          is_active: true,
          updated_at: new Date().toISOString(),
          updated_by: superAdminId,
          deleted_at: null,
          deleted_by: null
        })
        .eq('id', coupon.id);
      if (error) throw error;

      await supabaseAdmin.from('subscription_audit_logs').insert({
        school_id: schools[0]?.id || '11111111-1111-1111-1111-111111111111',
        admin_id: superAdminId,
        action: 'COUPON_RESTORED',
        plan: coupon.applicable_plans?.[0] || 'all',
        metadata: { code: coupon.code }
      });

      await loadData();
      alert('Coupon restored to active status.');
    } catch (err: any) {
      alert('Failed to restore coupon: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Duplicate Coupon
  const handleDuplicateCoupon = (coupon: any) => {
    setCouponForm({
      code: `${coupon.code}_COPY`,
      name: `${coupon.name || ''} (Copy)`,
      description: coupon.description || '',
      discountType: coupon.discount_type || (coupon.discount_percent ? 'PERCENTAGE' : 'FIXED'),
      discountValue: String(coupon.discount_value || coupon.discount_percent || coupon.discount_amount || 0),
      maxDiscount: coupon.max_discount ? String(coupon.max_discount) : '',
      minPurchase: coupon.min_purchase ? String(coupon.min_purchase) : '',
      maxUses: coupon.max_uses ? String(coupon.max_uses) : '',
      perUserRedemption: coupon.per_user_redemption ? String(coupon.per_user_redemption) : '1',
      expiryDate: coupon.expiry_date || '',
      activationDate: coupon.activation_date || '',
      applicablePlans: coupon.applicable_plans || [],
      applicableSchools: coupon.applicable_schools || [],
      status: 'ACTIVE',
      color: coupon.color || 'brand',
      tag: coupon.tag || '',
      priority: String(coupon.priority || 0),
      notes: coupon.notes || '',
    });
    setEditingCoupon(null);
    setShowCouponModal(true);
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
      {activeTab === 'sub-coupons' && (() => {
        // Stats calculations
        const activeCouponList = coupons.filter(c => !c.is_deleted);
        const totalCount = activeCouponList.length;
        const activeCount = coupons.filter(c => c.status === 'ACTIVE' && !c.is_deleted && (!c.expiry_date || new Date(c.expiry_date) >= new Date())).length;
        const totalUsage = couponUsages.length;
        const totalDiscount = couponUsages.reduce((acc, u) => acc + Number(u.discount_amount || 0), 0);

        // Filter calculation
        const filteredCoupons = coupons.filter(c => {
          const matchesSearch = c.code.toLowerCase().includes(couponSearch.toLowerCase()) ||
                                (c.name && c.name.toLowerCase().includes(couponSearch.toLowerCase()));
          const matchesStatus = couponFilterStatus === 'all' || 
                                (couponFilterStatus === 'active' && c.status === 'ACTIVE' && !c.is_deleted) ||
                                (couponFilterStatus === 'scheduled' && c.status === 'SCHEDULED') ||
                                (couponFilterStatus === 'expired' && c.status === 'EXPIRED') ||
                                (couponFilterStatus === 'inactive' && c.status === 'INACTIVE') ||
                                (couponFilterStatus === 'disabled' && c.status === 'DISABLED') ||
                                (couponFilterStatus === 'deleted' && c.is_deleted);
          const matchesType = couponFilterType === 'all' ||
                              (couponFilterType === 'percentage' && c.discount_type === 'PERCENTAGE') ||
                              (couponFilterType === 'fixed' && c.discount_type === 'FIXED');
          const matchesPlan = couponFilterPlan === 'all' ||
                              (c.applicable_plans && c.applicable_plans.includes(couponFilterPlan));
          
          const isSoftDeleted = c.is_deleted;
          if (couponFilterStatus === 'deleted') return isSoftDeleted && matchesSearch && matchesType && matchesPlan;
          if (isSoftDeleted && !showDeletedCoupons) return false;

          return matchesSearch && matchesStatus && matchesType && matchesPlan;
        });

        // Pagination
        const paginatedCoupons = filteredCoupons.slice((couponPage - 1) * couponPageSize, couponPage * couponPageSize);
        const totalCouponPages = Math.ceil(filteredCoupons.length / couponPageSize) || 1;

        const getRelativeDateString = (dateStr: string | null | undefined): string => {
          if (!dateStr) return 'Never';
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const exp = new Date(dateStr + 'T00:00:00');
          const diffMs = exp.getTime() - today.getTime();
          const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
          if (diffDays < 0) return 'Expired';
          if (diffDays === 0) return 'Expires today';
          if (diffDays === 1) return 'Expires tomorrow';
          return `in ${diffDays} days`;
        };

        return (
          <div className="space-y-6">
            <div className="flex justify-between items-center border-b border-slate-850 pb-3">
              <div>
                <h3 className="font-bold text-slate-100 flex items-center gap-2">
                  <Tag className="text-indigo-400" size={18} />
                  Coupon Management
                </h3>
                <p className="text-xs text-slate-450 mt-1">Create, manage and track promo coupons used during subscription payments.</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { loadData(); alert('Data refreshed successfully.'); }}
                  className="bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 px-3 py-2 rounded-xl text-xs flex items-center gap-1.5 transition-all"
                >
                  <RefreshCw size={12} /> Refresh
                </button>
                <button 
                  onClick={() => { setEditingCoupon(null); resetCouponForm(); setShowCouponModal(true); }}
                  className="bg-brand-600 hover:bg-brand-500 text-white font-bold text-xs px-3.5 py-2 rounded-xl transition-all flex items-center gap-1.5 shadow-lg shadow-brand-500/10 border border-brand-500/20"
                >
                  <PlusCircle size={14} /> Create Coupon
                </button>
              </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <GlassCard className="p-4 flex items-center gap-4 relative overflow-hidden border-slate-850">
                <div className="absolute top-0 left-0 w-full h-[2px] bg-brand-500/40" />
                <div className="p-2.5 rounded-xl bg-brand-500/10 text-brand-400">
                  <Tag size={20} />
                </div>
                <div>
                  <h4 className="text-2xl font-black text-slate-100 font-mono leading-none">{totalCount}</h4>
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider font-bold mt-1">Total Coupons</p>
                  <p className="text-[9px] text-slate-650 font-medium">All time campaigns</p>
                </div>
              </GlassCard>

              <GlassCard className="p-4 flex items-center gap-4 relative overflow-hidden border-slate-850">
                <div className="absolute top-0 left-0 w-full h-[2px] bg-emerald-500/40" />
                <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400">
                  <ShieldCheck size={20} />
                </div>
                <div>
                  <h4 className="text-2xl font-black text-slate-100 font-mono leading-none">{activeCount}</h4>
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider font-bold mt-1">Active Coupons</p>
                  <p className="text-[9px] text-slate-650 font-medium">Currently applicable</p>
                </div>
              </GlassCard>

              <GlassCard className="p-4 flex items-center gap-4 relative overflow-hidden border-slate-850">
                <div className="absolute top-0 left-0 w-full h-[2px] bg-purple-500/40" />
                <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-400">
                  <History size={20} />
                </div>
                <div>
                  <h4 className="text-2xl font-black text-slate-100 font-mono leading-none">{totalUsage}</h4>
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider font-bold mt-1">Total Usage</p>
                  <p className="text-[9px] text-slate-650 font-medium">All coupon usages</p>
                </div>
              </GlassCard>

              <GlassCard className="p-4 flex items-center gap-4 relative overflow-hidden border-slate-850">
                <div className="absolute top-0 left-0 w-full h-[2px] bg-amber-500/40" />
                <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400">
                  <Coins size={20} />
                </div>
                <div>
                  <h4 className="text-2xl font-black text-slate-100 font-mono leading-none">₹{totalDiscount.toLocaleString('en-IN')}</h4>
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider font-bold mt-1">Total Discount</p>
                  <p className="text-[9px] text-slate-650 font-medium">Total discount amount</p>
                </div>
              </GlassCard>
            </div>

            {/* Layout Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              
              {/* Left Main Pane */}
              <div className="lg:col-span-9 space-y-4">
                
                {/* Advanced Filters */}
                <GlassCard className="p-4 border-slate-850 flex flex-wrap items-center gap-3">
                  <div className="flex-1 min-w-[200px] relative">
                    <Search className="absolute left-3 top-2.5 text-slate-500" size={14} />
                    <input
                      type="text"
                      placeholder="Search by code or name..."
                      value={couponSearch}
                      onChange={(e) => { setCouponSearch(e.target.value); setCouponPage(1); }}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-200 focus:outline-none focus:border-brand-500/50"
                    />
                  </div>

                  <div className="flex gap-2">
                    <div className="flex flex-col">
                      <select
                        value={couponFilterStatus}
                        onChange={(e) => { setCouponFilterStatus(e.target.value); setCouponPage(1); }}
                        className="bg-slate-900 border border-slate-800 text-slate-350 p-2 rounded-xl text-xs focus:outline-none"
                      >
                        <option value="all">Status: All</option>
                        <option value="active">Active Only</option>
                        <option value="scheduled">Scheduled Only</option>
                        <option value="expired">Expired Only</option>
                        <option value="inactive">Inactive Only</option>
                        <option value="disabled">Disabled Only</option>
                        <option value="deleted">Deleted (Soft-Delete)</option>
                      </select>
                    </div>

                    <div className="flex flex-col">
                      <select
                        value={couponFilterType}
                        onChange={(e) => { setCouponFilterType(e.target.value); setCouponPage(1); }}
                        className="bg-slate-900 border border-slate-800 text-slate-350 p-2 rounded-xl text-xs focus:outline-none"
                      >
                        <option value="all">Type: All</option>
                        <option value="percentage">Percentage</option>
                        <option value="fixed">Fixed Amount</option>
                      </select>
                    </div>

                    <div className="flex flex-col">
                      <select
                        value={couponFilterPlan}
                        onChange={(e) => { setCouponFilterPlan(e.target.value); setCouponPage(1); }}
                        className="bg-slate-900 border border-slate-800 text-slate-350 p-2 rounded-xl text-xs focus:outline-none"
                      >
                        <option value="all">Applicable Plan: All</option>
                        <option value="freemium">Freemium</option>
                        <option value="basic">Basic</option>
                        <option value="pro">Pro</option>
                        <option value="enterprise">Enterprise</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 border-l border-slate-800 pl-3">
                    <input
                      type="checkbox"
                      id="show_deleted_coupons"
                      checked={showDeletedCoupons}
                      onChange={(e) => { setShowDeletedCoupons(e.target.checked); setCouponPage(1); }}
                      className="rounded border-slate-800 bg-slate-900 text-brand-500 focus:ring-0 focus:ring-offset-0"
                    />
                    <label htmlFor="show_deleted_coupons" className="text-[10px] text-slate-400 font-bold uppercase cursor-pointer select-none">Show Deleted</label>
                  </div>
                </GlassCard>

                {/* Coupons Table List */}
                <GlassCard className="p-0 overflow-hidden border-slate-850">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-slate-850 text-slate-450 font-bold uppercase tracking-wider text-[10px] bg-slate-900/30">
                          <th className="py-3 px-4">Coupon</th>
                          <th className="py-3 px-4">Type</th>
                          <th className="py-3 px-4">Discount</th>
                          <th className="py-3 px-4">Applicable Plans</th>
                          <th className="py-3 px-4">Usage</th>
                          <th className="py-3 px-4">Status</th>
                          <th className="py-3 px-4">Expiry Date</th>
                          <th className="py-3 px-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-850/60 text-slate-300">
                        {paginatedCoupons.map(c => {
                          const currentUses = c.current_uses || 0;
                          const maxUses = c.max_uses || 0;
                          const percent = maxUses > 0 ? Math.min(100, Math.round((currentUses / maxUses) * 100)) : 0;
                          const isCouponExpired = c.expiry_date && new Date().toISOString().split('T')[0] > c.expiry_date;
                          const isCouponScheduled = c.activation_date && new Date().toISOString().split('T')[0] < c.activation_date;
                          
                          let statusLabel = c.status || 'ACTIVE';
                          if (c.is_deleted) statusLabel = 'DELETED';
                          else if (c.status === 'ACTIVE' && isCouponExpired) statusLabel = 'EXPIRED';
                          else if (c.status === 'ACTIVE' && isCouponScheduled) statusLabel = 'SCHEDULED';

                          let statusClass = 'bg-slate-500/10 text-slate-450 border border-slate-500/20';
                          if (statusLabel === 'ACTIVE') statusClass = 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
                          else if (statusLabel === 'SCHEDULED') statusClass = 'bg-amber-500/10 text-amber-400 border border-amber-500/20';
                          else if (statusLabel === 'EXPIRED') statusClass = 'bg-rose-500/10 text-rose-400 border border-rose-500/20';
                          else if (statusLabel === 'DISABLED' || statusLabel === 'DELETED') statusClass = 'bg-rose-500/10 text-rose-400 border border-rose-500/20';
                          else if (statusLabel === 'INACTIVE') statusClass = 'bg-slate-500/10 text-slate-400 border border-slate-500/20';
                          
                          const discountTypeLabel = c.discount_type === 'PERCENTAGE' ? 'Percentage' : 'Fixed Amount';
                          const discountValLabel = c.discount_type === 'PERCENTAGE' ? `${c.discount_value}%` : `₹${Number(c.discount_value).toLocaleString('en-IN')}`;

                          return (
                            <tr key={c.id} className="hover:bg-slate-900/10 transition-colors">
                              <td className="py-3 px-4">
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2">
                                    <span className="font-mono font-extrabold text-slate-100 tracking-wider bg-slate-900 border border-slate-800 px-2 py-0.5 rounded text-[11px] uppercase">{c.code}</span>
                                    {c.tag && <span className="bg-brand-500/10 text-brand-400 text-[8px] font-bold px-1.5 py-0.2 rounded uppercase">{c.tag}</span>}
                                  </div>
                                  <p className="text-[10px] text-slate-400 truncate max-w-[200px]" title={c.name}>{c.name}</p>
                                </div>
                              </td>
                              <td className="py-3 px-4 font-semibold text-slate-450">{discountTypeLabel}</td>
                              <td className="py-3 px-4">
                                <div className="space-y-0.5">
                                  <span className="font-bold text-emerald-400 font-mono">{discountValLabel}</span>
                                  {c.max_discount && <p className="text-[9px] text-slate-500">Max ₹{Number(c.max_discount).toLocaleString('en-IN')}</p>}
                                </div>
                              </td>
                              <td className="py-3 px-4">
                                <div className="flex flex-wrap gap-1">
                                  {c.applicable_plans && c.applicable_plans.length > 0 ? (
                                    c.applicable_plans.map((p: string) => {
                                      const lower = p.toLowerCase();
                                      const themeClass = lower === 'enterprise' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' :
                                                         lower === 'pro' ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' :
                                                         lower === 'basic' ? 'bg-brand-500/10 text-brand-400 border-brand-500/20' :
                                                         'bg-slate-500/10 text-slate-400 border-slate-500/20';
                                      return (
                                        <span key={p} className={`text-[8px] font-bold px-1.5 py-0.2 rounded-full border uppercase ${themeClass}`}>{p}</span>
                                      );
                                    })
                                  ) : (
                                    <span className="text-[8px] font-bold px-1.5 py-0.2 rounded-full border bg-slate-500/10 text-slate-400 border-slate-500/20 uppercase">All Plans</span>
                                  )}
                                </div>
                              </td>
                              <td className="py-3 px-4">
                                <div className="space-y-1 w-32">
                                  <div className="flex justify-between text-[9px] text-slate-400 font-mono">
                                    <span>{currentUses} / {c.max_uses || '∞'}</span>
                                    <span>{percent}%</span>
                                  </div>
                                  <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden border border-slate-850">
                                    <div className="bg-brand-500 h-full transition-all" style={{ width: `${percent}%` }} />
                                  </div>
                                </div>
                              </td>
                              <td className="py-3 px-4">
                                <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded border ${statusClass}`}>{statusLabel}</span>
                              </td>
                              <td className="py-3 px-4">
                                <div className="space-y-0.5">
                                  <p className="font-semibold text-slate-350">{c.expiry_date ? formatDate(c.expiry_date) : 'Never'}</p>
                                  {c.expiry_date && <p className="text-[9px] text-slate-550 font-mono">{getRelativeDateString(c.expiry_date)}</p>}
                                </div>
                              </td>
                              <td className="py-3 px-4 text-right">
                                <div className="flex justify-end gap-1.5">
                                  <button
                                    onClick={() => {
                                      setSelectedCouponForUsage(c);
                                      fetchCouponUsage(c.id);
                                      setShowUsageDetailsModal(true);
                                    }}
                                    className="p-1 rounded bg-slate-900 border border-slate-800 hover:border-brand-500/40 text-brand-400 transition-colors"
                                    title="View Usage History"
                                  >
                                    <Eye size={12} />
                                  </button>
                                  <button
                                    onClick={() => {
                                      setEditingCoupon(c);
                                      setCouponForm({
                                        code: c.code,
                                        name: c.name || '',
                                        description: c.description || '',
                                        discountType: c.discount_type || (c.discount_percent ? 'PERCENTAGE' : 'FIXED'),
                                        discountValue: String(c.discount_value || c.discount_percent || c.discount_amount || 0),
                                        maxDiscount: c.max_discount ? String(c.max_discount) : '',
                                        minPurchase: c.min_purchase ? String(c.min_purchase) : '',
                                        maxUses: c.max_uses ? String(c.max_uses) : '',
                                        perUserRedemption: c.per_user_redemption ? String(c.per_user_redemption) : '1',
                                        expiryDate: c.expiry_date || '',
                                        activationDate: c.activation_date || '',
                                        applicablePlans: c.applicable_plans || [],
                                        applicableSchools: c.applicable_schools || [],
                                        status: c.status || 'ACTIVE',
                                        color: c.color || 'brand',
                                        tag: c.tag || '',
                                        priority: String(c.priority || 0),
                                        notes: c.notes || '',
                                      });
                                      setShowCouponModal(true);
                                    }}
                                    className="p-1 rounded bg-slate-900 border border-slate-800 hover:border-indigo-500/40 text-indigo-400 transition-colors"
                                    title="Edit Coupon"
                                    disabled={c.is_deleted}
                                  >
                                    <Edit2 size={12} />
                                  </button>
                                  <button
                                    onClick={() => handleToggleCouponActive(c)}
                                    className={`p-1 rounded border transition-colors ${
                                      c.status === 'ACTIVE'
                                        ? 'bg-slate-900 border-slate-800 hover:border-amber-500/45 text-amber-400'
                                        : 'bg-slate-900 border-slate-800 hover:border-emerald-500/45 text-emerald-400'
                                    }`}
                                    title={c.status === 'ACTIVE' ? 'Deactivate Coupon' : 'Activate Coupon'}
                                    disabled={c.is_deleted}
                                  >
                                    <Power size={12} />
                                  </button>
                                  <button
                                    onClick={() => handleDuplicateCoupon(c)}
                                    className="p-1 rounded bg-slate-900 border border-slate-800 hover:border-purple-500/40 text-purple-400 transition-colors"
                                    title="Duplicate Coupon"
                                    disabled={c.is_deleted}
                                  >
                                    <Copy size={12} />
                                  </button>
                                  {c.is_deleted ? (
                                    <button
                                      onClick={() => handleRestoreCoupon(c)}
                                      className="p-1 rounded bg-slate-900 border border-slate-800 hover:border-emerald-500/40 text-emerald-400 transition-colors"
                                      title="Restore Coupon"
                                    >
                                      <RefreshCw size={12} />
                                    </button>
                                  ) : (
                                    <button
                                      onClick={() => {
                                        setSelectedCouponToDelete(c);
                                        setShowDeleteCouponModal(true);
                                      }}
                                      className="p-1 rounded bg-slate-900 border border-slate-800 hover:border-rose-500/40 text-rose-400 transition-colors"
                                      title="Delete Coupon"
                                    >
                                      <Trash2 size={12} />
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                        {filteredCoupons.length === 0 && (
                          <tr>
                            <td colSpan={8} className="text-xs text-slate-500 italic py-8 text-center bg-slate-900/10">No coupon campaign matching filters found.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                  
                  {/* Pagination Controls */}
                  {filteredCoupons.length > 0 && (
                    <div className="flex justify-between items-center px-4 py-2.5 bg-slate-900/20 border-t border-slate-850/60 text-[10px] text-slate-400 font-mono">
                      <span>Showing {Math.min(filteredCoupons.length, (couponPage - 1) * couponPageSize + 1)} to {Math.min(filteredCoupons.length, couponPage * couponPageSize)} of {filteredCoupons.length} results</span>
                      <div className="flex gap-1">
                        <button 
                          disabled={couponPage === 1} 
                          onClick={() => setCouponPage(p => Math.max(1, p - 1))}
                          className="px-2 py-1 bg-slate-900 border border-slate-850 rounded hover:bg-slate-800 disabled:opacity-40"
                        >&lt;</button>
                        {Array.from({ length: totalCouponPages }).map((_, i) => (
                          <button
                            key={i}
                            onClick={() => setCouponPage(i + 1)}
                            className={`px-2 py-1 border rounded font-bold ${couponPage === i + 1 ? 'bg-brand-600 border-brand-500 text-white shadow-md' : 'bg-slate-900 border-slate-850 hover:bg-slate-800'}`}
                          >{i + 1}</button>
                        ))}
                        <button 
                          disabled={couponPage === totalCouponPages} 
                          onClick={() => setCouponPage(p => Math.min(totalCouponPages, p + 1))}
                          className="px-2 py-1 bg-slate-900 border border-slate-850 rounded hover:bg-slate-800 disabled:opacity-40"
                        >&gt;</button>
                      </div>
                    </div>
                  )}
                </GlassCard>
              </div>

              {/* Right Sidebar Legend / Tips */}
              <div className="lg:col-span-3 space-y-4">
                {/* Status Legend */}
                <GlassCard className="p-4 space-y-3 border-slate-850">
                  <h4 className="font-extrabold text-slate-200 text-xs uppercase tracking-wider border-b border-slate-850 pb-1.5">Coupon Status</h4>
                  <div className="space-y-3 text-[10px]">
                    <div className="flex items-start gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 mt-1 shrink-0" />
                      <div>
                        <p className="font-bold text-slate-350">Active</p>
                        <p className="text-slate-500">Coupon is active and valid.</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="w-2 h-2 rounded-full bg-amber-500 mt-1 shrink-0" />
                      <div>
                        <p className="font-bold text-slate-350">Scheduled</p>
                        <p className="text-slate-500">Coupon is scheduled for future.</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="w-2 h-2 rounded-full bg-rose-500 mt-1 shrink-0" />
                      <div>
                        <p className="font-bold text-slate-350">Expired</p>
                        <p className="text-slate-500">Coupon has expired.</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="w-2 h-2 rounded-full bg-slate-500 mt-1 shrink-0" />
                      <div>
                        <p className="font-bold text-slate-350">Inactive</p>
                        <p className="text-slate-500">Coupon is inactive or disabled.</p>
                      </div>
                    </div>
                  </div>
                </GlassCard>

                {/* Quick Tips */}
                <GlassCard className="p-4 space-y-3 border-slate-850">
                  <h4 className="font-extrabold text-slate-200 text-xs uppercase tracking-wider border-b border-slate-850 pb-1.5">Quick Tips</h4>
                  <ul className="space-y-2 text-[10px] text-slate-400 list-disc pl-4 leading-relaxed">
                    <li>Coupons are applied during subscription checkout.</li>
                    <li>Discounts are auto-validated based on rules.</li>
                    <li>Usage updates in real-time.</li>
                    <li>Expired coupons cannot be used.</li>
                  </ul>
                </GlassCard>

                {/* Summary */}
                <GlassCard className="p-4 space-y-3 border-slate-850">
                  <h4 className="font-extrabold text-slate-200 text-xs uppercase tracking-wider border-b border-slate-850 pb-1.5">Summary</h4>
                  <div className="space-y-1.5 text-[10px] font-mono text-slate-400">
                    <div className="flex justify-between">
                      <span>Total Coupons:</span>
                      <span className="font-bold text-slate-250">{totalCount}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Active Coupons:</span>
                      <span className="font-bold text-slate-250">{activeCount}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Total Usage:</span>
                      <span className="font-bold text-slate-250">{totalUsage}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Total Discount:</span>
                      <span className="font-bold text-emerald-400">₹{totalDiscount.toLocaleString('en-IN')}</span>
                    </div>
                  </div>
                </GlassCard>
              </div>

            </div>
          </div>
        );
      })()}

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
            <h4 className="font-black text-slate-100 text-sm border-b border-slate-850 pb-2">Plan Configuration: {editingPlan.name}</h4>
            <form onSubmit={handleSavePlan} className="space-y-4">

              {/* Identity & Display */}
              <div className="space-y-2 pb-3 border-b border-slate-900">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Identity &amp; Display</p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">Plan Name</label>
                    <input type="text" value={editingPlan.name} onChange={(e) => setEditingPlan({ ...editingPlan, name: e.target.value })} className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-slate-200 focus:outline-none" required />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">Color Theme</label>
                    <select value={editingPlan.color_theme || 'brand'} onChange={(e) => setEditingPlan({ ...editingPlan, color_theme: e.target.value })} className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-slate-200 focus:outline-none">
                      <option value="slate">Slate (Freemium)</option>
                      <option value="brand">Brand Blue (Basic)</option>
                      <option value="indigo">Indigo (Pro)</option>
                      <option value="purple">Purple (Enterprise)</option>
                      <option value="emerald">Emerald</option>
                      <option value="amber">Amber</option>
                    </select>
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Plan Description</label>
                  <input type="text" value={editingPlan.description || ''} onChange={(e) => setEditingPlan({ ...editingPlan, description: e.target.value })} className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-slate-200 focus:outline-none" placeholder="Short description shown on plan selection screen" />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">Display Order</label>
                    <input type="number" value={editingPlan.display_order ?? 0} onChange={(e) => setEditingPlan({ ...editingPlan, display_order: e.target.value })} className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-slate-200 focus:outline-none" />
                  </div>
                  <div className="flex items-center gap-2 mt-4">
                    <input type="checkbox" id="is_recommended" checked={!!editingPlan.is_recommended} onChange={(e) => setEditingPlan({ ...editingPlan, is_recommended: e.target.checked })} className="rounded border-slate-800 bg-slate-900 text-brand-500" />
                    <label htmlFor="is_recommended" className="text-slate-300 select-none cursor-pointer">Recommended</label>
                  </div>
                  <div className="flex items-center gap-2 mt-4">
                    <input type="checkbox" id="is_popular" checked={!!editingPlan.is_popular} onChange={(e) => setEditingPlan({ ...editingPlan, is_popular: e.target.checked })} className="rounded border-slate-800 bg-slate-900 text-brand-500" />
                    <label htmlFor="is_popular" className="text-slate-300 select-none cursor-pointer">Most Popular Badge</label>
                  </div>
                </div>
              </div>

              {/* Pricing */}
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

              {/* Resource Quotas */}
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

      {/* Dynamic Create/Edit Coupon Modal Overlay */}
      {showCouponModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fade-in text-xs overflow-y-auto">
          <GlassCard className="w-full max-w-2xl max-h-[90vh] overflow-y-auto border-brand-500/30 p-6 space-y-4 relative">
            <button 
              onClick={() => { setShowCouponModal(false); setEditingCoupon(null); resetCouponForm(); }}
              className="absolute top-4 right-4 text-slate-500 hover:text-slate-300 transition-colors"
            >
              ✕
            </button>
            <h4 className="font-black text-slate-100 text-sm border-b border-slate-850 pb-2">
              {editingCoupon ? `Edit Coupon: ${editingCoupon.code}` : 'Create Promo Coupon Code'}
            </h4>
            <form onSubmit={handleSaveCoupon} className="space-y-4">
              
              {/* Identity & Display */}
              <div className="space-y-2 pb-3 border-b border-slate-900">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Identity &amp; Details</p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">Coupon Code (Uppercase)</label>
                    <input 
                      type="text" 
                      placeholder="e.g. AEGISPRO50" 
                      value={couponForm.code} 
                      onChange={(e) => setCouponForm({ ...couponForm, code: e.target.value })} 
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-slate-200 focus:outline-none font-mono tracking-widest font-black uppercase" 
                      required 
                      disabled={!!editingCoupon}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">Coupon Name</label>
                    <input 
                      type="text" 
                      placeholder="e.g. Flat ₹1000 Off" 
                      value={couponForm.name} 
                      onChange={(e) => setCouponForm({ ...couponForm, name: e.target.value })} 
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-slate-200 focus:outline-none" 
                      required 
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Description</label>
                  <input 
                    type="text" 
                    placeholder="Short description shown on payment screen" 
                    value={couponForm.description} 
                    onChange={(e) => setCouponForm({ ...couponForm, description: e.target.value })} 
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-slate-200 focus:outline-none" 
                  />
                </div>
              </div>

              {/* Discount Rates & Limits */}
              <div className="space-y-2 pb-3 border-b border-slate-900">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Pricing &amp; Discounts</p>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">Discount Type</label>
                    <select 
                      value={couponForm.discountType} 
                      onChange={(e) => setCouponForm({ ...couponForm, discountType: e.target.value })} 
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-slate-200 focus:outline-none"
                    >
                      <option value="PERCENTAGE">Percentage (%)</option>
                      <option value="FIXED">Fixed Amount (INR)</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">Discount Value</label>
                    <input 
                      type="number" 
                      placeholder="Value" 
                      value={couponForm.discountValue} 
                      onChange={(e) => setCouponForm({ ...couponForm, discountValue: e.target.value })} 
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-slate-200 focus:outline-none" 
                      required 
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">Max Discount Limit (INR)</label>
                    <input 
                      type="number" 
                      placeholder="e.g. 5000 (Optional)" 
                      value={couponForm.maxDiscount} 
                      onChange={(e) => setCouponForm({ ...couponForm, maxDiscount: e.target.value })} 
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-slate-200 focus:outline-none" 
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">Min Purchase (INR)</label>
                    <input 
                      type="number" 
                      placeholder="e.g. 1000" 
                      value={couponForm.minPurchase} 
                      onChange={(e) => setCouponForm({ ...couponForm, minPurchase: e.target.value })} 
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-slate-200 focus:outline-none" 
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">Max Redemption count</label>
                    <input 
                      type="number" 
                      placeholder="e.g. 100 (Optional)" 
                      value={couponForm.maxUses} 
                      onChange={(e) => setCouponForm({ ...couponForm, maxUses: e.target.value })} 
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-slate-200 focus:outline-none" 
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">Per User Limit</label>
                    <input 
                      type="number" 
                      placeholder="e.g. 1" 
                      value={couponForm.perUserRedemption} 
                      onChange={(e) => setCouponForm({ ...couponForm, perUserRedemption: e.target.value })} 
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-slate-200 focus:outline-none" 
                      required 
                    />
                  </div>
                </div>
              </div>

              {/* Restrictions & Dates */}
              <div className="space-y-2 pb-3 border-b border-slate-900">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Applicable Scope &amp; Dates</p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">Valid From (Date)</label>
                    <input 
                      type="date" 
                      value={couponForm.activationDate} 
                      onChange={(e) => setCouponForm({ ...couponForm, activationDate: e.target.value })} 
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-slate-200 focus:outline-none font-mono" 
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">Expiry Date</label>
                    <input 
                      type="date" 
                      value={couponForm.expiryDate} 
                      onChange={(e) => setCouponForm({ ...couponForm, expiryDate: e.target.value })} 
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-slate-200 focus:outline-none font-mono" 
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase block">Applicable Subscription Plans</label>
                  <div className="flex gap-4 bg-slate-900/40 p-2.5 rounded-lg border border-slate-850">
                    {['freemium', 'basic', 'pro', 'enterprise'].map(planKey => {
                      const isChecked = couponForm.applicablePlans.includes(planKey);
                      return (
                        <label key={planKey} className="flex items-center gap-1.5 text-slate-300 cursor-pointer select-none font-medium text-xs">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {
                              if (isChecked) {
                                setCouponForm({ ...couponForm, applicablePlans: couponForm.applicablePlans.filter(p => p !== planKey) });
                              } else {
                                setCouponForm({ ...couponForm, applicablePlans: [...couponForm.applicablePlans, planKey] });
                              }
                            }}
                            className="rounded bg-slate-900 border-slate-800 text-brand-500 focus:ring-0 focus:ring-offset-0"
                          />
                          <span className="capitalize">{planKey}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase block">Restrict to Specific Schools (Optional)</label>
                  <select
                    multiple
                    value={couponForm.applicableSchools}
                    onChange={(e) => {
                      const selected = Array.from(e.target.selectedOptions, option => option.value);
                      setCouponForm({ ...couponForm, applicableSchools: selected });
                    }}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-slate-200 focus:outline-none h-16 text-[10px] select-none"
                  >
                    {schools.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                  <p className="text-[9px] text-slate-550 leading-none">Hold Command/Ctrl key to select multiple school nodes.</p>
                </div>
              </div>

              {/* Status & Display styling */}
              <div className="space-y-2">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Status &amp; Style Theme</p>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">Coupon Status</label>
                    <select 
                      value={couponForm.status} 
                      onChange={(e) => setCouponForm({ ...couponForm, status: e.target.value })} 
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-slate-200 focus:outline-none"
                    >
                      <option value="ACTIVE">Active</option>
                      <option value="INACTIVE">Inactive</option>
                      <option value="DISABLED">Disabled</option>
                      <option value="SCHEDULED">Scheduled</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">Card Color Theme</label>
                    <select 
                      value={couponForm.color} 
                      onChange={(e) => setCouponForm({ ...couponForm, color: e.target.value })} 
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-slate-200 focus:outline-none"
                    >
                      <option value="brand">Brand Blue</option>
                      <option value="indigo">Indigo</option>
                      <option value="purple">Purple</option>
                      <option value="emerald">Emerald</option>
                      <option value="slate">Slate</option>
                      <option value="amber">Amber</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">Priority Index</label>
                    <input 
                      type="number" 
                      placeholder="e.g. 10" 
                      value={couponForm.priority} 
                      onChange={(e) => setCouponForm({ ...couponForm, priority: e.target.value })} 
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-slate-200 focus:outline-none" 
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">Coupon Tag Badge</label>
                    <input 
                      type="text" 
                      placeholder="e.g. WELCOME, DIWALI (Optional)" 
                      value={couponForm.tag} 
                      onChange={(e) => setCouponForm({ ...couponForm, tag: e.target.value })} 
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-slate-200 focus:outline-none" 
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">Internal Notes</label>
                    <input 
                      type="text" 
                      placeholder="e.g. 50% discount welcome campaign" 
                      value={couponForm.notes} 
                      onChange={(e) => setCouponForm({ ...couponForm, notes: e.target.value })} 
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-slate-200 focus:outline-none" 
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-850">
                <button type="button" onClick={() => { setShowCouponModal(false); setEditingCoupon(null); resetCouponForm(); }} className="glass-btn-secondary py-2 text-xs">Cancel</button>
                <button type="submit" className="glass-btn-primary py-2 text-xs">
                  {editingCoupon ? 'Save Changes' : 'Publish Coupon'}
                </button>
              </div>
            </form>
          </GlassCard>
        </div>
      )}

      {/* Delete Coupon Confirmation Modal */}
      {showDeleteCouponModal && selectedCouponToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fade-in text-xs">
          <GlassCard className="w-full max-w-sm border-brand-500/30 p-6 space-y-4">
            <div className="flex flex-col items-center text-center space-y-2">
              <AlertTriangle className="text-rose-500" size={36} />
              <h4 className="font-extrabold text-slate-100 text-sm">Delete Coupon Campaign</h4>
              <p className="text-[11px] text-slate-400">Are you sure you want to delete coupon <strong className="text-slate-200">{selectedCouponToDelete.code}</strong>?</p>
            </div>
            
            <div className="p-3.5 bg-slate-950/40 border border-slate-850 rounded-xl space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-500">Coupon Name:</span>
                <span className="font-bold text-slate-300">{selectedCouponToDelete.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Code:</span>
                <span className="font-mono font-bold text-slate-300 uppercase">{selectedCouponToDelete.code}</span>
              </div>
            </div>

            <div className="flex flex-col gap-2 pt-2 border-t border-slate-850">
              <div className="flex gap-2">
                <button 
                  onClick={() => handleDeleteCoupon(true)}
                  className="flex-1 bg-amber-600/20 hover:bg-amber-600/35 border border-amber-500/30 text-amber-300 font-bold py-2 rounded-lg text-center transition-all"
                >
                  Soft Delete
                </button>
                <button 
                  onClick={() => handleDeleteCoupon(false)}
                  className="flex-1 bg-rose-600 hover:bg-rose-500 text-white font-bold py-2 rounded-lg text-center transition-all"
                >
                  Delete Permanently
                </button>
              </div>
              <button 
                type="button" 
                onClick={() => { setShowDeleteCouponModal(false); setSelectedCouponToDelete(null); }}
                className="w-full bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-400 font-bold py-1.5 rounded-lg text-center transition-all"
              >
                Cancel
              </button>
            </div>
          </GlassCard>
        </div>
      )}

      {/* Coupon Usage Details / History Modal */}
      {showUsageDetailsModal && selectedCouponForUsage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fade-in text-xs">
          <GlassCard className="w-full max-w-xl border-brand-500/30 p-6 space-y-4 relative">
            <button 
              onClick={() => { setShowUsageDetailsModal(false); setSelectedCouponForUsage(null); }}
              className="absolute top-4 right-4 text-slate-500 hover:text-slate-300 transition-colors"
            >
              ✕
            </button>
            
            <h4 className="font-black text-slate-100 text-sm border-b border-slate-850 pb-2">Coupon Usage Details</h4>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pb-2 border-b border-slate-900">
              <div className="space-y-0.5">
                <span className="text-[10px] font-bold text-slate-500 uppercase block">Coupon Code</span>
                <span className="font-mono font-bold text-slate-200 text-xs">{selectedCouponForUsage.code}</span>
              </div>
              <div className="space-y-0.5">
                <span className="text-[10px] font-bold text-slate-500 uppercase block">Status</span>
                <span className="text-emerald-400 font-semibold">{selectedCouponForUsage.status}</span>
              </div>
              <div className="space-y-0.5">
                <span className="text-[10px] font-bold text-slate-500 uppercase block">Total Redemptions</span>
                <span className="font-bold text-slate-200">{couponUsageHistory.length}</span>
              </div>
              <div className="space-y-0.5">
                <span className="text-[10px] font-bold text-slate-500 uppercase block">Per User Limit</span>
                <span className="font-bold text-slate-200">{selectedCouponForUsage.per_user_redemption || 1}</span>
              </div>
            </div>

            <div className="space-y-2">
              <h5 className="font-bold text-slate-350 text-xs uppercase tracking-wider">Recent Redemptions</h5>
              <div className="overflow-y-auto max-h-48 border border-slate-850 rounded-xl bg-slate-900/10">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-850 text-slate-450 font-bold uppercase tracking-wider text-[9px] bg-slate-900/30">
                      <th className="py-2 px-3">School / Node</th>
                      <th className="py-2 px-3">Plan</th>
                      <th className="py-2 px-3">Discount</th>
                      <th className="py-2 px-3">Transaction ID</th>
                      <th className="py-2 px-3 text-right">Redeemed At</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-850/60 text-slate-300">
                    {couponUsageHistory.map(u => (
                      <tr key={u.id} className="hover:bg-slate-900/5 transition-colors">
                        <td className="py-2 px-3 font-semibold text-slate-200">{u.schools?.name || 'Unknown School'}</td>
                        <td className="py-2 px-3 uppercase text-slate-400">{u.plan_code}</td>
                        <td className="py-2 px-3 font-mono font-bold text-emerald-400">₹{Number(u.discount_amount).toLocaleString('en-IN')}</td>
                        <td className="py-2 px-3 font-mono text-[10px] text-slate-500 truncate max-w-[100px]">{u.transaction_id}</td>
                        <td className="py-2 px-3 text-right font-mono text-[10px] text-slate-450">{u.redeemed_at ? new Date(u.redeemed_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                      </tr>
                    ))}
                    {couponUsageHistory.length === 0 && (
                      <tr>
                        <td colSpan={5} className="text-[10px] text-slate-500 italic py-6 text-center bg-slate-900/10">No usage logs recorded for this coupon campaign.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
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
