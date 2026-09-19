import { User } from '../types';

export const RECENT_ACTIVITY_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Robustly parses user age from string or number.
 */
export function parseUserAge(ageInput: string | number | undefined | null): number {
  if (ageInput === undefined || ageInput === null) return 0;
  const str = String(ageInput).trim();
  const parsed = parseInt(str, 10);
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Returns true if the user's age is 18 or older.
 */
export function isAdultUser(user: Partial<User> | null | undefined): boolean {
  if (!user || user.age === undefined || user.age === null) return false;
  return parseUserAge(user.age) >= 18;
}

/**
 * Secure check: can this user access the Meet feature?
 * Strictly restricted to adults (18+).
 */
export function canUseMeet(user: Partial<User> | null | undefined): boolean {
  return isAdultUser(user);
}

export interface MeetRequirementsStatus {
  isAdult: boolean;
  hasPhoto: boolean;
  hasMaritalStatus: boolean;
  hasPhone: boolean;
  isPhoneVerified: boolean;
  hasCountry: boolean;
  hasCity: boolean;
  isComplete: boolean;
  missingRequirements: string[];
}

/**
 * Evaluates the required fields for Meet completion.
 * ALL 6 details + 18+ check must be satisfied.
 */
export function checkMeetSetupRequirements(user: Partial<User> | null | undefined): MeetRequirementsStatus {
  const isAdult = isAdultUser(user);
  const hasPhoto = Boolean(user?.profilePhotoUrl && user.profilePhotoUrl.trim().length > 0);
  const hasMaritalStatus = user?.maritalStatus === 'Single' || user?.maritalStatus === 'Married';
  const hasPhone = Boolean(user?.phoneNumber && user.phoneNumber.trim().length > 0);
  const isPhoneVerified = Boolean(user?.phoneVerified === true);
  const hasCountry = Boolean(user?.country && user.country.trim().length > 0);
  const hasCity = Boolean(user?.city && user.city.trim().length > 0);

  const missing: string[] = [];
  if (!isAdult) missing.push('Must be 18 years or older');
  if (!hasPhoto) missing.push('Profile picture is required');
  if (!hasMaritalStatus) missing.push('Marital status (Single or Married) is required');
  if (!hasPhone) missing.push('Phone number is required');
  if (!isPhoneVerified) missing.push('Phone number must be verified');
  if (!hasCountry) missing.push('Country is required');
  if (!hasCity) missing.push('City is required');

  const isComplete = isAdult && hasPhoto && hasMaritalStatus && hasPhone && isPhoneVerified && hasCountry && hasCity;

  return {
    isAdult,
    hasPhoto,
    hasMaritalStatus,
    hasPhone,
    isPhoneVerified,
    hasCountry,
    hasCity,
    isComplete,
    missingRequirements: missing
  };
}

/**
 * Determines whether the user should currently be treated as online
 * based on their last activity timestamp within the configurable window.
 */
export function isUserOnline(lastSeenAt: number | string | null | undefined, windowMs: number = RECENT_ACTIVITY_WINDOW_MS): boolean {
  if (!lastSeenAt) return false;
  const lastTime = typeof lastSeenAt === 'string' ? new Date(lastSeenAt).getTime() : lastSeenAt;
  if (isNaN(lastTime)) return false;
  return (Date.now() - lastTime) <= windowMs;
}

/**
 * Standard list of countries for the country selector
 */
export const COUNTRY_LIST: string[] = [
  "United States", "United Kingdom", "Canada", "Australia", "Nigeria",
  "South Africa", "Ghana", "Kenya", "Germany", "France",
  "India", "Japan", "Brazil", "Mexico", "Spain",
  "Italy", "Netherlands", "Sweden", "Singapore", "United Arab Emirates",
  "New Zealand", "Ireland", "Norway", "Switzerland", "Egypt",
  "Saudi Arabia", "Indonesia", "Malaysia", "Philippines", "Argentina"
];
