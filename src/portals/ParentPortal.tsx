import React, { useState, useEffect } from 'react';
import { useStore } from '../store/useStore';
import { mockApi } from '../services/mockApi';
import { mockDb } from '../services/mockDb';
import { Student, User, Quiz, QuizAttempt,
  Hostel, HostelBlock, HostelRoom, HostelBed, HostelWarden, HostelAdmission,
  HostelAttendance, HostelFee, HostelPayment, HostelLeaveRequest, HostelVisitor,
  HostelComplaint, HostelMessMenu
} from '../types';
import { GlassCard } from '../components/GlassCard';
import { supabase } from '../lib/supabase';
import { 
  Eye, Award, DollarSign, Calendar, FileText, 
  User as UserIcon, ShieldAlert, CheckCircle, AlertCircle, UsersRound, Clock,
  BookOpen, Play, Download, MessageCircle, Paperclip,
  Filter, Search, ChevronDown, ChevronRight, ExternalLink,
  BookMarked, Layers, Home, Coffee, Utensils, ClipboardList, Check, X
} from 'lucide-react';
import PremiumLock from '../components/PremiumLock';
import { subscriptionPlans } from '../services/subscriptionConfig';
import { downloadMarksheetPdf } from '../components/MarksheetTemplate';
import { downloadReceiptPdf } from '../components/ReceiptTemplate';
import { 
  downloadStudentIdCardPdf, downloadAdmissionFormPdf, 
  downloadBonafideCertificatePdf 
} from '../components/DocumentTemplates';

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
  
  // Compute plan directly from Zustand session (single source of truth), with mockDb fallback
  const studentObj = mockDb.students.find(s => s.id === selectedStudent);
  const studentSchool = studentObj ? mockDb.schools.find(sch => sch.id === studentObj.schoolId) : null;
  const currentPlanName = (session?.schoolSubscriptionPlan || studentSchool?.subscriptionPlan || 'freemium').toLowerCase();
  const plan = subscriptionPlans[currentPlanName] || subscriptionPlans.freemium;
  const [academicRecord, setAcademicRecord] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
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

  // Load parent's students
  const loadAssignedStudents = async () => {
    if (!parentId) return;
    try {
      await syncSubscriptionPlan();
      setLoading(true);
      
      const parentUser = mockDb.users.find(u => u.id === session?.user?.id);
      const parentSchoolId = mockDb.parents.find(p => p.id === parentId)?.schoolId || parentUser?.schoolId;
      if (parentSchoolId) {
        await mockApi.syncSchoolsData(parentSchoolId);
        await mockApi.syncClassesData(parentSchoolId);
        await mockApi.syncTeachersData(parentSchoolId);
        await mockApi.syncSubjectsData(parentSchoolId);
        await mockApi.syncTeacherClassSubjectMappingsData(parentSchoolId);
        await mockApi.syncAcademicSessionsData(parentSchoolId);
        await mockApi.syncStudentsData(parentSchoolId);
        await mockApi.syncParentsData(parentSchoolId);
        await mockApi.syncParentStudentMappingsData(parentSchoolId);
        await mockApi.syncUsersData(parentSchoolId).catch(() => {});
      }

      const data = await mockApi.parentGetStudents(parentId);
      setAssignedStudents(data);
      setSelectedStudent(prev => {
        if (prev && data.some(s => s.id === prev)) {
          return prev;
        }
        return data[0].id;
      });
      setLoading(false);
    } catch (err: any) {
      setError(err.message || 'Error loading mapped student records');
      setLoading(false);
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
      } else {
        setMaterials([]);
      }
      setMaterialsLoading(false);

      if (studentObj) {
        const rcs = await mockApi.fetchReportCards(studentObj.schoolId, selectedStudent).catch(() => []);
        setReportCards(rcs);
      }

      if (studentObj) {
        await mockApi.syncSchoolsData(studentObj.schoolId);
        await mockApi.syncClassesData(studentObj.schoolId);
        await mockApi.syncTeachersData(studentObj.schoolId);
        await mockApi.syncSubjectsData(studentObj.schoolId);
        await mockApi.syncTeacherClassSubjectMappingsData(studentObj.schoolId);
        await mockApi.syncAcademicSessionsData(studentObj.schoolId);
        await mockApi.syncStudentsData(studentObj.schoolId);
        await mockApi.syncParentsData(studentObj.schoolId);
        await mockApi.syncParentStudentMappingsData(studentObj.schoolId);
        await mockApi.syncUsersData(studentObj.schoolId).catch(() => {});

        await mockApi.syncForumCategoriesData(studentObj.schoolId).catch(() => {});
        await mockApi.syncForumPostsData(studentObj.schoolId).catch(() => {});
        await mockApi.syncForumRepliesData(studentObj.schoolId).catch(() => {});
        
        const allPosts = await mockApi.getForumPosts().catch(() => []);
        const cats = await mockApi.getForumCategories(studentObj.schoolId).catch(() => []);
        const allowedCats = cats.filter(c => c.classId === studentObj.classId || !c.classId);
        const allowedCatIds = allowedCats.map(c => c.id);
        const filteredPosts = allPosts.filter(p => allowedCatIds.includes(p.categoryId));
        // Deduplicate forum posts by id
        setForumPosts(Array.from(new Map(filteredPosts.map(p => [p.id, p])).values()));

        // Fetch dynamic transit and library details for parent selectedStudent with safe catches
        const [allAssignments, allBuses, allRoutes, allPickupPoints, allDrivers, myIssues, myFines, digitalAssets, booksList] = await Promise.all([
          mockApi.fetchTransportAssignments(studentObj.schoolId).catch(() => []),
          mockApi.fetchBuses(studentObj.schoolId).catch(() => []),
          mockApi.fetchRoutes(studentObj.schoolId).catch(() => []),
          mockApi.fetchPickupPoints(studentObj.schoolId).catch(() => []),
          mockApi.fetchDrivers(studentObj.schoolId).catch(() => []),
          mockApi.fetchBookIssues(studentObj.schoolId, selectedStudent).catch(() => []),
          mockApi.fetchLibraryFines(studentObj.schoolId, selectedStudent).catch(() => []),
          mockApi.fetchDigitalLibraryAssets(studentObj.schoolId).catch(() => []),
          mockApi.fetchBookInventory(studentObj.schoolId).catch(() => [])
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

        setIssuedBooks(Array.from(new Map(myIssues.map(bi => [bi.id, bi])).values()));
        setLibraryFines(Array.from(new Map(myFines.map(lf => [lf.id, lf])).values()));
        setDigitalLibraryAssets(Array.from(new Map((digitalAssets || []).map(da => [da.id, da])).values()));
        setLibraryBooks(Array.from(new Map((booksList || []).map(b => [b.id, b])).values()));

        // Load Hostel details for Parent's ward
        if (studentObj) {
          const schoolId = studentObj.schoolId;
          const studentId = selectedStudent;
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
          setMyVisitors(visitors.filter((v: any) => v.studentId === studentId));

          const payments = await mockApi.fetchHostelPayments(schoolId).catch(() => []);
          setMyPayments(payments.filter((p: any) => p.studentId === studentId));

          const feesList = await mockApi.fetchHostelFees(schoolId).catch(() => []);
          setMyFees(feesList);
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

  // Real-time Supabase Postgres changes subscription
  useEffect(() => {
    if (activeTab !== 'forums' || !selectedStudent) return;

    const studentObj = mockDb.students.find(s => s.id === selectedStudent);
    if (!studentObj) return;

    const handleForumsSync = () => {
      mockApi.syncStudentsData(studentObj.schoolId).then(() => {
        mockApi.syncParentsData(studentObj.schoolId).then(() => {
          mockApi.syncParentStudentMappingsData(studentObj.schoolId).then(() => {
            mockApi.syncForumCategoriesData(studentObj.schoolId).then(() => {
              mockApi.syncForumPostsData(studentObj.schoolId).then(() => {
                mockApi.syncForumRepliesData(studentObj.schoolId).then(() => {
                  mockApi.getForumPosts().then(allPosts => {
                    mockApi.getForumCategories(studentObj.schoolId).then(cats => {
                      const allowedCats = cats.filter(c => c.classId === studentObj.classId || !c.classId);
                      const allowedCatIds = allowedCats.map(c => c.id);
                      const filtered = allPosts.filter(p => allowedCatIds.includes(p.categoryId));
                      // Deduplicate realtime forum posts by id
                      setForumPosts(Array.from(new Map(filtered.map(p => [p.id, p])).values()));
                    });
                  });
                  if (selectedPost) {
                    mockApi.getForumPostReplies(selectedPost.id).then(reps => setPostReplies(reps));
                  }
                });
              });
            });
          });
        });
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
      .on('postgres_changes', { event: '*', schema: 'public', table: 'hostel_admissions' }, handleAcademicSync)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'hostel_attendance' }, handleAcademicSync)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'hostel_leave_requests' }, handleAcademicSync)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'hostel_visitors' }, handleAcademicSync)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'hostel_complaints' }, handleAcademicSync)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'hostel_mess_menu' }, handleAcademicSync)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'hostel_fees' }, handleAcademicSync)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'hostel_payments' }, handleAcademicSync)
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
          mockApi.syncStudentsData(studentObj.schoolId).then(() => {
            mockApi.syncParentsData(studentObj.schoolId).then(() => {
              mockApi.syncParentStudentMappingsData(studentObj.schoolId).then(() => {
                mockApi.syncForumCategoriesData(studentObj.schoolId).then(() => {
                  mockApi.syncForumPostsData(studentObj.schoolId).then(() => {
                    mockApi.syncForumRepliesData(studentObj.schoolId).then(() => {
                      mockApi.getForumPosts().then(allPosts => {
                        mockApi.getForumCategories(studentObj.schoolId).then(cats => {
                          const allowedCats = cats.filter(c => c.classId === studentObj.classId || !c.classId);
                          const allowedCatIds = allowedCats.map(c => c.id);
                          setForumPosts(allPosts.filter(p => allowedCatIds.includes(p.categoryId)));
                        });
                      });
                      if (selectedPost) {
                        mockApi.getForumPostReplies(selectedPost.id).then(reps => setPostReplies(reps));
                      }
                    });
                  });
                });
              });
            });
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

  if (loading && !academicRecord) {
    return (
      <div className="py-12 text-center text-slate-400 text-sm">
        Retrieving secure child records...
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
                isLocked={currentPlanName !== 'enterprise'}
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
                isLocked={currentPlanName === 'freemium'} 
                requiredTier="Basic" 
                featureName="Fee Management"
              >
                <GlassCard className="space-y-6">
                  <div className="border-b border-slate-850 pb-3">
                    <h3 className="font-bold text-slate-100 flex items-center gap-2">
                      <DollarSign className="text-brand-500" size={18} />
                      Outstanding Fee Structure & Invoices
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {academicRecord.fees.map((f: any, idx: number) => (
                      <div key={idx} className="p-4 bg-slate-900/30 border border-slate-850 rounded-2xl flex flex-col justify-between gap-4">
                        <div className="space-y-1">
                          <span className={`text-[9.5px] font-bold tracking-wider px-2.5 py-0.5 rounded-full uppercase border ${
                            f.status === 'PAID' 
                              ? 'bg-green-500/10 border-green-500/15 text-green-400' 
                              : f.status === 'PENDING' 
                                ? 'bg-amber-500/10 border-amber-500/15 text-amber-400' 
                                : 'bg-red-500/10 border-red-500/15 text-red-400'
                          }`}>
                            {f.status}
                          </span>
                          <h4 className="font-bold text-slate-200 text-sm mt-2">{f.description}</h4>
                          <p className="text-xs text-slate-400">Total Bill Amount: {studentSchool?.currencySymbol || '$'}{f.amount.toFixed(2)}</p>
                          <p className="text-[10px] text-slate-500">Bill Due: {new Date(f.dueDate).toLocaleDateString()}</p>
                        </div>

                        {f.status === 'PAID' && (
                          <div className="text-[10px] text-slate-500 border-t border-slate-850 pt-2 flex justify-between items-center">
                            <span>Receipt Download Ready</span>
                            <button
                              onClick={async () => {
                                if (!studentSchool) return;
                                const studentProfile = academicRecord?.studentProfile || {};
                                await downloadReceiptPdf({
                                  schoolId: studentSchool.id,
                                  schoolName: studentSchool.name,
                                  schoolAddress: studentSchool.address || '',
                                  schoolPhone: studentSchool.phone || '',
                                  schoolEmail: studentSchool.email || '',
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
                                  transactionId: f.transactionId
                                });
                              }}
                              className="px-2 py-1 bg-brand-500/10 hover:bg-brand-500/20 text-brand-400 border border-brand-500/30 rounded flex items-center gap-1 font-semibold cursor-pointer active:scale-95 transition-all text-[9px]"
                            >
                              <Download size={10} />
                              Download
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </GlassCard>
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
                      isLocked={currentPlanName !== 'enterprise'}
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
                isLocked={currentPlanName !== 'enterprise'}
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
                isLocked={currentPlanName === 'freemium'} 
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
                isLocked={currentPlanName !== 'enterprise'}
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
                isLocked={currentPlanName === 'freemium' || currentPlanName === 'basic'} 
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
                isLocked={currentPlanName !== 'enterprise'} 
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
                          <div className="space-y-2">
                            <div className="flex items-center gap-2 text-teal-400">
                              <UserIcon size={18} />
                              <h4 className="font-bold text-xs uppercase tracking-wider">Hostel Warden Details</h4>
                            </div>
                            {wardenDetails ? (
                              <>
                                <h3 className="text-lg font-bold text-slate-100">
                                  {wardenDetails.userDetails 
                                    ? `${wardenDetails.userDetails.firstName} ${wardenDetails.userDetails.lastName}` 
                                    : 'Assigned Warden'}
                                </h3>
                                <p className="text-xs text-slate-400">Warden Email: <span className="text-slate-200 font-medium">{wardenDetails.userDetails?.email || 'N/A'}</span></p>
                                <p className="text-xs text-slate-400">Phone Contact: <span className="text-brand-400 font-bold font-mono">{wardenDetails.phone || 'N/A'}</span></p>
                              </>
                            ) : (
                              <p className="text-xs text-slate-500 italic py-2">No specific warden assigned to this building structure yet.</p>
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

          </div>
        )
      )}
    </div>
  );
};
