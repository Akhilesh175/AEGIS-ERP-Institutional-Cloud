import React, { useState, useEffect } from 'react';
import { 
  Shield, Phone, User, MapPin, Globe, Users, 
  ArrowRight, CheckCircle2, ShieldAlert, Key, Mail, 
  Landmark, MessageSquare, Clock, CreditCard, ChevronRight, Lock, 
  Sparkles, HelpCircle, Sun, Moon, Building2
} from 'lucide-react';
import { GlassCard } from './GlassCard';
import { BrandLogo, AEGIS_LOGO_URL } from './common/BrandLogo';

// Dynamically load Razorpay SDK
const loadRazorpayScript = () => {
  return new Promise<boolean>((resolve) => {
    if ((window as any).Razorpay) {
      resolve(true);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
};

interface SaaSAuthFlowProps {
  onBackToLogin: () => void;
  theme: 'dark' | 'light';
  toggleTheme: () => void;
  initialStep?: 'register' | 'otp' | 'plans' | 'success';
  initialSchoolId?: string;
  adminEmail?: string;
  adminPhone?: string;
}

export const SaaSAuthFlow: React.FC<SaaSAuthFlowProps> = ({ 
  onBackToLogin, 
  theme, 
  toggleTheme,
  initialStep,
  initialSchoolId,
  adminEmail,
  adminPhone
}) => {
  // Flow Step: 'register' | 'otp' | 'plans' | 'success'
  const [step, setStep] = useState<'register' | 'otp' | 'plans' | 'success'>(initialStep || 'register');

  // 1. School Registration States
  const [schoolName, setSchoolName] = useState('');
  const [schoolCode, setSchoolCode] = useState('');
  const [email, setEmail] = useState(adminEmail || '');
  const [phone, setPhone] = useState(adminPhone || '');
  const [principalName, setPrincipalName] = useState('');
  const [studentStrength, setStudentStrength] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [stateName, setStateName] = useState('');
  const [country, setCountry] = useState('India');
  const [schoolType, setSchoolType] = useState('');
  const [password, setPassword] = useState('');
  
  const [registerLoading, setRegisterLoading] = useState(false);
  const [registerError, setRegisterError] = useState<string | null>(null);

  // 2. OTP Verification States
  const [otpArray, setOtpArray] = useState(['', '', '', '', '', '']);
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [otpSuccess, setOtpSuccess] = useState<string | null>(null);
  const [resendTimer, setResendTimer] = useState(45);

  // 3. Plan Selection & Payment States
  const [billingCycle, setBillingCycle] = useState<'MONTHLY' | 'YEARLY'>('MONTHLY');
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  
  // Selected plan metadata for the success screen
  const [provisionedSchoolId, setProvisionedSchoolId] = useState(initialSchoolId || '');
  const [selectedPlanCode, setSelectedPlanCode] = useState('standard');
  const [paymentAmount, setPaymentAmount] = useState(2499);
  const [transactionId, setTransactionId] = useState('');
  const [paymentDate, setPaymentDate] = useState('');

  // Count down resend timer
  useEffect(() => {
    if (step !== 'otp' || resendTimer <= 0) return;
    const interval = setInterval(() => {
      setResendTimer(prev => prev - 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [step, resendTimer]);

  // Handle OTP digit inputs
  const handleOtpChange = (index: number, val: string) => {
    const numericVal = val.replace(/\D/g, '');
    if (numericVal.length > 1) return;

    const newOtp = [...otpArray];
    newOtp[index] = numericVal;
    setOtpArray(newOtp);

    // Auto-focus next input
    if (numericVal && index < 5) {
      const nextInput = document.getElementById(`otp-input-${index + 1}`);
      nextInput?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otpArray[index] && index > 0) {
      const prevInput = document.getElementById(`otp-input-${index - 1}`);
      prevInput?.focus();
    }
  };

  // Submit Step 1: Request OTP for Self-Registration
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!schoolName || !email || !password) {
      setRegisterError('School name, email and password are required');
      return;
    }

    try {
      setRegisterLoading(true);
      setRegisterError(null);

      const res = await fetch('/api/register-school', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to register school email');
      }

      setRegisterLoading(false);
      setResendTimer(45);
      setStep('otp');
    } catch (err: any) {
      setRegisterError(err.message || 'Error requesting registration OTP');
      setRegisterLoading(false);
    }
  };

  // Resend OTP trigger
  const handleResendOtp = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (resendTimer > 0) return;
    try {
      setOtpError(null);
      setOtpSuccess(null);
      const res = await fetch('/api/register-school', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to resend verification code');
      setOtpSuccess('A new verification code has been delivered.');
      setResendTimer(45);
    } catch (err: any) {
      setOtpError(err.message || 'Resend request failed');
    }
  };

  // Submit Step 2: Validate Email OTP and Create Trial Account
  const handleOtpVerifySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const otpCode = otpArray.join('');
    if (otpCode.length < 6) {
      setOtpError('Please enter the full 6-digit verification code');
      return;
    }

    try {
      setOtpLoading(true);
      setOtpError(null);
      setOtpSuccess(null);

      // Verify OTP
      const verifyRes = await fetch('/api/verify-registration-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otpCode })
      });
      const verifyData = await verifyRes.json();

      if (!verifyRes.ok) {
        throw new Error(verifyData.error || 'OTP verification failed');
      }

      // Provision School and Admin User
      const createRes = await fetch('/api/create-school-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schoolName,
          schoolCode,
          email,
          phone,
          principalName,
          address,
          city,
          state: stateName,
          country,
          studentStrength,
          schoolType,
          password
        })
      });
      const createData = await createRes.json();

      if (!createRes.ok) {
        throw new Error(createData.error || 'Failed to create school account');
      }

      setProvisionedSchoolId(createData.schoolId);
      setOtpLoading(false);
      setStep('plans');
    } catch (err: any) {
      setOtpError(err.message || 'Verification failed');
      setOtpLoading(false);
    }
  };

  // Submit Step 3: Plan Selection & Razorpay Checkout Integration
  const handlePlanPayment = async (planCode: string) => {
    if (planCode === 'enterprise') {
      // Enterprise redirects to sales support
      window.location.hash = 'support';
      return;
    }

    try {
      setPaymentLoading(true);
      setPaymentError(null);
      setSelectedPlanCode(planCode);

      // Load Razorpay Script
      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded) {
        throw new Error('Razorpay payment gateway failed to load. Please check your internet connection.');
      }

      // 1. Create Payment Order on backend
      const res = await fetch('/api/create-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schoolId: provisionedSchoolId,
          planCode,
          billingCycle
        })
      });
      const orderData = await res.json();

      if (!res.ok) {
        throw new Error(orderData.error || 'Failed to initialize payment transaction');
      }

      setPaymentAmount(orderData.amount);

      // 2. Launch Razorpay Checkout
      const options = {
        key: orderData.keyId,
        amount: orderData.amount * 100, // paise
        currency: orderData.currency,
        name: 'Aegis ERP',
        description: `${planCode.toUpperCase()} Subscription (${billingCycle})`,
        image: AEGIS_LOGO_URL,
        order_id: orderData.orderId,
        handler: async function (response: any) {
          try {
            setPaymentLoading(true);
            
            // 3. Verify Payment on backend
            const verifyRes = await fetch('/api/verify-payment', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                razorpayOrderId: response.razorpay_order_id || orderData.orderId,
                razorpayPaymentId: response.razorpay_payment_id || 'mock_payment_id',
                razorpaySignature: response.razorpay_signature || 'mock_sig',
                paymentId: orderData.paymentId,
                isMock: orderData.isMock
              })
            });
            const verifyData = await verifyRes.json();

            if (!verifyRes.ok) {
              throw new Error(verifyData.error || 'Payment validation failed');
            }

            setTransactionId(response.razorpay_payment_id || 'pay_mock_' + Math.random().toString(36).substring(2, 9));
            setPaymentDate(new Date().toLocaleDateString('en-IN', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            }));
            
            setPaymentLoading(false);
            setStep('success');
          } catch (err: any) {
            setPaymentError(err.message || 'Failed to activate subscription');
            setPaymentLoading(false);
          }
        },
        prefill: {
          name: principalName,
          email: email,
          contact: phone
        },
        theme: {
          color: '#0ea0eb'
        }
      };

      const rzp = new (window as any).Razorpay(options);
      rzp.on('payment.failed', function (response: any) {
        setPaymentError('Payment failed: ' + response.error.description);
      });
      rzp.open();
    } catch (err: any) {
      setPaymentError(err.message || 'Payment initiation failed');
      setPaymentLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#070a13] flex flex-col justify-between p-4 md:p-8 relative overflow-hidden font-sans text-slate-200 selection:bg-brand-500/30 selection:text-brand-200">
      {/* Background Gradients & Grid Backdrop */}
      <div className="absolute top-[-20%] left-[-15%] w-[60%] h-[60%] rounded-full bg-brand-500/10 blur-[130px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-15%] w-[60%] h-[60%] rounded-full bg-brand-600/10 blur-[130px] pointer-events-none" />
      
      <svg className="absolute inset-0 w-full h-full opacity-20 pointer-events-none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="saas-grid" width="50" height="50" patternUnits="userSpaceOnUse">
            <path d="M 50 0 L 0 0 0 50" fill="none" stroke="rgba(56, 176, 248, 0.07)" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#saas-grid)" />
      </svg>

      {/* Brand Header — Official AEGIS ERP Logo */}
      <div className="w-full flex justify-between items-center max-w-6xl mx-auto mb-6 relative z-10 shrink-0">
        <BrandLogo variant="horizontal" size="md" showTagline={true} />
        
        <button 
          onClick={toggleTheme}
          className="p-2.5 rounded-xl bg-slate-900/50 border border-slate-800 hover:border-brand-500/30 text-slate-400 hover:text-slate-200 transition-all duration-200 backdrop-blur-sm shadow-md"
          title="Toggle Theme"
        >
          {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
        </button>
      </div>

      {/* Central Screen Switcher */}
      <div className="w-full max-w-6xl mx-auto my-auto relative z-10 py-4">
        
        {/* Step 1: School Self-Registration Form */}
        {step === 'register' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
            {/* Left Value Props Sidebar */}
            <div className="lg:col-span-4 flex flex-col justify-center gap-6 p-8 bg-[#0b101d]/40 border border-slate-850 rounded-3xl backdrop-blur-sm shadow-xl">
              <div className="space-y-2">
                <h3 className="text-glow-brand text-brand-400 font-bold text-xs uppercase tracking-widest font-mono">AEGIS CLOUD GATEWAY</h3>
                <h2 className="text-xl font-extrabold text-white leading-tight">Digital Institutional Hub</h2>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Connect your administrators, teachers, hostel block overseers, library assets, vehicle log registers, and parent communications under a single secure console.
              </p>
              
              <div className="space-y-4 pt-4 border-t border-slate-900">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-brand-500/10 text-brand-400 shrink-0">
                    <Shield size={16} />
                  </div>
                  <div>
                    <h4 className="font-bold text-xs text-slate-200">Secure & Reliable</h4>
                    <p className="text-[10px] text-slate-450 leading-relaxed mt-0.5">Automated TLS 1.3 protections, database RLS, and regular backup points.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-brand-500/10 text-brand-400 shrink-0">
                    <Building2 size={16} />
                  </div>
                  <div>
                    <h4 className="font-bold text-xs text-slate-200">All-in-One Solution</h4>
                    <p className="text-[10px] text-slate-450 leading-relaxed mt-0.5">Modules for hostel management, transit monitoring, homework checklists, and exams.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-brand-500/10 text-brand-400 shrink-0">
                    <Clock size={16} />
                  </div>
                  <div>
                    <h4 className="font-bold text-xs text-slate-200">24/7 Support</h4>
                    <p className="text-[10px] text-slate-450 leading-relaxed mt-0.5">Dedicated client assistance support desk ready to manage integrations.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Main Form Panel */}
            <GlassCard className="lg:col-span-8 flex flex-col p-8 bg-[#0b101d]/75 border-slate-850 hover:border-slate-800/80 shadow-2xl relative overflow-hidden group">
              <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-brand-600 via-brand-400 to-brand-600 opacity-80" />
              
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-bold text-slate-100 font-sans tracking-wide">Register Your School</h2>
                  <p className="text-xs text-slate-400 mt-1">Create your institution account and start your digital journey today.</p>
                </div>

                {registerError && (
                  <div className="p-3.5 bg-red-500/5 border border-red-500/20 text-red-400 text-xs rounded-xl flex items-start gap-2.5">
                    <ShieldAlert size={16} className="shrink-0 mt-0.5" />
                    <div className="font-medium">{registerError}</div>
                  </div>
                )}

                <form onSubmit={handleRegisterSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    
                    {/* School Name */}
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5 font-mono">
                        <Building2 size={12} className="text-brand-400" /> School Name *
                      </label>
                      <input 
                        type="text"
                        placeholder="Enter school name"
                        value={schoolName}
                        onChange={(e) => setSchoolName(e.target.value)}
                        className="w-full bg-[#0a0e1a] border border-slate-805 text-slate-100 rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-all duration-200"
                        required
                      />
                    </div>

                    {/* School Code */}
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5 font-mono">
                        <Key size={12} className="text-brand-400" /> School Code (Custom)
                      </label>
                      <input 
                        type="text"
                        placeholder="Auto-generated if empty"
                        value={schoolCode}
                        onChange={(e) => setSchoolCode(e.target.value)}
                        className="w-full bg-[#0a0e1a] border border-slate-805 text-slate-100 rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-all duration-200"
                      />
                    </div>

                    {/* School Email */}
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5 font-mono">
                        <Mail size={12} className="text-brand-400" /> School Email *
                      </label>
                      <input 
                        type="email"
                        placeholder="school@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full bg-[#0a0e1a] border border-slate-805 text-slate-100 rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-all duration-200"
                        required
                      />
                    </div>

                    {/* School Phone */}
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5 font-mono">
                        <Phone size={12} className="text-brand-400" /> School Phone
                      </label>
                      <input 
                        type="tel"
                        placeholder="Enter phone number"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="w-full bg-[#0a0e1a] border border-slate-805 text-slate-100 rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-all duration-200"
                      />
                    </div>

                    {/* Principal / Admin Name */}
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5 font-mono">
                        <User size={12} className="text-brand-400" /> Principal / Admin Name *
                      </label>
                      <input 
                        type="text"
                        placeholder="Enter name"
                        value={principalName}
                        onChange={(e) => setPrincipalName(e.target.value)}
                        className="w-full bg-[#0a0e1a] border border-slate-805 text-slate-100 rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-all duration-200"
                        required
                      />
                    </div>

                    {/* Student Strength */}
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5 font-mono">
                        <Users size={12} className="text-brand-400" /> Student Strength
                      </label>
                      <input 
                        type="number"
                        placeholder="Estimated total students"
                        value={studentStrength}
                        onChange={(e) => setStudentStrength(e.target.value)}
                        className="w-full bg-[#0a0e1a] border border-slate-805 text-slate-100 rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-all duration-200"
                      />
                    </div>

                    {/* Address */}
                    <div className="space-y-1.5 md:col-span-2">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5 font-mono">
                        <MapPin size={12} className="text-brand-400" /> Address
                      </label>
                      <input 
                        type="text"
                        placeholder="Enter street address"
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        className="w-full bg-[#0a0e1a] border border-slate-805 text-slate-100 rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-all duration-200"
                      />
                    </div>

                    {/* City */}
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono">City</label>
                      <input 
                        type="text"
                        placeholder="Enter city"
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        className="w-full bg-[#0a0e1a] border border-slate-850 text-slate-100 rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-all duration-200"
                      />
                    </div>

                    {/* State */}
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono">State</label>
                      <input 
                        type="text"
                        placeholder="Enter state"
                        value={stateName}
                        onChange={(e) => setStateName(e.target.value)}
                        className="w-full bg-[#0a0e1a] border border-slate-850 text-slate-100 rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-all duration-200"
                      />
                    </div>

                    {/* Country */}
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5 font-mono">
                        <Globe size={12} className="text-brand-400" /> Country
                      </label>
                      <select 
                        value={country}
                        onChange={(e) => setCountry(e.target.value)}
                        className="w-full bg-[#0a0e1a] border border-slate-805 text-slate-100 rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-all duration-200"
                      >
                        <option value="India">India</option>
                        <option value="United States">United States</option>
                        <option value="United Kingdom">United Kingdom</option>
                        <option value="United Arab Emirates">United Arab Emirates</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>

                    {/* School Type */}
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono">School Type</label>
                      <select 
                        value={schoolType}
                        onChange={(e) => setSchoolType(e.target.value)}
                        className="w-full bg-[#0a0e1a] border border-slate-805 text-slate-100 rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-all duration-200"
                      >
                        <option value="">Select school type</option>
                        <option value="PRIMARY">Primary School</option>
                        <option value="SECONDARY">Secondary High School</option>
                        <option value="COLLEGE">College / University</option>
                        <option value="CHARTER">Charter/Independent Academy</option>
                      </select>
                    </div>

                    {/* Admin Password */}
                    <div className="space-y-1.5 md:col-span-2 border-t border-slate-900 pt-3">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5 font-mono">
                        <Lock size={12} className="text-brand-400" /> Admin Console Password *
                      </label>
                      <input 
                        type="password"
                        placeholder="••••••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full bg-[#0a0e1a] border border-slate-805 text-slate-100 rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-all duration-200"
                        required
                      />
                    </div>
                  </div>

                  <button 
                    type="submit"
                    disabled={registerLoading}
                    className="w-full bg-gradient-to-r from-brand-600 via-brand-500 to-brand-600 hover:from-brand-500 hover:to-brand-400 text-white font-bold text-xs py-3 rounded-xl transition-all shadow-lg hover:shadow-brand-500/20 disabled:opacity-40 disabled:pointer-events-none mt-2 flex items-center justify-center gap-2 border border-brand-400/20"
                  >
                    {registerLoading ? (
                      <span className="flex items-center gap-2">
                        <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                        Generating Verification Code...
                      </span>
                    ) : (
                      <>
                        <span>Register School</span>
                        <ArrowRight size={14} />
                      </>
                    )}
                  </button>
                </form>

                <div className="text-center pt-2">
                  <a 
                    href="#" 
                    onClick={(e) => { e.preventDefault(); onBackToLogin(); }}
                    className="text-xs text-slate-450 hover:text-slate-250 transition-colors"
                  >
                    Return to Operator Console Login
                  </a>
                </div>
              </div>
            </GlassCard>
          </div>
        )}

        {/* Step 2: Email Verification (OTP Entry) */}
        {step === 'otp' && (
          <GlassCard className="max-w-md mx-auto p-8 bg-[#0b101d]/75 border-slate-850 hover:border-slate-800/80 shadow-2xl relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-brand-600 via-brand-400 to-brand-600 opacity-80" />
            
            <div className="space-y-6 text-center">
              <div className="w-16 h-16 rounded-2xl bg-brand-500/10 flex items-center justify-center mx-auto text-brand-400">
                <Mail size={32} className="animate-pulse-subtle" />
              </div>

              <div className="space-y-2">
                <h2 className="text-xl font-bold text-slate-100 font-sans tracking-wide">Verify Your Email</h2>
                <p className="text-xs text-slate-450 px-2 leading-relaxed">
                  We have dispatched a 6-digit verification security OTP to <span className="text-slate-200 font-semibold">{email}</span>.
                </p>
              </div>

              {otpError && (
                <div className="p-3.5 bg-red-500/5 border border-red-500/20 text-red-400 text-xs rounded-xl flex items-start gap-2.5 text-left">
                  <ShieldAlert size={16} className="shrink-0 mt-0.5" />
                  <div className="font-medium">{otpError}</div>
                </div>
              )}

              {otpSuccess && (
                <div className="p-3.5 bg-emerald-500/5 border border-emerald-500/20 text-emerald-400 text-xs rounded-xl flex items-start gap-2.5 text-left">
                  <CheckCircle2 size={16} className="shrink-0 mt-0.5" />
                  <div className="font-medium">{otpSuccess}</div>
                </div>
              )}

              <form onSubmit={handleOtpVerifySubmit} className="space-y-5">
                <div className="flex justify-between items-center gap-2 max-w-xs mx-auto">
                  {otpArray.map((digit, idx) => (
                    <input 
                      key={idx}
                      id={`otp-input-${idx}`}
                      type="text"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleOtpChange(idx, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                      className="w-12 h-12 bg-[#0a0e1a] border border-slate-805 text-slate-100 text-xl font-bold text-center rounded-xl focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 focus:shadow-[0_0_12px_rgba(14,160,235,0.15)] transition-all duration-200"
                    />
                  ))}
                </div>

                <div className="text-xs text-slate-500">
                  {resendTimer > 0 ? (
                    <span>Resend verification code in <strong className="text-slate-350">{resendTimer}s</strong></span>
                  ) : (
                    <a href="#" onClick={handleResendOtp} className="text-brand-400 hover:text-brand-300 font-semibold hover:underline transition-colors">
                      Resend Verification Code
                    </a>
                  )}
                </div>

                <button 
                  type="submit"
                  disabled={otpLoading}
                  className="w-full bg-gradient-to-r from-brand-600 via-brand-500 to-brand-600 hover:from-brand-500 hover:to-brand-400 text-white font-bold text-xs py-3 rounded-xl transition-all shadow-lg hover:shadow-brand-500/20 disabled:opacity-40 disabled:pointer-events-none mt-2 flex items-center justify-center gap-2 border border-brand-400/20"
                >
                  {otpLoading ? (
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                      Provisioning Registry...
                    </span>
                  ) : (
                    <>
                      <span>Verify Email & Setup Account</span>
                      <ArrowRight size={14} />
                    </>
                  )}
                </button>
              </form>

              <div className="flex justify-between items-center text-xs pt-2 border-t border-slate-900">
                <a href="#" onClick={(e) => { e.preventDefault(); setStep('register'); }} className="text-slate-450 hover:text-slate-300 font-medium transition-colors">
                  Change Email
                </a>
                <a href="#" onClick={(e) => { e.preventDefault(); onBackToLogin(); }} className="text-slate-500 hover:text-slate-300 transition-colors">
                  Cancel
                </a>
              </div>
            </div>
          </GlassCard>
        )}

        {/* Step 3: Choose Plan & Pay */}
        {step === 'plans' && (
          <div className="space-y-6">
            <div className="text-center space-y-2 max-w-xl mx-auto mb-4">
              <h2 className="text-2xl font-bold text-slate-100 font-sans tracking-wide">Choose Your Subscription Plan</h2>
              <p className="text-xs text-slate-450 leading-relaxed">
                Your school trial account has been provisioned! Choose a subscription plan to unlock extended modules and connect payment.
              </p>
              
              {/* Monthly/Yearly toggle */}
              <div className="inline-flex items-center bg-slate-900/60 p-1.5 rounded-full border border-slate-850 mt-4">
                <button 
                  onClick={() => setBillingCycle('MONTHLY')}
                  className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${billingCycle === 'MONTHLY' ? 'bg-brand-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'}`}
                >
                  Monthly
                </button>
                <button 
                  onClick={() => setBillingCycle('YEARLY')}
                  className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 ${billingCycle === 'YEARLY' ? 'bg-brand-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'}`}
                >
                  Yearly
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-medium tracking-normal leading-none">Save 20%</span>
                </button>
              </div>
            </div>

            {paymentError && (
              <div className="max-w-xl mx-auto p-3.5 bg-red-500/5 border border-red-500/20 text-red-400 text-xs rounded-xl flex items-start gap-2.5">
                <ShieldAlert size={16} className="shrink-0 mt-0.5" />
                <div className="font-medium">{paymentError}</div>
              </div>
            )}

            {/* Grid of Plans */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-stretch">
              {[
                { 
                  name: 'Basic', 
                  code: 'basic', 
                  priceMonthly: 999, 
                  priceYearly: 9590, 
                  features: ['Student Management', 'Attendance', 'Fee Management'],
                  desc: 'Perfect for small schools.'
                },
                { 
                  name: 'Standard', 
                  code: 'standard', 
                  priceMonthly: 2499, 
                  priceYearly: 23990, 
                  features: ['Everything in Basic', 'Teacher Portal', 'Parent Portal', 'Reports'],
                  desc: 'Popular choice for growing schools.',
                  popular: true
                },
                { 
                  name: 'Premium', 
                  code: 'premium', 
                  priceMonthly: 4999, 
                  priceYearly: 47990, 
                  features: ['Everything in Standard', 'Hostel Management', 'Library Management', 'Transport Management', 'Analytics Dashboard'],
                  desc: 'For large institutions seeking full control.'
                },
                { 
                  name: 'Enterprise', 
                  code: 'enterprise', 
                  priceMonthly: 'Custom', 
                  priceYearly: 'Custom', 
                  features: ['All Modules', 'Custom Branding', 'Priority Support', 'Multi-Campus Support'],
                  desc: 'Bespoke integration for multi-campuses.'
                }
              ].map((plan, idx) => {
                const isEnterprise = plan.code === 'enterprise';
                const displayPrice = isEnterprise 
                  ? 'Custom' 
                  : (billingCycle === 'MONTHLY' ? `₹${plan.priceMonthly}` : `₹${plan.priceYearly}`);
                const displayCycle = isEnterprise ? '' : (billingCycle === 'MONTHLY' ? '/ month' : '/ year');

                return (
                  <GlassCard 
                    key={idx}
                    className={`flex flex-col justify-between p-6 bg-[#0b101d]/75 border-slate-850 hover:border-slate-800/80 shadow-xl relative overflow-hidden transition-all duration-300 ${plan.popular ? 'border-brand-500/30 shadow-brand-500/5 ring-1 ring-brand-500/20' : ''}`}
                  >
                    {plan.popular && (
                      <div className="absolute top-3 right-3">
                        <span className="text-[9px] px-2 py-0.5 rounded-full bg-brand-500/20 text-brand-400 font-bold uppercase tracking-wider">Popular</span>
                      </div>
                    )}

                    <div className="space-y-4">
                      <div className="space-y-1">
                        <h3 className="text-base font-bold text-slate-100">{plan.name}</h3>
                        <p className="text-[10px] text-slate-450 leading-relaxed">{plan.desc}</p>
                      </div>

                      <div className="py-2 border-y border-slate-900">
                        <span className="text-2xl font-extrabold text-white">{displayPrice}</span>
                        <span className="text-xs text-slate-500 ml-1">{displayCycle}</span>
                      </div>

                      <ul className="space-y-2.5 text-xs text-slate-350 flex-1">
                        {plan.features.map((feat, fIdx) => (
                          <li key={fIdx} className="flex items-start gap-2 leading-relaxed">
                            <span className="text-brand-400 font-bold">✓</span>
                            <span>{feat}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <button 
                      onClick={() => handlePlanPayment(plan.code)}
                      disabled={paymentLoading}
                      className={`w-full mt-6 py-2.5 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-1.5 ${plan.popular ? 'bg-brand-600 hover:bg-brand-500 text-white shadow-md' : 'bg-slate-900 border border-slate-800 hover:border-brand-500/30 text-slate-300'}`}
                    >
                      {paymentLoading && selectedPlanCode === plan.code ? (
                        <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                      ) : (
                        <>
                          <span>{isEnterprise ? 'Contact Sales' : 'Select Plan'}</span>
                          <ChevronRight size={13} />
                        </>
                      )}
                    </button>
                  </GlassCard>
                );
              })}
            </div>

            {/* Payment footer badges */}
            <div className="text-center pt-6 border-t border-slate-900 space-y-3">
              <div className="flex items-center justify-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-450">
                <Lock size={12} className="text-brand-400" />
                <span>Secure Payments Processed by Razorpay Gateway</span>
              </div>
              <div className="flex items-center justify-center gap-4 text-slate-600 text-xs">
                <span>UPI</span>
                <span>Visa</span>
                <span>Mastercard</span>
                <span>RuPay</span>
                <span>Net Banking</span>
              </div>
            </div>

            <div className="text-center">
              <a 
                href="#" 
                onClick={(e) => { e.preventDefault(); setStep('register'); }}
                className="text-xs text-slate-450 hover:text-slate-200 transition-colors font-medium"
              >
                Back to Registration Details
              </a>
            </div>
          </div>
        )}

        {/* Step 4: Payment Success Screen */}
        {step === 'success' && (
          <GlassCard className="max-w-xl mx-auto p-8 bg-[#0b101d]/75 border-slate-850 hover:border-slate-800/80 shadow-2xl relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-emerald-600 via-emerald-400 to-emerald-600 opacity-80" />
            
            <div className="space-y-6 text-center">
              <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto text-emerald-400">
                <CheckCircle2 size={36} className="animate-bounce" />
              </div>

              <div className="space-y-2">
                <h2 className="text-xl font-bold text-slate-100 font-sans tracking-wide">Payment Successful!</h2>
                <p className="text-xs text-slate-450 leading-relaxed px-6">
                  Congratulations! Your school account is now fully active. We have sent the confirmation invoice to your email registry.
                </p>
              </div>

              {/* Transaction Details */}
              <div className="p-4 bg-slate-900/40 border border-slate-850 rounded-2xl text-left text-xs space-y-3.5 max-w-sm mx-auto">
                <div className="flex items-center justify-between border-b border-slate-850/60 pb-2">
                  <span className="text-slate-450 font-medium">School Registered</span>
                  <span className="text-slate-200 font-bold">{schoolName}</span>
                </div>
                
                <div className="flex items-center justify-between border-b border-slate-850/60 pb-2">
                  <span className="text-slate-450 font-medium">Subscription Plan</span>
                  <span className="text-brand-400 font-bold uppercase tracking-wider">{selectedPlanCode} ({billingCycle})</span>
                </div>

                <div className="flex items-center justify-between border-b border-slate-850/60 pb-2">
                  <span className="text-slate-450 font-medium">Paid Amount</span>
                  <span className="text-slate-200 font-mono font-bold">₹{paymentAmount}</span>
                </div>

                <div className="flex items-center justify-between border-b border-slate-850/60 pb-2">
                  <span className="text-slate-450 font-medium">Transaction ID</span>
                  <span className="text-slate-350 font-mono truncate max-w-[150px]">{transactionId}</span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-450 font-medium">Payment Date</span>
                  <span className="text-slate-350">{paymentDate || new Date().toLocaleDateString('en-IN')}</span>
                </div>
              </div>

              <div className="space-y-3 max-w-xs mx-auto">
                <button 
                  onClick={() => {
                    // Navigate to dashboard / refresh session
                    window.location.hash = '';
                    onBackToLogin();
                  }}
                  className="w-full bg-gradient-to-r from-brand-600 via-brand-500 to-brand-600 hover:from-brand-500 hover:to-brand-400 text-white font-bold text-xs py-3 rounded-xl transition-all shadow-lg hover:shadow-brand-500/20 flex items-center justify-center gap-2 border border-brand-400/20"
                >
                  <span>Go to Dashboard Console</span>
                  <ArrowRight size={14} />
                </button>
                
                <p className="text-[10px] text-slate-500">
                  Please verify check-in credentials on your console dashboard.
                </p>
              </div>
            </div>
          </GlassCard>
        )}

      </div>

      {/* Footer System Badges */}
      <div className="w-full max-w-6xl mx-auto border-t border-slate-900 pt-5 mt-2 flex flex-col md:flex-row justify-between items-center gap-4 text-[10px] text-slate-500 font-mono relative z-10 shrink-0">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-400">Aegis ERP Institutional Cloud</span>
          <span className="text-slate-700">|</span>
          <span>SaaS self-provisioning gateway</span>
        </div>
        
        <div className="flex items-center gap-2 bg-slate-900/50 border border-slate-850 px-3 py-1 rounded-full backdrop-blur-sm">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-slate-400 font-semibold">All Services Operational</span>
        </div>

        <div className="flex items-center gap-1.5 text-slate-400">
          <Lock size={11} className="text-brand-400" />
          <span>SaaS payment sessions fully protected</span>
        </div>
      </div>
    </div>
  );
};
