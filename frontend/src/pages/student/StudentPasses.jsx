import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Layout from '../../components/Layout';
import StatusBadge from '../../components/StatusBadge';
import { format } from 'date-fns';
import { QRCodeSVG } from 'qrcode.react';
import { FileText, X, Clock, CheckCircle, Circle, Home, MapPin, AlertTriangle, RotateCcw, Download } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { downloadGatePassPDF } from '../../utils/GatePassPDF';

// Step tracker for Local and Home outpasses
const StatusTracker = ({ request }) => {
  const isLocal = request.PassType === 'Local';

  const localSteps = [
    { label: 'Submitted', done: true },
    { label: 'Warden Review', done: ['WardenApproved', 'Rejected'].includes(request.Status) },
    { label: 'Approved', done: request.Status === 'WardenApproved' },
  ];

  const homeSteps = [
    { label: 'Submitted', done: true },
    { label: 'Staff', done: ['StaffApproved', 'HODApproved', 'WardenApproved'].includes(request.Status), rejected: request.Status === 'Rejected' && request.RejectedByRole === 'Staff' },
    { label: 'HOD', done: ['HODApproved', 'WardenApproved'].includes(request.Status), rejected: request.Status === 'Rejected' && request.RejectedByRole === 'HOD' },
    { label: 'Warden', done: request.Status === 'WardenApproved', rejected: request.Status === 'Rejected' && (request.RejectedByRole === 'Warden' || !request.RejectedByRole) },
  ];

  const steps = isLocal ? localSteps : homeSteps;
  const rejected = request.Status === 'Rejected';
  const color = isLocal ? 'blue' : 'purple';

  return (
    <div className="mt-3">
      <div className="flex items-center space-x-1">
        {steps.map((step, i) => (
          <React.Fragment key={step.label}>
            <div className="flex flex-col items-center">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold
                ${step.rejected ? 'bg-red-500 text-white animate-pulse' :
                  step.done ? `bg-${color}-500 text-white` : 'bg-gray-200 text-gray-400'}`}>
                {step.rejected ? '!' : step.done ? '✓' : i + 1}
              </div>
              <span className="text-xs text-gray-500 mt-1 whitespace-nowrap">{step.label}</span>
            </div>
            {i < steps.length - 1 && (
              <div className={`flex-1 h-0.5 mb-4 ${step.done ? `bg-${color}-400` : 'bg-gray-200'}`} style={{ minWidth: 16 }} />
            )}
          </React.Fragment>
        ))}
      </div>
      {rejected && <p className="text-xs text-red-500 mt-1 font-medium">Request Rejected</p>}
    </div>
  );
};

const StudentPasses = () => {
  const [requests, setRequests] = useState([]);
  const [passes, setPasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('requests');
  const [selectedPass, setSelectedPass] = useState(null);
  const navigate = useNavigate();

  useEffect(() => { fetchData(); }, [activeTab]);

  const fetchData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'requests') {
        const res = await axios.get('/api/requests/my-requests');
        setRequests(res.data);
      } else {
        const res = await axios.get('/api/gatepass/my-passes');
        setPasses(res.data);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getPassTypeStyle = (type) =>
    type === 'Local'
      ? { bg: 'bg-blue-100', text: 'text-blue-700', icon: <MapPin className="h-3 w-3" /> }
      : { bg: 'bg-purple-100', text: 'text-purple-700', icon: <Home className="h-3 w-3" /> };

  const isExpiringSoon = (validUntil) => {
    if (!validUntil) return false;
    const minsLeft = (new Date(validUntil) - new Date()) / 60000;
    return minsLeft > 0 && minsLeft < 30;
  };

  const isExpired = (validUntil) => validUntil && new Date() > new Date(validUntil);

  return (
    <Layout>
      <div className="max-w-5xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">My Outpasses</h1>

        {/* Tabs */}
        <div className="border-b border-gray-200 mb-6 font-medium">
          <nav className="-mb-px flex space-x-8">
            {['requests', 'passes'].map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`${activeTab === tab
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
              >
                {tab === 'requests' ? 'My Requests' : 'Approved Passes'}
              </button>
            ))}
          </nav>
        </div>

        <div className="bg-white shadow overflow-hidden sm:rounded-md">
          {loading ? (
            <div className="p-6 text-center text-gray-500">Loading...</div>
          ) : (
            <ul className="divide-y divide-gray-200">
              {activeTab === 'requests' ? (
                requests.length === 0 ? (
                  <div className="p-6 text-center text-gray-500">No requests found.</div>
                ) : requests.map((req) => {
                  const style = getPassTypeStyle(req.PassType || 'Local');
                  return (
                    <li key={req.ID || req.id} className="p-4 hover:bg-gray-50">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-1">
                            <span className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-xs font-medium ${style.bg} ${style.text}`}>
                              {style.icon}<span>{req.PassType || 'Local'}</span>
                            </span>
                            <p className="text-sm font-medium text-gray-900">{req.Destination}</p>
                          </div>
                          <p className="text-sm text-gray-500">{req.Reason}</p>
                          <StatusTracker request={req} />
                        </div>
                          <div className="flex flex-col items-end ml-4">
                            <StatusBadge status={req.Status} />
                            {req.HolidayWindowName && (
                              <div className="mt-1 flex items-center text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                                <span className="mr-1">⚡</span> Holiday Mode: {req.HolidayWindowName}
                              </div>
                            )}
                            {req.Status === 'Rejected' && (
                              <button
                                onClick={() => navigate(`/student/apply?reapplyFrom=${req.ID || req.id}`)}
                                className="mt-2 flex items-center text-xs font-semibold text-blue-600 hover:text-blue-800 transition-colors"
                              >
                                <RotateCcw className="h-3 w-3 mr-1" /> Re-apply
                              </button>
                            )}
                            <p className="text-xs text-gray-500 mt-2">
                              <Clock className="inline h-3 w-3 mr-1" />
                              Out: {format(new Date(req.OutTime), 'PPp')}
                            </p>
                          </div>
                        </div>
                        {req.Status === 'Rejected' && (req.RejectionRemarks || req.WardenRemarks) && (
                          <div className="mt-4 bg-red-50 border border-red-100 rounded-xl p-4 flex items-start animate-in fade-in slide-in-from-top-2 duration-300">
                            <AlertTriangle className="h-5 w-5 text-red-500 mr-3 flex-shrink-0 mt-0.5" />
                            <div>
                              <p className="text-xs font-bold text-red-800 uppercase tracking-wider mb-1">
                                Rejected by {req.RejectedByRole || 'Warden'} {req.RejectedByName && `(${req.RejectedByName})`}
                              </p>
                              <p className="text-sm text-red-700 leading-relaxed font-medium">"{req.RejectionRemarks || req.WardenRemarks}"</p>
                              {req.RejectedAt && (
                                <p className="text-[10px] text-red-400 mt-2 font-semibold">Rejected on {format(new Date(req.RejectedAt), 'PPp')}</p>
                              )}
                            </div>
                          </div>
                        )}
                      </li>
                  );
                })
              ) : (
                passes.length === 0 ? (
                  <div className="p-6 text-center text-gray-500">No approved passes yet.</div>
                ) : passes.map((pass) => {
                  const style = getPassTypeStyle(pass.PassType || 'Local');
                  const expired = isExpired(pass.ValidUntil);
                  const expiringSoon = isExpiringSoon(pass.ValidUntil);
                  const terminated = pass.PassStatus === 'TERMINATED';

                  return (
                    <li key={pass.PassID} className="p-4 hover:bg-gray-50 flex items-center justify-between">
                      <div className="flex items-center flex-1">
                        <FileText className="h-8 w-8 text-blue-500 flex-shrink-0" />
                        <div className="ml-4 flex-1">
                          <div className="flex items-center space-x-2">
                            <span className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-xs font-medium ${style.bg} ${style.text}`}>
                              {style.icon}<span>{pass.PassType || 'Local'}</span>
                            </span>
                            <h4 className="text-sm font-bold text-gray-900">{pass.Destination}</h4>
                          </div>
                          <p className="text-sm text-gray-500 mt-0.5">Return by: {format(new Date(pass.ExpectedReturnTime), 'PPp')}</p>
                          {pass.PassType === 'Local' && pass.ValidUntil && (
                            <p className={`text-xs mt-1 font-semibold ${expired ? 'text-red-500' : expiringSoon ? 'text-orange-500' : 'text-green-600'}`}>
                              {expired ? '❌ Expired' : expiringSoon ? `⚠️ Expiring soon — ${Math.round((new Date(pass.ValidUntil) - new Date()) / 60000)} min left` : `✅ Valid until ${format(new Date(pass.ValidUntil), 'p')}`}
                            </p>
                          )}
                          {pass.PassType === 'Home' && (
                            <p className={`text-xs mt-1 font-semibold ${terminated ? 'text-gray-400' : 'text-purple-600'}`}>
                              {terminated ? '🔒 Pass Closed (Returned)' : '🟣 Active — stays open until you return'}
                            </p>
                          )}
                        </div>
                      </div>
                      {!terminated && (
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => setSelectedPass(pass)}
                            className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-blue-700 bg-blue-100 hover:bg-blue-200"
                          >
                            View QR
                          </button>
                          <button
                            onClick={() => {
                              // Ensure we have student profile info for the PDF
                              const studentInfo = JSON.parse(localStorage.getItem('user')) || {};
                              downloadGatePassPDF({ ...pass, Name: studentInfo.name, RegisterNumber: studentInfo.registerNumber });
                            }}
                            className="inline-flex items-center px-3 py-2 border border-blue-200 text-sm font-medium rounded-md text-blue-600 bg-white hover:bg-blue-50"
                            title="Download PDF Backup"
                          >
                            <Download className="h-4 w-4" />
                          </button>
                        </div>
                      )}
                    </li>
                  );
                })
              )}
            </ul>
          )}
        </div>

        {/* QR Modal */}
        {selectedPass && (
          <div className="fixed z-10 inset-0 overflow-y-auto">
            <div className="flex items-center justify-center min-h-screen p-4">
              <div className="fixed inset-0 bg-gray-500 bg-opacity-75" onClick={() => setSelectedPass(null)} />
              <div className="relative bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 z-20">
                <button onClick={() => setSelectedPass(null)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
                  <X className="h-6 w-6" />
                </button>

                <div className="text-center mb-4">
                  <h3 className="text-lg font-bold text-gray-900">Digital Gate Pass</h3>
                  <span className={`inline-flex items-center space-x-1 px-2 py-1 rounded-full text-xs font-medium mt-1 ${
                    selectedPass.PassType === 'Local' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                  }`}>
                    {selectedPass.PassType === 'Local' ? <MapPin className="h-3 w-3" /> : <Home className="h-3 w-3" />}
                    <span>{selectedPass.PassType} Outpass</span>
                  </span>
                </div>

                <div className="flex justify-center bg-gray-50 p-4 rounded-xl border border-gray-200 mb-4">
                  <QRCodeSVG value={selectedPass.QRCodeHash} size={200} />
                </div>

                <div className="text-xs text-gray-600 space-y-1 mb-4">
                  <div className="flex justify-between"><span className="font-medium">Destination:</span><span>{selectedPass.Destination}</span></div>
                  <div className="flex justify-between"><span className="font-medium">Return by:</span><span>{format(new Date(selectedPass.ExpectedReturnTime), 'PPp')}</span></div>
                  {selectedPass.PassType === 'Local' && selectedPass.ValidUntil && (
                    <div className="flex justify-between">
                      <span className="font-medium">Valid until:</span>
                      <span className={isExpired(selectedPass.ValidUntil) ? 'text-red-500' : 'text-green-600'}>
                        {format(new Date(selectedPass.ValidUntil), 'PPp')}
                      </span>
                    </div>
                  )}
                  {selectedPass.PassType === 'Home' && (
                    <div className="flex items-center text-purple-600 mt-1">
                      <AlertTriangle className="h-3 w-3 mr-1" />
                      <span>Pass stays active until Entry scan at gate</span>
                    </div>
                  )}
                </div>

                <div className="space-y-3 mt-6">
                  <p className="text-xs text-gray-400 text-center">Show this QR code to Security at the gate.</p>
                  <div className="border-t border-gray-100 pt-4">
                    <button
                      onClick={() => {
                        const studentInfo = JSON.parse(localStorage.getItem('user')) || {};
                        downloadGatePassPDF({ ...selectedPass, Name: studentInfo.name, RegisterNumber: studentInfo.registerNumber });
                      }}
                      className="w-full flex items-center justify-center space-x-2 py-2.5 bg-blue-50 text-blue-700 rounded-xl font-semibold text-sm hover:bg-blue-100 transition-colors border border-blue-100"
                    >
                      <Download className="h-4 w-4" />
                      <span>Download PDF Backup</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default StudentPasses;
