import React, { useState } from 'react';
import Layout from '../../components/Layout';
import axios from 'axios';
import { UserPlus, Copy, CheckCircle, RefreshCw, Eye, EyeOff, AlertCircle, BookOpen } from 'lucide-react';

const DEPARTMENTS = ['IT', 'CSE', 'ECE', 'EEE', 'MECH', 'AIML', 'AIDS', 'CIVIL'];
const ADMIN_ROLES = ['Staff', 'HOD', 'Warden', 'Security'];

// Password generator: min 10 chars, has uppercase, lowercase, number, special char
const generatePassword = (name = '') => {
  const upper   = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower   = 'abcdefghjkmnpqrstuvwxyz';
  const digits  = '23456789';
  const special = '@#$!%*?&';
  const seed = name.charAt(0).toUpperCase() || 'A';
  const rand = (str) => str[Math.floor(Math.random() * str.length)];
  const body = Array.from({ length: 6 }, () =>
    rand(upper + lower + digits)
  ).join('');
  return `${seed}${rand(digits)}${rand(special)}${body}${rand(digits)}`;
};

// Email generator: firstname.role@collegename.edu  (lowercased, no spaces)
const generateEmail = (name, role, collegeName) => {
  const clean = (s) => s.toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, '');
  const firstName = clean(name.split(' ')[0]);
  const college = clean(collegeName);
  const roleTag = role.toLowerCase();
  return `${firstName}.${roleTag}@${college}.edu`;
};

