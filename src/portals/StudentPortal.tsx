import React, { useState, useEffect } from 'react';
import { useStore } from '../store/useStore';
import { mockApi } from '../services/mockApi';
import { mockDb } from '../services/mockDb';
import { supabase } from '../lib/supabase';
import { 
  Timetable, Assignment, AssignmentSubmission, Quiz, QuizAttempt, 
  Subject, ExamSchedule, ExamMark, StudyMaterial, Announcement, ForumPost,
  Hostel, HostelBlock, HostelRoom, HostelBed, HostelWarden, HostelAdmission,
  HostelAttendance, HostelFee, HostelPayment, HostelLeaveRequest, HostelVisitor,
  HostelComplaint, HostelMessMenu
} from '../types';
import { GlassCard } from '../components/GlassCard';
import { 
  Calendar, Clock, BookOpen, PenTool, Award, Download, 
  ExternalLink, UploadCloud, MessageCircle, DollarSign, PlayCircle,
  Paperclip, Trash2, Loader2, CheckCircle, X, FileText, AlertCircle, Eye, ClipboardList,
  BookMarked, Layers, Home, User, Coffee, HelpCircle, Activity, Utensils, ShieldAlert,
  Printer, Share2, History, Plus, Search, Filter
} from 'lucide-react';
import PremiumLock from '../components/PremiumLock';
import { downloadFile } from '../utils/downloadHelper';
import { subscriptionPlans, isTabLocked, isTabLockedByEntitlements } from '../services/subscriptionConfig';
import { useFeatureEntitlements } from '../hooks/useFeatureEntitlements';
import { downloadMarksheetPdf } from '../components/MarksheetTemplate';
import { downloadReceiptPdf } from '../components/ReceiptTemplate';
import { downloadInvoicePdf } from '../components/InvoiceTemplate';
import { 
  downloadStudentIdCardPdf, downloadAdmissionFormPdf, 
  downloadBonafideCertificatePdf,
  downloadAdmissionRecordPdf,
  downloadCharacterCertificatePdf,
  downloadTransferCertificatePdf,
} from '../components/DocumentTemplates';
import {
  fetchStudentDocData,
  fetchSchoolDocData,
  fetchPrincipalDocData,
  checkDocumentGenerated,
} from '../services/documentService';
import type { GeneratedDocument } from '../types';

import { ClassDiscussion } from '../components/ClassDiscussion';
import { StudentPTMManagement } from '../components/PTMManagement';

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

