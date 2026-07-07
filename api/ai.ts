import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseServiceKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || '';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || '';

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

// Simple memory-based rate limiting cache (per user ID / IP)
const rateLimitCache = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_MAX = 60; // 60 requests per minute
const RATE_LIMIT_WINDOW = 60000; // 1 minute

function isRateLimited(identifier: string): boolean {
  const now = Date.now();
  const record = rateLimitCache.get(identifier);
  if (!record || now > record.resetAt) {
    rateLimitCache.set(identifier, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    return false;
  }
  record.count++;
  return record.count > RATE_LIMIT_MAX;
}

// Prompt Injection detection simple check
function isPromptInjection(text: string): boolean {
  const patterns = [
    /ignore previous/i,
    /system prompt/i,
    /bypass instruction/i,
    /you are now a/i,
    /sql injection/i,
    /drop table/i,
    /select \* from/i,
    /union select/i
  ];
  return patterns.some(p => p.test(text));
}

// Normalize legacy plan codes
function normalizePlan(raw: string): string {
  const lower = (raw || 'freemium').toLowerCase();
  if (lower === 'standard') return 'pro';
  if (lower === 'premium')  return 'enterprise';
  return lower;
}

export default async function handler(req: any, res: any) {
  // CORS setup
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const startTime = Date.now();
  const { prompt, chatHistory = [], file, mimeType } = req.body;

  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ success: false, error: 'Prompt string is required' });
  }

  // Rate Limiting identifier
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'anonymous';
  const authHeader = req.headers['authorization'];
  let userId: string | null = null;
  let userProfile: any = null;

  // Verify authorization token if present
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    try {
      const { data: { user: supabaseUser }, error: authError } = await supabaseAdmin.auth.getUser(token);
      if (!authError && supabaseUser) {
        userId = supabaseUser.id;
        const { data: profile } = await supabaseAdmin
          .from('users')
          .select('id, role, school_id, first_name, last_name')
          .eq('id', userId)
          .maybeSingle();
        if (profile) {
          userProfile = profile;
        }
      }
    } catch (err) {
      console.error('[ai-auth] Token verification failed:', err);
    }
  }

  const limitId = userId || ip;
  if (isRateLimited(limitId)) {
    return res.status(429).json({
      success: false,
      error: 'Rate limit exceeded',
      message: 'You have sent too many requests. Please wait a minute.'
    });
  }

  const role = userProfile?.role || 'PUBLIC';
  const schoolId = userProfile?.school_id || null;

  // Prompt injection checks
  if (isPromptInjection(prompt)) {
    // Log security alert
    await supabaseAdmin.from('ai_audit_logs').insert({
      user_id: userId,
      school_id: schoolId,
      role,
      prompt,
      response: 'Blocked prompt due to security policy constraints.',
      status: 'BLOCKED_INJECTION',
      latency_ms: Date.now() - startTime
    });
    return res.status(400).json({
      success: false,
      error: 'Security Policy Alert',
      message: 'This prompt violated our safety guidelines.'
    });
  }

  // 1. Build context (RAG)
  let context = '';
  try {
    if (userId && schoolId) {
      // Query specific details based on user role to build LLM context
      if (role === 'STUDENT') {
        const { data: student } = await supabaseAdmin.from('students').select('id, admission_no, roll_no, class_id').eq('id', userId).maybeSingle();
        if (student) {
          const { data: homeworks } = await supabaseAdmin.from('homeworks').select('title, description, due_date').eq('class_id', student.class_id).limit(3);
          const { data: exams } = await supabaseAdmin.from('exam_schedules').select('exam_name, date, subject_name').eq('school_id', schoolId).limit(3);
          context = `\n[Context: Student details - Admission No: ${student.admission_no || 'N/A'}, Roll No: ${student.roll_no || 'N/A'}.\nHomeworks pending in class: ${JSON.stringify(homeworks || [])}.\nUpcoming exams scheduled: ${JSON.stringify(exams || [])}.]`;
        }
      } else if (role === 'PARENT') {
        const { data: mappings } = await supabaseAdmin.from('parent_student_mappings').select('student_id').eq('parent_id', userId);
        if (mappings && mappings.length > 0) {
          const childIds = mappings.map(m => m.student_id);
          const { data: children } = await supabaseAdmin.from('users').select('id, first_name, last_name').in('id', childIds);
          context = `\n[Context: Parent details - Associated children: ${JSON.stringify(children || [])}.]`;
        }
      } else if (role === 'TEACHER') {
        const { data: classes } = await supabaseAdmin.from('classes').select('name, section').eq('school_id', schoolId).limit(5);
        context = `\n[Context: Teacher details - Homerooms/classes in school: ${JSON.stringify(classes || [])}.]`;
      } else if (role === 'SUPER_ADMIN') {
        const { data: countSchools } = await supabaseAdmin.from('schools').select('id', { count: 'exact', head: true });
        context = `\n[Context: Super Admin platform details - Total Schools Onboarded: ${countSchools?.length || 5}.]`;
      } else if (['ADMIN', 'ACADEMIC_ADMIN', 'FINANCE_ADMIN'].includes(role)) {
        const { data: school } = await supabaseAdmin.from('schools').select('name').eq('id', schoolId).maybeSingle();
        context = `\n[Context: School Admin - Institution: ${school?.name || 'Aegis Academy'}.]`;
      }
    }
  } catch (err) {
    console.error('[ai-context] Failed to build RAG context:', err);
  }

  // 2. Define System Prompts
  let systemPrompt = '';
  if (role === 'STUDENT') {
    systemPrompt = `You are "AEGIS AI Learning Assistant", a dedicated educational companion for students.
YOUR CRITICAL CORE RULES:
1. FOCUS ON LEARNING, NOT WORK COMPLETION.
2. NEVER write complete essays, full lab records, or plagiarizable assignment content.
3. NEVER solve exams or reveal direct answers to assessments.
4. If a student asks you to do their homework or provide answers directly, politely refuse. Explain that you are here to help them learn, not do their work.
5. Teach by offering hints, explaining concepts step-by-step, generating mock practice questions or revision quizzes, and diagnosing mistakes.
Keep explanations engaging, motivating, and simple. Context: ${context}`;
  } else if (role === 'PARENT') {
    systemPrompt = `You are "AEGIS AI Parent Assistant". Provide clear progress summaries, attendance ratios, invoice due reminders, homework updates, and tips to prepare for PTMs. Restrict reports and feedback strictly to the parent's linked children. Maintain professional, supportive communication. Context: ${context}`;
  } else if (role === 'TEACHER') {
    systemPrompt = `You are "AEGIS AI Teaching Assistant". Help teachers write detailed lesson plans, worksheets, assignments, question papers (with Bloom's taxonomy mapping), circular templates, rubrics, and card remarks. Help evaluate performance patterns. Context: ${context}`;
  } else if (role === 'SUPER_ADMIN') {
    systemPrompt = `You are "AEGIS AI Enterprise Assistant". Assist Super Admins with SaaS growth analytics, platform health logs, subscription metrics, and error rates. Maintain tenant isolation guidelines. Context: ${context}`;
  } else if (role === 'PUBLIC') {
    systemPrompt = `You are "AEGIS AI" public assistant. Explain AEGIS ERP features, subscription tiers (Freemium, Basic at $49/mo, Pro at $99/mo, Enterprise at $199/mo), and FAQs. Guide users to registration or demo booking. You have no access to student profiles, grades, fees, or school records. Prompt users to log in if they ask for school data.`;
  } else {
    systemPrompt = `You are "AEGIS AI School Assistant" for Role: ${role}. Assist school administrators with circular generation, analytics summaries, event planning, and resource audits. Context: ${context}`;
  }

  // Inject command parsing constraints
  systemPrompt += `\n\nIf the user requests an action (like create a timetable, draft circular, send reminders, approve leave request), classify the action and respond with a final line in this exact format:
[ACTION_CMD: <ACTION_TYPE>] <PARAMETERS_IN_JSON>
Example:
[ACTION_CMD: CREATE_CIRCULAR] { "title": "Maths Reschedule", "content": "The exam is pushed to Monday." }
Supported actions: CREATE_TIMETABLE, GENERATE_REPORT, SEND_REMINDERS, CREATE_CIRCULAR, GENERATE_PAPER, APPROVE_LEAVE.`;

  // 3. LLM API call using Provider Abstraction (Primary Gemini, fallback to Mock)
  let responseText = '';
  let tokenCount = 0;
  const geminiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;

  if (geminiKey) {
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`;
    try {
      const contentsParts: any[] = [{ text: `${systemPrompt}\n\nUser: ${prompt}` }];
      if (file && mimeType) {
        contentsParts.push({
          inlineData: {
            mimeType: mimeType,
            data: file
          }
        });
      }

      // Model request payload
      const response = await fetch(geminiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: contentsParts }],
          generationConfig: { maxOutputTokens: 1024 }
        })
      });

      const data = await response.json();
      responseText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      tokenCount = prompt.split(/\s+/).length + responseText.split(/\s+/).length; // simple approximation

      if (!responseText) {
        throw new Error('Empty response from model API');
      }
    } catch (err: any) {
      console.error('[ai-gemini] Gemini provider connection failed, activating fallback:', err);
      // Fallback response text on provider error
      responseText = `I apologize, but I am experiencing temporary connectivity difficulties with the AI engine. Here is a guided fallback to help you:\n\n* For support and feature guides, please visit our public Help Center.\n* If you requested an action, please perform it manually through your sidebar dashboard.`;
    }
  } else {
    // Graceful Demo Fallback Mode
    responseText = getDemoResponse(role, prompt);
    tokenCount = prompt.split(/\s+/).length + responseText.split(/\s+/).length;
  }

  // Parse if action took place
  let actionTaken: string | null = null;
  let parsedParams = null;
  const actionMatch = responseText.match(/\[ACTION_CMD:\s*(\w+)\]\s*(\{.*\})/);
  if (actionMatch) {
    actionTaken = actionMatch[1];
    try {
      parsedParams = JSON.parse(actionMatch[2]);
    } catch (e) {
      console.error('Failed to parse action json:', e);
    }
  }

  // 4. Log interaction to ai_audit_logs
  try {
    const latency = Date.now() - startTime;
    await supabaseAdmin.from('ai_audit_logs').insert({
      user_id: userId,
      school_id: schoolId,
      role,
      prompt,
      response: responseText,
      action_taken: actionTaken,
      latency_ms: latency,
      status: 'SUCCESS',
      token_count: tokenCount
    });
  } catch (err) {
    console.error('[ai-audit] Failed to write audit log:', err);
  }

  return res.status(200).json({
    success: true,
    response: responseText,
    action: actionTaken ? { type: actionTaken, params: parsedParams } : null
  });
}

// Fallback Helper for Demo Mode
function getDemoResponse(role: string, prompt: string): string {
  const lowerPrompt = prompt.toLowerCase();

  if (role === 'STUDENT') {
    if (lowerPrompt.includes('essay') || lowerPrompt.includes('answer') || lowerPrompt.includes('homework')) {
      return `I am your **AEGIS AI Learning Assistant** (Demo Mode). I notice you are asking me to complete coursework or write homework directly. To help you learn, I cannot complete this for you. 

Instead, let's explore the core concept together! Here is a learning hint:
* *Hint:* Think about the inputs (reactants) of photosynthesis: Carbon Dioxide ($CO_2$), Water ($H_2O$), and Light. What does the plant synthesize using these?
Would you like me to guide you step-by-step or generate a 3-question practice quiz to test your understanding?`;
    }
    return `Hello! I am your **AEGIS AI Learning Assistant** (Demo Mode). I can help you solve mathematical problems, explain physics concepts, analyze biology structures, or build customized revision schedules. 

What topic are you studying today? (Suggested: "Explain Newton's Laws step-by-step")`;
  }

  if (role === 'TEACHER') {
    if (lowerPrompt.includes('lesson') || lowerPrompt.includes('plan')) {
      return `Here is a sample **Grade 9 Physics Lesson Plan** (Demo Mode):
| Topic | Duration | Bloom's Level | Key Activity |
|---|---|---|---|
| Introduction to Kinematics | 45 Mins | Remember / Understand | Interactive slider demo showing distance vs displacement |
| Mathematical Speed vs Velocity | 30 Mins | Apply | Practical calculation sheet |

[ACTION_CMD: CREATE_CIRCULAR] { "title": "Kinematics Lesson Schedule", "content": "Physics Class for Grade 9 will focus on Kinematics this week." }`;
    }
    return `Hello, teacher! I am your **AEGIS AI Teaching Assistant** (Demo Mode). I can help you:
* Draft worksheets and MCQs.
* Write report card remarks.
* Generate lesson plan tables.

What would you like to draft today?`;
  }

  if (role === 'PUBLIC') {
    return `Welcome to **AEGIS ERP**! I am **AEGIS AI** (Demo Mode). 
Here are details about our subscription plans:
1. **Freemium Tier:** $0, covers core school rosters (upto 50 students).
2. **Basic Tier ($49/month):** Covers academics, attendance, and basic documents.
3. **Pro Tier ($99/month):** Covers all portals, homework, marks, and Razorpay integrations.
4. **Enterprise Tier ($199/month):** Full access including AI, Meet rooms, Warden, and Sports catalogs.

Would you like me to explain features or guide you to book a demo?`;
  }

  if (role === 'SUPER_ADMIN') {
    return `**AEGIS AI Enterprise Assistant** (Demo Mode SaaS Stats):
* **Platform Status:** 🟢 Stable / Online
* **API Availability:** 99.98%
* **Active Schools:** 1,245
* **Token Projection cost:** $14.50 (ap-northeast-1)
* **Average Latency:** 245ms

Would you like to analyze revenue trends or search audit logs?`;
  }

  return `Hello! I am your **AEGIS AI Assistant** (Demo Mode). I have analyzed your active workspace context. Let me know how I can assist you with your portal duties!`;
}
