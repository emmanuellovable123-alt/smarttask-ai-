import React, { useState, useRef } from 'react';
import { User } from '../../types';
import { COUNTRY_LIST, isAdultUser } from '../../lib/meetEligibility';
import { Camera, Check, AlertCircle, Loader2, X, Phone, ShieldCheck, MapPin } from 'lucide-react';
import { motion } from 'motion/react';

interface MeetSetupModalProps {
  user: User;
  onClose: () => void;
  onSetupComplete: (updatedUser: User) => void;
  onBlockedUnder18?: () => void;
}

export function MeetSetupModal({ user, onClose, onSetupComplete, onBlockedUnder18 }: MeetSetupModalProps) {
  // Adult gatekeeper: Under-18 users must NEVER be able to use or set up Meet
  if (!isAdultUser(user)) {
    if (onBlockedUnder18) onBlockedUnder18();
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
        <div className="bg-white rounded-2xl p-6 max-w-sm w-full text-center shadow-xl border border-slate-100">
          <AlertCircle className="w-10 h-10 text-rose-500 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-900 mb-1">Meet is unavailable for this account.</h3>
          <p className="text-xs text-slate-500 mb-4">You can continue using all your daily tasks, alarms, and reports normally.</p>
          <button
            onClick={onClose}
            className="w-full py-2 bg-slate-900 text-white text-xs font-semibold rounded-xl"
          >
            Back to Tasks
          </button>
        </div>
      </div>
    );
  }

  // Form states initialized with existing user values if available
  const [photoData, setPhotoData] = useState<string>(user.profilePhotoUrl || '');
  const [maritalStatus, setMaritalStatus] = useState<'Single' | 'Married' | ''>(user.maritalStatus || '');
  const [phoneNumber, setPhoneNumber] = useState<string>(user.phoneNumber || '');
  const [phoneVerified, setPhoneVerified] = useState<boolean>(user.phoneVerified || false);
  const [country, setCountry] = useState<string>(user.country || 'United States');
  const [city, setCity] = useState<string>(user.city || '');

  // Verification code states
  const [verificationCodeSent, setVerificationCodeSent] = useState(false);
  const [verificationInput, setVerificationInput] = useState('');
  const [dispatchedTestCode, setDispatchedTestCode] = useState<string | null>(null);
  const [isSendingCode, setIsSendingCode] = useState(false);
  const [isVerifyingCode, setIsVerifyingCode] = useState(false);

  // General submission & error states
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // 1. Photo upload handling
  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPhotoError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    // Check file format
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/jpg'];
    if (!allowedTypes.includes(file.type)) {
      setPhotoError('Unsupported file. Please upload a JPEG, PNG, WEBP, or GIF image.');
      return;
    }

    // Check file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setPhotoError('File too large. Maximum allowed size is 5MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (loadEvt) => {
      const result = loadEvt.target?.result as string;
      setPhotoData(result);
    };
    reader.readAsDataURL(file);
  };

  // 2. Send Phone Verification Code
  const handleSendVerificationCode = async () => {
    if (!phoneNumber || phoneNumber.trim().length < 6) {
      setErrorMessage('Please enter a valid phone number before verifying.');
      return;
    }

    setIsSendingCode(true);
    setErrorMessage(null);

    try {
      const res = await fetch('/api/meet/send-phone-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          age: user.age,
          phoneNumber: phoneNumber.trim()
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to dispatch verification code');
      }

      setVerificationCodeSent(true);
      if (data.testCode) {
        setDispatchedTestCode(data.testCode);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Error sending verification code');
    } finally {
      setIsSendingCode(false);
    }
  };

  // 3. Confirm Phone Verification Code
  const handleConfirmVerificationCode = async () => {
    if (!verificationInput || verificationInput.trim().length < 4) {
      setErrorMessage('Please enter the verification code.');
      return;
    }

    setIsVerifyingCode(true);
    setErrorMessage(null);

    try {
      const res = await fetch('/api/meet/verify-phone-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          age: user.age,
          phoneNumber: phoneNumber.trim(),
          code: verificationInput.trim()
        })
      });

      const data = await res.json();
      if (!res.ok || !data.verified) {
        throw new Error(data.error || 'Invalid verification code');
      }

      setPhoneVerified(true);
      setVerificationCodeSent(false);
      setDispatchedTestCode(null);
    } catch (err: any) {
      setErrorMessage(err.message || 'Verification failed');
    } finally {
      setIsVerifyingCode(false);
    }
  };

  // 4. Save Setup & Continue
  const handleContinue = async () => {
    setErrorMessage(null);

    // Client-side pre-validation
    if (!photoData) {
      setErrorMessage('Profile picture is required.');
      return;
    }
    if (!maritalStatus) {
      setErrorMessage('Please indicate whether you are single or married.');
      return;
    }
    if (!phoneNumber) {
      setErrorMessage('Phone number is required.');
      return;
    }
    if (!phoneVerified) {
      setErrorMessage('Phone number must be verified before proceeding.');
      return;
    }
    if (!country) {
      setErrorMessage('Country is required.');
      return;
    }
    if (!city.trim()) {
      setErrorMessage('City is required.');
      return;
    }

    setIsSubmitting(true);

    try {
      // Authoritative server-side verification of all 6 details + 18+ check
      const res = await fetch('/api/meet/save-setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          age: user.age,
          profilePhotoUrl: photoData,
          maritalStatus,
          phoneNumber: phoneNumber.trim(),
          country: country.trim(),
          city: city.trim()
        })
      });

      const data = await res.json();
      if (!res.ok) {
        const missing = data.missingRequirements?.join(', ') || data.error;
        throw new Error(missing || 'Failed to complete Meet setup');
      }

      // Updated user object
      const updatedUser: User = {
        ...user,
        profilePhotoUrl: photoData,
        maritalStatus: maritalStatus as 'Single' | 'Married',
        phoneNumber: phoneNumber.trim(),
        phoneVerified: true,
        country: country.trim(),
        city: city.trim(),
        meetSetupCompleted: true,
        meetEnabled: true
      };

      onSetupComplete(updatedUser);
    } catch (err: any) {
      setErrorMessage(err.message || 'Error saving Meet details');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div 
      id="meet-setup-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto"
    >
      <motion.div
        id="meet-setup-modal"
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-2xl shadow-2xl max-w-md w-full border border-slate-100 overflow-hidden my-6 flex flex-col"
      >
        {/* Modal Header */}
        <div className="px-6 pt-6 pb-4 border-b border-slate-100 flex items-start justify-between">
          <div>
            <h2 id="meet-setup-heading" className="text-xl font-bold text-slate-900">
              Set Up Meet
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Complete these details before using Meet People.
            </p>
          </div>
          <button
            id="close-meet-setup-btn"
            onClick={onClose}
            aria-label="Close setup"
            className="text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          {errorMessage && (
            <div id="meet-setup-error-banner" className="bg-rose-50 border border-rose-200 text-rose-700 p-3 rounded-xl text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* 1. Profile Picture (REQUIRED) */}
          <div id="setup-photo-section" className="flex flex-col items-center">
            <div className="relative group mb-2">
              {photoData ? (
                <img
                  src={photoData}
                  alt="Profile Preview"
                  className="w-24 h-24 rounded-full object-cover border-4 border-blue-100 shadow-sm"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-24 h-24 rounded-full bg-slate-100 border-2 border-dashed border-slate-300 flex flex-col items-center justify-center text-slate-400">
                  <Camera className="w-8 h-8 mb-1" />
                  <span className="text-[10px] font-semibold">No Photo</span>
                </div>
              )}

              <button
                type="button"
                id="add-photo-btn"
                onClick={() => fileInputRef.current?.click()}
                className="absolute bottom-0 right-0 bg-blue-600 hover:bg-blue-700 text-white p-2 rounded-full shadow-md transition-transform hover:scale-105"
                title="Add Photo"
              >
                <Camera className="w-4 h-4" />
              </button>
            </div>

            <input
              type="file"
              ref={fileInputRef}
              onChange={handlePhotoSelect}
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="hidden"
            />

            <span className="text-xs font-semibold text-slate-800">
              Profile Picture <span className="text-rose-500 font-bold">*</span>
            </span>
            <span className="text-[11px] text-slate-500">
              Add your picture (JPEG, PNG, WEBP, GIF up to 5MB)
            </span>

            {photoError && (
              <span className="text-[11px] text-rose-600 font-medium mt-1">{photoError}</span>
            )}
          </div>

          {/* 2. Marital Status (Single / Married REQUIRED) */}
          <div id="setup-marital-section" className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 block">
              Are you single or married? <span className="text-rose-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                id="marital-single-btn"
                onClick={() => setMaritalStatus('Single')}
                className={`py-2.5 px-4 rounded-xl text-xs font-semibold border text-center transition-all ${
                  maritalStatus === 'Single'
                    ? 'bg-blue-50 border-blue-600 text-blue-700 shadow-xs'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                Single
              </button>
              <button
                type="button"
                id="marital-married-btn"
                onClick={() => setMaritalStatus('Married')}
                className={`py-2.5 px-4 rounded-xl text-xs font-semibold border text-center transition-all ${
                  maritalStatus === 'Married'
                    ? 'bg-blue-50 border-blue-600 text-blue-700 shadow-xs'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                Married
              </button>
            </div>
          </div>

          {/* 3. Phone Number & Phone Verification (REQUIRED & DECOUPLED) */}
          <div id="setup-phone-section" className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-700">
                Phone Number <span className="text-rose-500">*</span>
              </label>
              {phoneVerified ? (
                <span id="phone-verified-badge" className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                  <Check className="w-3 h-3" /> Verified
                </span>
              ) : (
                <span className="text-[11px] text-amber-600 font-medium">Verification required</span>
              )}
            </div>

            <div className="flex gap-2">
              <div className="relative flex-1">
                <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="tel"
                  id="meet-phone-input"
                  value={phoneNumber}
                  onChange={(e) => {
                    setPhoneNumber(e.target.value);
                    if (phoneVerified) setPhoneVerified(false); // require re-verification if number changed
                  }}
                  placeholder="+1 555 019 2834"
                  className="w-full pl-9 pr-3 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>

              {!phoneVerified && (
                <button
                  type="button"
                  id="verify-phone-btn"
                  onClick={handleSendVerificationCode}
                  disabled={isSendingCode || !phoneNumber}
                  className="px-3 py-2.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 whitespace-nowrap transition-colors"
                >
                  {isSendingCode ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
                  <span>{verificationCodeSent ? 'Resend' : 'Verify'}</span>
                </button>
              )}
            </div>

            {/* Verification code input block */}
            {verificationCodeSent && !phoneVerified && (
              <div id="phone-code-entry-block" className="mt-2 p-3 bg-blue-50/60 rounded-xl border border-blue-100 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-blue-900 font-medium">
                    Enter the 6-digit code sent to your phone:
                  </span>
                  {dispatchedTestCode && (
                    <span className="text-[10px] font-bold text-blue-700 bg-white px-1.5 py-0.5 rounded border border-blue-200">
                      Code: {dispatchedTestCode}
                    </span>
                  )}
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    id="phone-verification-code-input"
                    maxLength={6}
                    value={verificationInput}
                    onChange={(e) => setVerificationInput(e.target.value.replace(/\D/g, ''))}
                    placeholder="123456"
                    className="flex-1 px-3 py-2 text-center tracking-widest font-mono text-sm bg-white border border-blue-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    type="button"
                    id="confirm-verification-code-btn"
                    onClick={handleConfirmVerificationCode}
                    disabled={isVerifyingCode || verificationInput.length < 4}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-semibold rounded-lg flex items-center gap-1"
                  >
                    {isVerifyingCode ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Confirm'}
                  </button>
                </div>
              </div>
            )}
            <p className="text-[11px] text-slate-400">
              Your phone number is strictly for verification and will never be shown to other users.
            </p>
          </div>

          {/* 4. Country (REQUIRED) */}
          <div id="setup-country-section" className="space-y-1">
            <label className="text-xs font-semibold text-slate-700 block">
              Country <span className="text-rose-500">*</span>
            </label>
            <select
              id="meet-country-select"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              className="w-full px-3 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            >
              {COUNTRY_LIST.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {/* 5. City (REQUIRED) */}
          <div id="setup-city-section" className="space-y-1">
            <label className="text-xs font-semibold text-slate-700 block">
              City <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <MapPin className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                id="meet-city-input"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="e.g. Chicago, Lagos, London, Toronto"
                className="w-full pl-9 pr-3 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
            </div>
            <p className="text-[11px] text-slate-400">
              Only your city will be visible. Exact street addresses are never shared.
            </p>
          </div>
        </div>

        {/* Modal Footer / Continue Button */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex flex-col gap-2">
          <button
            type="button"
            id="continue-meet-btn"
            onClick={handleContinue}
            disabled={isSubmitting}
            className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 text-white font-semibold text-sm rounded-xl shadow-md shadow-blue-500/20 transition-all flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Verifying Details...</span>
              </>
            ) : (
              <span>Continue</span>
            )}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