export const StudentPortal: React.FC<{ activeTab: string }> = ({ activeTab: rawActiveTab }) => {
  const activeTab = rawActiveTab.split('/')[0];
  const { session, syncSubscriptionPlan } = useStore();
  const studentId = session?.studentId;
  const currentPlanName = session?.schoolSubscriptionPlan || 'freemium';
  const plan = subscriptionPlans[currentPlanName] || subscriptionPlans.freemium;
  const ent = useFeatureEntitlements();

  // General States
  const [timetable, setTimetable] = useState<Timetable[]>([]);
  const [assignments, setAssignments] = useState<{ assignment: Assignment; submission?: AssignmentSubmission }[]>([]);
  const [grades, setGrades] = useState<{ schedule: ExamSchedule; mark?: ExamMark; subject: Subject; examName: string }[]>([]);
  const [quizzes, setQuizzes] = useState<{ quiz: Quiz; attempt?: QuizAttempt }[]>([]);
  const [materials, setMaterials] = useState<(StudyMaterial & { subjectName: string; teacherName: string })[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [forumPosts, setForumPosts] = useState<(ForumPost & { schoolId: string; authorName: string; categoryName: string; repliesCount: number })[]>([]);
  const [fees, setFees] = useState<{ structure: any; payment?: any }[]>([]);
  const [reportCards, setReportCards] = useState<any[]>([]);
  const [docGenerating, setDocGenerating] = useState<string>('');
  const [characterCertDoc, setCharacterCertDoc] = useState<GeneratedDocument | null | undefined>(undefined); // undefined = not yet checked
  const [transferCertDoc, setTransferCertDoc] = useState<GeneratedDocument | null | undefined>(undefined); // undefined = not yet checked
  const [selectedInvoice, setSelectedInvoice] = useState<any | null>(null);
  const [invoiceFilter, setInvoiceFilter] = useState<'ALL' | 'PAID' | 'PENDING' | 'OVERDUE'>('ALL');
  const [historyInvoice, setHistoryInvoice] = useState<any | null>(null);

  /**
   * Official student photo URL from student_profiles.photo_url (System 1: Academic).
   * Fetched with school_id + student_id isolation to prevent cross-student/cross-tenant leakage.
   */
  const [studentPhotoUrl, setStudentPhotoUrl] = useState<string>('');

  /**
   * Personal profile photo URL for portal UI display (System 2: Personal Avatar).
   * Source: users.profile_photo_url → users.avatar_url.
   * Used in: Banner, Navbar, Chat, Dashboard avatar.
   * NEVER used on official documents (ID Cards, Certificates, Marksheets).
   */
  const [profilePhotoDisplayUrl, setProfilePhotoDisplayUrl] = useState<string>('');

  // Dynamic Library & Transport States
  const [transitAssignment, setTransitAssignment] = useState<any>(null);
  const [assignedRoute, setAssignedRoute] = useState<any>(null);
  const [assignedBus, setAssignedBus] = useState<any>(null);
  const [assignedPickupPoint, setAssignedPickupPoint] = useState<any>(null);
  const [assignedDriver, setAssignedDriver] = useState<any>(null);

  const [issuedBooks, setIssuedBooks] = useState<any[]>([]);
  const [libraryFines, setLibraryFines] = useState<any[]>([]);
  const [digitalLibraryAssets, setDigitalLibraryAssets] = useState<any[]>([]);
  const [libraryBooks, setLibraryBooks] = useState<any[]>([]);

  // Interactive Action States
  const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null);
  const [submittingText, setSubmittingText] = useState('');
  const [submittingFile, setSubmittingFile] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [uploadState, setUploadState] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [uploadError, setUploadError] = useState<string>('');
  
  // Video player state
  const [activeVideoUrl, setActiveVideoUrl] = useState<string | null>(null);

  // Quiz active state
  const [activeQuiz, setActiveQuiz] = useState<Quiz | null>(null);
  const [quizQuestions, setQuizQuestions] = useState<any[]>([]);
  const [quizAnswers, setQuizAnswers] = useState<Record<string, number>>({});
  const [quizDurationLeft, setQuizDurationLeft] = useState(0);

  // Discussion state
  const [forumCategories, setForumCategories] = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<any | null>(null);
  const [postTitle, setPostTitle] = useState('');
  const [postContent, setPostContent] = useState('');
  const [postCategoryId, setPostCategoryId] = useState('');
  const [selectedPost, setSelectedPost] = useState<any | null>(null);
  const [postReplies, setPostReplies] = useState<any[]>([]);
  const [replyText, setReplyText] = useState('');

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
  const [myVisitorLogs, setMyVisitorLogs] = useState<HostelVisitor[]>([]);
  const [myPayments, setMyPayments] = useState<HostelPayment[]>([]);

  // Hostel Form States
  const [leaveFromDate, setLeaveFromDate] = useState('');
  const [leaveToDate, setLeaveToDate] = useState('');
  const [leaveReason, setLeaveReason] = useState('');

  const [complaintCategory, setComplaintCategory] = useState<'ROOM' | 'ELECTRICITY' | 'WATER' | 'MAINTENANCE' | 'OTHER'>('ROOM');
  const [complaintDescription, setComplaintDescription] = useState('');

  // ── Fetch academic photo (System 1) + personal profile photo (System 2) separately ──
  useEffect(() => {
    const schoolId = session?.user?.schoolId;
    const entity = mockDb.students.find(s => s.id === studentId);
    const dbStudentId = entity?.id || studentId;

    if (!dbStudentId || !schoolId) return;

    let cancelled = false;
    (async () => {
      try {
        // System 1: Official Academic Photo (student_profiles.photo_url)
        // Used ONLY for official documents — NOT for portal UI avatar
        const { data: spData, error: spErr } = await supabase
          .from('student_profiles')
          .select('photo_url, student_id, school_id')
          .eq('student_id', dbStudentId)
          .eq('school_id', schoolId)
          .maybeSingle();

        if (!cancelled && !spErr && spData?.student_id === dbStudentId && spData?.school_id === schoolId) {
          setStudentPhotoUrl(spData.photo_url || '');
        }

        // System 2: Personal Profile Photo (users.profile_photo_url → avatar_url)
        // Used ONLY for portal UI: banner, navbar, chat, dashboard avatar
        const userId = session?.user?.id;
        if (userId) {
          const { data: userData, error: userErr } = await supabase
            .from('users')
            .select('profile_photo_url, avatar_url')
            .eq('id', userId)
            .maybeSingle();

          if (!cancelled && !userErr && userData) {
            const personalPhoto = userData.profile_photo_url || userData.avatar_url || '';
            setProfilePhotoDisplayUrl(personalPhoto);
          }
        }
      } catch (err) {
        console.warn('[StudentPortal] Failed to fetch student photos:', err);
      }
    })();

    return () => { cancelled = true; };
  }, [studentId, session?.user?.schoolId, session?.user?.id]);

  const loadData = async () => {
    try {
      const schoolId = session?.user?.schoolId || '';
      if (schoolId) {
        // Sync core database state first to avoid empty/null profile lookup errors
        await Promise.all([
          mockApi.syncSchoolsData(schoolId),
          mockApi.syncClassesData(schoolId),
          mockApi.syncTeachersData(schoolId),
          mockApi.syncSubjectsData(schoolId),
          mockApi.syncTeacherClassSubjectMappingsData(schoolId),
          mockApi.syncAcademicSessionsData(schoolId),
          mockApi.syncStudentsData(schoolId)
        ]);
      }

      if (!studentId) return;
      const studentObj = mockDb.students.find(s => s.id === studentId);
      const classId = studentObj?.classId || null;

      await syncSubscriptionPlan();
      const tt = await mockApi.studentGetTimetable(studentId).catch(() => []);
      // Deduplicate timetable
      setTimetable(Array.from(new Map(tt.map(t => [t.id, t])).values()));

      const ass = await mockApi.studentGetAssignments(studentId).catch(() => []);
      // Deduplicate assignments by assignment.id
      setAssignments(Array.from(new Map(ass.map(item => [item.assignment.id, item])).values()));

      const grd = await mockApi.studentGetGrades(studentId).catch(() => []);
      // Deduplicate grades by schedule.id
      setGrades(Array.from(new Map(grd.map(item => [item.schedule.id, item])).values()));

      const qz = await mockApi.studentGetQuizzes(studentId).catch(() => []);
      // Deduplicate quizzes by quiz.id
      setQuizzes(Array.from(new Map(qz.map(item => [item.quiz.id, item])).values()));

      const mat = await mockApi.getStudyMaterials(schoolId, classId).catch(() => []);
      // Deduplicate materials by id
      setMaterials(Array.from(new Map(mat.map(m => [m.id, m])).values()));

      const ann = await mockApi.getAnnouncements('STUDENT').catch(() => []);
      setAnnouncements(Array.from(new Map(ann.map(a => [a.id, a])).values()));

      await mockApi.syncStudentsData(schoolId);
      await mockApi.syncForumCategoriesData(schoolId).catch(() => {});
      await mockApi.syncForumPostsData(schoolId).catch(() => {});
      await mockApi.syncForumRepliesData(schoolId).catch(() => {});
      
      const cats = await mockApi.getForumCategories(schoolId).catch(() => []);
      const allowedCats = cats.filter(c => c.classId === studentObj?.classId || !c.classId);
      
      // Deduplicate forum categories by id
      setForumCategories(Array.from(new Map(allowedCats.map(c => [c.id, c])).values()));
      if (allowedCats.length > 0 && !postCategoryId) {
        setPostCategoryId(allowedCats[0].id);
      }

      const posts = await mockApi.getForumPosts().catch(() => []);
      const allowedCatIds = allowedCats.map(c => c.id);
      const filteredPosts = posts.filter(p => allowedCatIds.includes(p.categoryId));
      // Deduplicate forum posts by id
      setForumPosts(Array.from(new Map(filteredPosts.map(p => [p.id, p])).values()));

      const f = await mockApi.studentGetFees(studentId).catch(() => []);
      setFees(Array.from(new Map(f.map(item => [item.structure.id, item])).values()));

      const rcs = await mockApi.fetchReportCards(schoolId, studentId).catch(() => []);
      setReportCards(rcs);

      // Fetch dynamic transit and library details with safe catches
      const [allAssignments, allBuses, allRoutes, allPickupPoints, allDrivers, myIssues, myFines, digitalAssets, booksList] = await Promise.all([
        mockApi.fetchTransportAssignments(schoolId).catch(() => []),
        mockApi.fetchBuses(schoolId).catch(() => []),
        mockApi.fetchRoutes(schoolId).catch(() => []),
        mockApi.fetchPickupPoints(schoolId).catch(() => []),
        mockApi.fetchDrivers(schoolId).catch(() => []),
        mockApi.fetchBookIssues(schoolId, studentId).catch(() => []),
        mockApi.fetchLibraryFines(schoolId, studentId).catch(() => []),
        mockApi.fetchDigitalLibraryAssets(schoolId).catch(() => []),
        mockApi.fetchBookInventory(schoolId).catch(() => [])
      ]);
      const studentUserId = studentObj?.userId || '';
      const myAssignment = allAssignments.find(ta => (ta.studentId === studentId || ta.studentId === studentUserId || ta.studentId === session?.user?.id) && ta.status === 'ACTIVE');
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

      setIssuedBooks(Array.from(new Map(myIssues.map(bi => [bi.id, bi])).values()));
      setLibraryFines(Array.from(new Map(myFines.map(lf => [lf.id, lf])).values()));
      setDigitalLibraryAssets(Array.from(new Map((digitalAssets || []).map(da => [da.id, da])).values()));
      setLibraryBooks(Array.from(new Map((booksList || []).map(b => [b.id, b])).values()));

      // Load Hostel details
      if (schoolId && studentId) {
        await mockApi.syncHostelData(schoolId).catch(() => {});
        
        const admissions = await mockApi.fetchHostelAdmissions(schoolId).catch(() => []);
        const activeAd = admissions.find((a: any) => a.studentId === studentId && a.status === 'ACTIVE');
        setActiveAdmission(activeAd || null);
        
        if (activeAd) {
          const hostels = await mockApi.fetchHostels(schoolId).catch(() => []);
          const blocks = await mockApi.fetchHostelBlocks(schoolId).catch(() => []);
          const rooms = await mockApi.fetchHostelRooms(schoolId).catch(() => []);
          const beds = await mockApi.fetchHostelBeds(schoolId).catch(() => []);
          const wardens = await mockApi.fetchHostelWardens(schoolId).catch(() => []);
          const menus = await mockApi.fetchHostelMessMenus(schoolId).catch(() => []);
          
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

        const leaves = await mockApi.fetchHostelLeaveRequests(schoolId).catch(() => []);
        setMyLeaveRequests(leaves.filter((l: any) => l.studentId === studentId));

        const complaints = await mockApi.fetchHostelComplaints(schoolId).catch(() => []);
        setMyComplaints(complaints.filter((c: any) => c.studentId === studentId));

        const attendance = await mockApi.fetchHostelAttendance(schoolId).catch(() => []);
        setMyAttendance(attendance.filter((a: any) => a.studentId === studentId));

        const visitors = await mockApi.fetchHostelVisitors(schoolId).catch(() => []);
        setMyVisitorLogs(visitors.filter((v: any) => v.studentId === studentId));

        const payments = await mockApi.fetchHostelPayments(schoolId).catch(() => []);
        setMyPayments(payments.filter((p: any) => p.studentId === studentId));
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadData();
  }, [studentId, activeTab]);

  // Real-time Supabase Postgres changes subscription
  useEffect(() => {
    if (activeTab !== 'forums') return;

    const handleForumsSync = () => {
      Promise.all([
        mockApi.syncStudentsData(session?.user?.schoolId || ''),
        mockApi.syncForumCategoriesData(session?.user?.schoolId || '').catch(() => {}),
        mockApi.syncForumPostsData(session?.user?.schoolId || '').catch(() => {}),
        mockApi.syncForumRepliesData(session?.user?.schoolId || '').catch(() => {})
      ]).then(() => {
        Promise.all([
          mockApi.getForumPosts().catch(() => []),
          mockApi.getForumCategories(session?.user?.schoolId).catch(() => [])
        ]).then(([posts, cats]) => {
          const studentObj = mockDb.students.find(s => s.id === studentId);
          const allowedCats = cats.filter(c => c.classId === studentObj?.classId || !c.classId);
          const allowedCatIds = allowedCats.map(c => c.id);
          const filtered = posts.filter(p => allowedCatIds.includes(p.categoryId));
          // Deduplicate realtime forum posts by id
          setForumPosts(Array.from(new Map(filtered.map(p => [p.id, p])).values()));
        });
        if (selectedPost) {
          mockApi.getForumPostReplies(selectedPost.id).then(reps => setPostReplies(reps));
        }
      });
    };

    const channel = supabase
      .channel('student-forums-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'forum_categories' }, handleForumsSync)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'forum_posts' }, handleForumsSync)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'forum_replies' }, handleForumsSync)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeTab, selectedPost, session?.user?.schoolId, studentId]);

  // Real-time Supabase Postgres changes subscription for academic data
  useEffect(() => {
    if (!studentId) return;

    const handleAcademicSync = () => {
      console.log('Realtime academic update detected, refreshing student portal...');
      if (session?.user?.schoolId) {
        mockApi.clearHostelCache(session.user.schoolId);
      }
      loadData();
    };

    const channel = supabase
      .channel('student-academic-realtime')
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
      .on('postgres_changes', { event: '*', schema: 'public', table: 'school_subscriptions' }, () => {
        console.log('Realtime school_subscriptions change detected, refreshing plan...');
        syncSubscriptionPlan();
        loadData();
      })
      .subscribe();

    // Subscribe to manual broadcast channel for instant, guaranteed real-time updates!
    const broadcastChannel = supabase
      .channel(`school-subscription-updates-${session?.user.schoolId}`)
      .on('broadcast', { event: 'plan_updated' }, () => {
        console.log('Realtime broadcast subscription update detected in StudentPortal! Syncing plan and loading data...');
        syncSubscriptionPlan();
        loadData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(broadcastChannel);
    };
  }, [studentId, session, syncSubscriptionPlan]);

  useEffect(() => {
    const interval = setInterval(() => {
      syncSubscriptionPlan();
      if (activeTab === 'forums') {
        Promise.all([
          mockApi.syncStudentsData(session?.user?.schoolId || ''),
          mockApi.syncForumCategoriesData(session?.user?.schoolId || '').catch(() => {}),
          mockApi.syncForumPostsData(session?.user?.schoolId || '').catch(() => {}),
          mockApi.syncForumRepliesData(session?.user?.schoolId || '').catch(() => {})
        ]).then(() => {
          Promise.all([
            mockApi.getForumPosts().catch(() => []),
            mockApi.getForumCategories(session?.user?.schoolId).catch(() => [])
          ]).then(([posts, cats]) => {
            const studentObj = mockDb.students.find(s => s.id === studentId);
            const allowedCats = cats.filter(c => c.classId === studentObj?.classId || !c.classId);
            const allowedCatIds = allowedCats.map(c => c.id);
            setForumPosts(posts.filter(p => allowedCatIds.includes(p.categoryId)));
          });
          if (selectedPost) {
            mockApi.getForumPostReplies(selectedPost.id).then(reps => setPostReplies(reps));
          }
        });
      }
    }, 10000);
    return () => clearInterval(interval);
  }, [syncSubscriptionPlan, activeTab, selectedPost, session?.user?.schoolId, studentId]);

  // Quiz Timer
  useEffect(() => {
    if (activeQuiz && quizDurationLeft > 0) {
      const timer = setInterval(() => {
        setQuizDurationLeft(prev => {
          if (prev <= 1) {
            handleQuizSubmit();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
    return;
  }, [activeQuiz, quizDurationLeft]);

  // File handling helpers
  const handleFileChange = async (file: File) => {
    if (!file) return;
    if (!selectedAssignment || !studentId) return;

    // Validate size (max 50MB)
    const MAX_SIZE = 50 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      setUploadState('error');
      setUploadError('File size exceeds the 50MB limit.');
      return;
    }

    // Validate MIME type
    const whitelist = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'image/jpeg',
      'image/jpg',
      'image/png',
      'application/zip',
      'application/x-zip-compressed',
      'video/mp4'
    ];
    if (!whitelist.includes(file.type)) {
      setUploadState('error');
      setUploadError('Unsupported file type. Please upload PDF, DOC/DOCX, JPG/PNG, ZIP, or MP4.');
      return;
    }

    // Prepare and upload
    setUploadState('uploading');
    setUploadProgress(10);
    setUploadError('');
    setSelectedFile(file);

    try {
      // Simulate progress ticks for beautiful UI animation
      const interval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) {
            clearInterval(interval);
            return 90;
          }
          return prev + 15;
        });
      }, 150);

      // Call API upload
      const student = mockDb.students.find(s => s.id === studentId)!;
      const schoolId = student.schoolId;
      
      // Delete old file first if we are re-uploading
      if (submittingFile) {
        await mockApi.deleteHomeworkSubmissionFile(submittingFile);
      }

      const publicUrl = await mockApi.uploadHomeworkSubmissionFile(
        schoolId,
        selectedAssignment.id,
        studentId,
        file
      );

      clearInterval(interval);
      setUploadProgress(100);
      setSubmittingFile(publicUrl);
      setUploadState('success');
    } catch (err: any) {
      setUploadState('error');
      setUploadError(err.message || 'File upload failed.');
    }
  };

  const handleRemoveFile = async () => {
    if (submittingFile) {
      setUploadState('uploading');
      try {
        await mockApi.deleteHomeworkSubmissionFile(submittingFile);
      } catch (e) {
        console.error(e);
      }
    }
    setSubmittingFile('');
    setSelectedFile(null);
    setUploadState('idle');
    setUploadProgress(0);
    setUploadError('');
  };

  // Submit Homework / Assignment
  const handleAssignmentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentId || !selectedAssignment || !submittingFile.trim()) return;

    try {
      await mockApi.studentSubmitAssignment(
        studentId, 
        selectedAssignment.id, 
        submittingText, 
        submittingFile
      );
      setSelectedAssignment(null);
      setSubmittingText('');
      setSubmittingFile('');
      loadData();
      alert('Homework submitted successfully!');
    } catch (err) {
      alert(err);
    }
  };

  // Launch Quiz
  const handleStartQuiz = async (quiz: Quiz) => {
    // Load questions
    try {
      const allQuestions = await mockApi.studentGetQuizQuestions(quiz.id);
      setQuizQuestions(allQuestions);
      setQuizAnswers({});
      setQuizDurationLeft(quiz.durationMinutes * 60);
      setActiveQuiz(quiz);
    } catch (err: any) {
      alert(err.message || 'Error loading quiz questions');
    }
  };

  // Submit Quiz Attempts
  const handleQuizSubmit = async () => {
    if (!studentId || !activeQuiz) return;

    // Calculate score
    let score = 0;
    quizQuestions.forEach(q => {
      const answer = quizAnswers[q.id];
      if (answer !== undefined && answer === q.correctOption) {
        score += q.marks;
      }
    });

    try {
      await mockApi.studentAttemptQuiz(studentId, activeQuiz.id, quizAnswers, score);
      setActiveQuiz(null);
      loadData();
      alert(`Quiz submitted! Your calculated score: ${score}/${activeQuiz.totalMarks}`);
    } catch (err) {
      alert(err);
    }
  };

  // Submit Hostel Leave Request
  const handleCreateLeaveRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentId || !session?.user?.schoolId) return;
    if (!leaveFromDate || !leaveToDate || !leaveReason.trim()) {
      alert('Please fill out all fields.');
      return;
    }
    try {
      await mockApi.createHostelLeaveRequest(
        session.user.schoolId,
        studentId,
        leaveFromDate,
        leaveToDate,
        leaveReason
      );
      setLeaveFromDate('');
      setLeaveToDate('');
      setLeaveReason('');
      loadData();
      alert('Leave request submitted successfully! It is pending Parent Approval.');
    } catch (err: any) {
      alert(err.message || 'Failed to submit leave request');
    }
  };

  // Submit Hostel Complaint
  const handleCreateComplaint = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentId || !session?.user?.schoolId) return;
    if (!complaintDescription.trim()) {
      alert('Please enter a description.');
      return;
    }
    try {
      await mockApi.createHostelComplaint(
        session.user.schoolId,
        studentId,
        complaintCategory,
        complaintDescription
      );
      setComplaintDescription('');
      loadData();
      alert('Complaint logged successfully.');
    } catch (err: any) {
      alert(err.message || 'Failed to log complaint');
    }
  };

  // View Forum Thread
  const handleSelectPost = async (post: any) => {
    setSelectedPost(post);
    try {
      const reps = await mockApi.getForumPostReplies(post.id);
      setPostReplies(reps);
    } catch (err) {
      console.error(err);
    }
  };

  // Reply to Forum
  const handleForumReplySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session || !selectedPost || !replyText.trim()) return;

    try {
      await mockApi.replyToForumPost(session.user.id, selectedPost.id, replyText);
      setReplyText('');
      const reps = await mockApi.getForumPostReplies(selectedPost.id);
      setPostReplies(reps);
      loadData();
    } catch (err) {
      console.error(err);
    }
  };

  // Add Discussion Thread
  const handleCreateForumPost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session || !postTitle.trim() || !postContent.trim() || !postCategoryId) return;

    try {
      await mockApi.createForumPost(session.user.id, postTitle, postContent, postCategoryId);
      setPostTitle('');
      setPostContent('');
      loadData();
      alert('Discussion thread published!');
    } catch (err) {
      console.error(err);
    }
  };

  const calculateAttendancePercentage = () => {
    const presentCount = mockDb.attendance.filter(a => a.studentId === studentId && (a.status === 'PRESENT' || a.status === 'LATE')).length;
    const totalCount = mockDb.attendance.filter(a => a.studentId === studentId).length;
    return totalCount > 0 ? Math.round((presentCount / totalCount) * 100) : 100;
  };

  const calculateAverageGPA = () => {
    const scoredGrades = grades.filter(g => g.mark !== undefined);
    if (scoredGrades.length === 0) return 'A';
    const sum = scoredGrades.reduce((acc, g) => acc + (g.mark!.marksObtained / g.schedule.maxMarks), 0);
    const avg = sum / scoredGrades.length;
    if (avg >= 0.9) return 'A+';
    if (avg >= 0.8) return 'A';
    if (avg >= 0.7) return 'B';
    return 'C';
  };

  const studentEntity = mockDb.students.find(s => s.id === studentId);
  const studentUser = mockDb.users.find(u => u.id === session?.user?.id);
  const studentClass = mockDb.classes.find(c => c.id === studentEntity?.classId);
  const studentSchool = mockDb.schools.find(s => s.id === studentEntity?.schoolId) || mockDb.schools.find(s => s.id === studentUser?.schoolId);
  
  const studentName = studentUser ? `${studentUser.firstName} ${studentUser.lastName}` : 'Student';
  const className = studentClass ? studentClass.name : 'Unassigned Class';
  const admissionNumber = studentEntity ? studentEntity.admissionNumber : 'N/A';
  const schoolName = studentSchool ? studentSchool.name : 'Aegis Academy';

  // Check gated certificates when Documents tab is opened
  useEffect(() => {
    if (activeTab !== 'documents' || !studentEntity) return;
    let cancelled = false;
    const check = async () => {
      const [charDoc, transferDoc] = await Promise.all([
        checkDocumentGenerated(studentEntity.id, 'character_certificate'),
        checkDocumentGenerated(studentEntity.id, 'transfer_certificate'),
      ]);
      if (!cancelled) {
        setCharacterCertDoc(charDoc); // null = not generated, GeneratedDocument = issued
        setTransferCertDoc(transferDoc);
      }
    };
    check();
    return () => { cancelled = true; };
  }, [activeTab, studentEntity?.id]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 animate-fade-in">
      {/* Portal Identity Context Bar */}
      {activeTab !== 'groupdiscussion' && (
        <div className="bg-gradient-to-r from-brand-950 to-slate-900 border border-slate-800 rounded-3xl p-5 md:p-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left">
            {/* System 2 – Personal Profile Photo: profile_photo_url → avatar_url → BookOpen placeholder */}
            {/* This is the student's personal avatar; NEVER the official academic/registration photo */}
            {(profilePhotoDisplayUrl || studentUser?.avatarUrl) ? (
              <img 
                src={profilePhotoDisplayUrl || studentUser!.avatarUrl!} 
                alt="" 
                className="w-12 h-12 rounded-xl object-cover border border-slate-700 shadow-md shrink-0 animate-fade-in"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            ) : (
              <div className="w-12 h-12 rounded-xl bg-brand-500/10 border border-brand-500/25 flex items-center justify-center shrink-0">
                <BookOpen className="text-brand-400" size={24} />
              </div>
            )}
            <div>
              <h2 className="text-xl font-bold text-slate-100 font-sans leading-none">{studentName} <span className="text-xs text-slate-400 font-normal ml-1">(Student)</span></h2>
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mt-2">
                <span className="text-[10px] text-slate-400 uppercase tracking-widest font-mono bg-slate-800 px-2 py-0.5 rounded">Adm No: {admissionNumber}</span>
                <span className="text-[10px] text-slate-400 uppercase tracking-widest font-mono bg-slate-800 px-2 py-0.5 rounded">Class: {className}</span>
                <span className="text-[10px] text-brand-400 uppercase tracking-widest font-mono bg-brand-500/10 border border-brand-500/20 px-2 py-0.5 rounded">{schoolName}</span>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Active Tab Routing switch */}

      {activeTab === 'dashboard' && (
        <div className="space-y-6">
          {/* Welcome Banner */}
          <div className="bg-gradient-to-r from-brand-900/60 to-slate-950 border border-brand-500/20 rounded-3xl p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-6 shadow-2xl">
            <div className="text-center md:text-left space-y-2">
              <h2 className="text-2xl md:text-3xl font-extrabold text-slate-100 font-sans tracking-tight leading-none">
                Welcome back, <span className="text-brand-400 text-glow-brand">{session?.user.firstName}!</span>
              </h2>
              <p className="text-xs text-slate-400 max-w-md">
                Monitor your daily classes, attend active quizzes, submit major projects, and view grades analytics.
              </p>
            </div>
            
            <div className="flex gap-4">
              <div className="px-4 py-2 bg-slate-900/60 border border-slate-800 rounded-2xl text-center">
                <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest leading-none">Attendance</span>
                <span className="text-lg font-bold text-brand-400 mt-1">{calculateAttendancePercentage()}%</span>
              </div>
              <div className="px-4 py-2 bg-slate-900/60 border border-slate-800 rounded-2xl text-center">
                <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest leading-none">Term Grade</span>
                <span className="text-lg font-bold text-brand-400 mt-1">{calculateAverageGPA()}</span>
              </div>
            </div>
          </div>

          {/* Core Dashboard Metric grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Today's Lectures */}
            <GlassCard className="col-span-1 md:col-span-2 space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-850">
                <h3 className="font-bold text-slate-200 text-sm flex items-center gap-2">
                  <Calendar className="text-brand-500" size={16} />
                  Today's Lecture Schedule
                </h3>
              </div>
              
              <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                {timetable.filter(t => mockDb.subjects.some(s => s.id === t.subjectId)).length === 0 ? (
                  <div className="text-center py-10 bg-slate-900/10 border border-dashed border-slate-850 rounded-2xl p-4 flex flex-col items-center justify-center gap-2">
                    <Calendar size={24} className="text-slate-650 animate-pulse-subtle" />
                    <p className="text-xs text-slate-500 font-semibold">No Lectures Scheduled Today</p>
                  </div>
                ) : (
                  timetable.filter(t => mockDb.subjects.some(s => s.id === t.subjectId)).map(t => {
                    const subject = mockDb.subjects.find(s => s.id === t.subjectId)!;
                    return (
                      <div 
                        key={t.id}
                        className="flex items-center justify-between p-3.5 bg-slate-900/30 border border-slate-850 rounded-xl hover:border-slate-800 transition-all"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-slate-900 flex items-center justify-center font-bold text-xs text-brand-400 border border-slate-800">
                            {subject.code}
                          </div>
                          <div>
                            <h4 className="font-semibold text-slate-200 text-xs">{subject.name}</h4>
                            <p className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                              <Clock size={10} />
                              {t.startTime} - {t.endTime} | {t.classroomNumber}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </GlassCard>

            {/* General school alerts */}
            <GlassCard className="space-y-4">
              <h3 className="font-bold text-slate-200 text-sm pb-2 border-b border-slate-850">STEM Announcements</h3>
              <div className="space-y-3 max-h-72 overflow-y-auto">
                {announcements.length === 0 ? (
                  <div className="text-center py-8 text-slate-500 text-xs">No active notices published yet.</div>
                ) : (
                  announcements.map(a => (
                    <div key={a.id} className="p-3 bg-brand-500/5 border border-brand-500/10 rounded-xl space-y-1">
                      <h4 className="font-semibold text-slate-200 text-xs truncate">{a.title}</h4>
                      <p className="text-[10px] text-slate-400 leading-relaxed line-clamp-3">{a.content}</p>
                    </div>
                  ))
                )}
              </div>
            </GlassCard>
          </div>
        </div>
      )}

      {activeTab === 'groupdiscussion' && session?.user && (
        <ClassDiscussion
          currentUserId={session.user.id}
          currentUserRole={session.user.role}
          schoolId={session.user.schoolId || ''}
          academicSessionId={session.user.academicSessionId || ''}
        />
      )}

      {activeTab === 'timetable' && (
        <GlassCard className="space-y-6">
          <div className="border-b border-slate-850 pb-3 flex items-center justify-between">
            <h3 className="font-bold text-slate-100 flex items-center gap-2">
              <Calendar className="text-brand-500" size={18} />
              Assignments & Timetable Master
            </h3>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* List Timetable */}
            <div className="space-y-4">
              <h4 className="font-semibold text-slate-200 text-xs">Weekly Timetable Schedule</h4>
              <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
                {timetable.filter(t => mockDb.subjects.some(s => s.id === t.subjectId)).length === 0 ? (
                  <div className="text-center py-12 bg-slate-900/10 border border-dashed border-slate-850 rounded-2xl p-4 flex flex-col items-center justify-center gap-2">
                    <Calendar size={28} className="text-slate-600 animate-pulse-subtle" />
                    <p className="text-xs text-slate-400 font-semibold">No Classes Scheduled</p>
                    <p className="text-[10px] text-slate-500">There are no weekly class schedules mapped for your course profile yet.</p>
                  </div>
                ) : (
                  timetable.filter(t => mockDb.subjects.some(s => s.id === t.subjectId)).map(t => {
                    const subject = mockDb.subjects.find(s => s.id === t.subjectId)!;
                    return (
                      <div key={t.id} className="p-3 bg-slate-900/30 border border-slate-850 rounded-xl flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="w-8 h-8 rounded bg-slate-800 flex items-center justify-center font-bold text-xs text-brand-400">
                            {t.dayOfWeek === 1 ? 'M' : t.dayOfWeek === 2 ? 'T' : t.dayOfWeek === 3 ? 'W' : t.dayOfWeek === 4 ? 'Th' : t.dayOfWeek === 5 ? 'F' : t.dayOfWeek === 6 ? 'Sa' : 'Su'}
                          </span>
                          <div>
                            <p className="font-semibold text-xs text-slate-200">{subject.name}</p>
                            <p className="text-[10px] text-slate-400 mt-0.5">{t.classroomNumber || 'Main hall'} | {t.startTime} - {t.endTime}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Assignments Homework */}
            <div className="space-y-4">
              <PremiumLock
                isLocked={!ent.hasLibraryAccess}
                requiredTier="ENTERPRISE"
                featureName="Upcoming Homework & Project Deadlines"
                customMessage="This feature is available only with an active Enterprise Subscription. Please contact your School Administrator."
              >
                <div>
                  <h4 className="font-semibold text-slate-200 text-xs">Upcoming Homework & Project Deadlines</h4>
                  <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
                {assignments.filter(({ assignment }) => mockDb.subjects.some(s => s.id === assignment.subjectId)).length === 0 ? (
                  <div className="text-center py-12 bg-slate-900/10 border border-dashed border-slate-850 rounded-2xl p-4 flex flex-col items-center justify-center gap-2">
                    <ClipboardList size={28} className="text-slate-650 animate-pulse-subtle" />
                    <p className="text-xs text-slate-400 font-semibold">No Active Assignments</p>
                    <p className="text-[10px] text-slate-500">You are completely caught up! No homework or major projects are pending.</p>
                  </div>
                ) : (
                  assignments.filter(({ assignment }) => mockDb.subjects.some(s => s.id === assignment.subjectId)).map(({ assignment, submission }) => {
                    const subject = mockDb.subjects.find(s => s.id === assignment.subjectId)!;
                    return (
                      <div key={assignment.id} className="p-3.5 bg-slate-900/40 border border-slate-850 rounded-xl space-y-3">
                        <div className="flex justify-between items-start">
                          <div>
                            <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                              assignment.isHomework ? 'bg-amber-500/10 text-amber-400' : 'bg-red-500/10 text-red-400'
                            }`}>
                              {assignment.isHomework ? 'Daily Homework' : 'Major Assignment'}
                            </span>
                            <h5 className="font-semibold text-slate-200 text-xs mt-1.5">{assignment.title}</h5>
                            <p className="text-[10px] text-slate-400 mt-0.5">{subject.name} | Due: {new Date(assignment.dueDate).toLocaleDateString()}</p>
                          </div>
                          <div>
                            <span className={`text-[10px] font-bold px-2.5 py-1 rounded-lg ${
                              submission 
                                ? submission.marksObtained !== undefined 
                                  ? 'bg-green-500/10 text-green-400' 
                                  : 'bg-blue-500/10 text-blue-400'
                                : 'bg-slate-850 text-slate-400'
                            }`}>
                              {submission 
                                ? submission.marksObtained !== undefined 
                                  ? `Graded: ${submission.marksObtained}/${assignment.maxMarks}` 
                                  : 'Submitted' 
                                : 'Pending'}
                            </span>
                          </div>
                        </div>
                        <p className="text-[10px] text-slate-400 leading-relaxed">{assignment.description}</p>
                        
                        {assignment.attachments && assignment.attachments.length > 0 && (
                          <div className="mt-2.5 pt-2.5 border-t border-slate-850/40 space-y-2">
                            <span className="block text-[9px] font-bold uppercase tracking-wider text-slate-500">Teacher's Resources ({assignment.attachments.length})</span>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {assignment.attachments.map((att) => (
                                <div 
                                  key={att.id} 
                                  className="flex items-center justify-between gap-3 p-2 bg-slate-950/40 hover:bg-slate-950/70 border border-slate-850 hover:border-slate-800 rounded-xl transition-all"
                                >
                                  <div className="flex items-center gap-2 truncate">
                                    <Paperclip size={12} className="text-brand-400 shrink-0" />
                                    <span className="text-[10.5px] text-slate-300 truncate" title={att.fileName}>
                                      {att.fileName}
                                    </span>
                                  </div>
                                  <div className="flex gap-1 shrink-0">
                                    <a 
                                      href={att.fileUrl} 
                                      target="_blank" 
                                      rel="noopener noreferrer" 
                                      className="p-1 hover:bg-slate-850 text-slate-400 hover:text-slate-200 rounded-lg transition-colors flex items-center justify-center"
                                      title="View File"
                                    >
                                      <Eye size={12} />
                                    </a>
                                    <a 
                                      href={att.fileUrl} 
                                      download={att.fileName}
                                      className="p-1 hover:bg-slate-850 text-slate-400 hover:text-slate-200 rounded-lg transition-colors flex items-center justify-center"
                                      title="Download"
                                    >
                                      <Download size={12} />
                                    </a>
                                  </div>
                                </div>
                              ))}
                            </div>
                            
                            {/* Rich inline preview for PDFs/Images/Videos */}
                            {assignment.attachments.some(att => /\.(jpg|jpeg|png|webp|gif|pdf|mp4)$/i.test(att.fileName || att.fileUrl)) && (
                              <div className="mt-2.5 flex flex-col gap-2.5">
                                {assignment.attachments
                                  .filter(att => /\.(jpg|jpeg|png|webp|gif|pdf|mp4)$/i.test(att.fileName || att.fileUrl))
                                  .map((att) => {
                                    const isImg = /\.(jpg|jpeg|png|webp|gif)$/i.test(att.fileName || att.fileUrl);
                                    const isVideo = /\.(mp4)$/i.test(att.fileName || att.fileUrl);
                                    const isPdf = /\.(pdf)$/i.test(att.fileName || att.fileUrl);
                                    
                                    return (
                                      <div key={att.id} className="border border-slate-850 rounded-xl overflow-hidden bg-slate-950/20 max-h-56 flex flex-col">
                                        <div className="bg-slate-950/40 px-3 py-1.5 border-b border-slate-850 flex items-center justify-between text-[10px] text-slate-400 font-mono">
                                          <span className="truncate max-w-[200px]">{att.fileName}</span>
                                          <span className="uppercase text-[9px] px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 shrink-0 font-bold">
                                            {isImg ? 'Image' : isVideo ? 'Video' : 'PDF'}
                                          </span>
                                        </div>
                                        <div className="flex-1 flex items-center justify-center p-2.5 bg-slate-900/10">
                                          {isImg && (
                                            <img src={att.fileUrl} alt={att.fileName} className="max-h-40 max-w-full object-contain rounded-lg shadow-inner" />
                                          )}
                                          {isVideo && (
                                            <video src={att.fileUrl} controls className="max-h-40 max-w-full rounded-lg" />
                                          )}
                                          {isPdf && (
                                            <iframe src={`${att.fileUrl}#toolbar=0`} className="w-full h-40 rounded-lg border-0" />
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })}
                              </div>
                            )}
                          </div>
                        )}
                        
                        {submission ? (
                          <div className="flex gap-2 w-full mt-2">
                            <a 
                              href={submission.fileUrl} 
                              target="_blank" 
                              rel="noopener noreferrer" 
                              className="flex-1 bg-slate-900/80 border border-slate-880 hover:border-slate-700 text-slate-300 hover:text-slate-100 font-semibold text-xs py-2 rounded-lg text-center hover:bg-slate-850 transition-all flex items-center justify-center gap-1.5"
                            >
                              <Eye size={13} /> View File
                            </a>
                            <button 
                              onClick={() => {
                                setSelectedAssignment(assignment);
                                setSubmittingText(submission.submissionText || '');
                                setSubmittingFile(submission.fileUrl || '');
                                setUploadState('success');
                                setSelectedFile(null);
                              }}
                              className="flex-1 bg-brand-500/10 hover:bg-brand-500 border border-brand-500/20 hover:border-brand-500/30 text-brand-400 hover:text-white font-semibold text-xs py-2 rounded-lg transition-all flex items-center justify-center gap-1.5"
                            >
                              <UploadCloud size={13} /> Re-upload
                            </button>
                          </div>
                        ) : (
                          <button 
                            onClick={() => {
                              setSelectedAssignment(assignment);
                              setSubmittingText('');
                              setSubmittingFile('');
                              setUploadState('idle');
                              setSelectedFile(null);
                            }}
                            className="w-full bg-brand-600/10 hover:bg-brand-600 border border-brand-500/20 text-brand-400 hover:text-white font-medium text-xs py-2 rounded-lg transition-colors flex items-center justify-center gap-1"
                          >
                            <UploadCloud size={13} />
                            Upload Submissions
                          </button>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
            </PremiumLock>
          </div>
        </div>
        </GlassCard>
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
                Academic Materials & Video Portal
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

            {materials.length === 0 ? (
              <div className="text-center py-16 bg-slate-900/10 border border-dashed border-slate-850 rounded-3xl p-6 flex flex-col items-center justify-center gap-3">
                <BookOpen size={36} className="text-slate-650 animate-pulse-subtle" />
                <p className="text-sm text-slate-350 font-semibold">No Study Materials Found</p>
                <p className="text-xs text-slate-500 max-w-sm">Your instructors haven't uploaded any study materials or references yet.</p>
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
                          <PlayCircle size={14} />
                          Stream Live
                        </button>
                      ) : (
                        <button 
                          onClick={async () => {
                            try {
                              const filename = m.title.toLowerCase().replace(/\s+/g, '_') + (m.fileUrl.endsWith('.pdf') ? '.pdf' : '.docx');
                              await downloadFile(m.fileUrl, filename);
                            } catch (err: any) {
                              alert('Download failed: ' + err.message);
                            }
                          }}
                          className="text-brand-400 hover:text-brand-300 flex items-center gap-1 font-semibold text-xs transition-colors"
                        >
                          <Download size={14} />
                          Download Resource
                        </button>
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
          <div className="space-y-6 animate-fade-in">
          
          {/* Active Quiz player frame */}
          {activeQuiz ? (
            <GlassCard className="space-y-6 border-brand-500/30">
              <div className="flex items-center justify-between border-b border-slate-850 pb-3 bg-slate-950/20 px-2 rounded">
                <div>
                  <h3 className="font-bold text-brand-400">{activeQuiz.title}</h3>
                  <p className="text-[10px] text-slate-400 uppercase tracking-widest mt-0.5">Secure Exam Assessment Panel</p>
                </div>
                <div className="px-4 py-1.5 bg-red-500/10 border border-red-500/20 text-red-400 font-mono font-bold text-sm rounded-xl">
                  Timer: {Math.floor(quizDurationLeft / 60)}m {quizDurationLeft % 60}s
                </div>
              </div>

              <div className="space-y-6">
                {quizQuestions.map((q, idx) => (
                  <div key={q.id} className="p-4 bg-slate-900/30 border border-slate-850 rounded-xl space-y-3">
                    <p className="text-slate-100 font-medium text-sm leading-relaxed">
                      {idx + 1}. {q.question}
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {q.options.map((opt: string, optIdx: number) => {
                        const isSelected = quizAnswers[q.id] === optIdx;
                        return (
                          <div 
                            key={optIdx}
                            onClick={() => setQuizAnswers(prev => ({ ...prev, [q.id]: optIdx }))}
                            className={`p-3 rounded-xl border text-xs cursor-pointer transition-all duration-200 ${
                              isSelected 
                                ? 'bg-brand-600/15 border-brand-500 text-brand-400 font-semibold' 
                                : 'bg-slate-900/20 border-slate-800 text-slate-300 hover:bg-slate-900/40 hover:border-slate-750'
                            }`}
                          >
                            {opt}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-850">
                <button 
                  onClick={() => setActiveQuiz(null)}
                  className="glass-btn-secondary text-xs"
                >
                  Cancel Attempt
                </button>
                <button 
                  onClick={handleQuizSubmit}
                  className="glass-btn-primary text-xs"
                >
                  Submit Secure Test
                </button>
              </div>
            </GlassCard>
          ) : (
            // Quiz listing
            <GlassCard className="space-y-6">
              <h3 className="font-bold text-slate-100 flex items-center gap-2 pb-3 border-b border-slate-850">
                <PenTool className="text-brand-500" size={18} />
                Quizzes & Interactive Online Tests
              </h3>

              {quizzes.filter(({ quiz }) => mockDb.subjects.some(s => s.id === quiz.subjectId)).length === 0 ? (
                <div className="text-center py-16 bg-slate-900/10 border border-dashed border-slate-850 rounded-3xl p-6 flex flex-col items-center justify-center gap-3">
                  <PenTool size={36} className="text-slate-650 animate-pulse-subtle" />
                  <p className="text-sm text-slate-350 font-semibold">No Quizzes Published</p>
                  <p className="text-xs text-slate-500 max-w-sm">There are no academic quizzes or online assessments scheduled for your sections.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {quizzes.filter(({ quiz }) => mockDb.subjects.some(s => s.id === quiz.subjectId)).map(({ quiz, attempt }) => {
                    const subject = mockDb.subjects.find(s => s.id === quiz.subjectId)!;
                    return (
                      <div key={quiz.id} className="p-4 bg-slate-900/30 border border-slate-850 hover:border-slate-800 rounded-2xl flex flex-col justify-between gap-4 transition-all">
                        <div className="space-y-2">
                          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{subject.name}</span>
                          <h4 className="font-bold text-slate-200 text-sm mt-0.5">{quiz.title}</h4>
                          <p className="text-xs text-slate-400">Duration: {quiz.durationMinutes} minutes | Marks: {quiz.totalMarks}</p>
                        </div>
                        
                        <div className="pt-3 border-t border-slate-850 flex items-center justify-between">
                          {attempt ? (
                            <span className="text-xs font-semibold text-green-400 bg-green-500/10 px-2.5 py-1 rounded-lg">
                              Attempted: {attempt.score}/{quiz.totalMarks} score
                            </span>
                          ) : (
                            <>
                              <span className="text-[10px] text-slate-500">Available Test</span>
                              <button 
                                onClick={() => handleStartQuiz(quiz)}
                                className="bg-brand-600 hover:bg-brand-500 text-white font-semibold text-xs px-4 py-1.5 rounded-lg transition-colors"
                              >
                                Launch Quiz
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </GlassCard>
          )}
        </div>
        </PremiumLock>
      )}

      {activeTab === 'grades' && (
        <>
          <GlassCard className="space-y-6">
          <div className="border-b border-slate-850 pb-3">
            <h3 className="font-bold text-slate-100 flex items-center gap-2">
              <Award className="text-brand-500" size={18} />
              Term Progress & Midterm Assessment Records
            </h3>
          </div>

          {grades.length === 0 ? (
            <div className="text-center py-16 p-6 flex flex-col items-center justify-center gap-3">
              <Award size={36} className="text-slate-650 animate-pulse-subtle" />
              <p className="text-sm text-slate-350 font-semibold">No Term Reports Mapped</p>
              <p className="text-xs text-slate-500 max-w-sm">No exam schedules or mid-term assessment marks have been published for this academic cycle yet.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-850 text-slate-400 font-bold">
                    <th className="py-3 px-4">Subject</th>
                    <th className="py-3 px-4">Assessment name</th>
                    <th className="py-3 px-4">Marks Scored</th>
                    <th className="py-3 px-4">Max Marks</th>
                    <th className="py-3 px-4">Remarks & Feedbacks</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-850">
                  {grades.map(({ schedule, mark, subject, examName }) => (
                    <tr key={schedule.id} className="hover:bg-slate-900/10 text-slate-200">
                      <td className="py-3 px-4 font-semibold">{subject.name}</td>
                      <td className="py-3 px-4 text-slate-400">{examName}</td>
                      <td className="py-3 px-4">
                        {mark ? (
                          <span className={`font-bold text-sm ${mark.marksObtained >= 80 ? 'text-green-400' : 'text-slate-200'}`}>
                            {mark.marksObtained}
                          </span>
                        ) : (
                          <span className="text-slate-500">Grading Pending</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-400">{schedule.maxMarks}</td>
                      <td className="py-3 px-4 text-slate-400 italic truncate max-w-xs">{mark ? mark.remarks : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
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
                        if (!studentId) return;
                        try {
                          const marksheetData = await mockApi.getStudentMarksheetData(studentId, rc.term);
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
      </>
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
                  My Issued Books History
                </h3>
                <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                  {issuedBooks.length === 0 ? (
                    <p className="text-xs text-slate-500 italic">No library checkout history found.</p>
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
                </div>
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
                My School Transit Details
              </h3>
            </div>
            {!transitAssignment ? (
              <div className="p-6 bg-slate-900/10 border border-dashed border-slate-850 rounded-2xl text-center">
                <Layers size={24} className="text-slate-500 mx-auto mb-2" />
                <p className="text-xs text-slate-450 italic">No transport route assigned yet. Please contact school administration.</p>
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
          isLocked={!ent.hasCommunications} 
          requiredTier="Basic" 
          featureName="Discussions & Forums"
        >
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in">
            
            {/* Create Post and list posts */}
            <div className="lg:col-span-2 space-y-6">
              {selectedPost ? (
                <GlassCard className="space-y-6">
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
                // List posts
                <GlassCard className="space-y-6">
                  <h3 className="font-bold text-slate-100 pb-3 border-b border-slate-850">Homeroom Classroom Forums</h3>
                  <div className="space-y-4 max-h-[500px] overflow-y-auto pr-1">
                    {forumPosts.length === 0 ? (
                      <div className="text-center py-12 text-slate-500 text-xs">No active discussions.</div>
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

            {/* Create Post Form */}
            <div className="space-y-6">
              <GlassCard className="space-y-4">
                <h3 className="font-bold text-slate-200 text-sm">Start New Discussion Thread</h3>
                <form onSubmit={handleCreateForumPost} className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Post Title</label>
                    <input 
                      type="text"
                      placeholder="e.g. Help with Vector calculus question 4"
                      value={postTitle}
                      onChange={(e) => setPostTitle(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-slate-100 focus:outline-none focus:border-brand-500"
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Select Category</label>
                    <select 
                      value={postCategoryId}
                      onChange={(e) => setPostCategoryId(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-slate-100 focus:outline-none focus:border-brand-500"
                      required
                    >
                      {forumCategories.map(cat => (
                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Thread Context</label>
                    <textarea 
                      placeholder="Explain your queries or share thoughts clearly..."
                      rows={4}
                      value={postContent}
                      onChange={(e) => setPostContent(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-slate-100 focus:outline-none focus:border-brand-500"
                      required
                    />
                  </div>
                  <button type="submit" className="w-full glass-btn-primary text-xs">
                    Create Thread
                  </button>
                </form>
              </GlassCard>
            </div>
          </div>
        </PremiumLock>
      )}

      {activeTab === 'fees' && (
        <PremiumLock 
          isLocked={!ent.hasBilling} 
          requiredTier="Basic" 
          featureName="Fee Management"
        >
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start animate-fade-in">
            {/* Left Panel: Invoices List */}
            <div className="lg:col-span-8 space-y-4">
              <GlassCard className="p-5 space-y-4">
                <div className="flex flex-col sm:flex-row justify-between sm:items-center pb-3 border-b border-slate-850 gap-3">
                  <h3 className="font-bold text-slate-100 flex items-center gap-2">
                    <DollarSign className="text-brand-500" size={18} />
                    My Invoices
                  </h3>
                  
                  {/* Filter chips */}
                  <div className="flex flex-wrap gap-1.5">
                    {(['ALL', 'PAID', 'PENDING', 'OVERDUE'] as const).map(f => (
                      <button
                        key={f}
                        onClick={() => setInvoiceFilter(f)}
                        className={`px-3 py-1 rounded-lg text-[10px] font-bold uppercase transition-all ${
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
                    const mappedInvoices = fees.map(({ structure, payment }) => {
                      const isPaid = payment?.status === 'PAID';
                      const isOverdue = !isPaid && new Date(structure.dueDate).getTime() < Date.now();
                      const status = isPaid ? 'PAID' : isOverdue ? 'OVERDUE' : (payment?.status === 'PENDING' ? 'PENDING' : 'UNPAID');
                      
                      const invoiceNumber = payment?.transactionId 
                        ? `INV-${new Date(structure.dueDate).getFullYear()}-${payment.transactionId.substring(0, 6).toUpperCase()}` 
                        : `INV-${new Date(structure.dueDate).getFullYear()}-${structure.id.substring(0, 6).toUpperCase()}`;

                      return {
                        id: structure.id,
                        structure,
                        payment,
                        invoiceNumber,
                        status,
                        description: structure.description,
                        dueDate: structure.dueDate,
                        amount: Number(structure.amount),
                        billDate: structure.createdAt || new Date(new Date(structure.dueDate).getTime() - 14 * 24 * 60 * 60 * 1000).toISOString()
                      };
                    });

                    const filteredInvoices = mappedInvoices.filter(inv => {
                      if (invoiceFilter === 'ALL') return true;
                      return inv.status === invoiceFilter;
                    });

                    if (filteredInvoices.length === 0) {
                      return (
                        <div className="text-center py-16 flex flex-col items-center justify-center gap-3">
                          <DollarSign size={36} className="text-slate-650 animate-pulse-subtle" />
                          <p className="text-sm text-slate-350 font-semibold">No Invoices Found</p>
                          <p className="text-xs text-slate-500 max-w-sm">No billing invoices matching the selected filter were found.</p>
                        </div>
                      );
                    }

                    return filteredInvoices.map((inv, idx) => {
                      const stObj = mockDb.students.find(s => s.id === studentId);
                      const cls = stObj ? mockDb.classes.find(c => c.id === stObj.classId) : null;
                      const parentObj = mockDb.parentStudentMappings.find(m => m.studentId === studentId);
                      const parentDetails = parentObj ? mockDb.parents.find(p => p.id === parentObj.parentId) : null;
                      const parentUser = parentDetails ? mockDb.users.find(u => u.id === parentDetails.userId) : null;

                      const invoicePayload = {
                        schoolId: studentSchool?.id || '',
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
                        studentName: `${session?.user?.firstName || 'Student'} ${session?.user?.lastName || ''}`,
                        studentClass: cls?.name || 'Class 10 - A',
                        studentRollNo: stObj?.rollNumber ? String(stObj.rollNumber) : '15',
                        studentAdmissionNo: stObj?.admissionNumber ? String(stObj.admissionNumber) : 'AEGIS2026/015',
                        studentId: studentId || '',
                        parentName: parentUser ? `${parentUser.firstName} ${parentUser.lastName}` : 'Guardian',
                        parentPhone: parentUser?.phone || 'N/A',
                        parentEmail: parentUser?.email || 'N/A',
                        parentRelation: 'Father',
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
                              <h4 className="font-bold text-slate-200 text-sm mt-2">{inv.description}</h4>
                              <p className="text-[10px] text-slate-450">
                                {session?.user?.firstName} ${session?.user?.lastName} ({cls?.name || 'Class 10 - A'})
                              </p>
                              <div className="flex flex-wrap gap-x-4 gap-y-1 text-[9.5px] text-slate-500 font-mono mt-1">
                                <span>Bill Date: {new Date(inv.billDate).toLocaleDateString()}</span>
                                <span>Due: {new Date(inv.dueDate).toLocaleDateString()}</span>
                              </div>
                            </div>

                            <div className="text-right shrink-0">
                              <span className="text-sm font-extrabold text-slate-100">
                                {studentSchool?.currencySymbol || '$'}{inv.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                              </span>
                              <p className="text-[9px] text-slate-500 mt-1">
                                {inv.status === 'PAID' ? `Paid on ${new Date(inv.payment.paymentDate).toLocaleDateString()}` : 'Payment Pending'}
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

                            <button
                              onClick={() => setSelectedInvoice(invoicePayload)}
                              className="px-3 py-1 bg-brand-600 hover:bg-brand-500 text-white rounded-lg text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-all active:scale-95 shadow-md shadow-brand-500/10"
                            >
                              <Eye size={11} />
                              View Detail
                            </button>
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              </GlassCard>
            </div>

            {/* Right Panel: Summary stats */}
            <div className="lg:col-span-4 space-y-4">
              <GlassCard className="p-5 space-y-4">
                <div className="border-b border-slate-850 pb-2">
                  <h4 className="font-bold text-slate-200 text-xs uppercase tracking-wider">My Invoices Summary</h4>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 bg-slate-900/30 border border-slate-850 rounded-xl">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Total Invoices</span>
                    <h3 className="text-xl font-extrabold text-slate-200 mt-1">
                      {fees.length}
                    </h3>
                  </div>

                  <div className="p-3 bg-slate-900/30 border border-slate-850 rounded-xl">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Total Paid</span>
                    <h3 className="text-xl font-extrabold text-emerald-400 mt-1">
                      {studentSchool?.currencySymbol || '$'}{fees
                        .filter(f => f.payment?.status === 'PAID')
                        .reduce((sum, f) => sum + Number(f.structure.amount), 0)
                        .toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </h3>
                  </div>
                </div>

                <button
                  onClick={async () => {
                    alert('Generating batch PDF invoices...');
                    for (const f of fees) {
                      const stObj = mockDb.students.find(s => s.id === studentId);
                      const cls = stObj ? mockDb.classes.find(c => c.id === stObj.classId) : null;
                      const parentObj = mockDb.parentStudentMappings.find(m => m.studentId === studentId);
                      const parentDetails = parentObj ? mockDb.parents.find(p => p.id === parentObj.parentId) : null;
                      const parentUser = parentDetails ? mockDb.users.find(u => u.id === parentDetails.userId) : null;

                      const isPaid = f.payment?.status === 'PAID';
                      const billDate = f.structure.createdAt || new Date(new Date(f.structure.dueDate).getTime() - 14 * 24 * 60 * 60 * 1000).toISOString();
                      const invoiceNumber = f.payment?.transactionId 
                        ? `INV-${new Date(f.structure.dueDate).getFullYear()}-${f.payment.transactionId.substring(0, 6).toUpperCase()}` 
                        : `INV-${new Date(f.structure.dueDate).getFullYear()}-${f.structure.id.substring(0, 6).toUpperCase()}`;

                      const pl = {
                        schoolId: studentSchool?.id || '',
                        schoolName: studentSchool?.name || '',
                        schoolAddress: studentSchool?.address || '',
                        schoolPhone: studentSchool?.phone || '',
                        schoolEmail: studentSchool?.email || '',
                        logoUrl: studentSchool?.logoUrl || '',
                        sealUrl: studentSchool?.sealUrl || '',
                        currencySymbol: studentSchool?.currencySymbol || '$',
                        invoiceNumber,
                        billDate,
                        dueDate: f.structure.dueDate,
                        paymentDate: f.payment?.paymentDate || undefined,
                        billingCycle: new Date(billDate).toLocaleString('default', { month: 'long', year: 'numeric' }),
                        academicYear: '2026 - 27',
                        paymentMethod: f.payment?.paymentMethod || undefined,
                        transactionId: f.payment?.transactionId || undefined,
                        status: isPaid ? 'PAID' : 'UNPAID' as any,
                        studentName: `${session?.user?.firstName || 'Student'} ${session?.user?.lastName || ''}`,
                        studentClass: cls?.name || 'Class 10 - A',
                        studentRollNo: stObj?.rollNumber ? String(stObj.rollNumber) : '15',
                        studentAdmissionNo: stObj?.admissionNumber ? String(stObj.admissionNumber) : 'AEGIS2026/015',
                        studentId: studentId || '',
                        parentName: parentUser ? `${parentUser.firstName} ${parentUser.lastName}` : 'Guardian',
                        parentPhone: parentUser?.phone || 'N/A',
                        parentEmail: parentUser?.email || 'N/A',
                        parentRelation: 'Father',
                        amount: Number(f.structure.amount)
                      };
                      await downloadInvoicePdf(pl, false);
                    }
                  }}
                  className="w-full py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-brand-500/10 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Download size={14} />
                  Download All Invoices
                </button>
              </GlassCard>
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
                <h3 className="font-bold text-slate-100 text-sm">My Documents Center</h3>
                <p className="text-[10px] text-slate-400 mt-0.5">Access and download your official institutional identity cards, certified enrollment sheets, and active credentials.</p>
              </div>
            </div>
          </GlassCard>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {(() => {
              /**
               * Shared document download helper — fetches ALL data from DB,
               * eliminates every hardcoded placeholder ('Father Name', 'A', 'USA', etc.)
               */
              const handleDocDownload = async (type: string) => {
                try {
                  setDocGenerating(type);
                  if (!studentEntity) return;

                  const schoolId = studentEntity.schoolId || session?.user?.schoolId || '';

                  // Fetch enriched student data from DB
                  const enrichedSt = await fetchStudentDocData(studentEntity.id, schoolId);
                  const enrichedSchool = await fetchSchoolDocData(schoolId);
                  const principal = await fetchPrincipalDocData(schoolId);

                  if (!enrichedSt) {
                    alert('Error: Could not load your student data. Please try again.');
                    return;
                  }

                  const docSt = {
                    id: enrichedSt.studentId,
                    fullName: enrichedSt.fullName || studentName,
                    firstName: enrichedSt.firstName,
                    lastName: enrichedSt.lastName,
                    admissionNumber: enrichedSt.admissionNumber,
                    rollNumber: enrichedSt.rollNumber,
                    className: enrichedSt.className || className,
                    sectionName: enrichedSt.sectionName,
                    dateOfBirth: enrichedSt.dateOfBirth,
                    gender: enrichedSt.gender,
                    photoUrl: enrichedSt.photoUrl,
                    avatarUrl: enrichedSt.avatarUrl || studentUser?.avatarUrl,
                    bloodGroup: enrichedSt.bloodGroup,
                    aadhaarNumber: enrichedSt.aadhaarNumber,
                    nationality: enrichedSt.nationality,
                    religion: enrichedSt.religion,
                    category: enrichedSt.category,
                    house: enrichedSt.house,
                    phone: enrichedSt.phone || studentUser?.phone,
                    email: enrichedSt.email,
                    addressLine1: enrichedSt.addressLine1,
                    addressLine2: enrichedSt.addressLine2,
                    city: enrichedSt.city,
                    state: enrichedSt.state,
                    pincode: enrichedSt.pincode,
                    country: enrichedSt.country,
                    fatherName: enrichedSt.fatherName,
                    fatherPhone: enrichedSt.fatherPhone,
                    fatherOccupation: enrichedSt.fatherOccupation,
                    motherName: enrichedSt.motherName,
                    motherPhone: enrichedSt.motherPhone,
                    motherOccupation: enrichedSt.motherOccupation,
                    admissionDate: enrichedSt.admissionDate,
                    academicSession: enrichedSt.academicSession,
                    previousSchool: enrichedSt.previousSchool,
                    previousClass: enrichedSt.previousClass,
                    previousBoard: enrichedSt.previousBoard,
                    previousPercentage: enrichedSt.previousPercentage,
                  };

                  const docSchool = enrichedSchool ? {
                    id: enrichedSchool.id,
                    name: enrichedSchool.name,
                    address: enrichedSchool.address,
                    phone: enrichedSchool.phone,
                    email: enrichedSchool.email,
                    logoUrl: enrichedSchool.logoUrl,
                    sealUrl: enrichedSchool.sealUrl,
                    sessionName: enrichedSchool.sessionName,
                  } : {
                    id: schoolId,
                    name: schoolName,
                    address: studentSchool?.address || '',
                    phone: studentSchool?.phone || '',
                    email: '',
                    logoUrl: studentSchool?.logoUrl || '',
                    sealUrl: studentSchool?.sealUrl || '',
                    sessionName: '2025-2026',
                  };

                  const pSig = principal.signatureUrl;
                  const pName = principal.name;

                  if (type === 'idcard') {
                    await downloadStudentIdCardPdf(docSchool, docSt, pSig, pName);
                  } else if (type === 'admission') {
                    await downloadAdmissionFormPdf(docSchool, docSt, undefined, pSig, pName);
                  } else if (type === 'admission_record') {
                    await downloadAdmissionRecordPdf(docSchool, docSt, pSig, pName);
                  } else if (type === 'bonafide') {
                    await downloadBonafideCertificatePdf(docSchool, docSt, pSig, pName);
                  } else if (type === 'character') {
                    await downloadCharacterCertificatePdf(docSchool, docSt, pSig, pName, characterCertDoc?.verificationNumber);
                  } else if (type === 'transfer') {
                    await downloadTransferCertificatePdf(docSchool, docSt, pSig, pName);
                  }
                } catch (err) {
                  console.error('Failed to generate document:', err);
                  alert('Error building document PDF.');
                } finally {
                  setDocGenerating('');
                }
              };

              return (
                <>
                  {/* ID Card */}
                  <div className="p-4 bg-slate-900/40 border border-slate-850 rounded-2xl flex flex-col justify-between gap-4">
                    <div>
                      <h6 className="font-bold text-slate-200 text-xs">My Student ID Card (CR80)</h6>
                      <p className="text-[10px] text-slate-450 mt-1">High-fidelity portrait wallet ID card with your photo, roll details, verified QR, logo, seal, and administrative signature.</p>
                    </div>
                    <button
                      onClick={() => handleDocDownload('idcard')}
                      disabled={!!docGenerating}
                      className="w-full glass-btn-primary py-2 text-xs flex items-center justify-center gap-1.5"
                    >
                      {docGenerating === 'idcard' ? 'Generating...' : 'Download ID Card (PDF)'}
                    </button>
                  </div>

                  {/* Admission Form */}
                  <div className="p-4 bg-slate-900/40 border border-slate-850 rounded-2xl flex flex-col justify-between gap-4">
                    <div>
                      <h6 className="font-bold text-slate-200 text-xs">My Admission Form Sheet</h6>
                      <p className="text-[10px] text-slate-450 mt-1">Pre-filled admission registry sheet with all verified profile fields, parent contact details, logo, and seal.</p>
                    </div>
                    <button
                      onClick={() => handleDocDownload('admission')}
                      disabled={!!docGenerating}
                      className="w-full glass-btn-primary py-2 text-xs flex items-center justify-center gap-1.5"
                    >
                      {docGenerating === 'admission' ? 'Generating...' : 'Download Admission Form (PDF)'}
                    </button>
                  </div>

                  {/* Admission Record */}
                  <div className="p-4 bg-slate-900/40 border border-slate-850 rounded-2xl flex flex-col justify-between gap-4">
                    <div>
                      <h6 className="font-bold text-slate-200 text-xs">My Admission Record</h6>
                      <p className="text-[10px] text-slate-450 mt-1">Comprehensive official record with all personal, academic, parent, address, and previous school details from the database.</p>
                    </div>
                    <button
                      onClick={() => handleDocDownload('admission_record')}
                      disabled={!!docGenerating}
                      className="w-full glass-btn-primary py-2 text-xs flex items-center justify-center gap-1.5"
                    >
                      {docGenerating === 'admission_record' ? 'Generating...' : 'Download Admission Record (PDF)'}
                    </button>
                  </div>

                  {/* Bonafide Certificate */}
                  <div className="p-4 bg-slate-900/40 border border-slate-850 rounded-2xl flex flex-col justify-between gap-4">
                    <div>
                      <h6 className="font-bold text-slate-200 text-xs">My Bonafide Certificate</h6>
                      <p className="text-[10px] text-slate-450 mt-1">Officially signed letter verifying your active registration status within the institution.</p>
                    </div>
                    <button
                      onClick={() => handleDocDownload('bonafide')}
                      disabled={!!docGenerating}
                      className="w-full glass-btn-primary py-2 text-xs flex items-center justify-center gap-1.5"
                    >
                      {docGenerating === 'bonafide' ? 'Generating...' : 'Download Bonafide Cert (PDF)'}
                    </button>
                  </div>

                  {/* Character Certificate — gated: only visible if Admin has generated it */}
                  {characterCertDoc === undefined ? (
                    <div className="p-4 bg-slate-900/40 border border-slate-800 rounded-2xl flex items-center justify-center text-slate-500 text-xs animate-pulse">
                      Checking certificate status…
                    </div>
                  ) : characterCertDoc !== null ? (
                    <div className="p-4 bg-emerald-950/30 border border-emerald-800/40 rounded-2xl flex flex-col justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-1.5 mb-1">
                          <h6 className="font-bold text-emerald-300 text-xs">Character Certificate</h6>
                          <span className="text-[8px] bg-emerald-900/60 text-emerald-400 px-1.5 py-0.5 rounded-full font-bold uppercase">Issued</span>
                        </div>
                        <p className="text-[10px] text-slate-450">Your character certificate has been issued by the school. Issued on {new Date(characterCertDoc.generatedAt).toLocaleDateString('en-IN')}.</p>
                        {characterCertDoc.verificationNumber && (
                          <p className="text-[9px] font-mono text-slate-500 mt-1">Cert No.: {characterCertDoc.verificationNumber}</p>
                        )}
                      </div>
                      <button
                        onClick={() => handleDocDownload('character')}
                        disabled={!!docGenerating}
                        className="w-full py-2 text-xs flex items-center justify-center gap-1.5 bg-emerald-700/80 hover:bg-emerald-600 text-white rounded-xl font-semibold transition-colors"
                      >
                        {docGenerating === 'character' ? 'Generating...' : 'Download Character Certificate (PDF)'}
                      </button>
                    </div>
                  ) : (
                    <div className="p-4 bg-slate-900/20 border border-dashed border-slate-700 rounded-2xl flex flex-col justify-between gap-3 opacity-60">
                      <div>
                        <h6 className="font-bold text-slate-400 text-xs">Character Certificate</h6>
                        <p className="text-[10px] text-slate-500 mt-1">Not yet issued by your school. Contact the school administration to request issuance.</p>
                      </div>
                      <div className="text-center text-[10px] text-slate-500 italic border border-dashed border-slate-700 rounded-lg py-2">
                        Awaiting issuance by School Admin
                      </div>
                    </div>
                  )}

                  {/* Transfer Certificate — gated: only visible if Admin has generated it */}
                  {transferCertDoc === undefined ? (
                    <div className="p-4 bg-slate-900/40 border border-slate-800 rounded-2xl flex items-center justify-center text-slate-500 text-xs animate-pulse">
                      Checking certificate status…
                    </div>
                  ) : transferCertDoc !== null ? (
                    <div className="p-4 bg-sky-950/30 border border-sky-800/40 rounded-2xl flex flex-col justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-1.5 mb-1">
                          <h6 className="font-bold text-sky-300 text-xs">Transfer Certificate</h6>
                          <span className="text-[8px] bg-sky-900/60 text-sky-400 px-1.5 py-0.5 rounded-full font-bold uppercase">Issued</span>
                        </div>
                        <p className="text-[10px] text-slate-450">Your transfer/leaving certificate has been issued by the school. Issued on {new Date(transferCertDoc.generatedAt).toLocaleDateString('en-IN')}.</p>
                        {transferCertDoc.verificationNumber && (
                          <p className="text-[9px] font-mono text-slate-500 mt-1">Cert No.: {transferCertDoc.verificationNumber}</p>
                        )}
                      </div>
                      <button
                        onClick={() => handleDocDownload('transfer')}
                        disabled={!!docGenerating}
                        className="w-full py-2 text-xs flex items-center justify-center gap-1.5 bg-sky-700/80 hover:bg-sky-600 text-white rounded-xl font-semibold transition-colors"
                      >
                        {docGenerating === 'transfer' ? 'Generating...' : 'Download Transfer Certificate (PDF)'}
                      </button>
                    </div>
                  ) : (
                    <div className="p-4 bg-slate-900/20 border border-dashed border-slate-700 rounded-2xl flex flex-col justify-between gap-3 opacity-60">
                      <div>
                        <h6 className="font-bold text-slate-400 text-xs">Transfer Certificate</h6>
                        <p className="text-[10px] text-slate-500 mt-1">Not yet issued by your school. Contact the school administration to request a transfer certificate.</p>
                      </div>
                      <div className="text-center text-[10px] text-slate-500 italic border border-dashed border-slate-700 rounded-lg py-2">
                        Awaiting issuance by School Admin
                      </div>
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        </div>
      )}

      {activeTab === 'ptm' && (
        <PremiumLock
          isLocked={isTabLockedByEntitlements('STUDENT', 'ptm', ent)}
          requiredTier="Pro"
          featureName="PTM Meetings"
        >
          <StudentPTMManagement />
        </PremiumLock>
      )}

      {activeTab === 'hostel' && (
        <PremiumLock 
          isLocked={!ent.hasHostelAccess} 
          requiredTier="Enterprise" 
          featureName="Hostel Hub"
          customMessage="Hostel services are available only for institutions with an active Enterprise Subscription. Please contact your School Administrator to upgrade your institution's plan."
        >
          <div className="space-y-6 animate-fade-in">
            {/* If the student is not active in any hostel */}
            {!activeAdmission ? (
              <GlassCard className="text-center py-16 p-6 flex flex-col items-center justify-center gap-3">
                <Home size={40} className="text-slate-650 animate-pulse-subtle" />
                <p className="text-sm text-slate-350 font-semibold font-mono">No Active Hostel Admission</p>
                <p className="text-xs text-slate-500 max-w-md">
                  You are not currently registered or assigned to an active bed space in any hostel building. Please contact the Hostel Warden or Admin for registration/allocation assistance.
                </p>
              </GlassCard>
            ) : (
              <div className="space-y-6">
                {/* 1. Header Grid / Allocations & Warden Contact */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <GlassCard className="p-5 flex flex-col justify-between">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-brand-400">
                        <Home size={18} />
                        <h4 className="font-bold text-xs uppercase tracking-wider">Room Allocation</h4>
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
                        <User size={18} />
                        <h4 className="font-bold text-xs uppercase tracking-wider">Hostel Warden Details</h4>
                      </div>
                      {wardenDetails && wardenDetails.status === 'ACTIVE' ? (
                        <div className="space-y-2.5">
                          <div>
                            <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Name</p>
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
                              <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Designation</p>
                              <p className="text-xs text-slate-200 font-semibold">{wardenDetails.designation || 'Hostel Warden'}</p>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Phone Number</p>
                              <p className="text-xs text-brand-400 font-bold font-mono">{wardenDetails.phone || 'N/A'}</p>
                            </div>
                            <div>
                              <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Email Address</p>
                              <p className="text-xs text-slate-200 font-semibold truncate">{wardenDetails.email || wardenDetails.userDetails?.email || 'N/A'}</p>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Assigned Block</p>
                              <p className="text-xs text-slate-200 font-semibold">{blockDetails?.name || 'N/A'}</p>
                            </div>
                            <div>
                              <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Status</p>
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                {wardenDetails.status || 'ACTIVE'}
                              </span>
                            </div>
                          </div>
                          <div>
                            <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Joining Date</p>
                            <p className="text-xs text-slate-200 font-medium">{wardenDetails.joiningDate ? new Date(wardenDetails.joiningDate).toLocaleDateString() : 'N/A'}</p>
                          </div>
                        </div>
                      ) : (
                        <p className="text-xs text-slate-500 italic py-6 text-center">No specific warden assigned to this building structure yet.</p>
                      )}
                    </div>
                    <div className="border-t border-slate-850 pt-3 mt-4 text-[10px] text-slate-500 font-medium">
                      Admission Date: {activeAdmission.admissionDate ? new Date(activeAdmission.admissionDate).toLocaleDateString() : 'N/A'}
                    </div>
                  </GlassCard>

                  <GlassCard className="p-5 flex flex-col justify-between">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-indigo-400">
                        <Activity size={18} />
                        <h4 className="font-bold text-xs uppercase tracking-wider">Attendance Rate</h4>
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
                              <span className="text-amber-400 font-bold">{leaveAtt} Approved Leave</span>
                              <span>•</span>
                              <span className="text-red-400 font-bold">{absentAtt} Absent</span>
                            </div>
                            <p className="text-[10px] text-slate-500 mt-1">Based on Warden evening/morning roster check-ins</p>
                          </>
                        );
                      })()}
                    </div>
                    <div className="border-t border-slate-850 pt-3 mt-4 text-[10px] text-slate-500 flex justify-between">
                      <span>Total Roll Checks: {myAttendance.length}</span>
                      <span className="text-teal-400 font-bold font-mono">Roll Sync Active</span>
                    </div>
                  </GlassCard>
                </div>

                {/* 2. Mess Menu & Attendance Logs */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Mess Menu Menu Grid */}
                  <GlassCard className="p-5 space-y-4">
                    <div className="border-b border-slate-850 pb-2 flex items-center gap-2 text-brand-400">
                      <Utensils size={18} />
                      <h4 className="font-bold text-xs uppercase tracking-wider text-slate-100">Hostel Mess Menu Planner</h4>
                    </div>

                    {messMenus.length === 0 ? (
                      <div className="text-center py-10 flex flex-col items-center justify-center gap-2">
                        <Coffee size={24} className="text-slate-650 animate-pulse-subtle" />
                        <p className="text-xs text-slate-450 italic">Mess Menu Planner has not been configured for this cycle.</p>
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

                  {/* Attendance Log Card */}
                  <GlassCard className="p-5 space-y-4">
                    <div className="border-b border-slate-850 pb-2 flex items-center gap-2 text-brand-400">
                      <ClipboardList size={18} />
                      <h4 className="font-bold text-xs uppercase tracking-wider text-slate-100">Daily Attendance Roll Log</h4>
                    </div>

                    {myAttendance.length === 0 ? (
                      <div className="text-center py-10 flex flex-col items-center justify-center gap-2">
                        <Activity size={24} className="text-slate-650" />
                        <p className="text-xs text-slate-450 italic">No attendance records registered yet for your profile.</p>
                      </div>
                    ) : (
                      <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
                        {myAttendance
                          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                          .map((att, index) => (
                            <div key={index} className="p-3 bg-slate-900/30 border border-slate-850 rounded-xl flex items-center justify-between text-xs hover:border-slate-800 transition-all duration-200">
                              <div className="space-y-1">
                                <p className="font-semibold text-slate-300">
                                  {new Date(att.date).toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}
                                </p>
                                <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Shift: {att.timeSlot}</p>
                              </div>
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase border ${
                                att.status === 'PRESENT' 
                                  ? 'bg-emerald-500/10 border-emerald-500/15 text-emerald-400' 
                                  : att.status === 'LEAVE'
                                    ? 'bg-amber-500/10 border-amber-500/15 text-amber-400'
                                    : 'bg-red-500/10 border-red-500/15 text-red-400'
                              }`}>
                                {att.status}
                              </span>
                            </div>
                          ))}
                      </div>
                    )}
                  </GlassCard>
                </div>

                {/* 3. Leave Requests & Workflow approvals */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  {/* Leave Request Form */}
                  <GlassCard className="p-5 lg:col-span-4 space-y-4">
                    <div className="border-b border-slate-850 pb-2 flex items-center gap-2 text-brand-400">
                      <Clock size={18} />
                      <h4 className="font-bold text-xs uppercase tracking-wider text-slate-100">Request Gate Leave</h4>
                    </div>

                    <form onSubmit={handleCreateLeaveRequest} className="space-y-3.5">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">From Date</label>
                        <input 
                          type="date" 
                          value={leaveFromDate}
                          onChange={(e) => setLeaveFromDate(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-800 text-xs text-slate-100 rounded-lg p-2 focus:outline-none focus:border-brand-500"
                          required
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">To Date</label>
                        <input 
                          type="date" 
                          value={leaveToDate}
                          onChange={(e) => setLeaveToDate(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-800 text-xs text-slate-100 rounded-lg p-2 focus:outline-none focus:border-brand-500"
                          required
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Reason / Destination</label>
                        <textarea 
                          placeholder="Provide leave description, travel details, and contact point..."
                          rows={3}
                          value={leaveReason}
                          onChange={(e) => setLeaveReason(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-800 text-xs text-slate-100 rounded-lg p-2 focus:outline-none focus:border-brand-500"
                          required
                        />
                      </div>
                      <button type="submit" className="w-full glass-btn-primary text-xs cursor-pointer py-2 font-semibold">
                        Submit Leave Request
                      </button>
                    </form>
                  </GlassCard>

                  {/* Leave Request Logs */}
                  <GlassCard className="p-5 lg:col-span-8 space-y-4">
                    <div className="border-b border-slate-850 pb-2 flex items-center gap-2 text-brand-400">
                      <Clock size={18} />
                      <h4 className="font-bold text-xs uppercase tracking-wider text-slate-100">Leave Approvals Tracker</h4>
                    </div>

                    {myLeaveRequests.length === 0 ? (
                      <div className="text-center py-16 flex flex-col items-center justify-center gap-2">
                        <Clock size={28} className="text-slate-650" />
                        <p className="text-xs text-slate-450 italic">No leave requests recorded yet.</p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs text-left border-collapse">
                          <thead>
                            <tr className="border-b border-slate-850 text-slate-400 uppercase tracking-widest text-[9px]">
                              <th className="py-2.5">Dates</th>
                              <th className="py-2.5">Reason</th>
                              <th className="py-2.5">Parent Stage</th>
                              <th className="py-2.5">Warden Stage</th>
                              <th className="py-2.5">Hostel Admin Stage</th>
                              <th className="py-2.5">School Admin Stage</th>
                              <th className="py-2.5">Final Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-850">
                            {myLeaveRequests
                              .sort((a, b) => new Date(b.fromDate).getTime() - new Date(a.fromDate).getTime())
                              .map((l) => (
                                <tr key={l.id} className="hover:bg-slate-900/30 text-slate-300">
                                  <td className="py-3 font-medium whitespace-nowrap">
                                    {new Date(l.fromDate).toLocaleDateString()} to {new Date(l.toDate).toLocaleDateString()}
                                  </td>
                                  <td className="py-3 max-w-[150px] truncate" title={l.reason}>{l.reason}</td>
                                  <td className="py-3">
                                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${
                                      l.parentApproval === 'APPROVED' 
                                        ? 'bg-emerald-500/10 border-emerald-500/15 text-emerald-400' 
                                        : l.parentApproval === 'REJECTED'
                                          ? 'bg-red-500/10 border-red-500/15 text-red-400'
                                          : 'bg-amber-500/10 border-amber-500/15 text-amber-400'
                                    }`}>
                                      {l.parentApproval}
                                    </span>
                                  </td>
                                  <td className="py-3">
                                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${
                                      l.wardenApproval === 'APPROVED' 
                                        ? 'bg-emerald-500/10 border-emerald-500/15 text-emerald-400' 
                                        : l.wardenApproval === 'REJECTED'
                                          ? 'bg-red-500/10 border-red-500/15 text-red-400'
                                          : 'bg-amber-500/10 border-amber-500/15 text-amber-400'
                                    }`}>
                                      {l.wardenApproval}
                                    </span>
                                  </td>
                                  <td className="py-3">
                                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${
                                      (l.hostelAdminApproval || 'PENDING') === 'APPROVED' 
                                        ? 'bg-emerald-500/10 border-emerald-500/15 text-emerald-400' 
                                        : (l.hostelAdminApproval || 'PENDING') === 'REJECTED'
                                          ? 'bg-red-500/10 border-red-500/15 text-red-400'
                                          : 'bg-amber-500/10 border-amber-500/15 text-amber-400'
                                    }`}>
                                      {l.hostelAdminApproval || 'PENDING'}
                                    </span>
                                  </td>
                                  <td className="py-3">
                                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${
                                      l.adminApproval === 'APPROVED' 
                                        ? 'bg-emerald-500/10 border-emerald-500/15 text-emerald-400' 
                                        : l.adminApproval === 'REJECTED'
                                          ? 'bg-red-500/10 border-red-500/15 text-red-400'
                                          : 'bg-amber-500/10 border-amber-500/15 text-amber-400'
                                    }`}>
                                      {l.adminApproval}
                                    </span>
                                  </td>
                                  <td className="py-3 font-bold">
                                    <span className={`text-[9.5px] font-bold px-2 py-0.5 rounded-full border ${
                                      l.status === 'APPROVED' 
                                        ? 'bg-emerald-500/15 border-emerald-500/25 text-emerald-400' 
                                        : l.status === 'REJECTED'
                                          ? 'bg-red-500/15 border-red-500/25 text-red-400'
                                          : l.status === 'HOLD'
                                            ? 'bg-amber-500/15 border-amber-500/25 text-amber-400'
                                            : 'bg-blue-500/15 border-blue-500/25 text-blue-400'
                                    }`}>
                                      {l.status}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </GlassCard>
                </div>

                {/* 4. Complaints & Grievances Ledger */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  {/* Lodge Complaint Form */}
                  <GlassCard className="p-5 lg:col-span-4 space-y-4">
                    <div className="border-b border-slate-850 pb-2 flex items-center gap-2 text-brand-400">
                      <ShieldAlert size={18} />
                      <h4 className="font-bold text-xs uppercase tracking-wider text-slate-100">Log Room Complaint</h4>
                    </div>

                    <form onSubmit={handleCreateComplaint} className="space-y-3.5">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Issue Category</label>
                        <select 
                          value={complaintCategory}
                          onChange={(e) => setComplaintCategory(e.target.value as any)}
                          className="w-full bg-slate-900 border border-slate-800 text-xs text-slate-100 rounded-lg p-2 focus:outline-none focus:border-brand-500"
                        >
                          <option value="ROOM">Room Allocation Issue</option>
                          <option value="ELECTRICITY">Electricity / Wiring</option>
                          <option value="WATER">Water Supply / Plumbing</option>
                          <option value="MAINTENANCE">Furniture / Infrastructure</option>
                          <option value="OTHER">Other Issues</option>
                        </select>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Issue Details</label>
                        <textarea 
                          placeholder="Describe the complaint in detail so that warden can dispatch maintenance..."
                          rows={4}
                          value={complaintDescription}
                          onChange={(e) => setComplaintDescription(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-800 text-xs text-slate-100 rounded-lg p-2 focus:outline-none focus:border-brand-500"
                          required
                        />
                      </div>
                      <button type="submit" className="w-full glass-btn-primary text-xs cursor-pointer py-2 font-semibold">
                        Log Maintenance Complaint
                      </button>
                    </form>
                  </GlassCard>

                  {/* Complaints Tracker Table */}
                  <GlassCard className="p-5 lg:col-span-8 space-y-4">
                    <div className="border-b border-slate-850 pb-2 flex items-center gap-2 text-brand-400">
                      <ShieldAlert size={18} />
                      <h4 className="font-bold text-xs uppercase tracking-wider text-slate-100">Maintenance & Complaints Log</h4>
                    </div>

                    {myComplaints.length === 0 ? (
                      <div className="text-center py-16 flex flex-col items-center justify-center gap-2">
                        <ShieldAlert size={28} className="text-slate-650" />
                        <p className="text-xs text-slate-450 italic">No room complaints logged.</p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs text-left border-collapse">
                          <thead>
                            <tr className="border-b border-slate-850 text-slate-400 uppercase tracking-widest text-[9px]">
                              <th className="py-2.5">Category</th>
                              <th className="py-2.5">Description</th>
                              <th className="py-2.5">Assigned Staff</th>
                              <th className="py-2.5">Status</th>
                              <th className="py-2.5">Resolution Notes</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-850 text-slate-300">
                            {myComplaints
                              .sort((a, b) => b.status.localeCompare(a.status))
                              .map((c) => (
                                <tr key={c.id} className="hover:bg-slate-900/30 text-slate-300">
                                  <td className="py-3 font-semibold text-brand-400">{c.category}</td>
                                  <td className="py-3 max-w-[200px] truncate" title={c.description}>{c.description}</td>
                                  <td className="py-3 text-slate-450">{c.assignedStaff || 'Unassigned'}</td>
                                  <td className="py-3">
                                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${
                                      c.status === 'RESOLVED' || c.status === 'CLOSED'
                                        ? 'bg-emerald-500/10 border-emerald-500/15 text-emerald-400'
                                        : c.status === 'ASSIGNED'
                                          ? 'bg-indigo-500/10 border-indigo-500/15 text-indigo-400'
                                          : 'bg-amber-500/10 border-amber-500/15 text-amber-400'
                                    }`}>
                                      {c.status}
                                    </span>
                                  </td>
                                  <td className="py-3 text-slate-450 italic max-w-[150px] truncate" title={c.resolutionNotes || '-'}>
                                    {c.resolutionNotes || '-'}
                                  </td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </GlassCard>
                </div>

                {/* 5. Visitor Logs & Fees Ledger */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Visitor Logs */}
                  <GlassCard className="p-5 space-y-4">
                    <div className="border-b border-slate-850 pb-2 flex items-center gap-2 text-brand-400">
                      <User size={18} />
                      <h4 className="font-bold text-xs uppercase tracking-wider text-slate-100">Visitor Logs</h4>
                    </div>

                    {myVisitorLogs.length === 0 ? (
                      <div className="text-center py-10 flex flex-col items-center justify-center gap-2">
                        <User size={24} className="text-slate-650" />
                        <p className="text-xs text-slate-450 italic">No visitor logs recorded yet.</p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs text-left border-collapse">
                          <thead>
                            <tr className="border-b border-slate-850 text-slate-400 uppercase tracking-widest text-[9px]">
                              <th className="py-2.5">Visitor Name</th>
                              <th className="py-2.5">Relation</th>
                              <th className="py-2.5">Purpose</th>
                              <th className="py-2.5">Entry Time</th>
                              <th className="py-2.5">Exit Time</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-850 text-slate-300">
                            {myVisitorLogs
                              .sort((a, b) => new Date(b.entryTime).getTime() - new Date(a.entryTime).getTime())
                              .map((v) => (
                                <tr key={v.id} className="hover:bg-slate-900/30">
                                  <td className="py-3 font-semibold text-slate-200">{v.visitorName}</td>
                                  <td className="py-3 text-slate-400">{v.relation}</td>
                                  <td className="py-3 text-slate-400 max-w-[120px] truncate" title={v.purpose}>{v.purpose}</td>
                                  <td className="py-3 font-mono text-[10px] text-slate-450">
                                    {new Date(v.entryTime).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })}
                                  </td>
                                  <td className="py-3 font-mono text-[10px] text-slate-450">
                                    {v.exitTime ? (
                                      new Date(v.exitTime).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })
                                    ) : (
                                      <span className="text-amber-400 font-bold uppercase text-[9px] px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/15">
                                        Still In
                                      </span>
                                    )}
                                  </td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </GlassCard>

                  {/* Fee Status & Payments */}
                  <GlassCard className="p-5 space-y-4">
                    <div className="border-b border-slate-850 pb-2 flex items-center gap-2 text-brand-400">
                      <DollarSign size={18} />
                      <h4 className="font-bold text-xs uppercase tracking-wider text-slate-100">Hostel Fees & Payments Ledger</h4>
                    </div>

                    {myPayments.length === 0 ? (
                      <div className="text-center py-10 flex flex-col items-center justify-center gap-2">
                        <DollarSign size={24} className="text-slate-650" />
                        <p className="text-xs text-slate-450 italic">No hostel payments or fee invoices found.</p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs text-left border-collapse">
                          <thead>
                            <tr className="border-b border-slate-850 text-slate-400 uppercase tracking-widest text-[9px]">
                              <th className="py-2.5">Fee Name</th>
                              <th className="py-2.5">Type</th>
                              <th className="py-2.5">Amount Paid</th>
                              <th className="py-2.5">Method</th>
                              <th className="py-2.5">Date</th>
                              <th className="py-2.5">Tx ID</th>
                              <th className="py-2.5">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-850 text-slate-300">
                            {myPayments
                              .sort((a, b) => new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime())
                              .map((p) => (
                                <tr key={p.id} className="hover:bg-slate-900/30">
                                  <td className="py-3 font-semibold text-slate-200">{p.fee?.name || 'Hostel Fee'}</td>
                                  <td className="py-3 text-[10px] text-slate-400">{p.fee?.feeType || 'N/A'}</td>
                                  <td className="py-3 font-bold text-slate-200">${p.amountPaid}</td>
                                  <td className="py-3 font-mono text-[10px] text-slate-400">{p.paymentMethod}</td>
                                  <td className="py-3 text-slate-400">
                                    {new Date(p.paymentDate).toLocaleDateString()}
                                  </td>
                                  <td className="py-3 font-mono text-[10px] text-slate-500" title={p.txId}>{p.txId || '-'}</td>
                                  <td className="py-3">
                                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${
                                      p.status === 'PAID'
                                        ? 'bg-emerald-500/10 border-emerald-500/15 text-emerald-400'
                                        : p.status === 'PARTIAL'
                                          ? 'bg-indigo-500/10 border-indigo-500/15 text-indigo-400'
                                          : 'bg-amber-500/10 border-amber-500/15 text-amber-400'
                                    }`}>
                                      {p.status}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </GlassCard>
                </div>
              </div>
            )}
          </div>
        </PremiumLock>
      )}

      {/* Assignment Upload Drawer Overlay */}
      {selectedAssignment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in p-4">
          <GlassCard className="w-full max-w-lg space-y-6">
            <div className="border-b border-slate-850 pb-3 flex items-center justify-between">
              <div>
                <h4 className="font-bold text-slate-100">Upload Homework Submission</h4>
                <p className="text-[10px] text-slate-400 mt-0.5">{selectedAssignment.title}</p>
              </div>
              <button 
                onClick={() => setSelectedAssignment(null)}
                className="text-xs text-slate-400 hover:text-slate-200"
              >
                Close Drawer
              </button>
            </div>

            <form onSubmit={handleAssignmentSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Submission Note</label>
                <textarea 
                  placeholder="Explain your workings or summarize submission details..."
                  rows={3}
                  value={submittingText}
                  onChange={(e) => setSubmittingText(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 text-xs text-slate-100 rounded-lg p-2 focus:outline-none focus:border-brand-500"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Attach Homework / Assignment Files</label>
                
                {uploadState === 'idle' && !submittingFile && (
                  <div 
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                        handleFileChange(e.dataTransfer.files[0]);
                      }
                    }}
                    onClick={() => document.getElementById('homework-file-picker')?.click()}
                    className="border-2 border-dashed border-slate-800 hover:border-brand-500/50 hover:bg-brand-500/5 rounded-2xl p-6 flex flex-col items-center justify-center gap-2 cursor-pointer transition-all duration-300 group"
                  >
                    <input 
                      type="file" 
                      id="homework-file-picker" 
                      className="hidden" 
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          handleFileChange(e.target.files[0]);
                        }
                      }}
                      accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.zip,.mp4"
                    />
                    <UploadCloud size={32} className="text-slate-500 group-hover:text-brand-400 group-hover:scale-110 transition-all duration-300" />
                    <p className="text-xs font-semibold text-slate-300">Drag & drop your file here, or <span className="text-brand-400 hover:underline">browse</span></p>
                    <p className="text-[9px] text-slate-500 text-center font-medium">Supports PDF, DOCX, ZIP, JPG, PNG, MP4 up to 50MB</p>
                  </div>
                )}

                {uploadState === 'uploading' && (
                  <div className="border border-slate-800 bg-slate-950/40 rounded-2xl p-5 flex flex-col gap-3">
                    <div className="flex items-center gap-3">
                      <Loader2 size={20} className="text-brand-400 animate-spin" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-slate-300 truncate">Uploading attachment...</p>
                        <p className="text-[9px] text-slate-500">Please wait while we secure your submission</p>
                      </div>
                      <span className="text-xs font-bold text-brand-400 font-mono">{uploadProgress}%</span>
                    </div>
                    <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden">
                      <div 
                        className="bg-brand-500 h-full rounded-full transition-all duration-300 shadow-[0_0_10px_rgba(59,130,246,0.5)]" 
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                  </div>
                )}

                {uploadState === 'success' && submittingFile && (
                  <div className="border border-green-500/20 bg-green-500/5 rounded-2xl p-4 flex items-center justify-between gap-3 animate-fade-in">
                    <div className="flex items-center gap-3 truncate">
                      <div className="w-10 h-10 rounded-xl bg-green-500/10 border border-green-500/25 flex items-center justify-center shrink-0">
                        <FileText size={18} className="text-green-400" />
                      </div>
                      <div className="truncate">
                        <p className="text-xs font-bold text-slate-200 truncate">
                          {selectedFile ? selectedFile.name : submittingFile.split('/').pop()?.split('_').slice(2).join('_') || 'homework_attachment'}
                        </p>
                        <p className="text-[9px] text-green-400 font-mono font-bold flex items-center gap-1">
                          <CheckCircle size={10} className="text-green-400" /> Securely Attached
                        </p>
                      </div>
                    </div>
                    <button 
                      type="button" 
                      onClick={handleRemoveFile}
                      className="p-2 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 text-slate-400 hover:text-red-400 rounded-xl transition-all duration-200"
                      title="Remove attachment"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                )}

                {uploadState === 'error' && (
                  <div className="border border-red-500/20 bg-red-500/5 rounded-2xl p-4 flex flex-col gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/25 flex items-center justify-center shrink-0">
                        <AlertCircle size={18} className="text-red-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-slate-200">Upload Failed</p>
                        <p className="text-[9px] text-red-400 font-medium line-clamp-1">{uploadError}</p>
                      </div>
                      <button 
                        type="button" 
                        onClick={() => {
                          setUploadState('idle');
                          setSelectedFile(null);
                          setSubmittingFile('');
                        }}
                        className="text-[10px] font-bold text-slate-400 hover:text-slate-200 uppercase tracking-widest font-mono"
                      >
                        Try Again
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button 
                  type="button" 
                  onClick={() => setSelectedAssignment(null)}
                  className="glass-btn-secondary text-xs"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={!submittingFile || uploadState === 'uploading'}
                  className={`glass-btn-primary text-xs flex items-center gap-1.5 ${(!submittingFile || uploadState === 'uploading') ? 'opacity-40 cursor-not-allowed' : ''}`}
                >
                  {uploadState === 'uploading' ? (
                    <>
                      <Loader2 size={13} className="animate-spin" /> Submitting...
                    </>
                  ) : 'Submit Homework'}
                </button>
              </div>
            </form>
          </GlassCard>
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
                className="px-3 py-1 bg-slate-900 hover:bg-slate-850 text-slate-300 rounded-lg text-[10px] font-bold cursor-pointer"
              >
                Close Audit Log
              </button>
            </div>
          </GlassCard>
        </div>
      )}
    </div>
  );
};
