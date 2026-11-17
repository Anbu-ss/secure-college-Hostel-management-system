import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { 
  User, 
  GraduationCap, 
  Home, 
  Users, 
  MapPin, 
  Camera, 
  Upload, 
  CheckCircle, 
  AlertCircle, 
  Loader2, 
  ArrowRight,
  Building2,
  DoorOpen
} from 'lucide-react';
import { useAuth } from '../auth/AuthContext';

const StudentCompleteProfile = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [error, setError] = useState('');

  // Auto-loaded academic details
  const [studentCode, setStudentCode] = useState('');
  const [fullName, setFullName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [profilePhotoUrl, setProfilePhotoUrl] = useState('');

  // Section A: Personal
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [gender, setGender] = useState('Male');

  // Section B: Academic
  const [department, setDepartment] = useState('CSE');
  const [academicYear, setAcademicYear] = useState('2024-2028');
  const [yearOfStudy, setYearOfStudy] = useState(1);
  const [registerNumber, setRegisterNumber] = useState('');

  // Section C: Room Details (Manual entry, Hostel Block removed)
  const [roomNumber, setRoomNumber] = useState('');

  // Section D: Parent / Guardian
  const [guardianName, setGuardianName] = useState('');
  const [guardianRelationship, setGuardianRelationship] = useState('Father');
  const [guardianPhone, setGuardianPhone] = useState('');

  // Section E: Residential Address
  const [permanentAddress, setPermanentAddress] = useState('');
  const [currentAddress, setCurrentAddress] = useState('');
  const [city, setCity] = useState('');
  const [district, setDistrict] = useState('');
  const [state, setState] = useState('Tamil Nadu');
  const [postalCode, setPostalCode] = useState('');

  useEffect(() => {
    fetchExistingProfile();
  }, []);

  const fetchExistingProfile = async () => {
    try {
      setLoading(true);
      const res = await axios.get('/api/student/profile');
      if (res.data?.profile) {
        const p = res.data.profile;
        if (p.studentCode) setStudentCode(p.studentCode);
        if (p.studentName) setFullName(p.studentName);
        if (p.email) setEmail(p.email);
        if (p.department && p.department !== 'General') setDepartment(p.department);
        if (p.academicYear) setAcademicYear(p.academicYear);
        if (p.yearOfStudy) setYearOfStudy(p.yearOfStudy);
        if (p.registerNumber && p.registerNumber !== 'Pending') setRegisterNumber(p.registerNumber);
        if (p.roomNumber && p.roomNumber !== 'Pending Allocation') setRoomNumber(p.roomNumber);
        if (p.phoneNumber) setPhoneNumber(p.phoneNumber);
        if (p.dateOfBirth) setDateOfBirth(p.dateOfBirth);
        if (p.gender) setGender(p.gender);
        if (p.profilePhotoUrl) setProfilePhotoUrl(p.profilePhotoUrl);
        if (p.guardianName) setGuardianName(p.guardianName);
        if (p.guardianRelationship) setGuardianRelationship(p.guardianRelationship);
        if (p.guardianPhone) setGuardianPhone(p.guardianPhone);
        if (p.permanentAddress) setPermanentAddress(p.permanentAddress);
        if (p.currentAddress) setCurrentAddress(p.currentAddress);
        if (p.city) setCity(p.city);
        if (p.district) setDistrict(p.district);
        if (p.state) setState(p.state);
        if (p.postalCode) setPostalCode(p.postalCode);
      }
    } catch (_) {}
    finally {
      setLoading(false);
    }
  };

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      setError('Profile photo must be smaller than 2MB.');
      return;
    }

    setUploadingPhoto(true);
    setError('');

    const reader = new FileReader();
    reader.onloadend = async () => {
      try {
        const token = localStorage.getItem('token') || sessionStorage.getItem('token');
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        const res = await axios.post('/api/student/upload-photo', {
          photoBase64: reader.result,
          fileName: file.name
        }, { headers });
        if (res.data.success) {
          setProfilePhotoUrl(res.data.photoUrl);
        }
      } catch (uploadErr) {
        setError(uploadErr.response?.data?.message || 'Failed to upload photo to Supabase Storage.');
      } finally {
        setUploadingPhoto(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!phoneNumber.trim() || !guardianName.trim() || !guardianPhone.trim() || !permanentAddress.trim() || !city.trim() || !roomNumber.trim()) {
      setError('Please fill in all required fields: phone number, room number, guardian details, and residential address.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await axios.post('/api/student/complete-profile', {
        dateOfBirth,
        gender,
        department,
        academicYear,
        yearOfStudy,
        registerNumber: registerNumber.trim() || null,
        roomNumber: roomNumber.trim(),
        phoneNumber: phoneNumber.trim(),
        permanentAddress: permanentAddress.trim(),
        currentAddress: currentAddress.trim() || permanentAddress.trim(),
        city: city.trim(),
        district: district.trim(),
        state: state.trim(),
        postalCode: postalCode.trim(),
        guardianName: guardianName.trim(),
        guardianRelationship,
        guardianPhone: guardianPhone.trim()
      });

      if (res.data.success) {
        navigate('/student/pending-approval', { replace: true });
      }
    } catch (err) {
      const msg = err.response?.data?.message || 'Error saving student profile. Please try again.';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center text-slate-400">
        <Loader2 className="h-7 w-7 animate-spin text-blue-500 mr-3" />
        <span>Loading Profile Configuration...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">

        {/* Top Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center space-x-2 px-3 py-1 bg-blue-950/80 border border-blue-800 rounded-full text-blue-300 text-xs font-semibold uppercase tracking-wider mb-3">
            <Building2 className="h-3.5 w-3.5" />
            <span>Step 2 of 2: Profile Submission</span>
          </div>
          <h1 className="text-3xl font-extrabold text-white">
            Complete Your Student Profile
          </h1>
          <p className="text-sm text-slate-400 mt-1 max-w-xl mx-auto">
            Your details will be reviewed by hostel administrators for active dashboard access.
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-6 p-4 bg-red-950/70 border border-red-800/80 rounded-2xl flex items-start space-x-3 text-red-200 text-xs animate-shake">
            <AlertCircle className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
            <div className="font-medium leading-relaxed">{error}</div>
          </div>
        )}

        {/* ── SINGLE CARD CONTAINER FOR ENTIRE PROFILE FORM ──────────────── */}
        <div className="bg-slate-800/90 border border-slate-700/80 rounded-3xl p-6 sm:p-10 shadow-2xl">
          <form onSubmit={handleSubmit} className="space-y-10">

            {/* ── SECTION A: Personal Information ──────────────────────────── */}
            <div>
              <div className="flex items-center space-x-3 mb-6 pb-4 border-b border-slate-700/80">
                <div className="p-2.5 bg-blue-600/20 text-blue-400 rounded-xl">
                  <User className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">Section A: Personal Information</h2>
                  <p className="text-xs text-slate-400">Basic contact, identity, and profile picture</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
                {/* Profile Photo Upload */}
                <div className="flex flex-col items-center justify-center p-4 bg-slate-900/60 border border-slate-700/80 rounded-2xl text-center">
                  <div className="relative w-28 h-28 rounded-full overflow-hidden border-2 border-blue-500/50 bg-slate-800 mb-3 flex items-center justify-center">
                    {profilePhotoUrl ? (
                      <img src={profilePhotoUrl} alt="Student" className="w-full h-full object-cover" />
                    ) : (
                      <User className="h-14 w-14 text-slate-500" />
                    )}
                    {uploadingPhoto && (
                      <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                        <Loader2 className="h-6 w-6 animate-spin text-white" />
                      </div>
                    )}
                  </div>

                  <label className="cursor-pointer inline-flex items-center space-x-1.5 py-1.5 px-3 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl transition-colors">
                    <Camera className="h-3.5 w-3.5" />
                    <span>{profilePhotoUrl ? 'Change Photo' : 'Upload Photo'}</span>
                    <input
                      type="file"
                      accept="image/png, image/jpeg, image/webp"
                      onChange={handlePhotoUpload}
                      className="hidden"
                    />
                  </label>
                  <span className="text-[10px] text-slate-500 mt-1">PNG, JPG up to 2MB</span>
                </div>

                {/* Personal Fields */}
                <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                      Full Name (Read-Only)
                    </label>
                    <input
                      type="text"
                      value={fullName}
                      disabled
                      className="w-full px-3.5 py-2.5 bg-slate-900/90 border border-slate-700 rounded-xl text-slate-300 text-sm cursor-not-allowed"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                      Email Address (Read-Only)
                    </label>
                    <input
                      type="email"
                      value={email}
                      disabled
                      className="w-full px-3.5 py-2.5 bg-slate-900/90 border border-slate-700 rounded-xl text-slate-300 text-sm cursor-not-allowed"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                      Mobile Phone Number *
                    </label>
                    <input
                      type="tel"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      placeholder="e.g. 9876543210"
                      required
                      className="w-full px-3.5 py-2.5 bg-slate-900/60 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                      Date of Birth *
                    </label>
                    <input
                      type="date"
                      value={dateOfBirth}
                      onChange={(e) => setDateOfBirth(e.target.value)}
                      required
                      className="w-full px-3.5 py-2.5 bg-slate-900/60 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                      Gender
                    </label>
                    <select
                      value={gender}
                      onChange={(e) => setGender(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-900/60 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* ── SECTION B: Academic Information ──────────────────────────── */}
            <div className="pt-8 border-t border-slate-700/80">
              <div className="flex items-center space-x-3 mb-6 pb-4 border-b border-slate-700/80">
                <div className="p-2.5 bg-indigo-600/20 text-indigo-400 rounded-xl">
                  <GraduationCap className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">Section B: Academic Information</h2>
                  <p className="text-xs text-slate-400">Department, study year, and auto-generated unique student identifier</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {/* Generated Student ID (Read Only, zero-padded 3 digits) */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                    Unique Student ID (Auto-Generated)
                  </label>
                  <input
                    type="text"
                    value={studentCode || 'Generating...'}
                    disabled
                    className="w-full px-3.5 py-2.5 bg-slate-900/90 border border-indigo-500/50 rounded-xl font-mono font-bold text-indigo-400 text-sm cursor-not-allowed tracking-widest"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">Permanent zero-padded identifier (001, 002...)</p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                    Department *
                  </label>
                  <select
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-900/60 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="CSE">CSE - Computer Science & Engineering</option>
                    <option value="IT">IT - Information Technology</option>
                    <option value="AIDS">AIDS - AI & Data Science</option>
                    <option value="AIML">AIML - AI & Machine Learning</option>
                    <option value="ECE">ECE - Electronics & Communication</option>
                    <option value="EEE">EEE - Electrical & Electronics</option>
                    <option value="MECH">MECH - Mechanical Engineering</option>
                    <option value="CIVIL">CIVIL - Civil Engineering</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                    Year of Study *
                  </label>
                  <select
                    value={yearOfStudy}
                    onChange={(e) => setYearOfStudy(parseInt(e.target.value))}
                    className="w-full px-3.5 py-2.5 bg-slate-900/60 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value={1}>1st Year</option>
                    <option value={2}>2nd Year</option>
                    <option value={3}>3rd Year</option>
                    <option value={4}>4th Year</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                    Academic Year
                  </label>
                  <input
                    type="text"
                    value={academicYear}
                    onChange={(e) => setAcademicYear(e.target.value)}
                    placeholder="e.g. 2024-2028"
                    className="w-full px-3.5 py-2.5 bg-slate-900/60 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                    University / College Register Number (if available)
                  </label>
                  <input
                    type="text"
                    value={registerNumber}
                    onChange={(e) => setRegisterNumber(e.target.value)}
                    placeholder="e.g. 210523205001 (optional at registration)"
                    className="w-full px-3.5 py-2.5 bg-slate-900/60 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* ── SECTION C: Room Details (Single Field, Manual Entry) ─────── */}
            <div className="pt-8 border-t border-slate-700/80">
              <div className="flex items-center space-x-3 mb-6 pb-4 border-b border-slate-700/80">
                <div className="p-2.5 bg-emerald-600/20 text-emerald-400 rounded-xl">
                  <DoorOpen className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">Section C: Room Details</h2>
                  <p className="text-xs text-slate-400">Enter your assigned or preferred hostel room number</p>
                </div>
              </div>

              <div className="max-w-md">
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  Room Number *
                </label>
                <input
                  type="text"
                  value={roomNumber}
                  onChange={(e) => setRoomNumber(e.target.value)}
                  placeholder="e.g. 101 or B-204"
                  required
                  className="w-full px-3.5 py-2.5 bg-slate-900/60 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <p className="text-[11px] text-slate-400 mt-1">Hostel Block assignment is managed by administration.</p>
              </div>
            </div>

            {/* ── SECTION D: Parent / Guardian Details ─────────────────────── */}
            <div className="pt-8 border-t border-slate-700/80">
              <div className="flex items-center space-x-3 mb-6 pb-4 border-b border-slate-700/80">
                <div className="p-2.5 bg-violet-600/20 text-violet-400 rounded-xl">
                  <Users className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">Section D: Parent / Guardian Details</h2>
                  <p className="text-xs text-slate-400">Authorized parent or guardian contact verification</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                    Parent / Guardian Full Name *
                  </label>
                  <input
                    type="text"
                    value={guardianName}
                    onChange={(e) => setGuardianName(e.target.value)}
                    placeholder="e.g. S. Ramanathan"
                    required
                    className="w-full px-3.5 py-2.5 bg-slate-900/60 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                    Relationship *
                  </label>
                  <select
                    value={guardianRelationship}
                    onChange={(e) => setGuardianRelationship(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-900/60 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="Father">Father</option>
                    <option value="Mother">Mother</option>
                    <option value="Local Guardian">Local Guardian</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                    Parent Contact Number *
                  </label>
                  <input
                    type="tel"
                    value={guardianPhone}
                    onChange={(e) => setGuardianPhone(e.target.value)}
                    placeholder="e.g. 9840123456"
                    required
                    className="w-full px-3.5 py-2.5 bg-slate-900/60 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* ── SECTION E: Residential Address ───────────────────────────── */}
            <div className="pt-8 border-t border-slate-700/80">
              <div className="flex items-center space-x-3 mb-6 pb-4 border-b border-slate-700/80">
                <div className="p-2.5 bg-rose-600/20 text-rose-400 rounded-xl">
                  <MapPin className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">Section E: Residential Address</h2>
                  <p className="text-xs text-slate-400">Permanent residence for official college records</p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                    Permanent Address Line 1 *
                  </label>
                  <input
                    type="text"
                    value={permanentAddress}
                    onChange={(e) => setPermanentAddress(e.target.value)}
                    placeholder="House / Door No., Street, Area"
                    required
                    className="w-full px-3.5 py-2.5 bg-slate-900/60 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                      City / Town *
                    </label>
                    <input
                      type="text"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder="e.g. Chennai"
                      required
                      className="w-full px-3.5 py-2.5 bg-slate-900/60 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                      District
                    </label>
                    <input
                      type="text"
                      value={district}
                      onChange={(e) => setDistrict(e.target.value)}
                      placeholder="e.g. Kanchipuram"
                      className="w-full px-3.5 py-2.5 bg-slate-900/60 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                      State *
                    </label>
                    <input
                      type="text"
                      value={state}
                      onChange={(e) => setState(e.target.value)}
                      placeholder="e.g. Tamil Nadu"
                      required
                      className="w-full px-3.5 py-2.5 bg-slate-900/60 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                      Postal Code
                    </label>
                    <input
                      type="text"
                      value={postalCode}
                      onChange={(e) => setPostalCode(e.target.value)}
                      placeholder="e.g. 600001"
                      className="w-full px-3.5 py-2.5 bg-slate-900/60 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Submit Action inside Single Card */}
            <div className="pt-6 border-t border-slate-700/80">
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-emerald-600 hover:from-blue-500 hover:to-emerald-500 text-white font-bold text-base shadow-xl shadow-blue-600/25 flex items-center justify-center space-x-2 transition-all duration-200 disabled:opacity-60 cursor-pointer"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span>Submitting to Supabase Database...</span>
                  </>
                ) : (
                  <>
                    <span>Submit Profile for Administrator Approval</span>
                    <ArrowRight className="h-5 w-5" />
                  </>
                )}
              </button>
            </div>

          </form>
        </div>

      </div>
    </div>
  );
};

export default StudentCompleteProfile;
