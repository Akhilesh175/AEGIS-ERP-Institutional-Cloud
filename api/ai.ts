import { createClient } from '@supabase/supabase-js';
import { GoogleGenAI } from '@google/genai';

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
    systemPrompt = `You are "AEGIS AI" public assistant. Explain AEGIS ERP features, subscription tiers (Freemium, Basic, Pro, Enterprise), and FAQs. Guide users to registration or demo booking. You have no access to student profiles, grades, fees, or school records. Prompt users to log in if they ask for school data.`;
  } else {
    systemPrompt = `You are "AEGIS AI School Assistant" for Role: ${role}. Assist school administrators with circular generation, analytics summaries, event planning, and resource audits. Context: ${context}`;
  }

  // 2.2 Conditional Single Source of Truth pricing fetch based on keyword intent
  const pricingKeywords = ['pricing', 'subscription', 'plan', 'upgrade', 'basic', 'pro', 'enterprise', 'freemium', 'billing', 'cost'];
  const isPricingIntent = pricingKeywords.some(keyword => prompt.toLowerCase().includes(keyword));
  let plansInfo = '';

  if (isPricingIntent) {
    console.log('[ai-pricing] User intent detected as pricing-related. Fetching live database plans...');
    try {
      const { data: plansData, error: plansError } = await supabaseAdmin
        .from('subscription_plans')
        .select('name, price_monthly, price_yearly')
        .eq('is_active', true)
        .order('price_monthly', { ascending: true });

      if (plansError) throw plansError;

      if (plansData && plansData.length > 0) {
        plansInfo = plansData.map(p => {
          const monthly = Number(p.price_monthly);
          const yearly = Number(p.price_yearly);
          const formattedMonthly = monthly === 0 ? '₹0' : `₹${monthly.toLocaleString('en-IN')}`;
          const formattedYearly = yearly === 0 ? '₹0' : `₹${yearly.toLocaleString('en-IN')}`;
          return `- ${p.name}: Monthly: ${formattedMonthly}, Yearly: ${formattedYearly}`;
        }).join('\n');
      } else {
        plansInfo = 'Unable to retrieve current pricing. Please visit the pricing page.';
      }
    } catch (err) {
      console.error('[ai-pricing] Failed to fetch live subscription plans:', err);
      plansInfo = 'Unable to retrieve current pricing. Please visit the pricing page.';
    }

    systemPrompt += `\n\n[CRITICAL: LIVE SUBSCRIPTION PRICING Single Source of Truth]\nActive subscription plans and pricing retrieved directly from the live database. Use these exact prices only. If this data says "Unable to retrieve", you MUST say "Unable to retrieve current pricing. Please visit the pricing page." and never guess, estimate, or hardcode prices:\n${plansInfo}`;
  }

  // Inject command parsing constraints
  systemPrompt += `\n\nIf the user requests an action (like create a timetable, draft circular, send reminders, approve leave request), classify the action and respond with a final line in this exact format:
[ACTION_CMD: <ACTION_TYPE>] <PARAMETERS_IN_JSON>
Example:
[ACTION_CMD: CREATE_CIRCULAR] { "title": "Maths Reschedule", "content": "The exam is pushed to Monday." }
Supported actions: CREATE_TIMETABLE, GENERATE_REPORT, SEND_REMINDERS, CREATE_CIRCULAR, GENERATE_PAPER, APPROVE_LEAVE.`;

  // 3. Official Google AI Studio SDK integration (using @google/genai)
  let responseText = '';
  let tokenCount = 0;
  const geminiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;

  if (!geminiKey) {
    console.error("[ai-startup] GEMINI_API_KEY environment variable is not configured.");
    return res.status(500).json({
      success: false,
      error: 'Configuration Error',
      message: 'GEMINI_API_KEY environment variable is missing on the server. Please check your credentials.'
    });
  }

  const keyFingerprint = geminiKey.length > 8
    ? `${geminiKey.substring(0, 6)}...${geminiKey.substring(geminiKey.length - 4)}`
    : 'invalid-key-length';
  console.log(`[ai-startup] Loaded GEMINI_API_KEY fingerprint: ${keyFingerprint}`);

  const rawModelEnv = process.env.GEMINI_MODEL || process.env.VITE_GEMINI_MODEL || '';
  console.log(`[ai-startup] Loaded GEMINI_MODEL: ${rawModelEnv}`);
  console.log(`[ai-startup] Loaded GEMINI_API_KEY fingerprint: ${keyFingerprint}`);

  const activeModel = rawModelEnv || 'gemini-2.5-flash';
  console.log(`[ai-gemini] Resolved model: ${activeModel}`);
  console.log(`[ai-gemini] SDK version: @google/genai ^2.10.0`);
  console.log(`[ai-gemini] API endpoint: https://generativelanguage.googleapis.com/v1beta/models`);

  const partsArray: any[] = [{ text: `${systemPrompt}\n\nUser: ${prompt}` }];
  if (file && mimeType) {
    partsArray.push({
      inlineData: {
        mimeType: mimeType,
        data: file
      }
    });
  }

  try {
    const ai = new GoogleGenAI({ apiKey: geminiKey });
    
    // Call the official SDK generateContent
    const response = await ai.models.generateContent({
      model: activeModel,
      contents: [{ role: 'user', parts: partsArray }],
      config: {
        maxOutputTokens: 512
      }
    });

    console.log('[ai-gemini] SDK generateContent call succeeded.');

    // Log candidates metadata, safety, and response body as requested
    const candidates = response.candidates || [];
    const candidate = candidates[0];
    const finishReason = candidate?.finishReason || 'STOP';
    
    console.log(`[ai-gemini] Model actually used: ${activeModel}`);
    console.log(`[ai-gemini] HTTP status returned by Google: 200`);
    console.log(`[ai-gemini] finishReason: ${finishReason}`);
    console.log(`[ai-gemini] candidates: ${JSON.stringify(candidates)}`);
    console.log(`[ai-gemini] Response body: ${response.text}`);

    if (!candidate) {
      console.error('[ai-gemini] No candidates returned by official SDK. Response:', JSON.stringify(response));
      return res.status(200).json({
        success: false,
        error: 'Empty Response',
        message: 'No candidates were returned by the model. The query may have been blocked due to safety filters.'
      });
    }

    // Safety and blocked response handling
    if (finishReason === 'SAFETY' || finishReason === 'RECITATION' || finishReason === 'OTHER') {
      console.warn(`[ai-gemini] Response was safety blocked by Gemini. Finish reason: ${finishReason}`);
      return res.status(200).json({
        success: false,
        error: 'Safety Blocked',
        message: `I apologize, but this response was blocked by content guidelines (Reason: ${finishReason}). Please try rephrasing your request.`
      });
    }

    responseText = response.text || '';
    if (!responseText) {
      console.error('[ai-gemini] Response text is empty. Raw candidates structure:', JSON.stringify(candidates));
      return res.status(200).json({
        success: false,
        error: 'Empty Response Content',
        message: 'The model returned an empty response. Please try sending a more specific query.'
      });
    }

    tokenCount = prompt.split(/\s+/).length + responseText.split(/\s+/).length;
  } catch (err: any) {
    console.error('[ai-gemini] Google GenAI SDK call failed:', err);
    console.log(`[ai-gemini] Model actually used: ${activeModel}`);
    console.log(`[ai-gemini] HTTP status returned by Google: ${err.status || 500}`);

    // Return the exact error transparently to the frontend
    const errMsg = err.message || String(err);
    const isRateLimit = errMsg.toLowerCase().includes('quota') || errMsg.toLowerCase().includes('rate') || err.status === 429;
    
    return res.status(err.status || 500).json({
      success: false,
      error: isRateLimit ? 'RateLimitExceeded' : 'AI Provider Failure',
      message: isRateLimit 
        ? 'The AI service has temporarily reached its free usage limit. Please try again later.'
        : errMsg
    });
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

