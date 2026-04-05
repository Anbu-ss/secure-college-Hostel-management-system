import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { UserPlus, User, Mail, Lock, Building, Hash, AlertCircle, BookOpen, GraduationCap, ArrowLeft } from 'lucide-react';

const DEPARTMENTS = ['IT', 'CSE', 'ECE', 'EEE', 'MECH', 'AIML', 'AIDS', 'CIVIL'];

const Register = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'Student',
    registerNumber: '',
    block: '',
    roomNumber: '',
    department: ''
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setIsLoading(true);
    try {
      await axios.post('/api/auth/register', formData);
      setSuccess('Account created successfully! Redirecting to login...');
      setTimeout(() => navigate('/login'), 1500);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to register. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const isStudent = formData.role === 'Student';
  const needsDept  = ['Student', 'Staff', 'HOD'].includes(formData.role);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <div className="bg-white p-3 rounded-full shadow-md">
            <UserPlus className="h-10 w-10 text-blue-600" />
          </div>
        </div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">Create an Account</h2>
        <p className="mt-2 text-center text-sm text-gray-500">Secure Hostel Management System</p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow-lg sm:rounded-xl sm:px-10 relative">
          <Link to="/" className="inline-flex items-center text-sm font-medium text-blue-600 hover:text-blue-800 mb-6 transition-colors">
            <ArrowLeft className="h-4 w-4 mr-1.5" />
            Back to portal selection
          </Link>

          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg flex items-center">
              <AlertCircle className="h-5 w-5 mr-2 flex-shrink-0" />
              <span className="text-sm">{error}</span>
            </div>
          )}
          {success && (
            <div className="mb-4 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm font-medium">
              ✅ {success}
            </div>
          )}

          <form className="space-y-4" onSubmit={handleSubmit}>

            {/* Full Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700">Full Name</label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User className="h-5 w-5 text-gray-400" />
                </div>
                <input type="text" name="name" required
                  className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 sm:text-sm"
                  value={formData.name} onChange={handleChange} placeholder="Your full name" />
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-gray-700">Email address</label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-gray-400" />
                </div>
                <input type="email" name="email" required
                  className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 sm:text-sm"
                  value={formData.email} onChange={handleChange} placeholder="you@example.com" />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-gray-700">Password</label>
              <div className="mt-1 relative rounded-md shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <input type="password" name="password" required
                  className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 sm:text-sm"
                  value={formData.password} onChange={handleChange} placeholder="••••••••" />
              </div>
            </div>

            {/* Role selector */}
            <div>
              <label className="block text-sm font-medium text-gray-700">Role</label>
              <select name="role" value={formData.role} onChange={handleChange}
                className="mt-1 block w-full pl-3 pr-10 py-2 text-sm border border-gray-300 focus:ring-2 focus:ring-blue-500 rounded-md">
                <option value="Student">Student</option>
                <option value="Staff">Staff (Tutor)</option>
                <option value="HOD">HOD</option>
                <option value="Warden">Warden</option>
                <option value="Security">Security</option>
              </select>
            </div>

            {/* Department — shown for Student, Staff, HOD */}
            {needsDept && (
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Department
                  {!isStudent && <span className="ml-1 text-xs text-blue-600">(your assigned department)</span>}
                </label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <BookOpen className="h-5 w-5 text-gray-400" />
                  </div>
                  <select name="department" value={formData.department} onChange={handleChange} required
                    className="block w-full pl-10 pr-3 py-2 text-sm border border-gray-300 focus:ring-2 focus:ring-blue-500 rounded-md">
                    <option value="">Select department...</option>
                    {DEPARTMENTS.map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
                {!isStudent && (
                  <p className="mt-1 text-xs text-gray-400">
                    You will only see requests from {formData.department || 'your'} department students.
                  </p>
                )}
              </div>
            )}

            {/* Student-only fields */}
            {isStudent && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Register Number</label>
                  <div className="mt-1 relative rounded-md shadow-sm">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Hash className="h-5 w-5 text-gray-400" />
                    </div>
                    <input type="text" name="registerNumber" required
                      className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 sm:text-sm"
                      value={formData.registerNumber} onChange={handleChange} placeholder="e.g. 824521104001" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Block</label>
                    <div className="mt-1 relative rounded-md shadow-sm">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Building className="h-5 w-5 text-gray-400" />
                      </div>
                      <input type="text" name="block" required
                        className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 sm:text-sm"
                        value={formData.block} onChange={handleChange} placeholder="A / B / C" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Room No.</label>
                    <input type="text" name="roomNumber" required
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 sm:text-sm"
                      value={formData.roomNumber} onChange={handleChange} placeholder="101" />
                  </div>
                </div>
              </>
            )}

            <button type="submit" disabled={isLoading}
              className={`w-full flex justify-center py-2.5 px-4 border border-transparent rounded-md shadow-sm text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 mt-2 ${isLoading ? 'opacity-60 cursor-not-allowed' : ''}`}>
              {isLoading ? 'Creating account...' : 'Create Account'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              Already have an account?{' '}
              <Link to="/login" className="font-semibold text-blue-600 hover:text-blue-500">Sign in</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Register;
