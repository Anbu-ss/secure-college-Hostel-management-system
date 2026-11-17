import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Layout from '../../shared/components/Layout';
import { 
  User, 
  BookOpen, 
  MapPin, 
  ShieldCheck, 
  Users, 
  Home, 
  CheckCircle, 
  AlertCircle, 
  Save, 
  Loader2, 
  Lock,
  Sparkles,
  Phone,
  Mail,
  Calendar
} from 'lucide-react';

const StudentProfile = () => {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null); // { type: 'success' | 'error', text: '' }

  // Editable Form State
  const [formData, setFormData] = useState({
    dateOfBirth: '',
    personalEmail: '',
    phoneNumber: '',
    gender: 'MALE',
    permanentAddress: '',
    currentAddress: '',
    city: '',
    district: '',
    state: '',
    postalCode: '',
    guardianName: '',
    guardianRelationship: 'Father',
    guardianPhone: '',
    emergencyContact: '',
    parentPhone: ''
  });

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/students/profile');
      const p = res.data.profile;
      setProfile(p);
      setFormData({
        dateOfBirth: p.dateOfBirth || '',
        personalEmail: p.personalEmail || '',
        phoneNumber: p.phoneNumber || '',
        gender: p.gender || 'MALE',
        permanentAddress: p.permanentAddress || '',
        currentAddress: p.currentAddress || '',
        city: p.city || '',
        district: p.district || '',
        state: p.state || '',
        postalCode: p.postalCode || '',
        guardianName: p.guardianName || '',
        guardianRelationship: p.guardianRelationship || 'Father',
        guardianPhone: p.guardianPhone || p.parentPhone || '',
        emergencyContact: p.emergencyContact || '',
        parentPhone: p.parentPhone || ''
      });
    } catch (err) {
      setMsg({ type: 'error', text: err.response?.data?.message || 'Failed to load profile.' });
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMsg(null);

    try {
      const res = await axios.put('/api/students/profile', formData);
      setMsg({ type: 'success', text: res.data.message || 'Profile successfully saved!' });
      if (res.data.profileCompletion !== undefined) {
        setProfile(prev => ({ ...prev, profileCompletion: res.data.profileCompletion }));
      }
    } catch (err) {
      setMsg({ type: 'error', text: err.response?.data?.message || 'Failed to save profile changes.' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex h-96 items-center justify-center">
          <div className="flex flex-col items-center space-y-2">
            <Loader2 className="h-8 w-8 text-blue-600 animate-spin" />
            <p className="text-xs text-slate-500 font-medium">Loading your student profile...</p>
          </div>
        </div>
      </Layout>
    );
  }

  const completion = profile?.profileCompletion || 25;

  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-6 pb-12">
        
        {/* Top Header & Completion Bar */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-xs border border-slate-100">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-2xl font-bold text-slate-900">{profile?.studentName}</h1>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
                  {profile?.accountStatus || 'ACTIVE'}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Register Number: <strong className="text-slate-700 font-mono">{profile?.registerNumber}</strong> • {profile?.department}
              </p>
            </div>

            {/* Profile Completion Meter */}
            <div className="md:w-64 bg-slate-50 border border-slate-200/80 p-3.5 rounded-2xl">
              <div className="flex items-center justify-between text-xs font-bold mb-1.5">
                <span className="text-slate-600">Profile Completion</span>
                <span className={completion === 100 ? 'text-emerald-600' : 'text-blue-600'}>
                  {completion}%
                </span>
              </div>
              <div className="w-full h-2.5 bg-slate-200 rounded-full overflow-hidden">
                <div 
                  className={`h-full transition-all duration-500 ${completion === 100 ? 'bg-emerald-500' : 'bg-gradient-to-r from-blue-600 to-indigo-600'}`}
                  style={{ width: `${completion}%` }}
                />
              </div>
              <p className="text-[10px] text-slate-400 mt-1">
                {completion === 100 ? '✨ Profile 100% complete!' : 'Fill in personal & address details to complete.'}
              </p>
            </div>
          </div>
        </div>

        {/* Message banner */}
        {msg && (
          <div className={`p-4 rounded-2xl flex items-center space-x-3 text-xs font-medium animate-fadeIn ${
            msg.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-rose-50 text-rose-800 border border-rose-200'
          }`}>
            {msg.type === 'success' ? <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0" /> : <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />}
            <span>{msg.text}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">

          {/* ── SECTION A: Academic Information (READ ONLY) ────────────────── */}
          <div className="bg-white rounded-3xl p-6 sm:p-7 shadow-xs border border-slate-100 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                  <BookOpen className="h-4 w-4" />
                </div>
                <h2 className="text-sm font-bold text-slate-900">Section A: Academic Record</h2>
              </div>
              <span className="inline-flex items-center text-[11px] font-semibold text-slate-400 bg-slate-100 px-2.5 py-0.5 rounded-full">
                <Lock className="h-3 w-3 mr-1" />
                Institutional (Read-Only)
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  Register Number
                </label>
                <div className="px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-800">
                  {profile?.registerNumber}
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  Full Student Name
                </label>
                <div className="px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800">
                  {profile?.studentName}
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  Department
                </label>
                <div className="px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800">
                  {profile?.department}
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  Academic Year
                </label>
                <div className="px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800">
                  {profile?.academicYear || '2023-2027'}
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  Year of Study
                </label>
                <div className="px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800">
                  Year {profile?.yearOfStudy || 1}
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  College Email
                </label>
                <div className="px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 truncate">
                  {profile?.collegeEmail || profile?.email}
                </div>
              </div>
            </div>
          </div>

          {/* ── SECTION B: Personal Information (EDITABLE) ─────────────────── */}
          <div className="bg-white rounded-3xl p-6 sm:p-7 shadow-xs border border-slate-100 space-y-4">
            <div className="flex items-center space-x-2 border-b border-slate-100 pb-3">
              <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                <User className="h-4 w-4" />
              </div>
              <h2 className="text-sm font-bold text-slate-900">Section B: Personal Information</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Date of Birth</label>
                <input
                  type="date"
                  name="dateOfBirth"
                  value={formData.dateOfBirth}
                  onChange={handleInputChange}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Student Mobile Number</label>
                <input
                  type="tel"
                  name="phoneNumber"
                  placeholder="e.g. 9876543210"
                  value={formData.phoneNumber}
                  onChange={handleInputChange}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Personal Email</label>
                <input
                  type="email"
                  name="personalEmail"
                  placeholder="personal@gmail.com"
                  value={formData.personalEmail}
                  onChange={handleInputChange}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Gender</label>
                <select
                  name="gender"
                  value={formData.gender}
                  onChange={handleInputChange}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
                >
                  <option value="MALE">Male</option>
                  <option value="FEMALE">Female</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>
            </div>
          </div>

          {/* ── SECTION C: Address Information (EDITABLE) ──────────────────── */}
          <div className="bg-white rounded-3xl p-6 sm:p-7 shadow-xs border border-slate-100 space-y-4">
            <div className="flex items-center space-x-2 border-b border-slate-100 pb-3">
              <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
                <MapPin className="h-4 w-4" />
              </div>
              <h2 className="text-sm font-bold text-slate-900">Section C: Address Details</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Permanent Residential Address</label>
                <textarea
                  name="permanentAddress"
                  rows="2"
                  placeholder="Door No, Street name, Village/Town"
                  value={formData.permanentAddress}
                  onChange={handleInputChange}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Current / Communication Address</label>
                <textarea
                  name="currentAddress"
                  rows="2"
                  placeholder="Leave blank if same as permanent"
                  value={formData.currentAddress}
                  onChange={handleInputChange}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">City / Town</label>
                <input
                  type="text"
                  name="city"
                  placeholder="Chennai"
                  value={formData.city}
                  onChange={handleInputChange}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">District</label>
                <input
                  type="text"
                  name="district"
                  placeholder="Kanchipuram"
                  value={formData.district}
                  onChange={handleInputChange}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">State</label>
                <input
                  type="text"
                  name="state"
                  placeholder="Tamil Nadu"
                  value={formData.state}
                  onChange={handleInputChange}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Postal PIN Code</label>
                <input
                  type="text"
                  name="postalCode"
                  placeholder="600123"
                  value={formData.postalCode}
                  onChange={handleInputChange}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
                />
              </div>
            </div>
          </div>

          {/* ── SECTION D: Parent / Guardian Information (EDITABLE) ─────────── */}
          <div className="bg-white rounded-3xl p-6 sm:p-7 shadow-xs border border-slate-100 space-y-4">
            <div className="flex items-center space-x-2 border-b border-slate-100 pb-3">
              <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
                <Users className="h-4 w-4" />
              </div>
              <h2 className="text-sm font-bold text-slate-900">Section D: Parent / Guardian & Emergency Contact</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Parent / Guardian Name</label>
                <input
                  type="text"
                  name="guardianName"
                  placeholder="Guardian's Name"
                  value={formData.guardianName}
                  onChange={handleInputChange}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Relationship</label>
                <select
                  name="guardianRelationship"
                  value={formData.guardianRelationship}
                  onChange={handleInputChange}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
                >
                  <option value="Father">Father</option>
                  <option value="Mother">Mother</option>
                  <option value="Guardian">Legal Guardian</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Parent Contact Number</label>
                <input
                  type="tel"
                  name="guardianPhone"
                  placeholder="Primary parent phone"
                  value={formData.guardianPhone}
                  onChange={handleInputChange}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Emergency SOS Phone</label>
                <input
                  type="tel"
                  name="emergencyContact"
                  placeholder="Alternate emergency phone"
                  value={formData.emergencyContact}
                  onChange={handleInputChange}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
                />
              </div>
            </div>
          </div>

          {/* ── SECTION E: Hostel Allocation (READ-ONLY) ───────────────────── */}
          <div className="bg-white rounded-3xl p-6 sm:p-7 shadow-xs border border-slate-100 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <div className="p-2 bg-purple-50 text-purple-600 rounded-xl">
                  <Home className="h-4 w-4" />
                </div>
                <h2 className="text-sm font-bold text-slate-900">Section E: Hostel Accommodation</h2>
              </div>
              <span className="inline-flex items-center text-[11px] font-semibold text-slate-400 bg-slate-100 px-2.5 py-0.5 rounded-full">
                <Lock className="h-3 w-3 mr-1" />
                Warden Controlled
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  Hostel Block
                </label>
                <div className="px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800">
                  Block {profile?.block || 'TBD'}
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  Allocated Room Number
                </label>
                <div className="px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800">
                  Room {profile?.roomNumber || 'TBD'}
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  Hostel Admission Status
                </label>
                <div className="px-3.5 py-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-semibold text-emerald-800">
                  Resident Hosteler
                </div>
              </div>
            </div>
          </div>

          {/* Submit Action Bar */}
          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center space-x-2 py-3 px-6 rounded-2xl text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-500/20 active:scale-[0.99] transition disabled:opacity-60"
            >
              {saving ? (
                <>
                  <Loader2 className="animate-spin h-4 w-4 text-white" />
                  <span>Saving Updates...</span>
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  <span>Save Profile Details</span>
                </>
              )}
            </button>
          </div>

        </form>
      </div>
    </Layout>
  );
};

export default StudentProfile;

