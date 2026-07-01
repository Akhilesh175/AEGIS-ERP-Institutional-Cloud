import React, { useState, useEffect } from 'react';
import { useStore } from '../store/useStore';
import { mockApi } from '../services/mockApi';
import { mockDb } from '../services/mockDb';
import { Student, User, Quiz, QuizAttempt,
  Hostel, HostelBlock, HostelRoom, HostelBed, HostelWarden, HostelAdmission,
  HostelAttendance, HostelFee, HostelPayment, HostelLeaveRequest, HostelVisitor,
  HostelComplaint, HostelMessMenu, SchoolPaymentSettings
} from '../types';
import { GlassCard } from '../components/GlassCard';
import { supabase } from '../lib/supabase';
import { 
  Eye, Award, DollarSign, Calendar, FileText, 
  User as UserIcon, ShieldAlert, CheckCircle, XCircle, AlertCircle, UsersRound, Clock,
  BookOpen, Play, Download, MessageCircle, Paperclip,
  Filter, Search, ChevronDown, ChevronRight, ExternalLink,
  BookMarked, Layers, Home, Coffee, Utensils, ClipboardList, Check, X, Bell, Mail,
  Printer, Share2, History
} from 'lucide-react';
import PremiumLock from '../components/PremiumLock';
import { subscriptionPlans, isTabLocked, isTabLockedByEntitlements } from '../services/subscriptionConfig';
import { useFeatureEntitlements } from '../hooks/useFeatureEntitlements';
import { downloadMarksheetPdf } from '../components/MarksheetTemplate';
import { downloadReceiptPdf } from '../components/ReceiptTemplate';
import { downloadInvoicePdf } from '../components/InvoiceTemplate';
import { 
  downloadStudentIdCardPdf, downloadAdmissionFormPdf, 
  downloadBonafideCertificatePdf 
} from '../components/DocumentTemplates';
import { ParentPTMManagement } from '../components/PTMManagement';

const renderVideoPlayer = (url: string) => {
  if (!url) return null;
  
  // Detect YouTube
  const ytMatch = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i);
  if (ytMatch) {
    const embedUrl = `https://www.youtube.com/embed/${ytMatch[1]}`;
    return (
      <iframe
        src={embedUrl}
        className="w-full aspect-video rounded-xl border border-slate-800 bg-black"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
      />
    );
  }

  // Detect Vimeo
  const vimeoMatch = url.match(/vimeo\.com\/(?:video\/)?([0-9]+)/i);
  if (vimeoMatch) {
    const embedUrl = `https://player.vimeo.com/video/${vimeoMatch[1]}`;
    return (
      <iframe
        src={embedUrl}
        className="w-full aspect-video rounded-xl border border-slate-800 bg-black"
        allow="autoplay; fullscreen; picture-in-picture"
        allowFullScreen
      />
    );
  }

  // Fallback to native video player
  return (
    <video
      key={url}
      src={url}
      controls
      className="w-full max-h-96 rounded-xl border border-slate-800 bg-black"
      autoPlay
      controlsList="nodownload"
    />
  );
};