const CreateAdminUser = () => {
  const [form, setForm] = useState({
    name: '', dob: '', role: 'Staff', department: '', collegeName: 'DMICE'
  });
  const [generated, setGenerated] = useState(null);
  const [copied, setCopied]       = useState('');
  const [showPwd, setShowPwd]     = useState(false);
  const [loading, setLoading]     = useState(false);
  const [success, setSuccess]     = useState('');
  const [error, setError]         = useState('');

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setGenerated(null);
    setSuccess('');
    setError('');
  };

  const handleGenerate = () => {
    if (!form.name || !form.role || !form.collegeName) {
      setError('Please fill in Name, Role, and College Name first.');
      return;
    }
    if (['Staff', 'HOD'].includes(form.role) && !form.department) {
      setError('Department is required for Staff and HOD roles.');
      return;
    }
    setError('');
    const email    = generateEmail(form.name, form.role, form.collegeName);
    const password = generatePassword(form.name);
    const birthYear = form.dob ? new Date(form.dob).getFullYear() : '';
    setGenerated({ email, password, birthYear });
  };

  const handleCopy = (text, label) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(''), 2000);
  };

  const handleCreate = async () => {
    if (!generated) return;
    setLoading(true);
    setSuccess('');
    setError('');
    try {
      await axios.post('/api/auth/create-admin', {
        name:       form.name,
        dob:        form.dob,
        role:       form.role,
        department: ['Staff', 'HOD'].includes(form.role) ? form.department : null,
        collegeName:form.collegeName,
        email:      generated.email,
        password:   generated.password,
      });
      setSuccess(`✅ Account created! Share credentials with ${form.name} securely.`);
      setGenerated(null);
      setForm({ name: '', dob: '', role: 'Staff', department: '', collegeName: form.collegeName });
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create account. Try again.');
    } finally {
      setLoading(false);
    }
  };

  const needsDept = ['Staff', 'HOD'].includes(form.role);

  return (
    <Layout>
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Create Admin Account</h1>
        <p className="text-sm text-gray-500 mb-6">
          Generate institutional credentials for Staff, HOD, Warden, or Security personnel.
        </p>

        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-start">
            <AlertCircle className="h-5 w-5 mr-2 flex-shrink-0 mt-0.5" />
            <span className="text-sm">{error}</span>
          </div>
        )}
        {success && (
          <div className="mb-4 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-xl">
            <p className="text-sm font-medium">{success}</p>
          </div>
        )}

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-5">
          <div className="grid grid-cols-2 gap-4">
            {/* Full Name */}
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
              <input type="text" name="name" required
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500"
                placeholder="e.g. Dr. Anbu Kumar" value={form.name} onChange={handleChange} />
            </div>

            {/* DOB */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date of Birth</label>
              <input type="date" name="dob"
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500"
                value={form.dob} onChange={handleChange} />
              <p className="text-xs text-gray-400 mt-1">Used for identity reference only</p>
            </div>

            {/* College Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">College Name / Code</label>
              <input type="text" name="collegeName"
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500"
                placeholder="e.g. DMICE" value={form.collegeName} onChange={handleChange} />
              <p className="text-xs text-gray-400 mt-1">Used to form the email domain</p>
            </div>

            {/* Role */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">College Position</label>
              <select name="role"
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500"
                value={form.role} onChange={handleChange}>
                {ADMIN_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>

            {/* Department — only for Staff/HOD */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Department {!needsDept && <span className="text-gray-400 font-normal">(not required)</span>}
              </label>
              <div className="relative">
                <BookOpen className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                <select name="department" disabled={!needsDept}
                  className={`w-full pl-9 pr-3 py-2.5 border rounded-xl text-sm focus:ring-2 focus:ring-blue-500 ${!needsDept ? 'bg-gray-50 text-gray-400 border-gray-200' : 'border-gray-300'}`}
                  value={form.department} onChange={handleChange}>
                  <option value="">Select department...</option>
                  {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Generate Button */}
          <button onClick={handleGenerate}
            className="w-full flex items-center justify-center py-2.5 px-4 rounded-xl text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700">
            <RefreshCw className="h-4 w-4 mr-2" />Generate Credentials
          </button>
        </div>

        {/* Generated Credentials Card */}
        {generated && (
          <div className="mt-5 bg-white rounded-2xl border-2 border-blue-200 shadow-md p-6">
            <div className="flex items-center mb-4">
              <UserPlus className="h-5 w-5 text-blue-600 mr-2" />
              <h3 className="text-base font-bold text-gray-900">Generated Credentials for {form.name}</h3>
            </div>

            <div className="space-y-3 mb-5">
              {/* Email */}
              <div>
                <label className="block text-xs text-gray-500 font-medium mb-1">Email Address (Login ID)</label>
                <div className="flex items-center bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5">
                  <span className="flex-1 text-sm font-mono text-gray-800">{generated.email}</span>
                  <button onClick={() => handleCopy(generated.email, 'email')} className="text-blue-500 hover:text-blue-700 ml-2">
                    {copied === 'email' ? <CheckCircle className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="block text-xs text-gray-500 font-medium mb-1">
                  Auto-Generated Password
                  <span className="ml-2 text-green-600">✓ Contains A-Z, a-z, 0-9, special chars</span>
                </label>
                <div className="flex items-center bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5">
                  <span className="flex-1 text-sm font-mono text-gray-800">
                    {showPwd ? generated.password : '•'.repeat(generated.password.length)}
                  </span>
                  <button onClick={() => setShowPwd(!showPwd)} className="text-gray-400 hover:text-gray-600 mr-2">
                    {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                  <button onClick={() => handleCopy(generated.password, 'pwd')} className="text-blue-500 hover:text-blue-700">
                    {copied === 'pwd' ? <CheckCircle className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Summary */}
              <div className="bg-blue-50 rounded-xl p-3 text-xs text-blue-700 space-y-0.5">
                <p><span className="font-semibold">Role:</span> {form.role}</p>
                {form.department && <p><span className="font-semibold">Department:</span> {form.department}</p>}
                <p><span className="font-semibold">College:</span> {form.collegeName}</p>
              </div>
            </div>

            <div className="flex gap-3">
              <button onClick={handleGenerate}
                className="flex-1 flex items-center justify-center py-2.5 border border-gray-300 rounded-xl text-sm text-gray-600 hover:bg-gray-50">
                <RefreshCw className="h-4 w-4 mr-1.5" />Regenerate
              </button>
              <button onClick={handleCreate} disabled={loading}
                className={`flex-1 flex items-center justify-center py-2.5 rounded-xl text-sm font-semibold text-white bg-green-600 hover:bg-green-700 ${loading ? 'opacity-60' : ''}`}>
                <UserPlus className="h-4 w-4 mr-1.5" />
                {loading ? 'Creating...' : 'Create Account'}
              </button>
            </div>

            <p className="text-xs text-amber-600 bg-amber-50 rounded-lg p-2 mt-3 border border-amber-200">
              ⚠️ Share these credentials directly with the person. They should change their password on first login.
            </p>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default CreateAdminUser;
