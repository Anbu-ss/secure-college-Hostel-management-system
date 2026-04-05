import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import Layout from '../../components/Layout';
import { Send, AlertCircle, Home, MapPin, Info, BookOpen, User, Building, Hash, Clock } from 'lucide-react';
import { format } from 'date-fns';

const ApplyPass = () => {
  const [formData, setFormData] = useState({
    destination: '',
    reason: '',
    outTime: '',
    expectedReturnTime: '',
    passType: 'Local'
  });

  const [profile, setProfile]   = useState(null);   // student's DB profile
  const [profileLoading, setProfileLoading] = useState(true);

  const [error, setError]       = useState('');
  const [success, setSuccess]   = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const reapplyId = searchParams.get('reapplyFrom');
  const [previousRequest, setPreviousRequest] = useState(null);

  useEffect(() => {
    axios.get('/api/requests/my-profile')
      .then(res => setProfile(res.data))
      .catch(() => setProfile(null))
      .finally(() => setProfileLoading(false));

    if (reapplyId) {
      axios.get('/api/requests/my-requests')
        .then(res => {
          const original = res.data.find(r => (r.ID || r.id) == reapplyId);
          if (original) {
            if (original.Status === 'Rejected') {
              setPreviousRequest(original);
              setFormData({
                destination: original.Destination || original.destination,
                reason: original.Reason || original.reason,
                outTime: (original.OutTime || original.outTime) ? (original.OutTime || original.outTime).slice(0, 16).replace(' ', 'T') : '',
                expectedReturnTime: (original.ExpectedReturnTime || original.expectedReturnTime) ? (original.ExpectedReturnTime || original.expectedReturnTime).slice(0, 16).replace(' ', 'T') : '',
                passType: original.PassType || original.passType
              });
            } else {
              setError(`Request #${reapplyId} is not in Rejected state.`);
            }
          } else {
            setError(`Could not find request #${reapplyId}.`);
          }
        })
        .catch(err => {
          console.error("Error fetching original request:", err);
          setError("Failed to load previous request details.");
        });
    }
  }, [reapplyId]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setIsLoading(true);
    try {
      await axios.post('/api/requests/apply', formData);
      setSuccess('Gate pass request submitted successfully!');
      setTimeout(() => navigate('/student/passes'), 2000);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to submit request.');
    } finally {
      setIsLoading(false);
    }
  };

  const isLocal = formData.passType === 'Local';

  // Department colour map
  const deptColors = {
    IT: 'bg-blue-100 text-blue-700 border-blue-200',
    CSE: 'bg-indigo-100 text-indigo-700 border-indigo-200',
    ECE: 'bg-purple-100 text-purple-700 border-purple-200',
    EEE: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    MECH: 'bg-orange-100 text-orange-700 border-orange-200',
    AIML: 'bg-green-100 text-green-700 border-green-200',
    AIDS: 'bg-teal-100 text-teal-700 border-teal-200',
    CIVIL: 'bg-red-100 text-red-700 border-red-200',
  };
  const deptColor = profile?.Department ? (deptColors[profile.Department] || 'bg-gray-100 text-gray-700 border-gray-200') : '';

  return (
    <Layout>
      <div className="max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          {reapplyId ? 'Correct & Re-apply Outpass' : 'Apply for Outpass'}
        </h1>
        <p className="text-sm text-gray-500 mb-6">
          {reapplyId ? 'Adjust the details below based on the Warden\'s feedback.' : 'Choose your pass type carefully — it determines the approval workflow.'}
        </p>

        {/* ── Previous Rejection Context ── */}
        {previousRequest && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-2xl p-5 shadow-sm animate-in fade-in slide-in-from-top-4 duration-500">
            <div className="flex items-start">
              <AlertCircle className="h-6 w-6 text-red-500 mr-3 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="text-sm font-bold text-red-900 uppercase tracking-wide">
                  Feedback from {previousRequest.RejectedByRole || previousRequest.rejectedByRole || 'Warden'} {(previousRequest.RejectedByName || previousRequest.rejectedByName) && `(${previousRequest.RejectedByName || previousRequest.rejectedByName})`}
                </h3>
                <p className="text-sm text-red-700 mt-1 font-medium leading-relaxed italic">
                  "{previousRequest.RejectionRemarks || previousRequest.rejectionRemarks || previousRequest.WardenRemarks || previousRequest.wardenRemarks}"
                </p>
                {(previousRequest.RejectedAt || previousRequest.rejectedAt) && (
                  <div className="mt-3 flex items-center text-xs text-red-400 font-semibold">
                    <Clock className="h-3.5 w-3.5 mr-1" />
                    Rejected on {format(new Date(previousRequest.RejectedAt || previousRequest.rejectedAt), 'PPp')}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── Student Profile Card (auto-detected) ── */}
        {profileLoading ? (
          <div className="bg-gray-50 rounded-xl border border-gray-200 px-4 py-3 mb-5 text-sm text-gray-400 animate-pulse">
            Loading your profile...
          </div>
        ) : profile ? (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-5 py-4 mb-5">
            <p className="text-xs text-gray-400 font-medium mb-3 flex items-center">
              <User className="h-3.5 w-3.5 mr-1" />Your Profile (auto-detected from your account)
            </p>
            <div className="flex flex-wrap items-center gap-3">
              {/* Name */}
              <div className="flex items-center space-x-1.5">
                <User className="h-4 w-4 text-gray-400" />
                <span className="text-sm font-semibold text-gray-800">{profile.Name}</span>
              </div>

              {/* Reg No */}
              <div className="flex items-center space-x-1.5">
                <Hash className="h-4 w-4 text-gray-400" />
                <span className="text-sm text-gray-600">{profile.RegisterNumber}</span>
              </div>

              {/* Room */}
              <div className="flex items-center space-x-1.5">
                <Building className="h-4 w-4 text-gray-400" />
                <span className="text-sm text-gray-600">Block {profile.Block} — Room {profile.RoomNumber}</span>
              </div>

              {/* Department badge */}
              {profile.Department ? (
                <div className={`flex items-center space-x-1.5 px-3 py-1 rounded-full border text-xs font-bold ${deptColor}`}>
                  <BookOpen className="h-3.5 w-3.5" />
                  <span>{profile.Department} Department</span>
                </div>
              ) : (
                <div className="flex items-center space-x-1.5 px-3 py-1 rounded-full border border-red-200 bg-red-50 text-red-600 text-xs font-medium">
                  <AlertCircle className="h-3.5 w-3.5" />
                  <span>No department set — contact admin</span>
                </div>
              )}
            </div>

            {/* Approval route info */}
            {!isLocal && profile.Department && (
              <div className="mt-3 pt-3 border-t border-gray-100 text-xs text-gray-500">
                Your Home Outpass will be reviewed by:
                <span className="ml-1 font-semibold text-purple-700">
                  {profile.Department} Staff Tutor → {profile.Department} HOD → Warden
                </span>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-red-50 rounded-xl border border-red-200 px-4 py-3 mb-5 flex items-center text-sm text-red-600">
            <AlertCircle className="h-4 w-4 mr-2" />
            Could not load your profile. Make sure you have a registered student account.
          </div>
        )}

        {/* Pass Type Selector */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <button
            type="button"
            onClick={() => setFormData({ ...formData, passType: 'Local' })}
            className={`flex flex-col items-start p-4 rounded-xl border-2 transition-all ${
              isLocal ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white hover:border-gray-300'
            }`}
          >
            <div className="flex items-center mb-2">
              <MapPin className={`h-5 w-5 mr-2 ${isLocal ? 'text-blue-600' : 'text-gray-400'}`} />
              <span className={`font-semibold text-sm ${isLocal ? 'text-blue-700' : 'text-gray-700'}`}>Local Outpass</span>
              {isLocal && <span className="ml-2 text-xs bg-blue-600 text-white px-2 py-0.5 rounded-full">Selected</span>}
            </div>
            <p className="text-xs text-gray-500 text-left">Short trips (2–6 hours). Warden approval only. Valid for <strong>24 hours</strong> after approval.</p>
            <div className="mt-2 text-xs text-blue-600 font-medium">Student → Warden ✓</div>
          </button>

          <button
            type="button"
            onClick={() => setFormData({ ...formData, passType: 'Home' })}
            className={`flex flex-col items-start p-4 rounded-xl border-2 transition-all ${
              !isLocal ? 'border-purple-500 bg-purple-50' : 'border-gray-200 bg-white hover:border-gray-300'
            }`}
          >
            <div className="flex items-center mb-2">
              <Home className={`h-5 w-5 mr-2 ${!isLocal ? 'text-purple-600' : 'text-gray-400'}`} />
              <span className={`font-semibold text-sm ${!isLocal ? 'text-purple-700' : 'text-gray-700'}`}>Home Outpass</span>
              {!isLocal && <span className="ml-2 text-xs bg-purple-600 text-white px-2 py-0.5 rounded-full">Selected</span>}
            </div>
            <p className="text-xs text-gray-500 text-left">Weekend or holiday trips. Multi-level approval. Pass stays <strong>active for entire trip</strong>.</p>
            <div className="mt-2 text-xs text-purple-600 font-medium">Student → Staff → HOD → Warden ✓</div>
          </button>
        </div>

        {/* Info Banner */}
        <div className={`mb-6 p-3 rounded-lg flex items-start text-xs ${isLocal ? 'bg-blue-50 border border-blue-200 text-blue-700' : 'bg-purple-50 border border-purple-200 text-purple-700'}`}>
          <Info className="h-4 w-4 mr-2 flex-shrink-0 mt-0.5" />
          {isLocal
            ? 'Local Outpass: Once the Warden approves, your QR code is generated. It expires automatically after 24 hours.'
            : 'Home Outpass: Your request goes through Staff Tutor → HOD → Warden. The QR code stays active until you return and scan in at the gate.'}
        </div>

        <div className="bg-white shadow rounded-lg p-6">
          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md flex items-center">
              <AlertCircle className="h-5 w-5 mr-2" />
              <span className="text-sm">{error}</span>
            </div>
          )}
          {success && (
            <div className="mb-4 bg-green-50 border border-green-200 text-green-600 px-4 py-3 rounded-md">
              <span className="text-sm font-medium">{success}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700">Destination</label>
              <input
                type="text" name="destination" required
                className="mt-1 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md py-2 px-3 border focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                value={formData.destination} onChange={handleChange}
                placeholder={isLocal ? 'e.g. Nearby Market, Gym' : 'e.g. Home — Chennai'}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Reason for leaving</label>
              <textarea
                name="reason" required rows={3}
                className="mt-1 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md py-2 px-3 border focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                value={formData.reason} onChange={handleChange}
                placeholder={isLocal ? 'e.g. Buying groceries, medical appointment' : 'e.g. Family function, semester break'}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700">Exit Time</label>
                <input
                  type="datetime-local" name="outTime" required
                  className="mt-1 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md py-2 px-3 border focus:ring-2 focus:ring-blue-500"
                  value={formData.outTime} onChange={handleChange}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Expected Return Time</label>
                <input
                  type="datetime-local" name="expectedReturnTime" required
                  className="mt-1 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md py-2 px-3 border focus:ring-2 focus:ring-blue-500"
                  value={formData.expectedReturnTime} onChange={handleChange}
                />
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="submit" disabled={isLoading}
                className={`inline-flex justify-center py-2 px-6 border border-transparent shadow-sm text-sm font-medium rounded-md text-white ${
                  isLocal ? 'bg-blue-600 hover:bg-blue-700' : 'bg-purple-600 hover:bg-purple-700'
                } focus:outline-none focus:ring-2 focus:ring-offset-2 ${isLoading ? 'opacity-70 cursor-not-allowed' : ''}`}
              >
                <Send className="mr-2 h-5 w-5" />
                {isLoading ? 'Submitting...' : `Submit ${formData.passType} Outpass`}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Layout>
  );
};

export default ApplyPass;