export const ParentPortal: React.FC<{ activeTab: string }> = ({ activeTab: rawActiveTab }) => {
  const activeTab = rawActiveTab.split('/')[0];
  const { session, syncSubscriptionPlan } = useStore();
  const parentId = session?.parentId;
  // States
  const [assignedStudents, setAssignedStudents] = useState<(Student & { userDetails: User; className: string })[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<string>('');
  const [schoolPaymentSettings, setSchoolPaymentSettings] = useState<SchoolPaymentSettings | null>(null);
  // wardLoadComplete prevents premature 'No Wards Linked' render during async initial load
  const [wardLoadComplete, setWardLoadComplete] = useState(false);
  const [selectedFee, setSelectedFee] = useState<any | null>(null);
  const [showProofModal, setShowProofModal] = useState(false);
  const [showPayModal, setShowPayModal] = useState(false);
  const [payModalTab, setPayModalTab] = useState<'qr' | 'upi' | 'bank'>('qr');
  const [paymentMethod, setPaymentMethod] = useState('UPI');
  const [utrNumber, setUtrNumber] = useState('');
  const [screenshotFile, setScreenshotFile] = useState<File | null>(null);
  const [submittingProof, setSubmittingProof] = useState(false);
  const [payInstructTab, setPayInstructTab] = useState<'qr' | 'upi' | 'bank'>('qr');
  const [feePaySubTab, setFeePaySubTab] = useState<'outstanding' | 'history'>('outstanding');
  const [selectedFeeForProof, setSelectedFeeForProof] = useState<string | null>(null);
  
  // Compute plan directly from Zustand session (single source of truth), with mockDb fallback
  const studentObj = mockDb.students.find(s => s.id === selectedStudent);
  const studentSchool = studentObj ? mockDb.schools.find(sch => sch.id === studentObj.schoolId) : null;
  const currentPlanName = (session?.schoolSubscriptionPlan || studentSchool?.subscriptionPlan || 'freemium').toLowerCase();
  const plan = subscriptionPlans[currentPlanName] || subscriptionPlans.freemium;
  const ent = useFeatureEntitlements();
  const [academicRecord, setAcademicRecord] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<any | null>(null);
  const [invoiceFilter, setInvoiceFilter] = useState<'ALL' | 'PAID' | 'PENDING' | 'OVERDUE'>('ALL');
  const [historyInvoice, setHistoryInvoice] = useState<any | null>(null);
  const [quizzes, setQuizzes] = useState<{ quiz: Quiz; attempt?: QuizAttempt }[]>([]);

  // Dynamic Library & Transport States
  const [reportCards, setReportCards] = useState<any[]>([]);
  const [docGenerating, setDocGenerating] = useState<string>('');
  const [transitAssignment, setTransitAssignment] = useState<any>(null);
  const [assignedRoute, setAssignedRoute] = useState<any>(null);
  const [assignedBus, setAssignedBus] = useState<any>(null);
  const [assignedPickupPoint, setAssignedPickupPoint] = useState<any>(null);
  const [assignedDriver, setAssignedDriver] = useState<any>(null);

  const [issuedBooks, setIssuedBooks] = useState<any[]>([]);
  const [libraryFines, setLibraryFines] = useState<any[]>([]);
  const [digitalLibraryAssets, setDigitalLibraryAssets] = useState<any[]>([]);
  const [libraryBooks, setLibraryBooks] = useState<any[]>([]);
  
  // Discussion state
  const [forumPosts, setForumPosts] = useState<any[]>([]);
  const [selectedPost, setSelectedPost] = useState<any | null>(null);
  const [postReplies, setPostReplies] = useState<any[]>([]);
  const [replyText, setReplyText] = useState('');
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [materials, setMaterials] = useState<any[]>([]);
  const [materialsLoading, setMaterialsLoading] = useState(false);
  const [activeVideoUrl, setActiveVideoUrl] = useState<string | null>(null);

  // Hostel Portal States
  const [activeAdmission, setActiveAdmission] = useState<HostelAdmission | null>(null);
  const [hostelDetails, setHostelDetails] = useState<Hostel | null>(null);
  const [blockDetails, setBlockDetails] = useState<HostelBlock | null>(null);
  const [roomDetails, setRoomDetails] = useState<HostelRoom | null>(null);
  const [bedDetails, setBedDetails] = useState<HostelBed | null>(null);
  const [wardenDetails, setWardenDetails] = useState<HostelWarden | null>(null);

  const [myLeaveRequests, setMyLeaveRequests] = useState<HostelLeaveRequest[]>([]);
  const [myComplaints, setMyComplaints] = useState<HostelComplaint[]>([]);
  const [myAttendance, setMyAttendance] = useState<HostelAttendance[]>([]);
  const [messMenus, setMessMenus] = useState<HostelMessMenu[]>([]);
  const [myVisitors, setMyVisitors] = useState<HostelVisitor[]>([]);
  const [myPayments, setMyPayments] = useState<HostelPayment[]>([]);
  const [myFees, setMyFees] = useState<HostelFee[]>([]);

  // Homework tab state
  const [hwSubjectFilter, setHwSubjectFilter] = useState<string>('all');
  const [hwSearchQuery, setHwSearchQuery] = useState('');
  const [hwStatusFilter, setHwStatusFilter] = useState<string>('all');
  const [expandedHomeworkId, setExpandedHomeworkId] = useState<string | null>(null);

  // Notifications state
  const [notifications, setNotifications] = useState<any[]>([]);
  const [notifCategoryFilter, setNotifCategoryFilter] = useState<string>('all');
  const [notifSearchQuery, setNotifSearchQuery] = useState('');

  // Load parent's students — sets wardLoadComplete ONLY after the full async chain resolves
  const loadAssignedStudents = async () => {
    if (!parentId) return;
    try {
      await syncSubscriptionPlan();
      setLoading(true);
      
      // STEP 1: Sync mappings directly by parentId first (fastest path to ward data)
      await mockApi.syncParentStudentMappingsForParent(parentId);

      // STEP 2: Sync school-level data in parallel once we know the parent's school
      const parentUser = mockDb.users.find(u => u.id === session?.user?.id);
      const parentSchoolId = mockDb.parents.find(p => p.id === parentId)?.schoolId || parentUser?.schoolId;
      if (parentSchoolId) {
        await Promise.all([
          mockApi.syncSchoolsData(parentSchoolId),
          mockApi.syncClassesData(parentSchoolId),
          mockApi.syncTeachersData(parentSchoolId),
          mockApi.syncSubjectsData(parentSchoolId),
          mockApi.syncTeacherClassSubjectMappingsData(parentSchoolId),
          mockApi.syncAcademicSessionsData(parentSchoolId),
          mockApi.syncStudentsData(parentSchoolId),
          mockApi.syncParentsData(parentSchoolId),
          mockApi.syncUsersData(parentSchoolId).catch(() => {})
        ]);
      }

      // STEP 3: Re-sync mappings after school data is loaded to resolve any student/user cross-references
      await mockApi.syncParentStudentMappingsForParent(parentId);

      // STEP 4: Fetch the resolved list of students
      const data = await mockApi.parentGetStudents(parentId);
      setAssignedStudents(data);
      setSelectedStudent(prev => {
        if (prev && data.some(s => s.id === prev)) {
          return prev;
        }
        return data[0]?.id || '';
      });
      setLoading(false);
      // Mark ward data as fully loaded — this PREVENTS premature 'No Wards Linked' from rendering
      setWardLoadComplete(true);
    } catch (err: any) {
      setError(err.message || 'Error loading mapped student records');
      setLoading(false);
      setWardLoadComplete(true); // Still mark complete so UI shows error, not skeleton forever
    }
  };

  // Load student records
  const loadAcademicRecord = async () => {
    if (!parentId || !selectedStudent) return;
    try {
      setLoading(true);
      setError(null);
      setMaterialsLoading(true);
      
      // Sync the subscription plan from DB into Zustand store (single source of truth)
      await syncSubscriptionPlan();

      const data = await mockApi.parentGetStudentAcademicRecord(parentId, selectedStudent);
      
      // Deduplicate lists inside data
      const deduplicatedData = data ? {
        ...data,
        assignments: Array.from(new Map((data.assignments || []).map((a: any) => [a.id, a])).values()),
        attendance: Array.from(new Map((data.attendance || []).map((att: any) => [att.id, att])).values()),
        fees: Array.from(new Map((data.fees || []).map((f: any) => [f.description + '-' + f.dueDate, f])).values())
      } : null;
      setAcademicRecord(deduplicatedData);

      const qz = await mockApi.studentGetQuizzes(selectedStudent).catch(() => []);
      // Deduplicate quizzes by quiz.id
      setQuizzes(Array.from(new Map(qz.map(item => [item.quiz.id, item])).values()));
      
      if (studentObj) {
        const mat = await mockApi.getStudyMaterials(studentObj.schoolId, studentObj.classId).catch(() => []);
        // Deduplicate study materials by id
        setMaterials(Array.from(new Map(mat.map(m => [m.id, m])).values()));
        
        const sps = await mockApi.fetchSchoolPaymentSettings(studentObj.schoolId, session?.user?.role || 'PARENT').catch(() => null);
        setSchoolPaymentSettings(sps);
      } else {
        setMaterials([]);
        setSchoolPaymentSettings(null);
      }
      setMaterialsLoading(false);

      if (studentObj) {
        const rcs = await mockApi.fetchReportCards(studentObj.schoolId, selectedStudent).catch(() => []);
        setReportCards(rcs);
      }

      if (studentObj) {
        // Sync core school entities in parallel
        await Promise.all([
          mockApi.syncSchoolsData(studentObj.schoolId),
          mockApi.syncClassesData(studentObj.schoolId),
          mockApi.syncTeachersData(studentObj.schoolId),
          mockApi.syncSubjectsData(studentObj.schoolId),
          mockApi.syncTeacherClassSubjectMappingsData(studentObj.schoolId),
          mockApi.syncAcademicSessionsData(studentObj.schoolId),
          mockApi.syncStudentsData(studentObj.schoolId),
          mockApi.syncParentsData(studentObj.schoolId),
          mockApi.syncParentStudentMappingsData(studentObj.schoolId),
          mockApi.syncUsersData(studentObj.schoolId).catch(() => {})
        ]);

        // 1. Forums Tab Specific Syncs & Queries
        if (activeTab === 'forums') {
          await Promise.all([
            mockApi.syncForumCategoriesData(studentObj.schoolId).catch(() => {}),
            mockApi.syncForumPostsData(studentObj.schoolId).catch(() => {}),
            mockApi.syncForumRepliesData(studentObj.schoolId).catch(() => {})
          ]);
          
          const allPosts = await mockApi.getForumPosts().catch(() => []);
          const cats = await mockApi.getForumCategories(studentObj.schoolId).catch(() => []);
          const allowedCats = cats.filter(c => c.classId === studentObj.classId || !c.classId);
          const allowedCatIds = allowedCats.map(c => c.id);
          const filteredPosts = allPosts.filter(p => allowedCatIds.includes(p.categoryId));
          setForumPosts(Array.from(new Map(filteredPosts.map(p => [p.id, p])).values()));
        }

        // 2. Transport Tab Specific Syncs & Queries
        if (activeTab === 'transit' || activeTab === 'transport') {
          const [allAssignments, allBuses, allRoutes, allPickupPoints, allDrivers] = await Promise.all([
            mockApi.fetchTransportAssignments(studentObj.schoolId).catch(() => []),
            mockApi.fetchBuses(studentObj.schoolId).catch(() => []),
            mockApi.fetchRoutes(studentObj.schoolId).catch(() => []),
            mockApi.fetchPickupPoints(studentObj.schoolId).catch(() => []),
            mockApi.fetchDrivers(studentObj.schoolId).catch(() => [])
          ]);

          const studentUserId = studentObj?.userId || '';
          const myAssignment = allAssignments.find(ta => (ta.studentId === selectedStudent || ta.studentId === studentUserId) && ta.status === 'ACTIVE');
          if (myAssignment) {
            setTransitAssignment(myAssignment);
            const route = allRoutes.find(r => r.id === myAssignment.routeId);
            setAssignedRoute(route);
            const bus = allBuses.find(b => b.id === myAssignment.busId);
            setAssignedBus(bus);
            const pickup = allPickupPoints.find(p => p.id === myAssignment.pickupPointId);
            setAssignedPickupPoint(pickup);
            if (bus && bus.driverId) {
              const driver = allDrivers.find(d => d.id === bus.driverId);
              setAssignedDriver(driver);
            } else if (bus && (bus.driverName || bus.driverPhone)) {
              setAssignedDriver({
                name: bus.driverName,
                phone: bus.driverPhone
              });
            }
          } else {
            setTransitAssignment(null);
            setAssignedRoute(null);
            setAssignedBus(null);
            setAssignedPickupPoint(null);
            setAssignedDriver(null);
          }
        }

        // 3. Library Tab Specific Syncs & Queries
        if (activeTab === 'library') {
          const [myIssues, myFines, digitalAssets, booksList] = await Promise.all([
            mockApi.fetchBookIssues(studentObj.schoolId, selectedStudent).catch(() => []),
            mockApi.fetchLibraryFines(studentObj.schoolId, selectedStudent).catch(() => []),
            mockApi.fetchDigitalLibraryAssets(studentObj.schoolId).catch(() => []),
            mockApi.fetchBookInventory(studentObj.schoolId).catch(() => [])
          ]);

          setIssuedBooks(Array.from(new Map(myIssues.map(bi => [bi.id, bi])).values()));
          setLibraryFines(Array.from(new Map(myFines.map(lf => [lf.id, lf])).values()));
          setDigitalLibraryAssets(Array.from(new Map((digitalAssets || []).map(da => [da.id, da])).values()));
          setLibraryBooks(Array.from(new Map((booksList || []).map(b => [b.id, b])).values()));
        }

        // 4. Hostel Tab Specific Syncs & Queries
        if (activeTab === 'hostel') {
          const schoolId = studentObj.schoolId;
          const studentId = selectedStudent;
          await mockApi.syncHostelData(schoolId).catch(() => {});
          
          const [admissions, hostels, blocks, rooms, beds, wardens, menus, leaves, complaints, attendance, visitors, payments, feesList] = await Promise.all([
            mockApi.fetchHostelAdmissions(schoolId).catch(() => []),
            mockApi.fetchHostels(schoolId).catch(() => []),
            mockApi.fetchHostelBlocks(schoolId).catch(() => []),
            mockApi.fetchHostelRooms(schoolId).catch(() => []),
            mockApi.fetchHostelBeds(schoolId).catch(() => []),
            mockApi.fetchHostelWardens(schoolId).catch(() => []),
            mockApi.fetchHostelMessMenus(schoolId).catch(() => []),
            mockApi.fetchHostelLeaveRequests(schoolId).catch(() => []),
            mockApi.fetchHostelComplaints(schoolId).catch(() => []),
            mockApi.fetchHostelAttendance(schoolId).catch(() => []),
            mockApi.fetchHostelVisitors(schoolId).catch(() => []),
            mockApi.fetchHostelPayments(schoolId).catch(() => []),
            mockApi.fetchHostelFees(schoolId).catch(() => [])
          ]);

          const activeAd = admissions.find((a: any) => a.studentId === studentId && a.status === 'ACTIVE');
          setActiveAdmission(activeAd || null);
          
          if (activeAd) {
            const h = hostels.find((x: any) => x.id === activeAd.hostelId);
            const rm = rooms.find((x: any) => x.id === activeAd.roomId);
            const bl = blocks.find((x: any) => x.id === rm?.blockId);
            const bd = beds.find((x: any) => x.id === activeAd.bedId);
            const wd = wardens.find((w: any) => {
               if (bl?.wardenId && w.id === bl.wardenId) return true;
               if (w.hostelId === activeAd.hostelId) return true;
               if (w.assignedLocations && Array.isArray(w.assignedLocations)) {
                 return w.assignedLocations.some((loc: any) => {
                   const matchesBuilding = loc.buildingId === activeAd.hostelId;
                   const matchesBlock = !loc.blockId || loc.blockId === rm?.blockId;
                   const matchesFloor = loc.floor === null || loc.floor === rm?.floor;
                   const matchesSection = !loc.section || loc.section === rm?.roomNumber;
                   return matchesBuilding && matchesBlock && matchesFloor && matchesSection;
                 });
               }
               return false;
             });
            
            setHostelDetails(h || null);
            setBlockDetails(bl || null);
            setRoomDetails(rm || null);
            setBedDetails(bd || null);
            setWardenDetails(wd || null);
            setMessMenus(menus.filter((m: any) => m.hostelId === activeAd.hostelId || !m.hostelId));
          } else {
            setHostelDetails(null);
            setBlockDetails(null);
            setRoomDetails(null);
            setBedDetails(null);
            setWardenDetails(null);
            setMessMenus([]);
          }

          setMyLeaveRequests(leaves.filter((l: any) => l.studentId === studentId));
          setMyComplaints(complaints.filter((c: any) => c.studentId === studentId));
          setMyAttendance(attendance.filter((a: any) => a.studentId === studentId));
          setMyVisitors(visitors.filter((v: any) => v.studentId === studentId));
          setMyPayments(payments.filter((p: any) => p.studentId === studentId));
          setMyFees(feesList);
        }
      }

      // Fetch notifications for parent and trigger reminders check
      if (session?.user?.id) {
        const notifs = await mockApi.getNotifications(session.user.id).catch(() => []);
        setNotifications(notifs);
        
        if (studentObj) {
          await mockApi.sendUpcomingDeadlineReminders(studentObj.schoolId).catch(() => {});
          const freshNotifs = await mockApi.getNotifications(session.user.id).catch(() => []);
          setNotifications(freshNotifs);
        }
      }

      setLoading(false);
    } catch (err: any) {
      setError(err.message || 'Access Denied: Isolation boundary violation');
      setAcademicRecord(null);
      setQuizzes([]);
      setMaterials([]);
      setMaterialsLoading(false);
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAssignedStudents();
  }, [parentId]);

  // Real-time Supabase Postgres changes subscription for parent ward mappings
  // This fires whenever admin links/unlinks a student — causing instant portal update with NO page refresh required
  useEffect(() => {
    if (!parentId) return;

    const handleMappingSync = async (_payload?: any) => {
      console.log('[ParentPortal] Realtime ward mapping change detected — reloading ward data instantly...');
      // Reset wardLoadComplete so portal shows skeleton (not stale 'No Wards' state) during reload
      setWardLoadComplete(false);
      await mockApi.syncParentStudentMappingsForParent(parentId);
      await loadAssignedStudents();
    };

    const channel = supabase
      .channel(`parent-mappings-realtime-${parentId}`)
      // Primary trigger: direct mapping row INSERT/UPDATE/DELETE
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'parent_student_mapping', filter: `parent_id=eq.${parentId}` }, handleMappingSync)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'parent_student_mapping', filter: `parent_id=eq.${parentId}` }, handleMappingSync)
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'parent_student_mapping', filter: `parent_id=eq.${parentId}` }, handleMappingSync)
      // Secondary triggers: student/parent profile changes affecting the parent
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'students' }, handleMappingSync)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'parents', filter: `id=eq.${parentId}` }, handleMappingSync)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'users' }, handleMappingSync)
      .subscribe((status) => {
        console.log('[ParentPortal] Ward realtime channel status:', status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [parentId]);

  // Real-time Supabase Postgres changes subscription
  useEffect(() => {
    if (activeTab !== 'forums' || !selectedStudent) return;

    const studentObj = mockDb.students.find(s => s.id === selectedStudent);
    if (!studentObj) return;

    const handleForumsSync = () => {
      Promise.all([
        mockApi.syncStudentsData(studentObj.schoolId),
        mockApi.syncParentsData(studentObj.schoolId),
        mockApi.syncParentStudentMappingsData(studentObj.schoolId),
        mockApi.syncForumCategoriesData(studentObj.schoolId).catch(() => {}),
        mockApi.syncForumPostsData(studentObj.schoolId).catch(() => {}),
        mockApi.syncForumRepliesData(studentObj.schoolId).catch(() => {})
      ]).then(() => {
        Promise.all([
          mockApi.getForumPosts().catch(() => []),
          mockApi.getForumCategories(studentObj.schoolId).catch(() => [])
        ]).then(([allPosts, cats]) => {
          const allowedCats = cats.filter(c => c.classId === studentObj.classId || !c.classId);
          const allowedCatIds = allowedCats.map(c => c.id);
          const filtered = allPosts.filter(p => allowedCatIds.includes(p.categoryId));
          // Deduplicate realtime forum posts by id
          setForumPosts(Array.from(new Map(filtered.map(p => [p.id, p])).values()));
        });
        if (selectedPost) {
          mockApi.getForumPostReplies(selectedPost.id).then(reps => setPostReplies(reps));
        }
      });
    };

    const channel = supabase
      .channel('parent-forums-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'forum_categories' }, handleForumsSync)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'forum_posts' }, handleForumsSync)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'forum_replies' }, handleForumsSync)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeTab, selectedStudent, selectedPost]);

  // Real-time Supabase Postgres changes subscription for child academic data
  useEffect(() => {
    if (!parentId || !selectedStudent) return;

    const handleAcademicSync = () => {
      console.log('Realtime academic update detected, refreshing parent portal...');
      const studentObj = mockDb.students.find(s => s.id === selectedStudent);
      if (studentObj) {
        mockApi.clearHostelCache(studentObj.schoolId);
      }
      loadAcademicRecord();
    };

    const channel = supabase
      .channel('parent-academic-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'homeworks' }, handleAcademicSync)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'homework_attachments' }, handleAcademicSync)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'homework_submissions' }, handleAcademicSync)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'quizzes' }, handleAcademicSync)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'timetables' }, handleAcademicSync)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'study_materials' }, handleAcademicSync)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'announcements' }, handleAcademicSync)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'invoices' }, handleAcademicSync)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'report_cards' }, handleAcademicSync)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'student_marks' }, handleAcademicSync)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'exam_marks' }, handleAcademicSync)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'exam_subjects' }, handleAcademicSync)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'exam_schedules' }, handleAcademicSync)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'quiz_results' }, handleAcademicSync)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'book_inventory' }, handleAcademicSync)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'digital_library_assets' }, handleAcademicSync)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'drivers' }, handleAcademicSync)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pickup_points' }, handleAcademicSync)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'book_issues' }, handleAcademicSync)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'library_fines' }, handleAcademicSync)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transport_assignments' }, handleAcademicSync)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'buses' }, handleAcademicSync)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'routes' }, handleAcademicSync)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'exams' }, handleAcademicSync)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'exam_results' }, handleAcademicSync)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'driver_attendance' }, handleAcademicSync)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'hostels' }, handleAcademicSync)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'hostel_blocks' }, handleAcademicSync)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'hostel_rooms' }, handleAcademicSync)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'hostel_beds' }, handleAcademicSync)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'hostel_wardens' }, handleAcademicSync)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'hostel_warden_assignments' }, handleAcademicSync)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'hostel_admissions' }, handleAcademicSync)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'hostel_attendance' }, handleAcademicSync)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'hostel_leave_requests' }, handleAcademicSync)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'hostel_visitors' }, handleAcademicSync)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'hostel_complaints' }, handleAcademicSync)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'hostel_mess_menu' }, handleAcademicSync)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'hostel_fees' }, handleAcademicSync)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'hostel_payments' }, handleAcademicSync)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'fee_payments' }, handleAcademicSync)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'fee_structures' }, handleAcademicSync)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${session?.user?.id}` }, handleAcademicSync)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'school_subscriptions' }, () => {
        console.log('Realtime school_subscriptions change detected in parent portal, refreshing plan...');
        syncSubscriptionPlan();
        loadAcademicRecord();
      })
      .subscribe();

    // Subscribe to manual broadcast channel for instant, guaranteed real-time updates!
    const broadcastChannel = supabase
      .channel(`school-subscription-updates-${session?.user.schoolId}`)
      .on('broadcast', { event: 'plan_updated' }, () => {
        console.log('Realtime broadcast subscription update detected in ParentPortal! Syncing plan and loading academic record...');
        syncSubscriptionPlan();
        loadAcademicRecord();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(broadcastChannel);
    };
  }, [parentId, selectedStudent, session, syncSubscriptionPlan]);

  useEffect(() => {
    const interval = setInterval(() => {
      syncSubscriptionPlan();
      
      if (activeTab === 'forums' && selectedStudent) {
        const studentObj = mockDb.students.find(s => s.id === selectedStudent);
        if (studentObj) {
          Promise.all([
            mockApi.syncStudentsData(studentObj.schoolId),
            mockApi.syncParentsData(studentObj.schoolId),
            mockApi.syncParentStudentMappingsData(studentObj.schoolId),
            mockApi.syncForumCategoriesData(studentObj.schoolId).catch(() => {}),
            mockApi.syncForumPostsData(studentObj.schoolId).catch(() => {}),
            mockApi.syncForumRepliesData(studentObj.schoolId).catch(() => {})
          ]).then(() => {
            Promise.all([
              mockApi.getForumPosts().catch(() => []),
              mockApi.getForumCategories(studentObj.schoolId).catch(() => [])
            ]).then(([allPosts, cats]) => {
              const allowedCats = cats.filter(c => c.classId === studentObj.classId || !c.classId);
              const allowedCatIds = allowedCats.map(c => c.id);
              setForumPosts(allPosts.filter(p => allowedCatIds.includes(p.categoryId)));
            });
            if (selectedPost) {
              mockApi.getForumPostReplies(selectedPost.id).then(reps => setPostReplies(reps));
            }
          });
        }
      }
    }, 10000);
    return () => clearInterval(interval);
  }, [syncSubscriptionPlan, activeTab, selectedStudent, selectedPost]);

  useEffect(() => {
    if (selectedStudent) {
      loadAcademicRecord();
    }
  }, [selectedStudent, activeTab]);

  const getAttendanceSummary = () => {
    if (!academicRecord || academicRecord.attendance.length === 0) return { present: 0, total: 0, pct: 100 };
    const attList = academicRecord.attendance;
    const present = attList.filter((a: any) => a.status === 'PRESENT' || a.status === 'LATE').length;
    return {
      present,
      total: attList.length,
      pct: Math.round((present / attList.length) * 100)
    };
  };

  const handleSelectPost = async (post: any) => {
    setSelectedPost(post);
    try {
      const reps = await mockApi.getForumPostReplies(post.id);
      setPostReplies(reps);
    } catch (err) {
      console.error(err);
    }
  };

  const handleForumReplySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session || !selectedPost || !replyText.trim()) return;

    try {
      await mockApi.replyToForumPost(session.user.id, selectedPost.id, replyText);
      setReplyText('');
      const reps = await mockApi.getForumPostReplies(selectedPost.id);
      setPostReplies(reps);
      loadAcademicRecord();
    } catch (err) {
      console.error(err);
    }
  };

  const handleHostelLeaveApproval = async (id: string, approvalStatus: 'APPROVED' | 'REJECTED') => {
    if (!session?.user?.id) return;
    try {
      await mockApi.approveHostelLeaveRequest(id, 'PARENT', approvalStatus, session.user.id);
      loadAcademicRecord();
      alert(`Leave request ${approvalStatus.toLowerCase()} successfully!`);
    } catch (err: any) {
      alert(err.message || 'Failed to update leave request status');
    }
  };

  const handleHostelFeePayment = async (feeId: string, amount: number) => {
    if (!selectedStudent || !studentObj) return;
    try {
      const txId = 'TXN-' + Math.floor(Math.random() * 1000000);
      await mockApi.recordHostelPayment(
        studentObj.schoolId,
        selectedStudent,
        feeId,
        amount,
        'ONLINE',
        txId
      );
      loadAcademicRecord();
      alert('Hostel fee payment processed successfully via Aegis Secure Gateway!');
    } catch (err: any) {
      alert(err.message || 'Payment processing failed');
    }
  };

  const parentUser = mockDb.users.find(u => u.id === session?.user?.id);
  const parentName = parentUser ? `${parentUser.firstName} ${parentUser.lastName}` : 'Guardian';
  
  // Get unique school names from assigned students
  const schoolIds = Array.from(new Set(assignedStudents.map(s => s.schoolId)));
  const schoolNames = schoolIds.map(id => mockDb.schools.find(sch => sch.id === id)?.name).filter(Boolean).join(', ') || 'Aegis Academy';

  // Get student names
  const studentNames = assignedStudents.map(s => `${s.userDetails?.firstName || 'Student'} ${s.userDetails?.lastName || ''}`.trim()).join(', ') || 'No linked wards';

  // RACE CONDITION FIX: Only show skeleton if ward data hasn't loaded yet OR if academic record is loading
  // We NEVER show 'No Wards Linked' until wardLoadComplete=true to prevent premature empty state
  if (!wardLoadComplete || ((loading || !parentId) && assignedStudents.length === 0) || (loading && !academicRecord && assignedStudents.length > 0)) {
    return (
      <div className="space-y-6 max-w-7xl mx-auto pb-12 animate-pulse">
        {/* Header identity skeleton */}
        <div className="h-28 bg-[#0b101d] border border-slate-800 rounded-3xl p-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-slate-800 rounded-xl"></div>
            <div className="space-y-2">
              <div className="h-4 w-40 bg-slate-800 rounded"></div>
              <div className="h-3 w-60 bg-slate-800 rounded"></div>
            </div>
          </div>
          <div className="h-8 w-44 bg-slate-800 rounded-xl"></div>
        </div>

        {/* 3 cards skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="h-20 bg-[#0b101d] border border-slate-800 rounded-2xl p-4 flex items-center gap-3">
            <div className="w-10 h-10 bg-slate-800 rounded-lg"></div>
            <div className="space-y-2 flex-1">
              <div className="h-2 w-20 bg-slate-800 rounded"></div>
              <div className="h-3 w-28 bg-slate-800 rounded"></div>
            </div>
          </div>
          <div className="h-20 bg-[#0b101d] border border-slate-800 rounded-2xl p-4 flex items-center gap-3">
            <div className="w-10 h-10 bg-slate-800 rounded-lg"></div>
            <div className="space-y-2 flex-1">
              <div className="h-2 w-20 bg-slate-800 rounded"></div>
              <div className="h-3 w-28 bg-slate-800 rounded"></div>
            </div>
          </div>
          <div className="h-20 bg-[#0b101d] border border-slate-800 rounded-2xl p-4 flex items-center gap-3">
            <div className="w-10 h-10 bg-slate-800 rounded-lg"></div>
            <div className="space-y-2 flex-1">
              <div className="h-2 w-20 bg-slate-800 rounded"></div>
              <div className="h-3 w-28 bg-slate-800 rounded"></div>
            </div>
          </div>
        </div>

        {/* Main layout skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="h-96 bg-[#0b101d] border border-slate-800 rounded-3xl p-6 space-y-4">
            <div className="h-4 w-40 bg-slate-800 rounded"></div>
            <div className="space-y-3 pt-2">
              <div className="h-24 bg-slate-900/40 border border-slate-800/40 rounded-2xl"></div>
              <div className="h-24 bg-slate-900/40 border border-slate-800/40 rounded-2xl"></div>
              <div className="h-24 bg-slate-900/40 border border-slate-800/40 rounded-2xl"></div>
            </div>
          </div>
          <div className="h-96 bg-[#0b101d] border border-slate-800 rounded-3xl p-6 space-y-4">
            <div className="h-4 w-40 bg-slate-800 rounded"></div>
            <div className="space-y-3 pt-2">
              <div className="h-24 bg-slate-900/40 border border-slate-800/40 rounded-2xl"></div>
              <div className="h-24 bg-slate-900/40 border border-slate-800/40 rounded-2xl"></div>
              <div className="h-24 bg-slate-900/40 border border-slate-800/40 rounded-2xl"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 animate-fade-in">
      {/* Portal Identity Context Bar */}
      <div className="bg-gradient-to-r from-brand-950 to-slate-900 border border-slate-800 rounded-3xl p-5 md:p-6 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left">
          {parentUser?.avatarUrl ? (
            <img 
              src={parentUser.avatarUrl} 
              alt="" 
              className="w-12 h-12 rounded-xl object-cover border border-slate-700 shadow-md shrink-0 animate-fade-in"
              onError={(e) => {
                // If link fails or is broken, clear it visually
                (e.target as HTMLImageElement).src = '';
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          ) : (
            <div className="w-12 h-12 rounded-xl bg-brand-500/10 border border-brand-500/25 flex items-center justify-center shrink-0">
              <UsersRound className="text-brand-400" size={24} />
            </div>
          )}
          <div>
            <h2 className="text-xl font-bold text-slate-100 font-sans leading-none">{parentName} <span className="text-xs text-slate-400 font-normal ml-1">(Parent/Guardian)</span></h2>
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mt-2">
              <span className="text-[10px] text-slate-400 uppercase tracking-widest font-mono bg-slate-800 px-2 py-0.5 rounded">Wards: {studentNames}</span>
              <span className="text-[10px] text-brand-400 uppercase tracking-widest font-mono bg-brand-500/10 border border-brand-500/20 px-2 py-0.5 rounded">{schoolNames}</span>
            </div>
          </div>
        </div>

        {/* Dropdown child selector */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400 font-medium">Select Child:</span>
          <select 
            value={selectedStudent}
            onChange={(e) => setSelectedStudent(e.target.value)}
            className="bg-slate-950 border border-slate-800 text-slate-200 text-xs font-semibold rounded-xl px-3 py-2 focus:outline-none focus:border-brand-500"
          >
            {assignedStudents.map(s => (
              <option key={s.id} value={s.id}>{s.userDetails?.firstName || 'Student'} {s.userDetails?.lastName || ''} ({s.className})</option>
            ))}
          </select>
        </div>
      </div>

      {error ? (
        <div className="p-6 bg-red-500/5 border border-red-500/20 rounded-2xl flex items-center gap-3 text-red-400">
          <ShieldAlert size={24} />
          <div>
            <h4 className="font-bold text-sm">Security Policy Alert</h4>
            <p className="text-xs leading-relaxed opacity-90">{error}</p>
          </div>
        </div>
      ) : assignedStudents.length === 0 ? (
        <div className="p-12 text-center bg-[#0b101d] border border-slate-800 rounded-3xl space-y-4">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-slate-800/40 border border-slate-700/50 flex items-center justify-center">
            <UsersRound className="text-slate-550" size={32} />
          </div>
          <div className="max-w-md mx-auto space-y-2">
            <h3 className="text-lg font-bold text-slate-200">No Wards Linked</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              We couldn't find any student profiles linked to your parent account in this institution. 
              Please contact the school administration to map your child's student profile to your login credentials.
            </p>
          </div>
        </div>
      ) : (
        academicRecord && (
          <div className="space-y-6">
            
            {activeTab === 'dashboard' && (
              <div className="space-y-6">
                {/* Ward Profile Overview */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  
                  {/* Stats Card Attendance */}
                  <GlassCard className="flex items-center gap-4">
                    <div className="w-11 h-11 rounded-xl bg-brand-500/10 border border-brand-500/25 flex items-center justify-center">
                      <Calendar className="text-brand-400" size={20} />
                    </div>
                    <div>
                      <span className="block text-[10px] text-slate-500 uppercase font-bold font-mono tracking-widest leading-none">Attendance Tracker</span>
                      <h4 className="text-lg font-bold text-slate-200 mt-1">
                        {getAttendanceSummary().pct}% <span className="text-xs font-normal text-slate-400">({getAttendanceSummary().present}/{getAttendanceSummary().total} days)</span>
                      </h4>
                    </div>
                  </GlassCard>

                  {/* Ward ID and Roll Number */}
                  <GlassCard className="flex items-center gap-4">
                    <div className="w-11 h-11 rounded-xl bg-brand-500/10 border border-brand-500/25 flex items-center justify-center">
                      <UserIcon className="text-brand-400" size={20} />
                    </div>
                    <div>
                      <span className="block text-[10px] text-slate-500 uppercase font-bold font-mono tracking-widest leading-none">Enrollment Metadata</span>
                      <h4 className="text-xs font-semibold text-slate-300 mt-1">
                        Roll No: {academicRecord.studentProfile.rollNumber} | Adm No: {academicRecord.studentProfile.admissionNumber}
                      </h4>
                    </div>
                  </GlassCard>

                  {/* Class homeroom details */}
                  <GlassCard className="flex items-center gap-4">
                    <div className="w-11 h-11 rounded-xl bg-brand-500/10 border border-brand-500/25 flex items-center justify-center">
                      <Award className="text-brand-400" size={20} />
                    </div>
                    <div>
                      <span className="block text-[10px] text-slate-500 uppercase font-bold font-mono tracking-widest leading-none">Class Homeroom</span>
                      <h4 className="text-sm font-bold text-slate-200 mt-1">
                        Active in {academicRecord.studentProfile.className}
                      </h4>
                    </div>
                  </GlassCard>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  
                  {/* Homework list */}
                  <GlassCard className="space-y-4">
                    <h3 className="font-bold text-slate-200 text-sm pb-2 border-b border-slate-850">Homework & Project Submissions</h3>
                    <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                      {academicRecord.assignments.length === 0 ? (
                        <div className="text-center py-6 text-slate-500 text-xs">No active assignments on log.</div>
                      ) : (
                        academicRecord.assignments.map((a: any, idx: number) => (
                          <div key={idx} className="p-4 bg-slate-900/30 border border-slate-850 rounded-2xl flex flex-col gap-2">
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <h4 className="font-bold text-xs text-slate-200">{a.title}</h4>
                                <p className="text-[9px] text-slate-550 mt-0.5">Due: {new Date(a.dueDate).toLocaleDateString()}</p>
                              </div>
                              <span className={`text-[9.5px] font-bold px-2.5 py-0.5 rounded-lg ${
                                a.submitted ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'
                              }`}>
                                {a.submitted ? 'Submitted' : 'Pending'}
                              </span>
                            </div>
                            <p className="text-[10px] text-slate-400 leading-relaxed mt-0.5">{a.description}</p>
                            
                            {a.attachments && a.attachments.length > 0 && (
                              <div className="mt-2 pt-2 border-t border-slate-850/40 space-y-1.5">
                                <span className="block text-[9px] font-bold uppercase tracking-wider text-slate-500">Classroom Resources ({a.attachments.length})</span>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                  {a.attachments.map((att: any) => (
                                    <div 
                                      key={att.id} 
                                      className="flex items-center justify-between gap-2 p-2 bg-slate-950/40 border border-slate-850 rounded-xl"
                                    >
                                      <div className="flex items-center gap-2 truncate">
                                        <Paperclip size={11} className="text-brand-400 shrink-0" />
                                        <span className="text-[10px] text-slate-350 truncate" title={att.fileName}>
                                          {att.fileName}
                                        </span>
                                      </div>
                                      <a 
                                        href={att.fileUrl} 
                                        target="_blank" 
                                        rel="noopener noreferrer" 
                                        className="p-1 hover:bg-slate-850 text-slate-450 hover:text-slate-200 rounded-lg transition-colors flex items-center justify-center shrink-0"
                                        title="View File"
                                      >
                                        <Eye size={12} />
                                      </a>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </GlassCard>

                  {/* Attendance Ledger logs */}
                  <GlassCard className="space-y-4">
                    <h3 className="font-bold text-slate-200 text-sm pb-2 border-b border-slate-850">Daily Attendance Ledger</h3>
                    <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                      {academicRecord.attendance.length === 0 ? (
                        <div className="text-center py-6 text-slate-500 text-xs">No attendance marked yet.</div>
                      ) : (
                        academicRecord.attendance.map((a: any) => (
                          <div key={a.id} className="p-3 bg-slate-900/30 border border-slate-850 rounded-xl flex items-center justify-between">
                            <div>
                              <p className="font-semibold text-xs text-slate-200">{new Date(a.date).toLocaleDateString()}</p>
                              <p className="text-[9px] text-slate-500 italic mt-0.5">{a.remarks || 'Standard Check-in'}</p>
                            </div>
                            <span className={`text-[10px] font-bold flex items-center gap-1 ${
                              a.status === 'PRESENT' ? 'text-green-400' : a.status === 'ABSENT' ? 'text-red-400' : 'text-amber-400'
                            }`}>
                              {a.status === 'PRESENT' && <CheckCircle size={12} />}
                              {a.status === 'ABSENT' && <AlertCircle size={12} />}
                              {a.status}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </GlassCard>
                </div>
              </div>
            )}

            {activeTab === 'timetable' && (
              <GlassCard className="space-y-6 animate-fade-in">
                <div className="border-b border-slate-850 pb-3">
                  <h3 className="font-bold text-slate-100 flex items-center gap-2">
                    <Calendar className="text-brand-500" size={18} />
                    Class Timetable Schedule
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Weekly academic lectures and class schedule for {academicRecord?.studentProfile?.firstName} {academicRecord?.studentProfile?.lastName}.
                  </p>
                </div>

                <div className="space-y-4">
                  {[1, 2, 3, 4, 5, 6].map(dayNum => {
                    const dayLectures = mockDb.timetables
                      .filter(t => t.classId === academicRecord?.studentProfile?.classId && t.dayOfWeek === dayNum)
                      .sort((a, b) => a.startTime.localeCompare(b.startTime));

                    const dayName = dayNum === 1 ? 'Monday' : 
                                    dayNum === 2 ? 'Tuesday' : 
                                    dayNum === 3 ? 'Wednesday' : 
                                    dayNum === 4 ? 'Thursday' : 
                                    dayNum === 5 ? 'Friday' : 'Saturday';

                    return (
                      <div key={dayNum} className="space-y-2">
                        <h4 className="text-xs font-bold text-brand-400 uppercase tracking-widest pl-1">
                          {dayName}
                        </h4>
                        {dayLectures.length === 0 ? (
                          <div className="p-3 bg-slate-900/10 border border-slate-850/50 rounded-xl text-slate-500 text-xs italic">
                            No lectures scheduled for today.
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {dayLectures.map(lecture => {
                              const subject = mockDb.subjects.find(s => s.id === lecture.subjectId);
                              const teacher = lecture.teacherId ? mockDb.teachers.find(t => t.id === lecture.teacherId) : null;
                              const teacherUser = teacher ? mockDb.users.find(u => u.id === teacher.userId) : null;
                              
                              return (
                                <div 
                                  key={lecture.id} 
                                  className="p-4 bg-slate-900/30 border border-slate-850 rounded-2xl flex justify-between items-center hover:border-brand-500/20 transition-all duration-300 group"
                                >
                                  <div className="space-y-1">
                                    <h5 className="font-bold text-slate-200 text-xs group-hover:text-brand-400 transition-colors">
                                      {subject ? subject.name : 'Course Lecture'}
                                    </h5>
                                    <p className="text-[10px] text-slate-450 font-medium">
                                      Instructor: {teacherUser ? `${teacherUser.firstName} ${teacherUser.lastName}` : 'Guest Faculty'}
                                    </p>
                                    <div className="flex items-center gap-3 text-[10px] text-slate-400 mt-1.5 font-sans">
                                      <span className="flex items-center gap-1">
                                        <Clock size={11} className="text-slate-500" />
                                        {lecture.startTime} - {lecture.endTime}
                                      </span>
                                      <span className="flex items-center gap-1">
                                        <UserIcon size={11} className="text-slate-500" />
                                        {lecture.classroomNumber || 'Main Lecture Hall'}
                                      </span>
                                    </div>
                                  </div>
                                  <span className="w-9 h-9 rounded-xl bg-slate-900/60 border border-slate-850 flex items-center justify-center font-bold text-xs text-slate-500 group-hover:text-brand-400 group-hover:border-brand-500/25 transition-all">
                                    {lecture.startTime.split(':')[0]}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </GlassCard>
            )}

            {activeTab === 'homework' && (
              <PremiumLock
                isLocked={!ent.hasLibraryAccess}
                requiredTier="ENTERPRISE"
                featureName="Homework & Assignments"
                customMessage="This feature is available only with an active Enterprise Subscription. Please contact your School Administrator."
              >
                <div className="space-y-6 animate-fade-in">
                {/* Homework Header */}
                <GlassCard className="space-y-4">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <h3 className="font-bold text-slate-100 text-lg flex items-center gap-2">
                        <FileText className="text-brand-500" size={20} />
                        Homework & Assignments
                      </h3>
                      <p className="text-xs text-slate-400 mt-1">
                        View all homework assigned to {academicRecord?.studentProfile?.fullName || 'your child'} with due dates, attachments, and submission status.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold bg-brand-500/10 text-brand-400 border border-brand-500/20 px-3 py-1 rounded-full">
                        {academicRecord?.assignments?.length || 0} Total
                      </span>
                      <span className="text-[10px] font-bold bg-green-500/10 text-green-400 border border-green-500/20 px-3 py-1 rounded-full">
                        {academicRecord?.assignments?.filter((a: any) => a.submitted).length || 0} Submitted
                      </span>
                      <span className="text-[10px] font-bold bg-red-500/10 text-red-400 border border-red-500/20 px-3 py-1 rounded-full">
                        {academicRecord?.assignments?.filter((a: any) => !a.submitted && new Date(a.dueDate) < new Date()).length || 0} Overdue
                      </span>
                    </div>
                  </div>

                  {/* Filters Row */}
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-2 border-t border-slate-850">
                    {/* Search */}
                    <div className="relative flex-1 min-w-0">
                      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                      <input
                        type="text"
                        placeholder="Search homework..."
                        value={hwSearchQuery}
                        onChange={(e) => setHwSearchQuery(e.target.value)}
                        className="w-full bg-slate-900/50 border border-slate-800 text-xs text-slate-200 rounded-xl pl-9 pr-3 py-2.5 focus:outline-none focus:border-brand-500 transition-colors"
                      />
                    </div>
                    {/* Subject Filter */}
                    <div className="flex items-center gap-2">
                      <Filter size={14} className="text-slate-500 shrink-0" />
                      <select
                        value={hwSubjectFilter}
                        onChange={(e) => setHwSubjectFilter(e.target.value)}
                        className="bg-slate-900/50 border border-slate-800 text-xs text-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-brand-500 transition-colors"
                      >
                        <option value="all">All Subjects</option>
                        {Array.from(new Set(academicRecord?.assignments?.map((a: any) => a.subjectName) || [])).map((subj: any) => (
                          <option key={subj} value={subj}>{subj}</option>
                        ))}
                      </select>
                    </div>
                    {/* Status Filter */}
                    <select
                      value={hwStatusFilter}
                      onChange={(e) => setHwStatusFilter(e.target.value)}
                      className="bg-slate-900/50 border border-slate-800 text-xs text-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-brand-500 transition-colors"
                    >
                      <option value="all">All Status</option>
                      <option value="submitted">Submitted</option>
                      <option value="pending">Pending</option>
                      <option value="overdue">Overdue</option>
                    </select>
                  </div>
                </GlassCard>

                {/* Homework List */}
                <div className="space-y-3">
                  {(() => {
                    const allAssignments = academicRecord?.assignments || [];
                    const filtered = allAssignments.filter((a: any) => {
                      const matchesSearch = !hwSearchQuery || a.title?.toLowerCase().includes(hwSearchQuery.toLowerCase()) || a.description?.toLowerCase().includes(hwSearchQuery.toLowerCase());
                      const matchesSubject = hwSubjectFilter === 'all' || a.subjectName === hwSubjectFilter;
                      const isOverdue = !a.submitted && new Date(a.dueDate) < new Date();
                      const matchesStatus = hwStatusFilter === 'all' 
                        || (hwStatusFilter === 'submitted' && a.submitted) 
                        || (hwStatusFilter === 'pending' && !a.submitted && !isOverdue)
                        || (hwStatusFilter === 'overdue' && isOverdue);
                      return matchesSearch && matchesSubject && matchesStatus;
                    });

                    if (filtered.length === 0) {
                      return (
                        <GlassCard>
                          <div className="text-center py-12 space-y-3">
                            <FileText size={40} className="mx-auto text-slate-600" />
                            <p className="text-sm text-slate-400">No homework found matching your filters.</p>
                            <button
                              onClick={() => { setHwSearchQuery(''); setHwSubjectFilter('all'); setHwStatusFilter('all'); }}
                              className="text-xs text-brand-400 hover:text-brand-300 font-semibold"
                            >
                              Clear all filters
                            </button>
                          </div>
                        </GlassCard>
                      );
                    }

                    return filtered.map((a: any) => {
                      const isExpanded = expandedHomeworkId === a.id;
                      const dueDate = new Date(a.dueDate);
                      const now = new Date();
                      const isOverdue = !a.submitted && dueDate < now;
                      const isDueSoon = !a.submitted && !isOverdue && (dueDate.getTime() - now.getTime()) < 2 * 24 * 60 * 60 * 1000;
                      const hasAttachments = a.attachments && a.attachments.length > 0;

                      return (
                        <GlassCard key={a.id} className="overflow-hidden">
                          {/* Clickable header */}
                          <button
                            onClick={() => setExpandedHomeworkId(isExpanded ? null : a.id)}
                            className="w-full flex items-start gap-4 text-left group"
                          >
                            <div className="mt-0.5 shrink-0">
                              {isExpanded 
                                ? <ChevronDown size={16} className="text-brand-400" /> 
                                : <ChevronRight size={16} className="text-slate-500 group-hover:text-slate-300 transition-colors" />
                              }
                            </div>
                            <div className="flex-1 min-w-0 space-y-1.5">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-[9px] font-bold text-brand-400 bg-brand-500/10 border border-brand-500/20 px-2 py-0.5 rounded-full uppercase tracking-widest">
                                  {a.subjectName}
                                </span>
                                {a.isHomework && (
                                  <span className="text-[9px] font-bold text-purple-400 bg-purple-500/10 border border-purple-500/20 px-2 py-0.5 rounded-full uppercase tracking-widest">
                                    Homework
                                  </span>
                                )}
                                {hasAttachments && (
                                  <span className="text-[9px] text-slate-400 flex items-center gap-1">
                                    <Paperclip size={10} /> {a.attachments.length} file{a.attachments.length > 1 ? 's' : ''}
                                  </span>
                                )}
                              </div>
                              <h4 className="font-bold text-sm text-slate-200 group-hover:text-slate-100 transition-colors">{a.title}</h4>
                              <div className="flex items-center gap-4 text-[10px] text-slate-500">
                                <span className="flex items-center gap-1">
                                  <Calendar size={11} /> Due: {dueDate.toLocaleDateString()}
                                </span>
                                <span className="flex items-center gap-1">
                                  <UserIcon size={11} /> {a.teacherName}
                                </span>
                              </div>
                            </div>
                            <div className="shrink-0 flex flex-col items-end gap-1.5">
                              {/* Status badge */}
                              <span className={`text-[9.5px] font-bold px-2.5 py-0.5 rounded-lg whitespace-nowrap ${
                                a.submitted 
                                  ? 'bg-green-500/10 text-green-400 border border-green-500/20' 
                                  : isOverdue 
                                    ? 'bg-red-500/10 text-red-400 border border-red-500/20' 
                                    : isDueSoon
                                      ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                      : 'bg-slate-700/30 text-slate-400 border border-slate-700'
                              }`}>
                                {a.submitted ? '✓ Submitted' : isOverdue ? '⚠ Overdue' : isDueSoon ? '⏰ Due Soon' : 'Pending'}
                              </span>
                              {a.submitted && a.marksObtained !== null && (
                                <span className="text-[10px] font-bold text-slate-300">
                                  {a.marksObtained}/{a.maxMarks} marks
                                </span>
                              )}
                            </div>
                          </button>

                          {/* Expanded details */}
                          {isExpanded && (
                            <div className="mt-4 pt-4 border-t border-slate-850 space-y-4 animate-fade-in">
                              {/* Description */}
                              {a.description && (
                                <div className="space-y-1">
                                  <span className="block text-[9px] font-bold uppercase tracking-wider text-slate-500">Instructions</span>
                                  <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-line bg-slate-900/40 border border-slate-850 rounded-xl p-3">
                                    {a.description}
                                  </p>
                                </div>
                              )}

                              {/* Attachments */}
                              {hasAttachments && (
                                <div className="space-y-2">
                                  <span className="block text-[9px] font-bold uppercase tracking-wider text-slate-500">Teacher Attachments ({a.attachments.length})</span>
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    {a.attachments.map((att: any) => {
                                      const ext = att.fileName?.split('.').pop()?.toLowerCase() || '';
                                      const isImage = ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext);
                                      const isPdf = ext === 'pdf';
                                      const isDoc = ['doc', 'docx'].includes(ext);
                                      return (
                                        <div 
                                          key={att.id} 
                                          className="flex items-center justify-between gap-2 p-3 bg-slate-950/50 border border-slate-850 rounded-xl hover:border-brand-500/20 transition-all group/att"
                                        >
                                          <div className="flex items-center gap-2.5 truncate">
                                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                                              isImage ? 'bg-emerald-500/10 border border-emerald-500/20' :
                                              isPdf ? 'bg-red-500/10 border border-red-500/20' :
                                              isDoc ? 'bg-blue-500/10 border border-blue-500/20' :
                                              'bg-slate-800 border border-slate-700'
                                            }`}>
                                              <Paperclip size={13} className={`${
                                                isImage ? 'text-emerald-400' :
                                                isPdf ? 'text-red-400' :
                                                isDoc ? 'text-blue-400' :
                                                'text-slate-400'
                                              }`} />
                                            </div>
                                            <div className="truncate">
                                              <span className="text-[11px] text-slate-300 truncate block font-medium" title={att.fileName}>
                                                {att.fileName}
                                              </span>
                                              <span className="text-[9px] text-slate-500 uppercase">{ext}</span>
                                            </div>
                                          </div>
                                          <div className="flex items-center gap-1 shrink-0">
                                            <a 
                                              href={att.fileUrl} 
                                              target="_blank" 
                                              rel="noopener noreferrer" 
                                              className="p-1.5 hover:bg-slate-800 text-slate-450 hover:text-slate-200 rounded-lg transition-colors" 
                                              title="View File"
                                            >
                                              <Eye size={13} />
                                            </a>
                                            <a 
                                              href={att.fileUrl} 
                                              download 
                                              className="p-1.5 hover:bg-slate-800 text-slate-450 hover:text-slate-200 rounded-lg transition-colors" 
                                              title="Download File"
                                            >
                                              <Download size={13} />
                                            </a>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}

                              {/* Submission Info */}
                              <div className="space-y-2">
                                <span className="block text-[9px] font-bold uppercase tracking-wider text-slate-500">Submission Status</span>
                                {a.submitted ? (
                                  <div className="p-3 bg-green-500/5 border border-green-500/15 rounded-xl space-y-2">
                                    <div className="flex items-center gap-2">
                                      <CheckCircle size={14} className="text-green-400" />
                                      <span className="text-xs font-semibold text-green-400">Submitted</span>
                                      {a.submittedAt && (
                                        <span className="text-[10px] text-slate-400 ml-auto">on {new Date(a.submittedAt).toLocaleString()}</span>
                                      )}
                                    </div>
                                    {a.submissionFileUrl && (
                                      <a 
                                        href={a.submissionFileUrl} 
                                        target="_blank" 
                                        rel="noopener noreferrer" 
                                        className="inline-flex items-center gap-1.5 text-[10px] text-brand-400 hover:text-brand-300 font-semibold transition-colors"
                                      >
                                        <ExternalLink size={11} /> View Submitted Work
                                      </a>
                                    )}
                                    {a.marksObtained !== null && a.marksObtained !== undefined && (
                                      <div className="flex items-center justify-between text-xs pt-1 border-t border-green-500/10">
                                        <span className="text-slate-400">Marks Awarded:</span>
                                        <span className={`font-bold text-sm ${
                                          a.marksObtained >= (a.maxMarks * 0.8) ? 'text-green-400' : 
                                          a.marksObtained >= (a.maxMarks * 0.5) ? 'text-amber-400' : 'text-red-400'
                                        }`}>
                                          {a.marksObtained} / {a.maxMarks}
                                        </span>
                                      </div>
                                    )}
                                    {a.feedback && (
                                      <div className="pt-1 border-t border-green-500/10">
                                        <span className="text-[9px] text-slate-500 font-bold uppercase">Teacher Feedback:</span>
                                        <p className="text-xs text-slate-300 mt-1 italic">{a.feedback}</p>
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <div className={`p-3 rounded-xl space-y-1 ${
                                    isOverdue 
                                      ? 'bg-red-500/5 border border-red-500/15' 
                                      : 'bg-slate-900/40 border border-slate-850'
                                  }`}>
                                    <div className="flex items-center gap-2">
                                      <AlertCircle size={14} className={isOverdue ? 'text-red-400' : 'text-amber-400'} />
                                      <span className={`text-xs font-semibold ${isOverdue ? 'text-red-400' : 'text-amber-400'}`}>
                                        {isOverdue ? 'Not submitted — overdue' : 'Awaiting submission'}
                                      </span>
                                    </div>
                                    <p className="text-[10px] text-slate-500">
                                      {isOverdue 
                                        ? `This assignment was due on ${dueDate.toLocaleDateString()}. Please follow up with your child's teacher.`
                                        : `Due on ${dueDate.toLocaleDateString()} — ${Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))} day(s) remaining.`
                                      }
                                    </p>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </GlassCard>
                      );
                    });
                  })()}
                </div>
              </div>
              </PremiumLock>
            )}

            {activeTab === 'grades' && (
              <div className="space-y-6">
                <GlassCard className="space-y-6">
                  <div className="border-b border-slate-850 pb-3">
                    <h3 className="font-bold text-slate-100 flex items-center gap-2">
                      <Award className="text-brand-500" size={18} />
                      Midterm Exam Report Card Grades
                    </h3>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-slate-850 text-slate-400 font-bold">
                          <th className="py-3 px-4">Subject Name</th>
                          <th className="py-3 px-4">Subject Code</th>
                          <th className="py-3 px-4">Marks Obtained</th>
                          <th className="py-3 px-4">Max Marks</th>
                          <th className="py-3 px-4">Remarks Feedback</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-850">
                        {academicRecord.examMarks.map((em: any, idx: number) => (
                          <tr key={idx} className="hover:bg-slate-900/10 text-slate-200">
                            <td className="py-3 px-4 font-semibold">{em.subjectName}</td>
                            <td className="py-3 px-4 text-slate-400">{em.subjectCode}</td>
                            <td className="py-3 px-4">
                              {em.marksObtained !== null ? (
                                <span className={`font-bold text-sm ${em.marksObtained >= 80 ? 'text-green-400' : 'text-slate-200'}`}>
                                  {em.marksObtained}
                                </span>
                              ) : (
                                <span className="text-slate-500">Ungraded</span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-slate-400">{em.maxMarks}</td>
                            <td className="py-3 px-4 text-slate-400 italic max-w-xs truncate">{em.remarks || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </GlassCard>

                {/* Published Term Report Cards Section */}
                <GlassCard className="space-y-6">
                  <div className="border-b border-slate-850 pb-3">
                    <h3 className="font-bold text-slate-100 flex items-center gap-2">
                      <Award className="text-emerald-500" size={18} />
                      Published Term Report Cards
                    </h3>
                  </div>

                  {reportCards.length === 0 ? (
                    <p className="text-xs text-slate-500 italic py-4 text-center">No official term report cards published yet.</p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {reportCards.map((rc: any) => (
                        <div key={rc.id} className="p-4 bg-slate-900/30 border border-slate-850 rounded-2xl flex flex-col justify-between gap-4 hover:border-slate-800 transition-all duration-200">
                          <div className="space-y-1">
                            <div className="flex items-center justify-between">
                              <h4 className="font-bold text-slate-200 text-sm">{rc.term}</h4>
                              <span className="inline-block text-[9.5px] font-bold px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 uppercase">
                                GPA: {rc.gradePointAverage.toFixed(2)}
                              </span>
                            </div>
                            <p className="text-xs text-slate-400 mt-1">Attendance: {rc.attendancePercentage}%</p>
                            <p className="text-xs text-slate-400 italic mt-1 font-semibold">" {rc.remarks || 'No remarks.'} "</p>
                          </div>
                          <div className="pt-2 border-t border-slate-850/60 flex items-center justify-between">
                            <span className="text-[10px] text-slate-500">Issued: {new Date(rc.createdAt).toLocaleDateString()}</span>
                            <button
                              onClick={async () => {
                                if (!selectedStudent) return;
                                try {
                                  const marksheetData = await mockApi.getStudentMarksheetData(selectedStudent, rc.term);
                                  await downloadMarksheetPdf(rc.studentName || 'Student', rc.term, marksheetData);
                                } catch (err: any) {
                                  console.error(err);
                                  alert('Failed to generate marksheet: ' + err.message);
                                }
                              }}
                              className="px-2.5 py-1 bg-brand-500/10 hover:bg-brand-500/20 text-brand-400 border border-brand-500/30 rounded-lg flex items-center gap-1.5 font-semibold text-[10px] cursor-pointer active:scale-95 transition-all animate-pulse-subtle"
                            >
                              <Download size={11} />
                              Download Marksheet (PDF)
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </GlassCard>
              </div>
            )}

            {activeTab === 'fees' && (
              <PremiumLock 
                isLocked={!ent.hasBilling} 
                requiredTier="Basic" 
                featureName="Fee Management"
              >
                <div className="space-y-6">
                  {/* Greeting header */}
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                    <div>
                      <h3 className="text-lg font-bold text-slate-100">Welcome back, {parentName}</h3>
                      <p className="text-xs text-slate-400 mt-0.5">Here's what's happening with your children today.</p>
                    </div>
                  </div>

                  {/* Stats Row */}
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                    {/* Stat 1: Total Outstanding */}
                    {(() => {
                      const outstandingFees = (academicRecord?.fees || []).filter((f: any) => f.status !== 'PAID');
                      const totalOutstanding = outstandingFees.reduce((acc: number, f: any) => acc + f.amount, 0);
                      const pendingCount = outstandingFees.length;
                      return (
                        <GlassCard className="p-4 flex items-center gap-4">
                          <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
                            <DollarSign size={20} />
                          </div>
                          <div>
                            <span className="block text-[9px] uppercase tracking-wider text-slate-500 font-bold font-mono">Total Outstanding</span>
                            <h4 className="text-base font-extrabold text-slate-200 mt-0.5">
                              ₹{totalOutstanding.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </h4>
                            <span className="text-[9px] text-rose-400 font-medium">{pendingCount} Invoice(s) Pending</span>
                          </div>
                        </GlassCard>
                      );
                    })()}

                    {/* Stat 2: Paid This Session */}
                    {(() => {
                      const paidFees = (academicRecord?.fees || []).filter((f: any) => f.status === 'PAID');
                      const totalPaid = paidFees.reduce((acc: number, f: any) => acc + f.amount, 0);
                      return (
                        <GlassCard className="p-4 flex items-center gap-4">
                          <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            <Calendar size={20} />
                          </div>
                          <div>
                            <span className="block text-[9px] uppercase tracking-wider text-slate-500 font-bold font-mono">Paid This Session</span>
                            <h4 className="text-base font-extrabold text-slate-200 mt-0.5">
                              ₹{totalPaid.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </h4>
                            <span className="text-[9px] text-emerald-400 font-medium">2026-27 Academic Year</span>
                          </div>
                        </GlassCard>
                      );
                    })()}

                    {/* Stat 3: Total Invoices */}
                    <GlassCard className="p-4 flex items-center gap-4">
                      <div className="p-2.5 rounded-xl bg-violet-500/10 text-violet-400 border border-violet-500/20">
                        <FileText size={20} />
                      </div>
                      <div>
                        <span className="block text-[9px] uppercase tracking-wider text-slate-500 font-bold font-mono">Total Invoices</span>
                        <h4 className="text-base font-extrabold text-slate-200 mt-0.5">
                          {(academicRecord?.fees || []).length}
                        </h4>
                        <span className="text-[9px] text-slate-400 font-medium">This Academic Year</span>
                      </div>
                    </GlassCard>

                    {/* Stat 4: Recent Payment */}
                    {(() => {
                      const paidFees = (academicRecord?.fees || []).filter((f: any) => f.status === 'PAID');
                      const lastPayment = paidFees.length > 0 ? paidFees[paidFees.length - 1] : null;
                      return (
                        <GlassCard className="p-4 flex items-center gap-4">
                          <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            <Clock size={20} />
                          </div>
                          <div>
                            <span className="block text-[9px] uppercase tracking-wider text-slate-500 font-bold font-mono">Recent Payment</span>
                            <h4 className="text-base font-extrabold text-slate-200 mt-0.5">
                              {lastPayment ? `₹${lastPayment.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '—'}
                            </h4>
                            <span className="text-[9px] text-slate-450 font-medium">
                              {lastPayment ? new Date(lastPayment.paymentDate || lastPayment.dueDate).toLocaleDateString() : 'No recent payments'}
                            </span>
                          </div>
                        </GlassCard>
                      );
                    })()}
                  </div>

                  {/* Main Grid: Left Outstanding Invoices, Right Quick Actions & Payment Instructions */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                    
                    {/* Left Panel: Invoices & Child Selector */}
                    <div className="lg:col-span-8 space-y-4">
                      {/* Multi-Child Selector Chips */}
                      {assignedStudents.length > 1 && (
                        <GlassCard className="p-4 space-y-3">
                          <span className="text-[10px] uppercase font-bold tracking-widest text-slate-500 block">Select Child Profile</span>
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                            {assignedStudents.map(s => {
                              const isActive = selectedStudent === s.id;
                              return (
                                <div
                                  key={s.id}
                                  onClick={() => setSelectedStudent(s.id)}
                                  className={`p-3 rounded-xl border cursor-pointer flex items-center gap-3 transition-all ${
                                    isActive
                                      ? 'bg-brand-500/10 border-brand-500/40 shadow-lg shadow-brand-500/5'
                                      : 'bg-slate-900/40 border-slate-850 hover:bg-slate-900/60'
                                  }`}
                                >
                                  <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center font-bold text-slate-350 text-xs">
                                    {s.userDetails?.firstName?.substring(0, 1)}
                                  </div>
                                  <div className="min-w-0">
                                    <span className="block text-xs font-bold text-slate-200 truncate">{s.userDetails?.firstName} {s.userDetails?.lastName}</span>
                                    <span className="block text-[10px] text-slate-550 truncate">{s.className} | Adm: {s.admissionNumber}</span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </GlassCard>
                      )}

                      <GlassCard className="p-5 space-y-4">
                        <div className="flex flex-col sm:flex-row justify-between sm:items-center pb-2 border-b border-slate-850 gap-3">
                          <h4 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                            Outstanding Invoices
                            <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-rose-500/15 text-rose-400 border border-rose-500/20">
                              {(academicRecord?.fees || []).filter((f: any) => f.status !== 'PAID').length}
                            </span>
                          </h4>
                          
                          {/* Filter chips */}
                          <div className="flex flex-wrap gap-1.5">
                            {(['ALL', 'PAID', 'PENDING', 'OVERDUE'] as const).map(f => (
                              <button
                                key={f}
                                onClick={() => setInvoiceFilter(f)}
                                className={`px-2.5 py-0.5 rounded-lg text-[9px] font-bold uppercase transition-all ${
                                  invoiceFilter === f
                                    ? 'bg-brand-600 text-white shadow-lg'
                                    : 'bg-slate-900/40 text-slate-450 border border-slate-850 hover:text-slate-200'
                                }`}
                              >
                                {f}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="space-y-4">
                          {(() => {
                            const rawFees = academicRecord?.fees || [];
                            if (rawFees.length === 0) {
                              return (
                                <div className="text-center py-10 text-slate-500 text-xs">
                                  No invoices mapped for the selected child.
                                </div>
                              );
                            }

                            const mappedInvoices = rawFees.map((f: any) => {
                              const isPaid = f.status === 'PAID';
                              const isOverdue = !isPaid && new Date(f.dueDate).getTime() < Date.now();
                              const status = isPaid ? 'PAID' : isOverdue ? 'OVERDUE' : (f.status === 'PENDING' ? 'PENDING' : 'UNPAID');
                              
                              const invoiceNumber = f.paymentId 
                                ? `INV-${new Date(f.dueDate).getFullYear()}-${f.paymentId.substring(0, 6).toUpperCase()}` 
                                : `INV-${new Date(f.dueDate).getFullYear()}-${f.id.substring(0, 6).toUpperCase()}`;

                              return {
                                id: f.id,
                                structure: f,
                                payment: {
                                  status: f.status,
                                  paymentDate: f.paymentDate,
                                  paymentMethod: f.paymentMethod,
                                  transactionId: f.utrNumber || f.paymentId
                                },
                                invoiceNumber,
                                status,
                                description: f.description,
                                dueDate: f.dueDate,
                                amount: Number(f.amount),
                                billDate: new Date(new Date(f.dueDate).getTime() - 14 * 24 * 60 * 60 * 1000).toISOString()
                              };
                            });

                            const filteredInvoices = mappedInvoices.filter((inv: any) => {
                              if (invoiceFilter === 'ALL') return true;
                              return inv.status === invoiceFilter;
                            });

                            if (filteredInvoices.length === 0) {
                              return (
                                <div className="text-center py-10 text-slate-550 text-xs">
                                  No invoices matching the selected filter.
                                </div>
                              );
                            }

                            return filteredInvoices.map((inv: any, idx: number) => {
                              const stObj = assignedStudents.find(s => s.id === selectedStudent);
                              const parentUser = session?.user;

                              const invoicePayload = {
                                schoolId: stObj?.schoolId || '',
                                schoolName: studentSchool?.name || '',
                                schoolAddress: studentSchool?.address || '',
                                schoolPhone: studentSchool?.phone || '',
                                schoolEmail: studentSchool?.email || '',
                                schoolWebsite: (studentSchool as any)?.website || '',
                                logoUrl: studentSchool?.logoUrl || '',
                                sealUrl: studentSchool?.sealUrl || '',
                                currencySymbol: studentSchool?.currencySymbol || '$',
                                invoiceNumber: inv.invoiceNumber,
                                billDate: inv.billDate,
                                dueDate: inv.dueDate,
                                paymentDate: inv.payment?.paymentDate || undefined,
                                billingCycle: new Date(inv.billDate).toLocaleString('default', { month: 'long', year: 'numeric' }),
                                academicYear: '2026 - 27',
                                paymentMethod: inv.payment?.paymentMethod || undefined,
                                transactionId: inv.payment?.transactionId || undefined,
                                status: inv.status === 'PAID' ? 'PAID' : (inv.status === 'PENDING' ? 'PENDING' : 'UNPAID') as any,
                                studentName: stObj ? `${stObj.userDetails?.firstName} ${stObj.userDetails?.lastName}` : 'Student',
                                studentClass: stObj?.className || 'N/A',
                                studentRollNo: stObj?.rollNumber ? String(stObj.rollNumber) : 'N/A',
                                studentAdmissionNo: stObj?.admissionNumber ? String(stObj.admissionNumber) : 'N/A',
                                studentId: selectedStudent || '',
                                parentName: parentUser ? `${parentUser.firstName} ${parentUser.lastName}` : 'Guardian',
                                parentPhone: parentUser?.phone || 'N/A',
                                parentEmail: parentUser?.email || 'N/A',
                                parentRelation: 'Parent',
                                amount: inv.amount
                              };

                              return (
                                <div key={idx} className="p-4 bg-slate-900/30 border border-slate-850 hover:border-slate-800 rounded-2xl flex flex-col justify-between gap-4 transition-all duration-200">
                                  <div className="flex justify-between items-start gap-4">
                                    <div className="space-y-1">
                                      <div className="flex items-center gap-2">
                                        <span className={`text-[9px] font-extrabold tracking-wider px-2 py-0.5 rounded uppercase border ${
                                          inv.status === 'PAID'
                                            ? 'bg-green-500/10 border-green-500/25 text-green-400'
                                            : inv.status === 'PENDING'
                                              ? 'bg-amber-500/10 border-amber-500/25 text-amber-400'
                                              : 'bg-red-500/10 border-red-500/25 text-red-400'
                                        }`}>
                                          {inv.status}
                                        </span>
                                        <span className="text-[9.5px] font-mono text-slate-500">#{inv.invoiceNumber}</span>
                                      </div>
                                      <h4 className="font-bold text-slate-200 text-xs mt-2">{inv.description}</h4>
                                      <p className="text-[10px] text-slate-450">
                                        {stObj?.userDetails?.firstName} {stObj?.userDetails?.lastName} ({stObj?.className})
                                      </p>
                                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[9.5px] text-slate-550 font-mono mt-1">
                                        <span>Bill Date: {new Date(inv.billDate).toLocaleDateString()}</span>
                                        <span>Due: {new Date(inv.dueDate).toLocaleDateString()}</span>
                                      </div>
                                    </div>

                                    <div className="text-right shrink-0">
                                      <span className="text-sm font-extrabold text-slate-100">
                                        ₹{inv.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                      </span>
                                      <p className="text-[9px] text-slate-555 mt-1">
                                        {inv.status === 'PAID' ? `Verified` : 'Awaiting Settlement'}
                                      </p>
                                    </div>
                                  </div>

                                  <div className="border-t border-slate-850/60 pt-3 flex flex-wrap justify-between items-center gap-3">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <button
                                        onClick={() => downloadInvoicePdf(invoicePayload, false)}
                                        className="px-2.5 py-1 bg-slate-900 border border-slate-850 hover:border-slate-700 text-slate-350 hover:text-slate-200 rounded-lg text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-all"
                                        title="Download Invoice A4 PDF"
                                      >
                                        <Download size={11} />
                                        Invoice
                                      </button>
                                      {inv.status === 'PAID' && (
                                        <button
                                          onClick={() => downloadInvoicePdf(invoicePayload, true)}
                                          className="px-2.5 py-1 bg-brand-500/10 hover:bg-brand-500/20 text-brand-400 border border-brand-500/25 rounded-lg text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-all"
                                          title="Download Payment Receipt PDF"
                                        >
                                          <FileText size={11} />
                                          Receipt
                                        </button>
                                      )}
                                      <button
                                        onClick={async () => {
                                          const shareUrl = `https://www.aegiserp.xyz/verify/invoice/${inv.invoiceNumber}`;
                                          if (navigator.share) {
                                            await navigator.share({
                                              title: `Invoice ${inv.invoiceNumber}`,
                                              url: shareUrl
                                            }).catch(() => {});
                                          } else {
                                            navigator.clipboard.writeText(shareUrl);
                                            alert('Invoice verification link copied to clipboard!');
                                          }
                                        }}
                                        className="px-2.5 py-1 bg-slate-900 border border-slate-850 hover:border-slate-700 text-slate-350 hover:text-slate-200 rounded-lg text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-all"
                                        title="Share Invoice Registry Link"
                                      >
                                        <Share2 size={11} />
                                        Share
                                      </button>
                                      <button
                                        onClick={() => downloadInvoicePdf(invoicePayload, false)}
                                        className="px-2.5 py-1 bg-slate-900 border border-slate-850 hover:border-slate-700 text-slate-350 hover:text-slate-200 rounded-lg text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-all"
                                        title="Print Invoice"
                                      >
                                        <Printer size={11} />
                                        Print
                                      </button>
                                      <button
                                        onClick={() => setHistoryInvoice(inv)}
                                        className="px-2.5 py-1 bg-slate-900 border border-slate-850 hover:border-slate-700 text-slate-350 hover:text-slate-200 rounded-lg text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-all"
                                        title="View Payment Audit History"
                                      >
                                        <History size={11} />
                                        History
                                      </button>
                                    </div>

                                    <div className="flex items-center gap-2">
                                      {(inv.status === 'UNPAID' || inv.status === 'OVERDUE') && (
                                        <button
                                          onClick={() => {
                                            setSelectedFee(inv.structure);
                                            setShowPayModal(true);
                                            if (schoolPaymentSettings?.qrPaymentEnabled && schoolPaymentSettings?.showQrToParents) {
                                              setPayModalTab('qr');
                                            } else if (schoolPaymentSettings?.upiId) {
                                              setPayModalTab('upi');
                                            } else {
                                              setPayModalTab('bank');
                                            }
                                          }}
                                          className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-all active:scale-95 shadow-md shadow-emerald-500/10"
                                        >
                                          Pay Now
                                        </button>
                                      )}
                                      <button
                                        onClick={() => setSelectedInvoice(invoicePayload)}
                                        className="px-3 py-1 bg-brand-600 hover:bg-brand-500 text-white rounded-lg text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-all active:scale-95 shadow-md shadow-brand-500/10"
                                      >
                                        <Eye size={11} />
                                        View Detail
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              );
                            });
                          })()}
                        </div>

                        <div className="pt-2 flex justify-center">
                          <button
                            onClick={() => {
                              const el = document.getElementById('recent-payments-section');
                              if (el) el.scrollIntoView({ behavior: 'smooth' });
                            }}
                            className="text-xs font-bold text-slate-400 hover:text-slate-350 transition-colors"
                          >
                            View All Invoices & Payment History &rarr;
                          </button>
                        </div>
                      </GlassCard>
                    </div>

                    {/* Right Panel: Quick Actions & Payment Instructions */}
                    <div className="lg:col-span-4 space-y-4">
                      
                      {/* Quick Actions */}
                      <GlassCard className="p-4 space-y-3">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Quick Actions</h4>
                        <div className="grid grid-cols-2 gap-2">
                          <button 
                            onClick={() => {
                              const outstandingFirst = (academicRecord?.fees || []).find((f: any) => f.status !== 'PAID');
                              if (outstandingFirst) {
                                setSelectedFee(outstandingFirst);
                                setShowPayModal(true);
                                if (schoolPaymentSettings?.qrPaymentEnabled && schoolPaymentSettings?.showQrToParents) {
                                  setPayModalTab('qr');
                                } else if (schoolPaymentSettings?.upiId) {
                                  setPayModalTab('upi');
                                } else {
                                  setPayModalTab('bank');
                                }
                              } else {
                                alert('All fees are currently cleared!');
                              }
                            }}
                            className="p-3 bg-slate-900/40 hover:bg-slate-900/60 border border-slate-850 rounded-xl transition-all flex flex-col items-center justify-center text-center gap-1.5 active:scale-[0.97]"
                          >
                            <DollarSign className="text-brand-400" size={16} />
                            <span className="text-[10px] font-bold text-slate-200">Pay Fees</span>
                            <span className="text-[8px] text-slate-500">Make a payment</span>
                          </button>

                          <button 
                            onClick={() => {
                              const el = document.getElementById('recent-payments-section');
                              if (el) el.scrollIntoView({ behavior: 'smooth' });
                            }}
                            className="p-3 bg-slate-900/40 hover:bg-slate-900/60 border border-slate-850 rounded-xl transition-all flex flex-col items-center justify-center text-center gap-1.5 active:scale-[0.97]"
                          >
                            <Clock className="text-brand-400" size={16} />
                            <span className="text-[10px] font-bold text-slate-200">Payment History</span>
                            <span className="text-[8px] text-slate-500">View all payments</span>
                          </button>

                          <button 
                            onClick={() => {
                              const el = document.getElementById('recent-payments-section');
                              if (el) el.scrollIntoView({ behavior: 'smooth' });
                            }}
                            className="p-3 bg-slate-900/40 hover:bg-slate-900/60 border border-slate-850 rounded-xl transition-all flex flex-col items-center justify-center text-center gap-1.5 active:scale-[0.97]"
                          >
                            <FileText className="text-brand-400" size={16} />
                            <span className="text-[10px] font-bold text-slate-200">Download Receipts</span>
                            <span className="text-[8px] text-slate-500">Get receipts</span>
                          </button>

                          <button 
                            onClick={() => {
                              const outstandingFirst = (academicRecord?.fees || []).find((f: any) => f.status !== 'PAID');
                              if (outstandingFirst) {
                                setSelectedFee(outstandingFirst);
                                setShowProofModal(true);
                                setUtrNumber('');
                                setScreenshotFile(null);
                              } else {
                                alert('No outstanding fees to submit proof for.');
                              }
                            }}
                            className="p-3 bg-brand-500/10 hover:bg-brand-500/20 border border-brand-500/25 rounded-xl transition-all flex flex-col items-center justify-center text-center gap-1.5 active:scale-[0.97]"
                          >
                            <Download className="text-brand-400" size={16} />
                            <span className="text-[10px] font-bold text-slate-200">Submit Payment Proof</span>
                            <span className="text-[8px] text-slate-500">Upload screenshot</span>
                          </button>
                        </div>
                      </GlassCard>

                      {/* Payment Instructions */}
                      <GlassCard className="p-4 space-y-3">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Payment Instructions</h4>
                        
                        {/* Tab buttons */}
                        <div className="flex border-b border-slate-850 pb-1 text-[10px] font-bold text-slate-500">
                          {[
                            { id: 'qr', label: 'UPI QR Code' },
                            { id: 'upi', label: 'UPI ID' },
                            { id: 'bank', label: 'Bank Transfer' }
                          ].map(t => (
                            <button
                              key={t.id}
                              onClick={() => setPayInstructTab(t.id as any)}
                              className={`flex-1 pb-1.5 text-center transition-all ${
                                payInstructTab === t.id
                                  ? 'text-brand-400 border-b-2 border-brand-400'
                                  : 'hover:text-slate-300'
                              }`}
                            >
                              {t.label}
                            </button>
                          ))}
                        </div>

                        {/* Tab content */}
                        <div className="space-y-3 pt-2">
                          {payInstructTab === 'qr' && (
                            <div className="space-y-3 text-center flex flex-col items-center">
                              {schoolPaymentSettings?.showQrToParents && schoolPaymentSettings?.qrCodeUrl ? (
                                <>
                                  <div className="w-32 h-32 bg-white p-2 rounded-xl flex items-center justify-center border border-slate-800">
                                    <img src={schoolPaymentSettings.qrCodeUrl} alt="UPI Payment QR" className="max-w-full max-h-full object-contain" />
                                  </div>
                                  <div>
                                    <h5 className="text-[11px] font-bold text-slate-200 font-sans">Scan & Pay Using Any UPI App</h5>
                                    <p className="text-[9px] text-slate-505 mt-0.5 leading-normal">Pay to the QR code using PhonePe, Google Pay, Paytm, BHIM or any UPI app.</p>
                                  </div>
                                  <button
                                    onClick={() => {
                                      const a = document.createElement('a');
                                      a.href = schoolPaymentSettings.qrCodeUrl || '';
                                      a.download = 'school_payment_qr.png';
                                      a.target = '_blank';
                                      a.click();
                                    }}
                                    className="px-3 py-1.5 bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-350 rounded-lg text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                                  >
                                    <Download size={10} /> Download QR Code
                                  </button>
                                </>
                              ) : (
                                <p className="text-slate-500 text-[10px] py-4">UPI QR Code payments are currently not enabled by the school.</p>
                              )}
                            </div>
                          )}

                          {payInstructTab === 'upi' && (
                            <div className="space-y-2 text-center flex flex-col items-center">
                              {schoolPaymentSettings?.upiId ? (
                                <>
                                  <div className="bg-slate-950/60 border border-slate-850 px-3 py-2 rounded-xl text-center w-full">
                                    <span className="text-xs font-mono font-bold text-slate-350 block select-all">{schoolPaymentSettings.upiId}</span>
                                  </div>
                                  <button
                                    onClick={() => {
                                      navigator.clipboard.writeText(schoolPaymentSettings.upiId || '');
                                      alert('UPI ID copied to clipboard!');
                                    }}
                                    className="px-3 py-1.5 bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-350 rounded-lg text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                                  >
                                    Copy UPI ID
                                  </button>
                                </>
                              ) : (
                                <p className="text-slate-500 text-[10px] py-4">UPI payment channel is not configured.</p>
                              )}
                            </div>
                          )}

                          {payInstructTab === 'bank' && (
                            <div className="space-y-2">
                              {schoolPaymentSettings?.showBankToParents ? (
                                <div className="space-y-2 text-xs p-3 bg-slate-950/20 rounded-xl border border-slate-850/80">
                                  {[
                                    { label: 'Account Holder Name', value: schoolPaymentSettings.accountHolderName },
                                    { label: 'Bank Name', value: schoolPaymentSettings.bankName },
                                    { label: 'Account Number', value: schoolPaymentSettings.accountNumber },
                                    { label: 'IFSC', value: schoolPaymentSettings.ifscCode },
                                    { label: 'Branch', value: schoolPaymentSettings.branchName },
                                    { label: 'UPI ID', value: schoolPaymentSettings.upiId }
                                  ].map(item => (
                                    <div key={item.label} className="flex justify-between items-center py-1 border-b border-slate-850/40 last:border-0">
                                      <span className="text-slate-500 text-[9px] font-bold uppercase">{item.label}</span>
                                      <span className="text-slate-200 font-semibold text-[10px] font-mono">{item.value || '—'}</span>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-slate-500 text-[10px] py-4 text-center">Bank Transfer details are not shared by the school.</p>
                              )}
                            </div>
                          )}
                        </div>

                        {schoolPaymentSettings?.paymentInstructions && (
                          <div className="p-2 border-t border-slate-850/40 text-[9px] text-slate-450 leading-normal">
                            <span className="font-bold text-slate-350">Instructions: </span>
                            {schoolPaymentSettings.paymentInstructions}
                          </div>
                        )}
                        <div className="text-[9px] text-slate-505 text-center pt-1.5 border-t border-slate-850/40 leading-normal">
                          After payment, please upload the screenshot using <span className="text-brand-400 font-bold hover:underline cursor-pointer" onClick={() => {
                            const outstandingFirst = (academicRecord?.fees || []).find((f: any) => f.status !== 'PAID');
                            if (outstandingFirst) {
                              setSelectedFee(outstandingFirst);
                              setShowProofModal(true);
                              setUtrNumber('');
                              setScreenshotFile(null);
                            }
                          }}>Submit Payment Proof</span>.
                        </div>
                      </GlassCard>

                    </div>
                  </div>

                  {/* Recent Payments Section */}
                  <div id="recent-payments-section">
                    <GlassCard className="p-5 space-y-4">
                      <div className="flex justify-between items-center pb-2 border-b border-slate-850">
                        <h4 className="text-sm font-bold text-slate-200">Recent Payments</h4>
                        <span className="text-xs text-slate-500 font-medium">All billing receipts on record</span>
                      </div>

                      {(() => {
                        const allFees = academicRecord?.fees || [];
                        return allFees.length === 0 ? (
                          <div className="text-center py-8 text-slate-500 text-xs">No payment records found.</div>
                        ) : (
                          <div className="overflow-x-auto">
                            <table className="w-full text-xs text-left">
                              <thead>
                                <tr className="border-b border-slate-850 text-slate-500 text-[9px] font-bold uppercase tracking-wider">
                                  <th className="py-2.5 px-3">Date</th>
                                  <th className="py-2.5 px-3">Invoice</th>
                                  <th className="py-2.5 px-3">Amount</th>
                                  <th className="py-2.5 px-3">Payment Method</th>
                                  <th className="py-2.5 px-3">Status</th>
                                  <th className="py-2.5 px-3 text-right">Receipt</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-900 text-slate-350">
                                {allFees.map((f: any, idx: number) => {
                                  const studentProfile = academicRecord?.studentProfile || {};
                                  return (
                                    <tr key={idx} className="hover:bg-slate-900/20 transition-colors">
                                      <td className="py-3 px-3 font-medium text-slate-400">
                                        {new Date(f.paymentDate || f.dueDate).toLocaleDateString()}
                                      </td>
                                      <td className="py-3 px-3">
                                        <div className="font-semibold text-slate-200">{f.description}</div>
                                        <div className="text-[9px] text-slate-550">
                                          {studentProfile.fullName || 'Student'} ({studentProfile.className || 'N/A'})
                                        </div>
                                      </td>
                                      <td className="py-3 px-3 font-semibold text-slate-200">
                                        ₹{f.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                      </td>
                                      <td className="py-3 px-3 font-mono text-slate-450">{f.paymentMethod || 'UPI'}</td>
                                      <td className="py-3 px-3">
                                        <span className={`text-[9.5px] font-bold px-2 py-0.5 rounded border uppercase ${
                                          f.status === 'PAID'
                                            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                                            : f.status === 'PENDING'
                                              ? 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                                              : f.status === 'UNPAID'
                                                ? 'bg-slate-500/10 border-slate-500/20 text-slate-400'
                                                : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
                                        }`}>
                                          {f.status === 'PAID' ? 'APPROVED' : f.status}
                                        </span>
                                      </td>
                                      <td className="py-3 px-3 text-right">
                                        {f.status === 'PAID' ? (
                                          <button
                                            onClick={async () => {
                                              if (!studentSchool) return;
                                              const studentProfile = academicRecord?.studentProfile || {};
                                              await downloadReceiptPdf({
                                                schoolId: studentSchool.id,
                                                schoolName: studentSchool.name,
                                                schoolAddress: studentSchool.address || '',
                                                schoolPhone: studentSchool.phone || '',
                                                schoolEmail: (studentSchool as any).email || '',
                                                logoUrl: studentSchool.logoUrl || '',
                                                sealUrl: studentSchool.sealUrl || '',
                                                currencySymbol: studentSchool.currencySymbol || '$',
                                                studentName: studentProfile.fullName || 'Student',
                                                studentId: selectedStudent,
                                                admissionNumber: studentProfile.admissionNumber || '',
                                                className: studentProfile.className || '',
                                                sectionName: studentProfile.sectionName || '',
                                                feeDescription: f.description,
                                                amount: Number(f.amount),
                                                paymentDate: f.paymentDate || new Date().toISOString(),
                                                paymentMethod: f.paymentMethod || 'ONLINE',
                                                transactionId: f.transactionId || f.utrNumber
                                              });
                                            }}
                                            className="px-2.5 py-1 bg-brand-500/10 hover:bg-brand-500/20 text-brand-400 border border-brand-500/20 rounded-lg font-bold text-[10px] inline-flex items-center gap-1 active:scale-95 transition-all text-right ml-auto"
                                          >
                                            <Download size={11} /> Download
                                          </button>
                                        ) : (
                                          <span className="text-[10px] text-slate-605">—</span>
                                        )}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        );
                      })()}
                    </GlassCard>
                  </div>

                  {/* Pay Fees Modal */}
                  {showPayModal && selectedFee && (
                    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                      <div className="w-full max-w-md bg-slate-900 border border-slate-805 rounded-3xl p-6 space-y-4 shadow-2xl animate-fade-in text-xs text-slate-350">
                        <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                          <div>
                            <h3 className="font-bold text-slate-100 text-base">Pay School Fees</h3>
                            <p className="text-[10px] text-slate-400 mt-0.5">{selectedFee.description}</p>
                          </div>
                          <button 
                            type="button"
                            onClick={() => {
                              setShowPayModal(false);
                              setSelectedFee(null);
                            }}
                            className="p-1 rounded-lg bg-slate-850 hover:bg-slate-805 text-slate-400 hover:text-slate-200 transition-colors"
                          >
                            <X size={18} />
                          </button>
                        </div>

                        {/* Invoice & Outstanding Details */}
                        <div className="p-3 bg-brand-500/5 border border-brand-500/10 rounded-xl flex justify-between items-center">
                          <span className="text-xs text-slate-400 font-semibold">Amount to Pay:</span>
                          <span className="text-sm font-extrabold text-brand-400">₹{selectedFee.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                        </div>

                        {/* Payment Instructions / Gateways */}
                        <div className="space-y-3">
                          <label className="text-[10.5px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Select Payment Method</label>
                          
                          {/* Method Selector Tabs */}
                          <div className="flex border-b border-slate-850 pb-1 text-[10px] font-bold text-slate-500">
                            {[
                              { id: 'qr', label: 'UPI QR Code', show: !!(schoolPaymentSettings?.qrPaymentEnabled && schoolPaymentSettings?.showQrToParents && schoolPaymentSettings?.qrCodeUrl) },
                              { id: 'upi', label: 'UPI ID', show: !!schoolPaymentSettings?.upiId },
                              { id: 'bank', label: 'Bank Transfer', show: !!schoolPaymentSettings?.showBankToParents }
                            ].filter(t => t.show).map(t => (
                              <button
                                key={t.id}
                                type="button"
                                onClick={() => setPayModalTab(t.id as any)}
                                className={`flex-1 pb-1.5 text-center transition-all ${
                                  payModalTab === t.id
                                    ? 'text-brand-400 border-b-2 border-brand-400'
                                    : 'hover:text-slate-350'
                                }`}
                              >
                                {t.label}
                              </button>
                            ))}
                          </div>

                          {/* Tab Contents */}
                          <div className="space-y-3 pt-2">
                            {payModalTab === 'qr' && schoolPaymentSettings?.qrCodeUrl && (
                              <div className="space-y-3 text-center flex flex-col items-center">
                                <div className="w-36 h-36 bg-white p-2 rounded-xl flex items-center justify-center border border-slate-800">
                                  <img src={schoolPaymentSettings.qrCodeUrl} alt="UPI Payment QR" className="max-w-full max-h-full object-contain" />
                                </div>
                                <div>
                                  <h5 className="text-[11px] font-bold text-slate-200">Scan & Pay Using Any UPI App</h5>
                                  <p className="text-[9px] text-slate-505 mt-0.5 leading-normal">GPay, PhonePe, Paytm, BHIM or any banking app</p>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const a = document.createElement('a');
                                    a.href = schoolPaymentSettings.qrCodeUrl || '';
                                    a.download = 'school_payment_qr.png';
                                    a.target = '_blank';
                                    a.click();
                                  }}
                                  className="px-3 py-1.5 bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-350 rounded-lg text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                                >
                                  <Download size={10} /> Download QR Code
                                </button>
                              </div>
                            )}

                            {payModalTab === 'upi' && schoolPaymentSettings?.upiId && (
                              <div className="space-y-3 text-center flex flex-col items-center">
                                <div className="bg-slate-950/60 border border-slate-850 px-3 py-2 rounded-xl text-center w-full">
                                  <span className="text-xs font-mono font-bold text-slate-350 block select-all">{schoolPaymentSettings.upiId}</span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => {
                                    navigator.clipboard.writeText(schoolPaymentSettings.upiId || '');
                                    alert('UPI ID copied to clipboard!');
                                  }}
                                  className="px-3 py-1.5 bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-350 rounded-lg text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                                >
                                  Copy UPI ID
                                </button>
                              </div>
                            )}

                            {payModalTab === 'bank' && schoolPaymentSettings?.showBankToParents && (
                              <div className="space-y-2">
                                <div className="space-y-2 text-xs p-3 bg-slate-950/20 rounded-xl border border-slate-850/80">
                                  {[
                                    { label: 'Account Holder Name', value: schoolPaymentSettings.accountHolderName },
                                    { label: 'Bank Name', value: schoolPaymentSettings.bankName },
                                    { label: 'Account Number', value: schoolPaymentSettings.accountNumber },
                                    { label: 'IFSC', value: schoolPaymentSettings.ifscCode },
                                    { label: 'Branch', value: schoolPaymentSettings.branchName },
                                    { label: 'SWIFT Code', value: schoolPaymentSettings.swiftCode }
                                  ].filter(item => item.value).map(item => (
                                    <div key={item.label} className="flex justify-between items-center py-1 border-b border-slate-850/40 last:border-0">
                                      <span className="text-slate-505 text-[9px] font-bold uppercase">{item.label}</span>
                                      <span className="text-slate-205 font-semibold text-[10px] font-mono select-all">{item.value || '—'}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {!schoolPaymentSettings?.qrCodeUrl && !schoolPaymentSettings?.upiId && !schoolPaymentSettings?.showBankToParents && (
                              <p className="text-slate-500 text-[10px] py-4 text-center">No online payment methods are currently enabled by the school. Please contact school administration.</p>
                            )}
                          </div>

                          {schoolPaymentSettings?.paymentInstructions && (
                            <div className="p-2.5 bg-slate-950/20 rounded-xl border border-slate-850/50 text-[9.5px] text-slate-400 leading-normal">
                              <span className="font-bold text-slate-300">Instructions: </span>
                              {schoolPaymentSettings.paymentInstructions}
                            </div>
                          )}
                        </div>

                        {/* Modal Actions */}
                        <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                          <button
                            type="button"
                            onClick={() => {
                              setShowPayModal(false);
                              setSelectedFee(null);
                            }}
                            className="px-4 py-2 bg-slate-850 hover:bg-slate-800 text-slate-300 rounded-xl text-xs font-semibold cursor-pointer"
                          >
                            Close
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setShowPayModal(false);
                              setShowProofModal(true);
                              setUtrNumber('');
                              setScreenshotFile(null);
                              if (payModalTab === 'qr' || payModalTab === 'upi') {
                                setPaymentMethod('UPI');
                              } else {
                                setPaymentMethod('BANK_TRANSFER');
                              }
                            }}
                            className="px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-xl text-xs font-semibold cursor-pointer flex items-center gap-1.5"
                          >
                            I've Paid — Submit Proof
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Submit Proof Modal */}
                  {showProofModal && selectedFee && (
                    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                      <div className="w-full max-w-md bg-slate-900 border border-slate-805 rounded-3xl p-6 space-y-4 shadow-2xl animate-fade-in text-xs text-slate-350">
                        <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                          <div>
                            <h3 className="font-bold text-slate-100 text-base">Submit Payment Proof</h3>
                            <p className="text-[10px] text-slate-400 mt-0.5">{selectedFee.description}</p>
                          </div>
                          <button 
                            onClick={() => {
                              setShowProofModal(false);
                              setSelectedFee(null);
                            }}
                            className="p-1 rounded-lg bg-slate-850 hover:bg-slate-805 text-slate-400 hover:text-slate-200 transition-colors"
                          >
                            <X size={18} />
                          </button>
                        </div>

                        <div className="space-y-4">
                          <div className="p-3 bg-brand-500/5 border border-brand-500/10 rounded-xl flex justify-between items-center">
                            <span className="text-xs text-slate-400">Total Payable:</span>
                            <span className="text-sm font-bold text-brand-400">₹{selectedFee.amount.toFixed(2)}</span>
                          </div>

                          <div className="space-y-1">
                            <label className="text-[10.5px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Payment Method</label>
                            <div className="grid grid-cols-2 gap-3">
                              <button
                                type="button"
                                onClick={() => setPaymentMethod('UPI')}
                                className={`py-2 px-3 rounded-xl border text-xs font-semibold text-center transition-all ${
                                  paymentMethod === 'UPI'
                                    ? 'bg-brand-500/10 border-brand-500 text-brand-400 font-bold'
                                    : 'bg-slate-950/20 border-slate-800 text-slate-400 hover:border-slate-750'
                                }`}
                              >
                                UPI / QR Code
                              </button>
                              <button
                                type="button"
                                onClick={() => setPaymentMethod('BANK_TRANSFER')}
                                className={`py-2 px-3 rounded-xl border text-xs font-semibold text-center transition-all ${
                                  paymentMethod === 'BANK_TRANSFER'
                                    ? 'bg-brand-500/10 border-brand-500 text-brand-400 font-bold'
                                    : 'bg-slate-950/20 border-slate-800 text-slate-400 hover:border-slate-750'
                                }`}
                              >
                                Bank Transfer
                              </button>
                            </div>
                          </div>

                          <div className="space-y-1">
                            <label className="text-[10.5px] font-bold text-slate-400 uppercase tracking-wider block">
                              UTR / Reference Number
                            </label>
                            <input
                              type="text"
                              placeholder={paymentMethod === 'UPI' ? 'Enter 12-digit UPI Ref No' : 'Enter Bank Transaction UTR'}
                              value={utrNumber}
                              onChange={(e) => setUtrNumber(e.target.value)}
                              className="w-full bg-slate-950 border border-slate-850 rounded-xl px-3 py-2 text-slate-200 text-xs focus:outline-none focus:border-brand-500 transition-colors"
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="text-[10.5px] font-bold text-slate-400 uppercase tracking-wider block">
                              Upload Payment Screenshot / Receipt
                            </label>
                            <div className="relative border border-dashed border-slate-800 hover:border-slate-750 bg-slate-950/20 rounded-xl p-4 flex flex-col items-center justify-center gap-1.5 transition-colors cursor-pointer">
                              <input
                                type="file"
                                accept="image/*,application/pdf"
                                onChange={(e) => {
                                  if (e.target.files && e.target.files[0]) {
                                    setScreenshotFile(e.target.files[0]);
                                  }
                                }}
                                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                              />
                              <Download size={20} className="text-slate-500" />
                              <span className="text-xs text-slate-300 font-semibold text-center truncate max-w-full px-2">
                                {screenshotFile ? screenshotFile.name : 'Choose file or drag here'}
                              </span>
                              <span className="text-[9px] text-slate-505">Max size 5MB (PNG, JPG, PDF)</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                          <button
                            type="button"
                            onClick={() => {
                              setShowProofModal(false);
                              setSelectedFee(null);
                            }}
                            className="px-4 py-2 bg-slate-850 hover:bg-slate-800 text-slate-300 rounded-xl text-xs font-semibold cursor-pointer"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              if (!utrNumber.trim()) {
                                alert('Please enter your transaction UTR/Reference number.');
                                return;
                              }
                              if (!screenshotFile) {
                                alert('Please upload a payment screenshot/receipt file.');
                                return;
                              }
                              try {
                                setSubmittingProof(true);
                                await mockApi.submitFeePaymentProof(
                                  parentId || '',
                                  selectedStudent,
                                  selectedFee.id,
                                  paymentMethod,
                                  utrNumber.trim(),
                                  screenshotFile
                                );
                                alert('Payment proof submitted successfully! Sub-admin / Finance Admin will verify your proof shortly.');
                                setShowProofModal(false);
                                setSelectedFee(null);
                                await loadAcademicRecord();
                              } catch (err: any) {
                                alert(err.message || 'Failed to submit payment proof.');
                              } finally {
                                setSubmittingProof(false);
                              }
                            }}
                            disabled={submittingProof}
                            className="px-4 py-2 bg-brand-500 hover:bg-brand-600 disabled:bg-brand-800 text-white rounded-xl text-xs font-semibold cursor-pointer flex items-center gap-1.5"
                          >
                            {submittingProof ? 'Submitting...' : 'Submit Proof'}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ══════════════ MY PAYMENTS — 3-Panel Layout ══════════════ */}
                  <div className="mt-8 pt-8 border-t border-slate-800/60">
                    <div className="flex items-center justify-between mb-5">
                      <div>
                        <h3 className="text-lg font-bold text-slate-100">My Payments</h3>
                        <p className="text-xs text-slate-400 mt-0.5">View and manage all fee payments</p>
                      </div>
                      <div className="flex items-center bg-slate-900/60 rounded-xl border border-slate-800 p-0.5">
                        {[
                          { id: 'outstanding' as const, label: 'Outstanding Fees' },
                          { id: 'history' as const, label: 'Payment History' },
                        ].map(tab => (
                          <button
                            key={tab.id}
                            onClick={() => setFeePaySubTab(tab.id)}
                            className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-all ${feePaySubTab === tab.id ? 'bg-brand-500/15 text-brand-400 border border-brand-500/25' : 'text-slate-400 hover:text-slate-200 border border-transparent'}`}
                          >
                            {tab.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {feePaySubTab === 'outstanding' && (
                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
                        {/* Left Panel: Select Fee to Pay */}
                        <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-5 space-y-4">
                          <div>
                            <h4 className="text-sm font-bold text-slate-100">Select Fee to Pay</h4>
                            <p className="text-[10px] text-slate-500 mt-0.5">Choose a fee from the list below to submit payment proof</p>
                          </div>
                          <div className="space-y-2.5 max-h-[340px] overflow-y-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: '#1e293b transparent' }}>
                            {(() => {
                              const outstanding = (academicRecord?.fees || []).filter((f: any) => f.status !== 'PAID');
                              if (outstanding.length === 0) {
                                return <div className="text-center py-6 text-slate-500 text-xs">No outstanding fees. All paid! 🎉</div>;
                              }
                              return outstanding.map((f: any, idx: number) => {
                                const invHash = f.id.split('').reduce((a: number, c: string) => a + c.charCodeAt(0), 0);
                                const invoiceNo = `INV-2026-${String(invHash % 10000).padStart(4, '0')}`;
                                const isSelected = selectedFeeForProof === f.id;
                                return (
                                  <div
                                    key={idx}
                                    onClick={() => {
                                      if (f.status === 'PENDING') return;
                                      setSelectedFeeForProof(f.id);
                                      setSelectedFee(f);
                                    }}
                                    className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                                      f.status === 'PENDING'
                                        ? 'border-amber-500/20 bg-amber-500/5 opacity-60 cursor-not-allowed'
                                        : isSelected
                                          ? 'border-brand-500/40 bg-brand-500/5 ring-1 ring-brand-500/20'
                                          : 'border-slate-800 hover:border-slate-700 bg-slate-950/30'
                                    }`}
                                  >
                                    <div className="flex items-start gap-3">
                                      <div className={`mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                                        f.status === 'PENDING' ? 'border-amber-500/40' : isSelected ? 'border-brand-500 bg-brand-500' : 'border-slate-600'
                                      }`}>
                                        {isSelected && f.status !== 'PENDING' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between gap-2">
                                          <p className="text-xs font-bold text-slate-200 truncate">{f.description}</p>
                                          <span className="text-sm font-extrabold text-slate-100 whitespace-nowrap">₹{f.amount.toLocaleString()}</span>
                                        </div>
                                        <p className="text-[9.5px] text-slate-500 mt-0.5">Invoice: <span className="font-mono text-slate-400">{invoiceNo}</span></p>
                                        <div className="flex items-center justify-between mt-1">
                                          <p className="text-[9.5px] text-slate-500">Due Date: <span className="text-slate-400">{new Date(f.dueDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span></p>
                                          {f.status === 'PENDING' && (
                                            <span className="text-[8px] font-bold px-1.5 py-0.5 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded uppercase">Pending Verification</span>
                                          )}
                                          {f.status === 'REJECTED' && (
                                            <span className="text-[8px] font-bold px-1.5 py-0.5 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded uppercase">Rejected</span>
                                          )}
                                        </div>
                                        {f.status === 'PENDING' && (
                                          <p className="text-[9px] text-amber-400/80 mt-1.5 font-medium leading-relaxed italic">
                                            Payment proof already submitted. Waiting for Finance Admin verification.
                                          </p>
                                        )}
                                        {f.status === 'REJECTED' && f.rejectionReason && (
                                          <p className="text-[9px] text-rose-400/80 mt-1 italic">Reason: {f.rejectionReason}</p>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                );
                              });
                            })()}
                          </div>
                          <p className="text-[9px] text-amber-400/80 flex items-center gap-1">
                            <AlertCircle size={10} className="flex-shrink-0" />
                            Select a fee above to proceed with payment proof submission.
                          </p>
                        </div>

                        {/* Middle Panel: Submit Payment Proof */}
                        <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-5 space-y-4">
                          <h4 className="text-sm font-bold text-slate-100">Submit Payment Proof</h4>
                          {(() => {
                            const selFee = selectedFeeForProof ? (academicRecord?.fees || []).find((f: any) => f.id === selectedFeeForProof) : null;
                            if (!selFee) {
                              return (
                                <div className="text-center py-12 text-slate-500 text-xs space-y-2">
                                  <DollarSign size={24} className="mx-auto text-slate-700" />
                                  <p>Select a fee from the left panel to submit payment proof.</p>
                                </div>
                              );
                            }
                            const invHash = selFee.id.split('').reduce((a: number, c: string) => a + c.charCodeAt(0), 0);
                            const invoiceNo = `INV-2026-${String(invHash % 10000).padStart(4, '0')}`;
                            return (
                              <>
                                <div className="p-3 bg-brand-500/5 border border-brand-500/10 rounded-xl space-y-1">
                                  <p className="text-[10px] text-slate-400">For: <span className="font-semibold text-slate-200">{selFee.description}</span></p>
                                  <div className="flex items-center gap-4">
                                    <p className="text-[10px] text-slate-500">Invoice: <span className="font-mono text-slate-400">{invoiceNo}</span></p>
                                    <p className="text-[10px] text-slate-500">Amount: <span className="font-bold text-slate-100">₹{selFee.amount.toLocaleString()}</span></p>
                                  </div>
                                </div>
                                <div className="space-y-1">
                                  <label className="text-[10.5px] font-bold text-slate-400 uppercase tracking-wider block">UTR Number *</label>
                                  <input
                                    type="text"
                                    placeholder="Enter UTR number"
                                    value={utrNumber}
                                    onChange={(e) => setUtrNumber(e.target.value)}
                                    className="w-full bg-slate-950 border border-slate-850 rounded-xl px-3 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-brand-500 transition-colors placeholder-slate-600"
                                  />
                                </div>
                                <div className="space-y-1">
                                  <label className="text-[10.5px] font-bold text-slate-400 uppercase tracking-wider block">Upload Payment Screenshot / Receipt *</label>
                                  <div className="relative border border-dashed border-slate-800 hover:border-slate-700 bg-slate-950/30 rounded-xl p-6 flex flex-col items-center justify-center gap-1.5 transition-colors cursor-pointer">
                                    <input
                                      type="file"
                                      accept="image/*,application/pdf"
                                      onChange={(e) => {
                                        if (e.target.files && e.target.files[0]) setScreenshotFile(e.target.files[0]);
                                      }}
                                      className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                                    />
                                    <Download size={20} className="text-slate-600" />
                                    <span className="text-xs text-slate-300 font-semibold text-center truncate max-w-full px-2">
                                      {screenshotFile ? screenshotFile.name : 'Click to upload or drag and drop'}
                                    </span>
                                    <span className="text-[9px] text-slate-600">JPG, PNG, PDF up to 5MB</span>
                                  </div>
                                </div>
                                <button
                                  disabled={submittingProof}
                                  onClick={async () => {
                                    if (!utrNumber.trim()) { alert('Please enter your transaction UTR/Reference number.'); return; }
                                    if (!screenshotFile) { alert('Please upload a payment screenshot/receipt file.'); return; }
                                    try {
                                      setSubmittingProof(true);
                                      await mockApi.submitFeePaymentProof(parentId || '', selectedStudent, selFee.id, paymentMethod, utrNumber.trim(), screenshotFile);
                                      alert('Payment proof submitted successfully! Finance Admin will verify shortly.');
                                      setSelectedFeeForProof(null);
                                      setUtrNumber('');
                                      setScreenshotFile(null);
                                      await loadAcademicRecord();
                                    } catch (err: any) {
                                      alert(err.message || 'Failed to submit payment proof.');
                                    } finally {
                                      setSubmittingProof(false);
                                    }
                                  }}
                                  className="w-full py-2.5 bg-brand-500 hover:bg-brand-600 disabled:bg-brand-800 text-white rounded-xl text-xs font-bold cursor-pointer flex items-center justify-center gap-1.5 transition-all active:scale-[0.97]"
                                >
                                  {submittingProof ? 'Submitting...' : 'Submit Payment Proof'}
                                </button>
                              </>
                            );
                          })()}
                        </div>

                        {/* Right Panel: Payment History */}
                        <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-5 space-y-4">
                          <div>
                            <h4 className="text-sm font-bold text-slate-100">Payment History</h4>
                            <p className="text-[10px] text-slate-500 mt-0.5">All payments and their current status</p>
                          </div>
                          <div className="space-y-3 max-h-[340px] overflow-y-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: '#1e293b transparent' }}>
                            {(() => {
                              const allFees = academicRecord?.fees || [];
                              const withPayments = allFees.filter((f: any) => f.status === 'PAID' || f.status === 'REJECTED' || f.status === 'PENDING');
                              if (withPayments.length === 0) {
                                return <div className="text-center py-8 text-slate-500 text-xs">No payment history yet.</div>;
                              }
                              return withPayments.map((f: any, idx: number) => {
                                const invHash = f.id.split('').reduce((a: number, c: string) => a + c.charCodeAt(0), 0);
                                const invoiceNo = `INV-2026-${String(invHash % 10000).padStart(4, '0')}`;
                                return (
                                  <div key={idx} className={`p-3.5 rounded-xl border transition-all ${
                                    f.status === 'REJECTED' ? 'border-rose-500/20 bg-rose-500/5' : f.status === 'PAID' ? 'border-slate-800 bg-slate-950/30' : 'border-amber-500/15 bg-amber-500/[0.02]'
                                  }`}>
                                    <div className="flex items-start justify-between gap-3">
                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                          {f.status === 'PAID' && <CheckCircle size={12} className="text-emerald-400 flex-shrink-0" />}
                                          {f.status === 'REJECTED' && <XCircle size={12} className="text-rose-400 flex-shrink-0" />}
                                          {f.status === 'PENDING' && <Clock size={12} className="text-amber-400 flex-shrink-0" />}
                                          <p className="text-xs font-bold text-slate-200 truncate">{f.description}</p>
                                        </div>
                                        <p className="text-[9.5px] text-slate-500 mt-1 ml-5">Invoice: <span className="font-mono text-slate-400">{invoiceNo}</span></p>
                                        {f.status === 'PAID' && <p className="text-[9.5px] text-slate-500 ml-5">Paid On: <span className="text-slate-400">{f.paymentDate ? new Date(f.paymentDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</span></p>}
                                        {f.status === 'REJECTED' && (
                                          <>
                                            {f.rejectionReason && <p className="text-[9px] text-rose-400/80 mt-1 ml-5 italic">Reason: {f.rejectionReason}. Please upload a clearer screenshot.</p>}
                                            <button className="mt-2 ml-5 flex items-center gap-1 text-[10px] font-bold text-cyan-400 hover:text-cyan-300 transition-colors"
                                              onClick={() => { setSelectedFeeForProof(f.id); setSelectedFee(f); setFeePaySubTab('outstanding'); setUtrNumber(''); setScreenshotFile(null); }}>
                                              ↻ Re-upload Payment Proof
                                            </button>
                                          </>
                                        )}
                                      </div>
                                      <div className="flex flex-col items-end gap-1 flex-shrink-0">
                                        <span className="text-sm font-extrabold text-slate-100">₹{f.amount.toLocaleString()}</span>
                                        <span className={`text-[8px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wide ${
                                          f.status === 'PAID' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : f.status === 'REJECTED' ? 'bg-rose-500/10 border-rose-500/20 text-rose-400' : 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                                        }`}>{f.status === 'PAID' ? 'APPROVED' : f.status}</span>
                                      </div>
                                    </div>
                                  </div>
                                );
                              });
                            })()}
                          </div>
                          <button onClick={() => setFeePaySubTab('history')} className="text-xs font-bold text-brand-400 hover:text-brand-300 transition-colors flex items-center gap-1">
                            View All Payment History →
                          </button>
                        </div>
                      </div>
                    )}

                    {feePaySubTab === 'history' && (
                      <GlassCard className="p-5 space-y-4">
                        <div className="flex justify-between items-center pb-2 border-b border-slate-850">
                          <h4 className="text-sm font-bold text-slate-200">Complete Payment History</h4>
                          <span className="text-xs text-slate-500 font-medium">All billing records</span>
                        </div>
                        {(() => {
                          const allFees = academicRecord?.fees || [];
                          return allFees.length === 0 ? (
                            <div className="text-center py-8 text-slate-500 text-xs">No payment records found.</div>
                          ) : (
                            <div className="overflow-x-auto">
                              <table className="w-full text-xs text-left">
                                <thead>
                                  <tr className="border-b border-slate-850 text-slate-500 text-[9px] font-bold uppercase tracking-wider">
                                    <th className="py-2.5 px-3">Date</th>
                                    <th className="py-2.5 px-3">Invoice</th>
                                    <th className="py-2.5 px-3">Fee Head</th>
                                    <th className="py-2.5 px-3">Amount</th>
                                    <th className="py-2.5 px-3">Status</th>
                                    <th className="py-2.5 px-3">Details</th>
                                    <th className="py-2.5 px-3 text-right">Actions</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-900 text-slate-350">
                                  {allFees.map((f: any, idx: number) => {
                                    const invHash = f.id.split('').reduce((a: number, c: string) => a + c.charCodeAt(0), 0);
                                    const invoiceNo = `INV-2026-${String(invHash % 10000).padStart(4, '0')}`;
                                    return (
                                      <tr key={idx} className="hover:bg-slate-900/20 transition-colors">
                                        <td className="py-3 px-3 font-medium text-slate-400">{new Date(f.paymentDate || f.dueDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                                        <td className="py-3 px-3 font-mono text-[10px] text-slate-400">{invoiceNo}</td>
                                        <td className="py-3 px-3"><div className="font-semibold text-slate-200">{f.description}</div></td>
                                        <td className="py-3 px-3 font-semibold text-slate-200">₹{f.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                        <td className="py-3 px-3">
                                          <span className={`text-[9.5px] font-bold px-2 py-0.5 rounded border uppercase ${
                                            f.status === 'PAID' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : f.status === 'PENDING' ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' : f.status === 'UNPAID' ? 'bg-slate-500/10 border-slate-500/20 text-slate-400' : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
                                          }`}>{f.status === 'PAID' ? 'APPROVED' : f.status}</span>
                                        </td>
                                        <td className="py-3 px-3 text-[10px]">
                                          {f.status === 'REJECTED' && f.rejectionReason && <span className="text-rose-400 italic">{f.rejectionReason}</span>}
                                          {f.status === 'PENDING' && <span className="text-amber-400">Awaiting verification</span>}
                                          {f.status === 'UNPAID' && <span className="text-slate-500">Not yet paid</span>}
                                          {f.status === 'PAID' && f.utrNumber && <span className="text-slate-500 font-mono">UTR: {f.utrNumber}</span>}
                                        </td>
                                        <td className="py-3 px-3 text-right">
                                          {f.status === 'PAID' ? (
                                            <button onClick={async () => {
                                              if (!studentSchool) return;
                                              const sp = academicRecord?.studentProfile || {};
                                              await downloadReceiptPdf({ schoolId: studentSchool.id, schoolName: studentSchool.name, schoolAddress: studentSchool.address || '', schoolPhone: studentSchool.phone || '', schoolEmail: (studentSchool as any).email || '', logoUrl: studentSchool.logoUrl || '', sealUrl: studentSchool.sealUrl || '', currencySymbol: studentSchool.currencySymbol || '$', studentName: sp.fullName || 'Student', studentId: selectedStudent, admissionNumber: sp.admissionNumber || '', className: sp.className || '', sectionName: sp.sectionName || '', feeDescription: f.description, amount: Number(f.amount), paymentDate: f.paymentDate || new Date().toISOString(), paymentMethod: f.paymentMethod || 'ONLINE', transactionId: f.transactionId || f.utrNumber });
                                            }} className="px-2.5 py-1 bg-brand-500/10 hover:bg-brand-500/20 text-brand-400 border border-brand-500/20 rounded-lg font-bold text-[10px] inline-flex items-center gap-1 active:scale-95 transition-all">
                                              <Download size={11} /> Receipt
                                            </button>
                                          ) : f.status === 'REJECTED' ? (
                                            <button onClick={() => { setSelectedFeeForProof(f.id); setSelectedFee(f); setFeePaySubTab('outstanding'); setUtrNumber(''); setScreenshotFile(null); }}
                                              className="px-2.5 py-1 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/20 rounded-lg font-bold text-[10px] inline-flex items-center gap-1 active:scale-95 transition-all">
                                              ↻ Re-upload
                                            </button>
                                          ) : <span className="text-[10px] text-slate-605">—</span>}
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          );
                        })()}
                      </GlassCard>
                    )}
                  </div>

                </div>
              </PremiumLock>
            )}

      {activeTab === 'documents' && (
        <div className="space-y-6 animate-fade-in text-xs font-sans">
          <GlassCard className="border border-brand-500/10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-brand-500/10 border border-brand-500/20">
                <FileText className="text-brand-400" size={20} />
              </div>
              <div>
                <h3 className="font-bold text-slate-100 text-sm">Ward's Documents Center</h3>
                <p className="text-[10px] text-slate-400 mt-0.5">Access and download official institutional documents, identity cards, and certified papers for your ward.</p>
              </div>
            </div>
          </GlassCard>

          {selectedStudent ? (
            (() => {
              const st = assignedStudents.find(s => s.id === selectedStudent);
              if (!st) return null;

              return (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {/* ID Card Button */}
                  <div className="p-4 bg-slate-900/40 border border-slate-850 rounded-2xl flex flex-col justify-between gap-4">
                    <div>
                      <h6 className="font-bold text-slate-200 text-xs">Student ID Card (CR80)</h6>
                      <p className="text-[10px] text-slate-450 mt-1">High-fidelity portrait wallet ID card. Incorporates photo, roll details, verified QR verification, logo, seal, and administrative signature.</p>
                    </div>
                    <button
                      onClick={async () => {
                        try {
                          setDocGenerating('idcard');
                          if (!studentSchool || !studentObj) return;

                          // Fetch dynamic principal signature from database
                          let pSig = '';
                          let pName = 'Principal / School Admin';
                          const { data: dbAdmin } = await supabase
                            .from('school_admins')
                            .select('signature_url, users(first_name, last_name)')
                            .eq('school_id', studentSchool.id)
                            .eq('status', 'ACTIVE')
                            .maybeSingle();
                          if (dbAdmin) {
                            if (dbAdmin.signature_url) pSig = dbAdmin.signature_url;
                            if (dbAdmin.users) {
                              const u = dbAdmin.users as any;
                              pName = `${u.first_name} ${u.last_name}`;
                            }
                          }

                          const docSt = {
                            id: studentObj.id,
                            fullName: st.userDetails ? `${st.userDetails.firstName} ${st.userDetails.lastName}` : 'Student Name',
                            admissionNumber: studentObj.admissionNumber,
                            rollNumber: studentObj.rollNumber,
                            className: st.className || 'Class Room',
                            sectionName: 'A',
                            dateOfBirth: studentObj.dateOfBirth,
                            gender: studentObj.gender,
                            avatarUrl: st.userDetails?.avatarUrl,
                            fatherName: 'Father Name',
                            motherName: 'Mother Name',
                            address: 'Student Residence, USA',
                            phone: st.userDetails?.phone
                          };

                          const docSchool = {
                            id: studentSchool.id,
                            name: studentSchool.name,
                            address: studentSchool.address,
                            phone: studentSchool.phone,
                            email: (studentSchool as any).email || 'billing@aegisacademy.edu',
                            logoUrl: studentSchool.logoUrl,
                            sealUrl: studentSchool.sealUrl,
                            sessionName: '2025-2026'
                          };

                          await downloadStudentIdCardPdf(docSchool, docSt, pSig, pName);
                        } catch (err) {
                          console.error('Failed to generate ID Card:', err);
                          alert('Error building ID Card.');
                        } finally {
                          setDocGenerating('');
                        }
                      }}
                      disabled={!!docGenerating}
                      className="w-full glass-btn-primary py-2 text-xs flex items-center justify-center gap-1.5"
                    >
                      {docGenerating === 'idcard' ? 'Generating...' : 'Download ID Card (PDF)'}
                    </button>
                  </div>

                  {/* Admission Form Button */}
                  <div className="p-4 bg-slate-900/40 border border-slate-850 rounded-2xl flex flex-col justify-between gap-4">
                    <div>
                      <h6 className="font-bold text-slate-200 text-xs">Admission Form Record</h6>
                      <p className="text-[10px] text-slate-450 mt-1">Pre-filled admission registry sheet. Displays all verified profile fields, parent contact metrics, logo, and seal.</p>
                    </div>
                    <button
                      onClick={async () => {
                        try {
                          setDocGenerating('admission');
                          if (!studentSchool || !studentObj) return;

                          // Fetch dynamic principal signature from database
                          let pSig = '';
                          let pName = 'Registrar / School Admin';
                          const { data: dbAdmin } = await supabase
                            .from('school_admins')
                            .select('signature_url, users(first_name, last_name)')
                            .eq('school_id', studentSchool.id)
                            .eq('status', 'ACTIVE')
                            .maybeSingle();
                          if (dbAdmin) {
                            if (dbAdmin.signature_url) pSig = dbAdmin.signature_url;
                            if (dbAdmin.users) {
                              const u = dbAdmin.users as any;
                              pName = `${u.first_name} ${u.last_name}`;
                            }
                          }

                          const docSt = {
                            id: studentObj.id,
                            fullName: st.userDetails ? `${st.userDetails.firstName} ${st.userDetails.lastName}` : 'Student Name',
                            admissionNumber: studentObj.admissionNumber,
                            rollNumber: studentObj.rollNumber,
                            className: st.className || 'Class Room',
                            sectionName: 'A',
                            dateOfBirth: studentObj.dateOfBirth,
                            gender: studentObj.gender,
                            avatarUrl: st.userDetails?.avatarUrl,
                            fatherName: 'Father Name',
                            motherName: 'Mother Name',
                            address: 'Student Residence, USA',
                            phone: st.userDetails?.phone
                          };

                          const docSchool = {
                            id: studentSchool.id,
                            name: studentSchool.name,
                            address: studentSchool.address,
                            phone: studentSchool.phone,
                            email: (studentSchool as any).email || 'billing@aegisacademy.edu',
                            logoUrl: studentSchool.logoUrl,
                            sealUrl: studentSchool.sealUrl,
                            sessionName: '2025-2026'
                          };

                          await downloadAdmissionFormPdf(docSchool, docSt, undefined, pSig, pName);
                        } catch (err) {
                          console.error('Failed to generate Admission Form:', err);
                          alert('Error building Admission Form.');
                        } finally {
                          setDocGenerating('');
                        }
                      }}
                      disabled={!!docGenerating}
                      className="w-full glass-btn-primary py-2 text-xs flex items-center justify-center gap-1.5"
                    >
                      {docGenerating === 'admission' ? 'Generating...' : 'Download Admission Record (PDF)'}
                    </button>
                  </div>

                  {/* Bonafide Certificate Button */}
                  <div className="p-4 bg-slate-900/40 border border-slate-850 rounded-2xl flex flex-col justify-between gap-4">
                    <div>
                      <h6 className="font-bold text-slate-200 text-xs">Bonafide Certificate</h6>
                      <p className="text-[10px] text-slate-450 mt-1">Officially signed letter verifying student's active registration status within the academic institution.</p>
                    </div>
                    <button
                      onClick={async () => {
                        try {
                          setDocGenerating('bonafide');
                          if (!studentSchool || !studentObj) return;

                          // Fetch dynamic principal signature from database
                          let pSig = '';
                          let pName = 'Principal / School Admin';
                          const { data: dbAdmin } = await supabase
                            .from('school_admins')
                            .select('signature_url, users(first_name, last_name)')
                            .eq('school_id', studentSchool.id)
                            .eq('status', 'ACTIVE')
                            .maybeSingle();
                          if (dbAdmin) {
                            if (dbAdmin.signature_url) pSig = dbAdmin.signature_url;
                            if (dbAdmin.users) {
                              const u = dbAdmin.users as any;
                              pName = `${u.first_name} ${u.last_name}`;
                            }
                          }

                          const docSt = {
                            id: studentObj.id,
                            fullName: st.userDetails ? `${st.userDetails.firstName} ${st.userDetails.lastName}` : 'Student Name',
                            admissionNumber: studentObj.admissionNumber,
                            rollNumber: studentObj.rollNumber,
                            className: st.className || 'Class Room',
                            sectionName: 'A',
                            dateOfBirth: studentObj.dateOfBirth,
                            gender: studentObj.gender,
                            avatarUrl: st.userDetails?.avatarUrl,
                            fatherName: 'Father Name',
                            motherName: 'Mother Name',
                            address: 'Student Residence, USA',
                            phone: st.userDetails?.phone
                          };

                          const docSchool = {
                            id: studentSchool.id,
                            name: studentSchool.name,
                            address: studentSchool.address,
                            phone: studentSchool.phone,
                            email: (studentSchool as any).email || 'billing@aegisacademy.edu',
                            logoUrl: studentSchool.logoUrl,
                            sealUrl: studentSchool.sealUrl,
                            sessionName: '2025-2026'
                          };

                          await downloadBonafideCertificatePdf(docSchool, docSt, pSig, pName);
                        } catch (err) {
                          console.error('Failed to generate Bonafide Certificate:', err);
                          alert('Error building Bonafide Certificate.');
                        } finally {
                          setDocGenerating('');
                        }
                      }}
                      disabled={!!docGenerating}
                      className="w-full glass-btn-primary py-2 text-xs flex items-center justify-center gap-1.5"
                    >
                      {docGenerating === 'bonafide' ? 'Generating...' : 'Download Bonafide Cert (PDF)'}
                    </button>
                  </div>
                </div>
              );
            })()
          ) : (
            <div className="p-6 bg-slate-900/10 border border-dashed border-slate-850 rounded-2xl text-center text-slate-500">
              Please select a ward directory entry to view official documents.
            </div>
          )}
        </div>
      )}
                  {activeTab === 'library' && (
                    <PremiumLock
                      isLocked={!ent.hasLibraryAccess}
                      requiredTier="ENTERPRISE"
                      featureName="School Library & Digital Books"
                      customMessage="This feature is available only with an active Enterprise Subscription. Please contact your School Administrator."
                    >
                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in">
                <div className="lg:col-span-2 space-y-6">
                  <GlassCard className="space-y-4">
                    <h3 className="font-bold text-slate-100 flex items-center gap-2 pb-2 border-b border-slate-850">
                      <BookMarked className="text-brand-500" size={18} />
                      School Library Catalog
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[500px] overflow-y-auto pr-1">
                      {libraryBooks.length === 0 ? (
                        <p className="text-xs text-slate-500 italic py-4 text-center col-span-2">No books registered in the catalog yet.</p>
                      ) : (
                        libraryBooks.map(b => (
                          <div key={b.id} className="p-3.5 bg-slate-900/30 border border-slate-850 rounded-xl space-y-2 flex flex-col justify-between">
                            <div>
                              <h4 className="font-bold text-slate-200 text-xs">{b.title}</h4>
                              <p className="text-[10px] text-slate-400 mt-1">Author: {b.author} | ISBN: {b.isbn}</p>
                            </div>
                            <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-850/40">
                              <span className="inline-block text-[9px] font-bold px-2 py-0.5 rounded bg-brand-500/10 text-brand-400">
                                Genre: {b.subject}
                              </span>
                              <span className={`text-[9px] font-semibold ${b.availableCopies > 0 ? 'text-emerald-450' : 'text-rose-450'}`}>
                                {b.availableCopies > 0 ? `${b.availableCopies} available` : 'Issued Out'}
                              </span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </GlassCard>

                  <GlassCard className="space-y-4">
                    <h3 className="font-bold text-slate-100 flex items-center gap-2 pb-2 border-b border-slate-850">
                      <BookOpen className="text-brand-500" size={18} />
                      Digital E-Books & Video Guides Catalog
                    </h3>
                    {digitalLibraryAssets.length === 0 ? (
                      <p className="text-xs text-slate-500 italic py-4 text-center">No digital library assets uploaded yet.</p>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[500px] overflow-y-auto pr-1">
                        {digitalLibraryAssets.map(asset => (
                          <div key={asset.id} className="p-3.5 bg-slate-900/40 border border-slate-850 rounded-2xl flex flex-col justify-between gap-3 hover:border-slate-750 transition-all animate-fade-in">
                            <div>
                              <span className="inline-block text-[9px] font-bold px-2 py-0.5 rounded-full bg-brand-500/10 text-brand-400 font-mono uppercase tracking-wider mb-2">
                                {asset.fileType || 'PDF E-Book'}
                              </span>
                              <h4 className="font-bold text-slate-200 text-xs leading-snug">{asset.title}</h4>
                              {asset.author && (
                                <p className="text-[10px] text-slate-400 mt-1 font-medium">By: {asset.author}</p>
                              )}
                            </div>
                            <div className="pt-2 border-t border-slate-850/60 flex items-center justify-between">
                              <span className="text-[9px] text-slate-500 font-mono">{new Date(asset.createdAt).toLocaleDateString()}</span>
                              <a 
                                href={asset.fileUrl} 
                                target="_blank" 
                                rel="noopener noreferrer" 
                                className="px-3 py-1 bg-brand-500/10 hover:bg-brand-500/20 text-brand-400 hover:text-brand-350 text-[10px] font-bold rounded-lg border border-brand-500/20 transition-all flex items-center gap-1"
                              >
                                Access File &rarr;
                              </a>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </GlassCard>
                </div>
                <div className="space-y-6">
                  <GlassCard className="space-y-4">
                    <h3 className="font-bold text-slate-200 text-xs pb-2 border-b border-slate-850 flex items-center gap-1.5">
                      <BookOpen size={14} className="text-brand-500" />
                      Library Activity & History
                    </h3>
                    <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                      {issuedBooks.length === 0 ? (
                        <p className="text-xs text-slate-500 italic">No library activity recorded for your ward.</p>
                      ) : (
                        issuedBooks.map(bi => {
                          const bookTitle = bi.book?.title || mockDb.books.find(b => b.id === bi.bookId)?.title || 'Unknown Book';
                          const fineRecord = libraryFines.find(f => f.issueId === bi.id);
                          let fineText = null;
                          if (fineRecord) {
                            fineText = `${studentSchool?.currencySymbol || '$'}${Number(fineRecord.amount).toFixed(2)} (${fineRecord.isPaid ? 'Paid' : 'Unpaid'})`;
                          }
                          return (
                            <div key={bi.id} className="p-3 bg-slate-900/40 border border-slate-850 rounded-xl space-y-1.5 text-[11px]">
                              <h4 className="font-bold text-slate-200">{bookTitle}</h4>
                              <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[10px] text-slate-450 font-mono">
                                <div>Issued: {bi.issueDate ? new Date(bi.issueDate).toLocaleDateString() : '—'}</div>
                                <div>Due: {bi.dueDate ? new Date(bi.dueDate).toLocaleDateString() : '—'}</div>
                                {bi.returnDate && <div className="col-span-2">Returned: {new Date(bi.returnDate).toLocaleDateString()}</div>}
                              </div>
                              <div className="flex items-center justify-between pt-1 border-t border-slate-850/40 mt-1">
                                <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold ${
                                  bi.status === 'RETURNED' ? 'bg-green-500/10 text-green-400' :
                                  bi.status === 'OVERDUE' ? 'bg-red-500/10 text-red-400' :
                                  'bg-brand-500/10 text-brand-400'
                                }`}>{bi.status}</span>
                                {fineText && (
                                  <span className="text-[10px] font-semibold text-red-400 font-mono">
                                    Fine: {fineText}
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })
                      )}
                      {libraryFines.length > 0 && (
                        <div className="space-y-2 mt-4 pt-4 border-t border-slate-850">
                          <h4 className="font-bold text-slate-200 text-xs">Outstanding Library Fines</h4>
                          {libraryFines.map(lf => (
                            <div key={lf.id} className="p-3 bg-red-500/5 border border-red-500/10 rounded-xl">
                              <p className="text-xs text-slate-400">Balance: <span className="text-red-400 font-bold">{studentSchool?.currencySymbol || '$'}{lf.amount || lf.fineAmount}</span></p>
                              <p className="text-[9px] text-slate-500">Reason: {lf.reason || 'Late Return Fee'}</p>
                              <span className={`text-[9px] font-bold ${lf.isPaid || lf.is_paid ? 'text-green-400' : 'text-red-400'}`}>
                                {lf.isPaid || lf.is_paid ? 'Paid' : 'Unpaid'}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </GlassCard>
                </div>
              </div>
              </PremiumLock>
            )}

            {activeTab === 'transit' && (
              <PremiumLock
                isLocked={!ent.hasTransportAccess}
                requiredTier="Enterprise"
                featureName="School Transit & Route Tracking"
              >
                <GlassCard className="space-y-6 animate-fade-in">
                  <div className="border-b border-slate-850 pb-3">
                    <h3 className="font-bold text-slate-100 flex items-center gap-2">
                      <Layers className="text-brand-500" size={18} />
                      Ward's School Transit Details
                    </h3>
                  </div>
                  {!transitAssignment ? (
                    <div className="p-6 bg-slate-900/10 border border-dashed border-slate-850 rounded-2xl text-center">
                      <Layers size={24} className="text-slate-500 mx-auto mb-2" />
                      <p className="text-xs text-slate-450 italic">No transport route assigned yet.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="p-4 bg-slate-900/30 border border-slate-850 rounded-2xl space-y-3">
                        <h4 className="font-bold text-slate-200 text-xs">Assigned Route & Stop</h4>
                        <p className="text-xs text-slate-350">Route: <span className="font-semibold text-brand-400">{assignedRoute?.name || 'Assigned Route'}</span> ({assignedRoute?.routeCode || 'Code Pending'})</p>
                        <p className="text-xs text-slate-350">Pickup Stop: <span className="font-semibold text-slate-200">{assignedPickupPoint?.name || 'Assigned Stop'}</span></p>
                        <p className="text-xs text-slate-350">Transit Fare: <span className="font-semibold text-slate-200">{studentSchool?.currencySymbol || '$'}{assignedRoute?.fare || 0}</span></p>
                      </div>
                      <div className="p-4 bg-slate-900/30 border border-slate-850 rounded-2xl space-y-3">
                        <h4 className="font-bold text-slate-200 text-xs">Vehicle & Driver Details</h4>
                        <p className="text-xs text-slate-350">Bus Number Plate: <span className="font-semibold text-slate-200">{assignedBus?.numberPlate || 'Vehicle Pending'}</span></p>
                        <p className="text-xs text-slate-350">Driver Name: <span className="font-semibold text-slate-200">{assignedDriver?.name || 'Driver Assigned'}</span></p>
                        <p className="text-xs text-slate-350">Contact: <span className="font-semibold text-slate-200">{assignedDriver?.phone || 'N/A'}</span></p>
                      </div>
                    </div>
                  )}
                </GlassCard>
              </PremiumLock>
            )}

            {activeTab === 'forums' && (
              <PremiumLock 
                isLocked={!ent.hasBilling} 
                requiredTier="Basic" 
                featureName="Discussions & Forums"
              >
                <div className="space-y-6">
                  {selectedPost ? (
                    <GlassCard className="space-y-4 animate-fade-in">
                      <button 
                        onClick={() => setSelectedPost(null)}
                        className="text-xs text-brand-400 hover:text-brand-300 font-semibold"
                      >
                        &larr; Back to discussion catalog
                      </button>
                      
                      <div className="p-4 bg-slate-900/40 border border-slate-850 rounded-2xl space-y-3">
                        <h4 className="font-bold text-slate-100 text-base">{selectedPost.title}</h4>
                        <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-line">{selectedPost.content}</p>
                        <p className="text-[10px] text-slate-500">Posted by: {selectedPost.authorName}</p>
                      </div>

                      <div className="space-y-4">
                        <h5 className="font-semibold text-slate-200 text-xs">Activity replies</h5>
                        <div className="space-y-3 max-h-72 overflow-y-auto">
                          {postReplies.length === 0 ? (
                            <div className="text-center py-6 text-slate-500 text-xs">No responses posted yet. Be the first to reply!</div>
                          ) : (
                            postReplies.map(r => (
                              <div key={r.id} className="p-3 bg-slate-900/20 border border-slate-850 rounded-xl space-y-1">
                                <div className="flex items-center justify-between mb-1">
                                  <span className="font-semibold text-slate-200 text-xs">{r.authorName}</span>
                                  <span className="text-[9px] uppercase tracking-wider text-slate-500">{r.authorRole}</span>
                                </div>
                                <p className="text-xs text-slate-300 leading-relaxed">{r.content}</p>
                              </div>
                            ))
                          )}
                        </div>
                      </div>

                      {/* Forum response creator */}
                      <form onSubmit={handleForumReplySubmit} className="space-y-3">
                        <textarea 
                          placeholder="Write a constructive response..."
                          rows={3}
                          value={replyText}
                          onChange={(e) => setReplyText(e.target.value)}
                          className="w-full bg-slate-900/50 border border-slate-800 text-xs text-slate-100 rounded-xl p-3 focus:outline-none focus:border-brand-500 transition-colors"
                          required
                        />
                        <button type="submit" className="glass-btn-primary text-xs">
                          Publish Reply
                        </button>
                      </form>
                    </GlassCard>
                  ) : (
                    <GlassCard className="space-y-6">
                      <h3 className="font-bold text-slate-100 pb-3 border-b border-slate-850">Homeroom Classroom Forums</h3>
                      <div className="space-y-4 max-h-[500px] overflow-y-auto pr-1">
                        {forumPosts.length === 0 ? (
                          <div className="text-center py-12 text-slate-500 text-xs">No active discussions available for this class.</div>
                        ) : (
                          forumPosts.map(p => (
                            <div 
                              key={p.id}
                              onClick={() => handleSelectPost(p)}
                              className="p-4 bg-slate-900/30 border border-slate-850 hover:border-slate-800 rounded-2xl cursor-pointer transition-all"
                            >
                              <div className="flex items-center justify-between mb-1.5">
                                <span className="text-[9px] font-bold text-brand-400 uppercase tracking-widest">{p.categoryName}</span>
                                <span className="text-[10px] text-slate-500 flex items-center gap-1">
                                  <MessageCircle size={10} />
                                  {p.repliesCount} replies
                                </span>
                              </div>
                              <h4 className="font-bold text-slate-200 text-sm truncate">{p.title}</h4>
                              <p className="text-xs text-slate-400 mt-1 line-clamp-2 leading-relaxed">{p.content}</p>
                              <div className="mt-3 flex items-center justify-between text-[10px] text-slate-500">
                                <span>By: {p.authorName}</span>
                                <span>{new Date(p.createdAt).toLocaleDateString()}</span>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </GlassCard>
                  )}
                </div>
              </PremiumLock>
            )}

            {activeTab === 'materials' && (
              <PremiumLock
                isLocked={!ent.hasLibraryAccess}
                requiredTier="ENTERPRISE"
                featureName="Premium Learning Resources"
                customMessage="This feature is available only with an active Enterprise Subscription. Please contact your School Administrator."
              >
                <GlassCard className="space-y-6">
                  <div className="border-b border-slate-850 pb-3">
                    <h3 className="font-bold text-slate-100 flex items-center gap-2">
                      <BookOpen className="text-brand-500" size={18} />
                      Ward's Academic Study Materials & Video Lectures
                    </h3>
                  </div>

                  {activeVideoUrl && (
                    <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl animate-fade-in space-y-2">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-semibold text-slate-200">Active Lecture Streaming Node</h4>
                        <button 
                          onClick={() => setActiveVideoUrl(null)}
                          className="text-xs text-red-400 hover:text-red-300 font-semibold"
                        >
                          Close Screen
                        </button>
                      </div>
                      {renderVideoPlayer(activeVideoUrl)}
                    </div>
                  )}

                  {materialsLoading ? (
                    <div className="text-center py-12 text-slate-400 italic text-sm">
                      Loading study materials...
                    </div>
                  ) : materials.length === 0 ? (
                    <div className="text-center py-12 text-slate-400 italic text-sm">
                      No academic materials uploaded for this student's subjects yet.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {materials.map(m => (
                        <div key={m.id} className="p-4 bg-slate-900/30 border border-slate-850 hover:border-brand-500/20 rounded-2xl flex flex-col justify-between gap-4 transition-all">
                          <div className="space-y-2">
                            <span className="text-[10px] font-bold text-brand-400 font-mono uppercase tracking-wider">{m.subjectName}</span>
                            <h4 className="font-bold text-slate-200 text-sm mt-0.5">{m.title}</h4>
                            <p className="text-xs text-slate-400 leading-relaxed line-clamp-3">{m.description || 'No description provided.'}</p>
                          </div>
                          <div className="pt-2 flex items-center justify-between border-t border-slate-850">
                            <span className="text-[10px] text-slate-500 truncate">Faculty: {m.teacherName}</span>
                            {m.isVideoStreamable ? (
                              <button 
                                onClick={() => setActiveVideoUrl(m.fileUrl)}
                                className="text-brand-400 hover:text-brand-300 flex items-center gap-1 font-semibold text-xs transition-colors"
                              >
                                <Play size={14} className="text-brand-500" />
                                Stream Live
                              </button>
                            ) : (
                              <a 
                                href={m.fileUrl} 
                                download 
                                className="text-brand-400 hover:text-brand-300 flex items-center gap-1 font-semibold text-xs transition-colors"
                              >
                                <Download size={14} className="text-brand-500" />
                                Get File
                              </a>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </GlassCard>
              </PremiumLock>
            )}

            {activeTab === 'quizzes' && (
              <PremiumLock 
                isLocked={!ent.hasQuizzes} 
                requiredTier="Pro" 
                featureName="Quizzes & Interactive Online Tests"
              >
                <GlassCard className="space-y-6">
                  <div className="border-b border-slate-850 pb-3">
                    <h3 className="font-bold text-slate-100 flex items-center gap-2">
                      <Award className="text-brand-500" size={18} />
                      Ward's Quizzes & Interactive Test Results
                    </h3>
                  </div>

                  {quizzes.length === 0 ? (
                    <div className="text-center py-8 text-slate-400 italic text-xs">
                      No quizzes published for this student's subjects yet.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {quizzes.map(({ quiz, attempt }) => {
                        const subject = mockDb.subjects.find(s => s.id === quiz.subjectId);
                        
                        // Calculate score details if attempted
                        let correctCount = 0;
                        let incorrectCount = 0;
                        if (attempt) {
                          const questions = mockDb.quizQuestions.filter(q => q.quizId === quiz.id);
                          questions.forEach(q => {
                            const studentAns = attempt.answers ? attempt.answers[q.id] : undefined;
                            if (studentAns !== undefined && studentAns === q.correctOption) {
                              correctCount++;
                            } else {
                              incorrectCount++;
                            }
                          });
                        }

                        return (
                          <div key={quiz.id} className="p-4 bg-slate-900/30 border border-slate-850 rounded-2xl flex flex-col justify-between gap-4">
                            <div className="space-y-2">
                              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{subject ? subject.name : 'Subject'}</span>
                              <h4 className="font-bold text-slate-200 text-sm mt-0.5">{quiz.title}</h4>
                              <p className="text-xs text-slate-400">Duration: {quiz.durationMinutes} minutes | Marks: {quiz.totalMarks}</p>
                            </div>
                            
                            <div className="pt-3 border-t border-slate-850 flex flex-col gap-2">
                              {attempt ? (
                                <div className="space-y-1.5">
                                  <div className="flex items-center justify-between text-xs">
                                    <span className="text-slate-400 font-semibold">Status:</span>
                                    <span className="text-green-400 font-bold bg-green-500/10 px-2 py-0.5 rounded uppercase tracking-wider text-[10px]">Attempted</span>
                                  </div>
                                  <div className="flex items-center justify-between text-xs">
                                    <span className="text-slate-400 font-semibold">Marks:</span>
                                    <span className="text-slate-200 font-bold">{attempt.score} / {quiz.totalMarks} ({Math.round((attempt.score / quiz.totalMarks) * 100)}%)</span>
                                  </div>
                                  <div className="flex items-center justify-between text-xs">
                                    <span className="text-slate-400 font-semibold">Correct Answers:</span>
                                    <span className="text-green-400 font-bold">{correctCount}</span>
                                  </div>
                                  <div className="flex items-center justify-between text-xs">
                                    <span className="text-slate-400 font-semibold">Incorrect Answers:</span>
                                    <span className="text-red-400 font-bold">{incorrectCount}</span>
                                  </div>
                                  <div className="flex items-center justify-between text-[10px] text-slate-500 italic mt-1">
                                    <span>Taken: {new Date(attempt.attemptedAt).toLocaleString()}</span>
                                  </div>
                                </div>
                              ) : (
                                <div className="flex items-center justify-between text-xs">
                                  <span className="text-slate-500">Status:</span>
                                  <span className="text-amber-400 font-bold bg-amber-500/10 px-2 py-0.5 rounded uppercase tracking-wider text-[10px]">Not Taken Yet</span>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </GlassCard>
              </PremiumLock>
            )}

            {activeTab === 'hostel' && (
              <PremiumLock 
                isLocked={!ent.hasHostelAccess} 
                requiredTier="Enterprise" 
                featureName="Hostel Hub"
                customMessage="Hostel monitoring features are available only under the Enterprise Plan. Please contact the School Administrator to request an upgrade."
              >
                <div className="space-y-6 animate-fade-in">
                  {!activeAdmission ? (
                    <GlassCard className="text-center py-16 p-6 flex flex-col items-center justify-center gap-3">
                      <Home size={40} className="text-slate-650 animate-pulse-subtle" />
                      <p className="text-sm text-slate-350 font-semibold font-mono">No Active Hostel Admission</p>
                      <p className="text-xs text-slate-500 max-w-md">
                        Your ward is not currently registered or assigned to any hostel room space. Please coordinate with the Hostel Admin or Warden for details.
                      </p>
                    </GlassCard>
                  ) : (
                    <div className="space-y-6">
                      {/* 1. Header Ward Hostel Info / Warden Contact */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <GlassCard className="p-5 flex flex-col justify-between">
                          <div className="space-y-2">
                            <div className="flex items-center gap-2 text-brand-400">
                              <Home size={18} />
                              <h4 className="font-bold text-xs uppercase tracking-wider">Ward Room Allocation</h4>
                            </div>
                            <h3 className="text-2xl font-bold text-slate-100">{hostelDetails?.name || 'Loading Hostel...'}</h3>
                            <p className="text-xs text-slate-400">Building Type: <span className="font-semibold text-slate-200">{hostelDetails?.type || 'N/A'}</span></p>
                            <p className="text-xs text-slate-400">Block / Wing: <span className="font-semibold text-slate-200">{blockDetails?.name || 'N/A'}</span></p>
                            <p className="text-xs text-slate-400">Floor Level: <span className="font-semibold text-slate-200">{roomDetails?.floor !== undefined ? `Floor ${roomDetails.floor}` : 'N/A'}</span></p>
                          </div>
                          <div className="border-t border-slate-850 pt-3 mt-4 text-[10px] text-slate-500 flex justify-between">
                            <span>Room: {roomDetails?.roomNumber || 'N/A'}</span>
                            <span>Bed: {bedDetails?.bedName || 'N/A'}</span>
                          </div>
                        </GlassCard>

                        <GlassCard className="p-5 flex flex-col justify-between">
                          <div className="space-y-4">
                            <div className="flex items-center gap-2 text-teal-400 border-b border-slate-850 pb-2">
                              <UserIcon size={18} />
                              <h4 className="font-bold text-xs uppercase tracking-wider">Hostel Warden Details</h4>
                            </div>
                            {wardenDetails && wardenDetails.status === 'ACTIVE' ? (
                              <div className="space-y-2.5">
                                <div>
                                  <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Warden Name</p>
                                  <h3 className="text-base font-bold text-slate-100">
                                    {wardenDetails.firstName && wardenDetails.lastName 
                                      ? `${wardenDetails.firstName} ${wardenDetails.lastName}`
                                      : wardenDetails.userDetails 
                                        ? `${wardenDetails.userDetails.firstName} ${wardenDetails.userDetails.lastName}` 
                                        : 'Assigned Warden'}
                                  </h3>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                  <div>
                                    <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Employee ID</p>
                                    <p className="text-xs text-slate-200 font-semibold font-mono">{wardenDetails.employeeId || 'N/A'}</p>
                                  </div>
                                  <div>
                                    <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Assigned Hostel Block</p>
                                    <p className="text-xs text-slate-200 font-semibold">{blockDetails?.name || 'N/A'}</p>
                                  </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                  <div>
                                    <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Contact Number</p>
                                    <p className="text-xs text-brand-400 font-bold font-mono">{wardenDetails.phone || 'N/A'}</p>
                                  </div>
                                  <div>
                                    <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Email Address</p>
                                    <p className="text-xs text-slate-200 font-semibold truncate">{wardenDetails.email || wardenDetails.userDetails?.email || 'N/A'}</p>
                                  </div>
                                </div>
                                <div>
                                  <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Status</p>
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                    {wardenDetails.status || 'ACTIVE'}
                                  </span>
                                </div>
                              </div>
                            ) : (
                              <p className="text-xs text-slate-500 italic py-6 text-center">No specific warden assigned to this building structure yet.</p>
                            )}
                          </div>
                          <div className="border-t border-slate-850 pt-3 mt-4 text-[10px] text-slate-500">
                            Admission Date: {activeAdmission.admissionDate ? new Date(activeAdmission.admissionDate).toLocaleDateString() : 'N/A'}
                          </div>
                        </GlassCard>

                        <GlassCard className="p-5 flex flex-col justify-between">
                          <div className="space-y-2">
                            <div className="flex items-center gap-2 text-indigo-400">
                              <Calendar size={18} />
                              <h4 className="font-bold text-xs uppercase tracking-wider">Attendance Roll Rate</h4>
                            </div>
                            {(() => {
                              const totalAtt = myAttendance.length;
                              const presentAtt = myAttendance.filter(a => a.status === 'PRESENT').length;
                              const leaveAtt = myAttendance.filter(a => a.status === 'LEAVE').length;
                              const absentAtt = myAttendance.filter(a => a.status === 'ABSENT').length;
                              const rate = totalAtt > 0 ? Math.round(((presentAtt + leaveAtt) / totalAtt) * 100) : 100;
                              return (
                                <>
                                  <h3 className="text-2xl font-bold text-slate-100">{rate}%</h3>
                                  <div className="flex items-center gap-2 text-xs text-slate-400 mt-1">
                                    <span className="text-emerald-400 font-bold">{presentAtt} Present</span>
                                    <span>•</span>
                                    <span className="text-amber-400 font-bold">{leaveAtt} Leave</span>
                                    <span>•</span>
                                    <span className="text-red-400 font-bold">{absentAtt} Absent</span>
                                  </div>
                                  <p className="text-[10px] text-slate-500 mt-1">Based on daily warden check-ins</p>
                                </>
                              );
                            })()}
                          </div>
                          <div className="border-t border-slate-850 pt-3 mt-4 text-[10px] text-slate-500 flex justify-between">
                            <span>Checks: {myAttendance.length}</span>
                            <span className="text-teal-400 font-bold font-mono">Roll Log Synced</span>
                          </div>
                        </GlassCard>
                      </div>

                      {/* 2. Leave Request Approval Console & Mess Menu */}
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Leave Approvals Console */}
                        <GlassCard className="p-5 space-y-4">
                          <div className="border-b border-slate-850 pb-2 flex items-center gap-2 text-brand-400">
                            <Clock size={18} />
                            <h4 className="font-bold text-xs uppercase tracking-wider text-slate-100">Ward Leave Approvals Console</h4>
                          </div>

                          {myLeaveRequests.length === 0 ? (
                            <div className="text-center py-10 flex flex-col items-center justify-center gap-2">
                              <Clock size={24} className="text-slate-650" />
                              <p className="text-xs text-slate-455 italic">No leave requests logged for your ward.</p>
                            </div>
                          ) : (
                            <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                              {myLeaveRequests
                                .sort((a, b) => new Date(b.fromDate).getTime() - new Date(a.fromDate).getTime())
                                .map((l) => {
                                  const isPendingParent = l.parentApproval === 'PENDING';
                                  return (
                                    <div key={l.id} className="p-4 bg-slate-900/30 border border-slate-850 rounded-2xl flex flex-col gap-3 hover:border-slate-800 transition-all duration-200">
                                      <div className="flex justify-between items-start">
                                        <div className="space-y-1">
                                          <p className="text-xs font-bold text-slate-200">
                                            {new Date(l.fromDate).toLocaleDateString()} to {new Date(l.toDate).toLocaleDateString()}
                                          </p>
                                          <p className="text-xs text-slate-400 font-medium">Reason: {l.reason}</p>
                                        </div>
                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                                          l.status === 'APPROVED' 
                                            ? 'bg-green-500/10 border-green-500/15 text-green-400' 
                                            : l.status === 'REJECTED'
                                              ? 'bg-red-500/10 border-red-500/15 text-red-400'
                                              : l.status === 'HOLD'
                                                ? 'bg-amber-500/10 border-amber-500/15 text-amber-400'
                                                : 'bg-blue-500/10 border-blue-500/15 text-blue-400'
                                        }`}>
                                          Status: {l.status}
                                        </span>
                                      </div>

                                      <div className="flex flex-wrap items-center gap-2 text-[10px] text-slate-500 border-t border-slate-850/60 pt-2.5">
                                        <span>Parent: <span className="font-bold text-slate-350">{l.parentApproval}</span></span>
                                        <span>•</span>
                                        <span>Warden: <span className="font-bold text-slate-350">{l.wardenApproval}</span></span>
                                        <span>•</span>
                                        <span>Hostel Admin: <span className="font-bold text-slate-350">{l.hostelAdminApproval || 'PENDING'}</span></span>
                                        <span>•</span>
                                        <span>School Admin: <span className="font-bold text-slate-350">{l.adminApproval}</span></span>
                                      </div>

                                      {isPendingParent && (
                                        <div className="flex gap-2 pt-1">
                                          <button
                                            onClick={() => handleHostelLeaveApproval(l.id, 'APPROVED')}
                                            className="px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer transition-all active:scale-95"
                                          >
                                            <Check size={12} /> Approve Leave
                                          </button>
                                          <button
                                            onClick={() => handleHostelLeaveApproval(l.id, 'REJECTED')}
                                            className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer transition-all active:scale-95"
                                          >
                                            <X size={12} /> Reject Leave
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                            </div>
                          )}
                        </GlassCard>

                        {/* Mess Menu Grid */}
                        <GlassCard className="p-5 space-y-4">
                          <div className="border-b border-slate-850 pb-2 flex items-center gap-2 text-brand-400">
                            <Utensils size={18} />
                            <h4 className="font-bold text-xs uppercase tracking-wider text-slate-100">Hostel Mess Menu Planner</h4>
                          </div>

                          {messMenus.length === 0 ? (
                            <div className="text-center py-10 flex flex-col items-center justify-center gap-2">
                              <Coffee size={24} className="text-slate-650 animate-pulse-subtle" />
                              <p className="text-xs text-slate-455 italic">Mess Menu Planner has not been configured for this cycle.</p>
                            </div>
                          ) : (
                            <div className="overflow-x-auto">
                              <table className="w-full text-[11px] text-left border-collapse">
                                <thead>
                                  <tr className="border-b border-slate-850 text-slate-400 uppercase tracking-widest text-[9px]">
                                    <th className="py-2">Day</th>
                                    <th className="py-2">Breakfast</th>
                                    <th className="py-2">Lunch</th>
                                    <th className="py-2">Dinner</th>
                                    <th className="py-2">Special Menu</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-850">
                                  {(() => {
                                    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
                                    return days.map((dayName, idx) => {
                                      const menu = messMenus.find(m => m.dayOfWeek === idx);
                                      return (
                                        <tr key={idx} className="hover:bg-slate-900/30 text-slate-300">
                                          <td className="py-2.5 font-semibold text-brand-400">{dayName}</td>
                                          <td className="py-2.5 max-w-[100px] truncate" title={menu?.breakfast || '-'}>{menu?.breakfast || '-'}</td>
                                          <td className="py-2.5 max-w-[100px] truncate" title={menu?.lunch || '-'}>{menu?.lunch || '-'}</td>
                                          <td className="py-2.5 max-w-[100px] truncate" title={menu?.dinner || '-'}>{menu?.dinner || '-'}</td>
                                          <td className="py-2.5 text-indigo-400 truncate max-w-[100px]" title={menu?.specialMenu || '-'}>{menu?.specialMenu || '-'}</td>
                                        </tr>
                                      );
                                    });
                                  })()}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </GlassCard>
                      </div>

                      {/* 3. Complaints & Visitors Logs */}
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Complaints List */}
                        <GlassCard className="p-5 space-y-4">
                          <div className="border-b border-slate-850 pb-2 flex items-center gap-2 text-brand-400">
                            <ShieldAlert size={18} />
                            <h4 className="font-bold text-xs uppercase tracking-wider text-slate-100">Ward Maintenance Complaints Log</h4>
                          </div>

                          {myComplaints.length === 0 ? (
                            <div className="text-center py-10 flex flex-col items-center justify-center gap-2">
                              <ShieldAlert size={24} className="text-slate-650" />
                              <p className="text-xs text-slate-455 italic">No complaints logged for this ward.</p>
                            </div>
                          ) : (
                            <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
                              {myComplaints
                                .sort((a, b) => b.status.localeCompare(a.status))
                                .map((c) => (
                                  <div key={c.id} className="p-3 bg-slate-900/30 border border-slate-850 rounded-xl flex flex-col gap-2 hover:border-slate-800 transition-all duration-200">
                                    <div className="flex justify-between items-center text-xs">
                                      <span className="font-bold text-brand-400">{c.category}</span>
                                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${
                                        c.status === 'RESOLVED' || c.status === 'CLOSED'
                                          ? 'bg-emerald-500/10 border-emerald-500/15 text-emerald-400'
                                          : c.status === 'ASSIGNED'
                                            ? 'bg-indigo-500/10 border-indigo-500/15 text-indigo-400'
                                            : 'bg-amber-500/10 border-amber-500/15 text-amber-400'
                                      }`}>
                                        {c.status}
                                      </span>
                                    </div>
                                    <p className="text-xs text-slate-300 leading-normal">{c.description}</p>
                                    <div className="text-[10px] text-slate-500 border-t border-slate-850/40 pt-2 flex flex-col gap-1">
                                      <p>Assigned Staff: <span className="font-medium text-slate-450">{c.assignedStaff || 'Unassigned'}</span></p>
                                      {c.resolutionNotes && <p>Resolution: <span className="font-semibold text-slate-300 italic">{c.resolutionNotes}</span></p>}
                                    </div>
                                  </div>
                                ))}
                            </div>
                          )}
                        </GlassCard>

                        {/* Visitors Log Card */}
                        <GlassCard className="p-5 space-y-4">
                          <div className="border-b border-slate-850 pb-2 flex items-center gap-2 text-brand-400">
                            <ClipboardList size={18} />
                            <h4 className="font-bold text-xs uppercase tracking-wider text-slate-100">Ward Visitor Log Book</h4>
                          </div>

                          {myVisitors.length === 0 ? (
                            <div className="text-center py-10 flex flex-col items-center justify-center gap-2">
                              <ClipboardList size={24} className="text-slate-650" />
                              <p className="text-xs text-slate-455 italic">No visitor entry logs registered for this student.</p>
                            </div>
                          ) : (
                            <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
                              {myVisitors
                                .sort((a, b) => new Date(b.entryTime).getTime() - new Date(a.entryTime).getTime())
                                .map((v) => (
                                  <div key={v.id} className="p-3 bg-slate-900/30 border border-slate-850 rounded-xl flex items-center justify-between text-xs hover:border-slate-800 transition-all duration-200">
                                    <div className="space-y-1">
                                      <p className="font-bold text-slate-200">{v.visitorName} <span className="text-[10px] text-slate-450 font-normal">({v.relation})</span></p>
                                      <p className="text-[10px] text-slate-450">Purpose: {v.purpose}</p>
                                      <p className="text-[9px] text-slate-500 font-mono">In: {new Date(v.entryTime).toLocaleString()}</p>
                                    </div>
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase border ${
                                      v.exitTime 
                                        ? 'bg-emerald-500/10 border-emerald-500/15 text-emerald-400' 
                                        : 'bg-rose-500/10 border-rose-500/15 text-rose-400'
                                    }`}>
                                      {v.exitTime ? `Out: ${new Date(v.exitTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Inside Building'}
                                    </span>
                                  </div>
                                ))}
                            </div>
                          )}
                        </GlassCard>
                      </div>

                      {/* 4. Hostel Invoices / Billing & Payments Ledger */}
                      <GlassCard className="p-5 space-y-4">
                        <div className="border-b border-slate-850 pb-2 flex items-center gap-2 text-brand-400">
                          <DollarSign size={18} />
                          <h4 className="font-bold text-xs uppercase tracking-wider text-slate-100">Hostel Fees Ledger & Invoices</h4>
                        </div>

                        {myFees.length === 0 ? (
                          <div className="text-center py-10 flex flex-col items-center justify-center gap-2">
                            <DollarSign size={24} className="text-slate-650 animate-pulse-subtle" />
                            <p className="text-xs text-slate-455 italic">No hostel-related fee structures defined for this school.</p>
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {myFees.map((fee) => {
                              const paymentRecord = myPayments.find(p => p.feeId === fee.id);
                              const isPaid = paymentRecord?.status === 'PAID';
                              return (
                                <div key={fee.id} className="p-4 bg-slate-900/30 border border-slate-850 rounded-2xl flex flex-col justify-between gap-4 hover:border-slate-800 transition-all duration-200">
                                  <div className="space-y-1">
                                    <div className="flex justify-between items-center">
                                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest font-mono">{fee.feeType}</span>
                                      <span className={`text-[9.5px] font-bold px-2 py-0.5 rounded-full uppercase border ${
                                        isPaid 
                                          ? 'bg-green-500/10 border-green-500/15 text-green-400' 
                                          : 'bg-red-500/10 border-red-500/15 text-red-400'
                                      }`}>
                                        {isPaid ? 'PAID' : 'UNPAID'}
                                      </span>
                                    </div>
                                    <h4 className="font-bold text-slate-200 text-sm mt-2">{fee.name}</h4>
                                    <p className="text-xs text-slate-450 mt-1">{fee.description || 'Hostel services accommodation billing component.'}</p>
                                  </div>

                                  <div className="pt-3 border-t border-slate-850 flex items-center justify-between">
                                    <div>
                                      <p className="text-xs text-slate-400">Fee Amount</p>
                                      <p className="text-sm font-bold text-slate-100">{studentSchool?.currencySymbol || '$'}{fee.amount.toFixed(2)}</p>
                                    </div>
                                    {!isPaid ? (
                                      <button
                                        onClick={() => handleHostelFeePayment(fee.id, fee.amount)}
                                        className="px-3 py-1.5 bg-brand-500/15 hover:bg-brand-500/25 border border-brand-500/30 rounded-xl text-xs font-bold text-brand-400 cursor-pointer active:scale-95 transition-all"
                                      >
                                        Process Online Payment
                                      </button>
                                    ) : (
                                      <div className="text-[9.5px] text-slate-500 text-right">
                                        <p>Paid: {new Date(paymentRecord.paymentDate).toLocaleDateString()}</p>
                                        <p>Ref: {paymentRecord.txId || paymentRecord.id.substring(0, 8)}</p>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </GlassCard>
                    </div>
                  )}
                </div>
              </PremiumLock>
            )}

            {activeTab === 'ptm' && (
              <PremiumLock
                isLocked={isTabLockedByEntitlements('PARENT', 'ptm', ent)}
                requiredTier="Pro"
                featureName="PTM Meetings"
              >
                <ParentPTMManagement />
              </PremiumLock>
            )}

            {activeTab === 'notifications' && (
              <div className="space-y-6 animate-fade-in text-slate-200">
                {/* 1. Header with Stats & Actions */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Unread count stats card */}
                  <GlassCard className="flex items-center gap-4">
                    <div className="w-11 h-11 rounded-xl bg-brand-500/10 border border-brand-500/25 flex items-center justify-center">
                      <Bell className="text-brand-400 animate-pulse-subtle" size={20} />
                    </div>
                    <div>
                      <span className="block text-[10px] text-slate-500 uppercase font-bold font-mono tracking-widest leading-none">Unread Alerts</span>
                      <h4 className="text-lg font-bold text-slate-200 mt-1">
                        {notifications.filter(n => !n.isRead).length} <span className="text-xs font-normal text-slate-400">pending notices</span>
                      </h4>
                    </div>
                  </GlassCard>

                  {/* Search box card */}
                  <GlassCard className="flex items-center gap-3">
                    <div className="relative w-full">
                      <Search className="absolute left-3 top-2.5 text-slate-500" size={14} />
                      <input
                        type="text"
                        placeholder="Search alerts by title or content..."
                        value={notifSearchQuery}
                        onChange={(e) => setNotifSearchQuery(e.target.value)}
                        className="bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-xl pl-9 pr-3 py-2 w-full focus:outline-none focus:border-brand-500 font-sans"
                      />
                    </div>
                  </GlassCard>

                  {/* Mark all read button card */}
                  <GlassCard className="flex items-center justify-center">
                    <button
                      onClick={async () => {
                        const unread = notifications.filter(n => !n.isRead);
                        if (unread.length === 0) return;
                        setLoading(true);
                        for (const n of unread) {
                          await mockApi.markNotificationAsRead(n.id).catch(() => {});
                        }
                        await loadAcademicRecord();
                        setLoading(false);
                        alert('All notifications marked as read!');
                      }}
                      disabled={notifications.filter(n => !n.isRead).length === 0}
                      className="px-4 py-2 bg-brand-500/15 hover:bg-brand-500/25 border border-brand-500/30 rounded-xl text-xs font-bold text-brand-400 cursor-pointer active:scale-95 disabled:opacity-40 disabled:pointer-events-none transition-all flex items-center gap-1.5 font-sans"
                    >
                      <Check size={14} />
                      <span>Mark All as Read</span>
                    </button>
                  </GlassCard>
                </div>

                {/* 2. Category Filters & Notifications Timeline */}
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                  {/* Category tabs */}
                  <GlassCard className="space-y-3 lg:col-span-1">
                    <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">Filter By Category</span>
                    <nav className="space-y-1">
                      {[
                        { id: 'all', label: 'All Categories' },
                        { id: 'Attendance', label: 'Attendance' },
                        { id: 'Homework', label: 'Homework' },
                        { id: 'Assignment', label: 'Assignment' },
                        { id: 'Quiz', label: 'Quiz' },
                        { id: 'Exam', label: 'Exam' },
                        { id: 'Hostel', label: 'Hostel' },
                        { id: 'Fee', label: 'Fee' },
                        { id: 'Announcement', label: 'Announcement' },
                        { id: 'Emergency', label: 'Emergency Alert' }
                      ].map(cat => {
                        const count = notifications.filter(n => {
                          const matchesCat = cat.id === 'all' || (n.category || '').toLowerCase() === cat.id.toLowerCase();
                          return matchesCat && !n.isRead;
                        }).length;

                        return (
                          <button
                            key={cat.id}
                            onClick={() => setNotifCategoryFilter(cat.id)}
                            className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                              notifCategoryFilter === cat.id
                                ? 'bg-brand-600/10 border border-brand-500/25 text-brand-400 font-semibold'
                                : 'border border-transparent text-slate-400 hover:text-slate-100 hover:bg-slate-900/45'
                            }`}
                          >
                            <span>{cat.label}</span>
                            {count > 0 && (
                              <span className="bg-brand-500/20 text-brand-400 text-[10px] font-bold px-1.5 py-0.5 rounded-full border border-brand-500/30">
                                {count}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </nav>
                  </GlassCard>

                  {/* List of notifications */}
                  <GlassCard className="lg:col-span-3 space-y-4">
                    <h3 className="font-bold text-slate-200 text-sm pb-2 border-b border-slate-850">Alerts History Log</h3>

                    <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                      {(() => {
                        const filtered = notifications.filter(n => {
                          const matchesCat = notifCategoryFilter === 'all' || (n.category || '').toLowerCase() === notifCategoryFilter.toLowerCase();
                          const matchesQuery = !notifSearchQuery ||
                            n.title.toLowerCase().includes(notifSearchQuery.toLowerCase()) ||
                            n.message.toLowerCase().includes(notifSearchQuery.toLowerCase());
                          return matchesCat && matchesQuery;
                        });

                        if (filtered.length === 0) {
                          return (
                            <div className="text-center py-12 text-slate-500 text-xs italic">
                              No notifications match your current filter selections.
                            </div>
                          );
                        }

                        return filtered.map((n) => {
                          const senderObj = mockDb.users.find(u => u.id === n.senderId);
                          const senderName = senderObj ? `${senderObj.firstName} ${senderObj.lastName}` : 'Aegis Core Gateway';
                          
                          return (
                            <div
                              key={n.id}
                              onClick={async () => {
                                if (!n.isRead) {
                                  await mockApi.markNotificationAsRead(n.id);
                                  await loadAcademicRecord();
                                }
                              }}
                              className={`p-4 border rounded-2xl flex flex-col gap-3 transition-all duration-200 ${
                                n.isRead
                                  ? 'bg-slate-900/10 border-slate-850/50 hover:border-slate-800 cursor-default'
                                  : 'bg-brand-500/5 border-brand-500/20 hover:border-brand-500/40 cursor-pointer shadow-md'
                              }`}
                            >
                              <div className="flex justify-between items-start gap-4">
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <h4 className={`font-bold text-xs ${n.isRead ? 'text-slate-300' : 'text-slate-100 font-semibold'}`}>
                                      {n.title}
                                    </h4>
                                    {!n.isRead && (
                                      <span className="w-1.5 h-1.5 rounded-full bg-brand-500 shrink-0" title="Unread Notice" />
                                    )}
                                  </div>
                                  <p className="text-[10px] text-slate-550">
                                    Sent by: <span className="font-semibold text-slate-400">{senderName}</span>
                                  </p>
                                </div>

                                <div className="flex items-center gap-2">
                                  <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase border ${
                                    n.priority === 'HIGH'
                                      ? 'bg-red-500/10 border-red-500/15 text-red-400'
                                      : 'bg-slate-900 border-slate-800 text-slate-400'
                                  }`}>
                                    {n.priority || 'MEDIUM'}
                                  </span>

                                  <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase border ${
                                    n.category === 'Emergency' ? 'bg-red-500/10 border-red-500/15 text-red-400' :
                                    n.category === 'Fee' ? 'bg-amber-500/10 border-amber-500/15 text-amber-400' :
                                    n.category === 'Attendance' ? 'bg-teal-500/10 border-teal-500/15 text-teal-400' :
                                    'bg-blue-500/10 border-blue-500/15 text-blue-400'
                                  }`}>
                                    {n.category || 'Announcement'}
                                  </span>
                                </div>
                              </div>

                              <p className="text-xs text-slate-400 leading-relaxed font-sans">
                                {n.message}
                              </p>

                              <div className="flex justify-between items-center text-[9.5px] text-slate-505 border-t border-slate-850/30 pt-2 font-mono">
                                <span>Ref: #{n.id.substring(0, 8)}</span>
                                <span>{new Date(n.createdAt).toLocaleString()}</span>
                              </div>
                            </div>
                          );
                        });
                      })()}
                    </div>
                  </GlassCard>
                </div>
              </div>
            )}

      {/* Invoice Detail Modal (Reference Layout Mock) */}
      {selectedInvoice && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs flex items-start justify-center overflow-y-auto z-50 p-4">
          <div className="bg-white text-slate-800 rounded-2xl max-w-[800px] w-full my-8 shadow-2xl border border-slate-200 overflow-hidden animate-fade-in font-sans">
            {/* Modal Controls Bar */}
            <div className="bg-slate-900 text-slate-100 p-4 flex justify-between items-center border-b border-slate-850">
              <h3 className="font-bold text-xs uppercase tracking-wider">Invoice Registry Preview</h3>
              <div className="flex gap-2">
                <button
                  onClick={() => downloadInvoicePdf(selectedInvoice, false)}
                  className="px-2.5 py-1 bg-brand-600 hover:bg-brand-500 text-white rounded-lg text-[10px] font-bold flex items-center gap-1 active:scale-95 transition-all cursor-pointer"
                >
                  <Download size={11} /> Download A4 PDF
                </button>
                <button
                  onClick={() => setSelectedInvoice(null)}
                  className="p-1 text-slate-400 hover:text-slate-200 cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* A4 Reference Invoice Wrapper */}
            <div className="p-8 space-y-6" style={{ minHeight: '800px' }}>
              {/* Header Branding */}
              <div className="flex justify-between items-start border-b-2 border-emerald-500 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-14 h-14 border-radius-12 bg-emerald-50 border border-emerald-200 flex items-center justify-center font-bold text-emerald-700 text-2xl">
                    {selectedInvoice.logoUrl ? (
                      <img src={selectedInvoice.logoUrl} className="w-full h-full object-cover rounded-xl" />
                    ) : selectedInvoice.schoolName.substring(0,1)}
                  </div>
                  <div>
                    <h2 className="text-base font-extrabold text-emerald-900 uppercase leading-tight">{selectedInvoice.schoolName}</h2>
                    <p className="text-[9px] text-emerald-600 font-semibold tracking-wider uppercase mt-1">Reference Invoice Layout</p>
                  </div>
                </div>

                <div className="text-right">
                  <span className={`text-[9px] font-black uppercase px-2.5 py-0.5 rounded-full ${
                    selectedInvoice.status === 'PAID' ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-200' : 'bg-amber-500/10 text-amber-600 border border-amber-200'
                  }`}>
                    {selectedInvoice.status}
                  </span>
                  <h3 className="text-sm font-extrabold text-slate-900 mt-2 uppercase">Invoice</h3>
                  <p className="text-[10px] font-mono text-slate-500 mt-0.5">#{selectedInvoice.invoiceNumber}</p>
                </div>
              </div>

              {/* School Details & Invoice Metadata */}
              <div className="grid grid-cols-2 gap-6 text-[10px] text-slate-650">
                <div className="space-y-1">
                  <p>📍 {selectedInvoice.schoolAddress}</p>
                  <p>📞 {selectedInvoice.schoolPhone}</p>
                  <p>✉️ {selectedInvoice.schoolEmail}</p>
                  {selectedInvoice.schoolWebsite && <p>🌐 {selectedInvoice.schoolWebsite}</p>}
                  <p className="text-[8px] text-slate-500 mt-2">GSTIN: 09ABCDE1234F1ZS | Affiliation: 2130456 | UDISE: 091234567890</p>
                </div>
                <div className="border-l border-emerald-50 pl-5 grid grid-cols-2 gap-x-2 gap-y-1 text-slate-700 font-medium">
                  <span className="text-slate-500 font-bold">Bill Date:</span>
                  <span>{new Date(selectedInvoice.billDate).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                  
                  <span className="text-slate-500 font-bold">Due Date:</span>
                  <span>{new Date(selectedInvoice.dueDate).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })}</span>

                  {selectedInvoice.status === 'PAID' && selectedInvoice.paymentDate && (
                    <>
                      <span className="text-slate-500 font-bold">Payment Date:</span>
                      <span>{new Date(selectedInvoice.paymentDate).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                    </>
                  )}

                  <span className="text-slate-500 font-bold">Billing Cycle:</span>
                  <span>{selectedInvoice.billingCycle}</span>

                  <span className="text-slate-500 font-bold">Academic Year:</span>
                  <span>{selectedInvoice.academicYear}</span>
                </div>
              </div>

              {/* Billed To / Parent Details Split */}
              <div className="grid grid-cols-2 gap-6 border-t border-b border-slate-100 py-4">
                <div>
                  <h4 className="text-[10px] font-black text-emerald-700 uppercase tracking-wide mb-2">Billed To</h4>
                  <div className="flex gap-2.5 items-center">
                    <div className="w-10 h-10 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700 font-extrabold text-sm overflow-hidden">
                      {selectedInvoice.studentPhoto ? (
                        <img src={selectedInvoice.studentPhoto} className="w-full h-full object-cover" />
                      ) : selectedInvoice.studentName.substring(0, 1)}
                    </div>
                    <div className="text-[10px] line-height-1.3 text-slate-650">
                      <strong className="text-slate-900 uppercase block font-bold">{selectedInvoice.studentName}</strong>
                      <p>Class: {selectedInvoice.studentClass}</p>
                      <p>Roll No: {selectedInvoice.studentRollNo}</p>
                      <p className="font-mono text-slate-500">Student ID: {selectedInvoice.studentId}</p>
                    </div>
                  </div>
                </div>

                <div className="border-l border-slate-50 pl-5">
                  <h4 className="text-[10px] font-black text-emerald-700 uppercase tracking-wide mb-2">Parent / Guardian</h4>
                  <div className="text-[10px] line-height-1.3 text-slate-650">
                    <strong className="text-slate-900 block font-bold">{selectedInvoice.parentName} <span className="text-[8.5px] font-normal text-slate-500">({selectedInvoice.parentRelation})</span></strong>
                    <p className="mt-1">📞 {selectedInvoice.parentPhone}</p>
                    <p>✉️ {selectedInvoice.parentEmail}</p>
                  </div>
                </div>
              </div>

              {/* Fee Component breakdown table */}
              <div>
                <table className="w-full text-left text-[10px] border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-slate-900 border-b-2 border-slate-200 font-bold uppercase">
                      <th className="py-2 px-3 width-6">#</th>
                      <th className="py-2 px-3">Description</th>
                      <th className="py-2 px-3 text-right">Amount</th>
                      <th className="py-2 px-3 text-right">Discount</th>
                      <th className="py-2 px-3 text-right">Late Fee</th>
                      <th className="py-2 px-3 text-right">Tax</th>
                      <th className="py-2 px-3 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-600">
                    {(selectedInvoice.feeItems && selectedInvoice.feeItems.length > 0
                      ? selectedInvoice.feeItems
                      : [{ description: selectedInvoice.description || 'Institutional Tuition Fee', amount: selectedInvoice.amount }]
                    ).map((item: any, itemIdx: number) => {
                      const itemAmount = Number(item.amount) || 0;
                      const itemDiscount = Number(item.discount) || 0;
                      const itemLateFee = Number(item.lateFee) || 0;
                      const itemTax = Number(item.tax) || 0;
                      const itemTotal = itemAmount - itemDiscount + itemLateFee + itemTax;
                      return (
                        <tr key={itemIdx}>
                          <td className="py-2.5 px-3">{itemIdx + 1}</td>
                          <td className="py-2.5 px-3 font-semibold text-slate-900">{item.description}</td>
                          <td className="py-2.5 px-3 text-right">{itemAmount.toFixed(2)}</td>
                          <td className="py-2.5 px-3 text-right">{itemDiscount.toFixed(2)}</td>
                          <td className="py-2.5 px-3 text-right">{itemLateFee.toFixed(2)}</td>
                          <td className="py-2.5 px-3 text-right">{itemTax.toFixed(2)}</td>
                          <td className="py-2.5 px-3 text-right font-bold text-slate-900">{itemTotal.toFixed(2)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Totals & QR Block */}
              <div className="flex justify-between items-start border-t border-slate-100 pt-4 gap-6">
                <div className="max-w-[50%]">
                  <h5 className="text-[9px] font-bold text-slate-900 uppercase">Amount In Words</h5>
                  <p className="text-[10px] text-emerald-700 italic font-semibold mt-1">
                    Rupees {selectedInvoice.amount.toLocaleString('en-IN')} Only
                  </p>
                </div>

                <div className="w-[200px] text-[10px] grid grid-cols-2 gap-y-1.5 text-right font-semibold text-slate-700">
                  <span className="text-slate-500 font-normal">Subtotal</span>
                  <span>{selectedInvoice.currencySymbol}{selectedInvoice.amount.toFixed(2)}</span>

                  <span className="text-slate-500 font-normal">Discount</span>
                  <span>0.00</span>

                  <span className="text-slate-500 font-normal">Tax</span>
                  <span>0.00</span>

                  <span className="text-emerald-700 font-extrabold text-[11px] border-t border-slate-100 pt-1.5">Grand Total</span>
                  <span className="text-emerald-700 font-extrabold text-[11px] border-t border-slate-100 pt-1.5">{selectedInvoice.currencySymbol}{selectedInvoice.amount.toFixed(2)}</span>
                </div>
              </div>

              {/* Signature Footer & Seal */}
              <div className="flex justify-between items-center border-t border-slate-100 pt-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 border border-slate-200">
                    <img src={`https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=https://www.aegiserp.xyz/verify/invoice/${selectedInvoice.invoiceNumber}`} className="w-full h-full" />
                  </div>
                  <div className="text-[8px] text-slate-500 leading-tight">
                    <strong className="text-slate-900 uppercase font-bold">QR Registry Verification</strong>
                    <p className="mt-0.5">This invoice is dynamically catalogued in the school blockchain.</p>
                  </div>
                </div>

                <div className="text-center w-[120px] text-[9px] relative font-semibold text-slate-500">
                  {selectedInvoice.sealUrl && (
                    <img src={selectedInvoice.sealUrl} className="absolute left-[38px] top-[-20px] w-10 h-10 opacity-70 pointer-events-none" />
                  )}
                  <span className="font-serif italic text-emerald-800 text-xs block h-6 leading-6">School Principal</span>
                  <span className="border-t border-slate-200 pt-1 block uppercase tracking-wide">Principal / Registrar</span>
                </div>
              </div>

              {/* Disclaimer */}
              <div className="p-2.5 bg-slate-50 border border-slate-200 text-center rounded-xl text-[9px] text-slate-500 leading-normal">
                This is a secure system-generated billing invoice. Does not require manual physical signature.
              </div>

              {/* Watermark */}
              <div className="border-t border-dashed border-slate-200 pt-2.5 flex justify-between items-center text-[8px] text-slate-400 font-bold uppercase tracking-wider">
                <div className="flex items-center gap-1.5">
                  <img src="/aegis-logo.png" className="w-3.5 h-3.5 object-contain" />
                  <span>Powered by AEGIS ERP – Institutional Cloud</span>
                </div>
                <span>&copy; 2026 AEGIS ERP. All rights reserved.</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Invoice History Log Timeline Modal */}
      {historyInvoice && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <GlassCard className="max-w-md w-full p-5 space-y-4 animate-fade-in">
            <div className="flex justify-between items-center border-b border-slate-850 pb-2.5">
              <h3 className="font-bold text-slate-100 text-xs uppercase tracking-wider flex items-center gap-1.5">
                <History size={14} className="text-brand-500" /> Payment Audit Timeline
              </h3>
              <button
                onClick={() => setHistoryInvoice(null)}
                className="text-slate-400 hover:text-slate-200 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-4 py-2 font-mono text-[10px]">
              {/* Step 1: Invoiced */}
              <div className="flex gap-3">
                <div className="flex flex-col items-center">
                  <div className="w-2.5 h-2.5 rounded-full bg-brand-500" />
                  <div className="w-0.5 h-10 bg-slate-800" />
                </div>
                <div className="space-y-0.5">
                  <strong className="text-slate-200 block text-xs">Fee Invoice Published</strong>
                  <span className="text-slate-450 block">Invoiced: {new Date(historyInvoice.billDate).toLocaleString()}</span>
                  <span className="text-[9px] text-slate-500">Ref: INV_GEN_AUDIT_LOG_SUCCESS</span>
                </div>
              </div>

              {/* Step 2: Verification Pending */}
              {historyInvoice.status !== 'UNPAID' && (
                <div className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                    {historyInvoice.status === 'PAID' && <div className="w-0.5 h-10 bg-slate-800" />}
                  </div>
                  <div className="space-y-0.5">
                    <strong className="text-slate-200 block text-xs">Payment Deposited / Submitted</strong>
                    <span className="text-slate-450 block">Submitted: {new Date(historyInvoice.payment?.paymentDate || historyInvoice.dueDate).toLocaleString()}</span>
                    <span className="text-[9px] text-slate-500">Channel: {historyInvoice.payment?.paymentMethod || 'Online Checkout'}</span>
                  </div>
                </div>
              )}

              {/* Step 3: Cleared */}
              {historyInvoice.status === 'PAID' && (
                <div className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
                  </div>
                  <div className="space-y-0.5">
                    <strong className="text-slate-200 block text-xs">Clearance Verification Verified</strong>
                    <span className="text-slate-450 block">Cleared: {new Date(historyInvoice.payment.paymentDate).toLocaleString()}</span>
                    <span className="text-[9px] text-slate-500">Receipt No: {historyInvoice.payment.transactionId}</span>
                  </div>
                </div>
              )}

              {historyInvoice.status === 'UNPAID' && (
                <div className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
                  </div>
                  <div className="space-y-0.5">
                    <strong className="text-rose-400 block text-xs">Awaiting Settlement</strong>
                    <span className="text-slate-400 block">Due Date: {new Date(historyInvoice.dueDate).toLocaleDateString()}</span>
                    <span className="text-[9px] text-rose-500/80">Reminder sent automatically to parent dashboard</span>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setHistoryInvoice(null)}
                className="px-3 py-1 bg-slate-900 hover:bg-slate-850 text-slate-350 rounded-lg text-[10px] font-bold cursor-pointer"
              >
                Close Audit Log
              </button>
            </div>
          </GlassCard>
        </div>
      )}
          </div>
        )
      )}
    </div>
  );
};
